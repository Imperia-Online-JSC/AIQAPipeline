// heal-gate — the mechanical over-heal guardrail.
//
// WHY THIS EXISTS
// AI test "healing" is legitimate when it repairs *addressing* (a selector/role/name moved,
// a wait was needed). It is NOT legitimate when it changes what a test *asserts* — deleting an
// expect, weakening a matcher, changing an expected value, skipping the test, or swallowing the
// error. That second class doesn't fix a test, it masks a real bug and turns the suite into a
// green-light generator. This script is a DETERMINISTIC check (no LLM, no browser) that runs at
// the commit gate / pre-commit and BLOCKS when a heal touched the "oracle" half of a test.
//
// THE CORE RULE
// Every assertion is `expect(LOCATOR).MATCHER(EXPECTED)`.
//   - LOCATOR (the addressing)     -> may change freely  (locator repair)
//   - MATCHER + EXPECTED (oracle)  -> may NOT change      (the test's intent)
// So we compare the *oracle signatures* of each spec before/after a heal. A locator repair leaves
// every oracle signature intact and passes; an over-heal removes or alters one and is blocked.
//
// BASELINE ("before") resolution, in order:
//   1. .agents/heal-baseline/<path>   -> snapshot the Generate stage took before Execute healed
//                                        (protects freshly-generated specs within a single run)
//   2. git HEAD:<path>                -> the committed version (protects regressions to real tests)
//   3. none                           -> brand-new file, nothing to compare -> nothing to weaken -> PASS
//
// FAST-PATH: if "before" === "after" (no heal happened, or heal didn't touch this file) the gate
// is a no-op and returns instantly — zero cost on the happy path.
//
// v1 is intentionally a line/set heuristic, biased to FLAG-ON-DOUBT: a wrongly-flagged legit heal
// costs a human ~30s to eyeball; a missed over-heal ships a broken feature as green. When unsure,
// we block. (A future v2 can swap the heuristic for a TS AST for fewer false positives.)
//
// Usage:
//   node scripts/heal-gate.mjs                 # check every tests/**/*.spec.ts that differs from baseline
//   node scripts/heal-gate.mjs <file> [<file>] # check specific spec files
//   node scripts/heal-gate.mjs --staged        # check staged spec files (used by the pre-commit hook)
// Exit code 0 = clean, 1 = over-heal detected (block), 2 = usage/internal error.

import { readFileSync, existsSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const BASELINE_DIR = join(repoRoot, '.agents', 'heal-baseline');

// ---- git helpers (best-effort; the gate still works without git) --------------------------------
function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}
function gitShowHead(relPath) {
  try {
    return git(['show', `HEAD:${relPath}`]);
  } catch {
    return null; // not tracked at HEAD (brand-new file)
  }
}

// ---- resolve which files to check ---------------------------------------------------------------
function repoRel(p) {
  return relative(repoRoot, resolve(repoRoot, p)).split('\\').join('/');
}
function listCandidateSpecs() {
  // Anything under tests/ ending in .spec.ts that differs from its baseline.
  let tracked = [];
  try {
    tracked = git(['ls-files', 'tests/**/*.spec.ts']).split('\n').filter(Boolean);
  } catch { /* ignore */ }
  let changed = [];
  try {
    changed = git(['diff', '--name-only', 'HEAD', '--', 'tests/**/*.spec.ts']).split('\n').filter(Boolean);
  } catch { /* ignore */ }
  let untracked = [];
  try {
    untracked = git(['ls-files', '--others', '--exclude-standard', 'tests/**/*.spec.ts']).split('\n').filter(Boolean);
  } catch { /* ignore */ }
  // Also anything with a snapshot baseline (same-run generated specs).
  let snapshotted = [];
  try {
    snapshotted = git(['ls-files', '--others', '--cached', '.agents/heal-baseline/**/*.spec.ts'])
      .split('\n').filter(Boolean).map((p) => p.replace('.agents/heal-baseline/', 'tests/').replace(/^tests\/tests\//, 'tests/'));
  } catch { /* ignore */ }
  return [...new Set([...changed, ...untracked, ...snapshotted, ...tracked])];
}
function listStagedSpecs() {
  try {
    return git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '--', 'tests/**/*.spec.ts'])
      .split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function resolveBaseline(relPath) {
  const snap = join(BASELINE_DIR, relPath);
  if (existsSync(snap)) return { source: 'snapshot', text: readFileSync(snap, 'utf8') };
  const head = gitShowHead(relPath);
  if (head != null) return { source: 'HEAD', text: head };
  return { source: 'none', text: null };
}

// ---- the classifier -----------------------------------------------------------------------------

// Matcher tokens that mark the "oracle" of an assertion. Includes an optional leading `.not`
// so that a negation flip changes the signature and is caught.
const MATCHER_RE =
  /(\.not)?\.(toBe[A-Za-z]*|toEqual|toStrictEqual|toContain[A-Za-z]*|toMatch[A-Za-z]*|toHave[A-Za-z]*|toThrow[A-Za-z]*|toBeCloseTo|toBeGreaterThan[A-Za-z]*|toBeLessThan[A-Za-z]*|resolves|rejects)\s*\(/;

// Ways to neuter a test WITHOUT editing an expect line — these are violations if a heal INTRODUCES
// them (present in "after", absent in "before").
const NEUTER_INTRODUCED_RE =
  /(test|it)\s*\.\s*(skip|fixme|only)\b|\bdescribe\s*\.\s*(skip|only)\b|\.only\s*\(|(^|[^.\w])(xit|xdescribe)\s*\(|\btest\.step\b.*\/\/\s*removed/;

// Swallowing constructs — introducing these around assertions hides failures.
const SWALLOW_INTRODUCED_RE = /\bcatch\s*(\(|\{)|\.catch\s*\(\s*(\(\s*\)|[A-Za-z_$][\w$]*)\s*=>/;

const isAssertionLine = (line) => /\bexpect\s*\(/.test(line);

// Extract a normalized "oracle signature" from an assertion line: the matcher + everything after it
// (the expected value), whitespace-collapsed. Returns null if no matcher is on this line
// (e.g. a multi-line expect) — callers then fall back to flag-on-doubt.
function oracleSignature(line) {
  const m = MATCHER_RE.exec(line);
  if (!m) return null;
  return line.slice(m.index).replace(/\s+/g, ' ').replace(/;\s*$/, '').trim();
}

// Count of top-level assertions, used as a backstop for wholesale removals.
function countExpects(text) {
  return (text.match(/\bexpect\s*\(/g) || []).length;
}

function classify(beforeText, afterText) {
  const violations = [];
  const beforeLines = beforeText.split('\n');
  const afterLines = afterText.split('\n');

  const afterSignatures = new Set();
  const afterAssertionLinesMultiline = [];
  for (const l of afterLines) {
    if (!isAssertionLine(l)) continue;
    const sig = oracleSignature(l);
    if (sig) afterSignatures.add(sig);
    else afterAssertionLinesMultiline.push(l.trim());
  }

  // (1)+(2)+(3)+(4) — every oracle present BEFORE must still be present AFTER, unchanged.
  // Because we compare the matcher+expected signature (not the locator), a pure locator repair
  // keeps the signature identical and passes; a changed/removed matcher or expected value fails.
  for (const l of beforeLines) {
    if (!isAssertionLine(l)) continue;
    const sig = oracleSignature(l);
    if (sig) {
      if (!afterSignatures.has(sig)) {
        violations.push({
          kind: 'assertion-removed-or-weakened',
          detail: `oracle no longer present: ${sig}`,
          line: l.trim(),
        });
      }
    } else {
      // Multi-line expect on the "before" side — can't extract a signature. Flag-on-doubt only if
      // an identical trimmed line isn't present after.
      const trimmed = l.trim();
      if (!afterAssertionLinesMultiline.includes(trimmed) && !afterLines.some((a) => a.trim() === trimmed)) {
        violations.push({
          kind: 'assertion-changed-multiline',
          detail: 'multi-line assertion changed (could not isolate oracle — flagged for review)',
          line: trimmed,
        });
      }
    }
  }

  // Backstop: fewer expects after than before => an assertion was dropped.
  const beforeCount = countExpects(beforeText);
  const afterCount = countExpects(afterText);
  if (afterCount < beforeCount) {
    violations.push({
      kind: 'assertion-count-dropped',
      detail: `expect() count fell ${beforeCount} -> ${afterCount}`,
      line: '',
    });
  }

  // (5) neutering constructs introduced by the heal
  const beforeJoined = beforeText;
  for (const l of afterLines) {
    if (NEUTER_INTRODUCED_RE.test(l) && !NEUTER_INTRODUCED_RE.test(beforeJoined)) {
      violations.push({ kind: 'test-neutered', detail: 'skip/only/fixme introduced', line: l.trim() });
    }
  }
  // A blunt but reliable check for skip/only anywhere new:
  const skipBefore = (beforeText.match(/\.(skip|only|fixme)\b/g) || []).length;
  const skipAfter = (afterText.match(/\.(skip|only|fixme)\b/g) || []).length;
  if (skipAfter > skipBefore) {
    violations.push({ kind: 'test-neutered', detail: `skip/only/fixme count rose ${skipBefore} -> ${skipAfter}`, line: '' });
  }

  // (6) swallowing constructs introduced by the heal
  const catchBefore = (beforeText.match(SWALLOW_INTRODUCED_RE) || []).length;
  const catchAfter = (afterText.match(SWALLOW_INTRODUCED_RE) || []).length;
  const tryBefore = (beforeText.match(/\btry\s*\{/g) || []).length;
  const tryAfter = (afterText.match(/\btry\s*\{/g) || []).length;
  if (catchAfter > catchBefore || tryAfter > tryBefore) {
    violations.push({
      kind: 'error-swallowed',
      detail: `error-swallowing construct introduced (try ${tryBefore}->${tryAfter}, catch ${catchBefore}->${catchAfter})`,
      line: '',
    });
  }

  // De-dup by kind+detail so we don't spam the same finding twice.
  const seen = new Set();
  return violations.filter((v) => {
    const k = `${v.kind}::${v.detail}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---- runner -------------------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  let files;
  if (argv.includes('--staged')) {
    files = listStagedSpecs();
  } else if (argv.filter((a) => !a.startsWith('--')).length) {
    files = argv.filter((a) => !a.startsWith('--'));
  } else {
    files = listCandidateSpecs();
  }
  files = [...new Set(files.map(repoRel))].filter((f) => f.endsWith('.spec.ts'));

  if (!files.length) {
    console.log('heal-gate: no spec files to check — pass (no-op).');
    return 0;
  }

  const report = [];
  let blocked = false;

  for (const rel of files) {
    const abs = join(repoRoot, rel);
    if (!existsSync(abs)) continue; // deleted file — not a heal we gate here
    const afterText = readFileSync(abs, 'utf8');
    const baseline = resolveBaseline(rel);

    if (baseline.source === 'none') {
      report.push({ rel, status: 'skip', note: 'brand-new file, no baseline — nothing to weaken' });
      continue;
    }
    // FAST-PATH: unchanged since baseline => no heal touched it.
    if (baseline.text === afterText) {
      report.push({ rel, status: 'noop', note: `unchanged vs ${baseline.source}` });
      continue;
    }

    const violations = classify(baseline.text, afterText);
    if (violations.length) {
      blocked = true;
      report.push({ rel, status: 'BLOCK', baseline: baseline.source, violations });
    } else {
      report.push({ rel, status: 'ok', note: `healed (vs ${baseline.source}); assertions intact` });
    }
  }

  // ---- print report ----
  console.log('\n🩹  heal-gate — over-heal guardrail\n' + '─'.repeat(52));
  for (const r of report) {
    if (r.status === 'BLOCK') {
      console.log(`❌ ${r.rel}  (baseline: ${r.baseline})`);
      for (const v of r.violations) {
        console.log(`     • [${v.kind}] ${v.detail}`);
        if (v.line) console.log(`       ↳ ${v.line}`);
      }
    } else {
      const icon = r.status === 'ok' ? '✅' : r.status === 'noop' ? '➖' : '⏭️ ';
      console.log(`${icon} ${r.rel}  — ${r.note}`);
    }
  }
  console.log('─'.repeat(52));

  if (blocked) {
    console.log(
      '\n🛑 BLOCKED: a heal changed what a test ASSERTS (not just how it locates elements).\n' +
      '   This may be masking a real bug. Do NOT commit. A human must review whether the\n' +
      '   app genuinely changed (update the test intentionally) or the app is broken (file a bug).\n' +
      "   Legitimate locator/wait/timeout repairs never trip this gate.\n");
    return 1;
  }
  console.log('\n✅ CLEAN: no assertions were removed, weakened, skipped, or swallowed.\n');
  return 0;
}

// Exported for unit testing; only run the CLI when invoked directly.
export { classify, oracleSignature, countExpects };

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(main());
