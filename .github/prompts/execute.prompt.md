---
mode: agent
description: Execute stage — runs Playwright tests, fixes failures, asks before committing
---

<!-- No `tools:` line — inherit the global picker. This stage runs the terminal
     (`execute` in Copilot, `Bash` in Claude) for `npx playwright test` and `git`, and
     uses the file editor (`edit`/`Edit`) to heal failing tests. -->

# Execute Stage — Generic AI QA Pipeline

> **Pipeline note:** When invoked by `pipeline.prompt.md`, `.agents/test-tasks.md` is
> already written — skip straight to Step 2 (run tests). When done, update
> `.agents/pipeline-status.md` Stages 3 and 4 rows and give the final pipeline report.
>
> **Tooling — identical for both tools.** Runs `npx playwright test` and `git` through
> the terminal (`execute` in Copilot, `Bash` in Claude) and heals failing tests with the
> file editor (`edit`/`Edit`). Commit only after explicit user approval.

## Your Role
Run new Playwright tests, attempt to fix failures, ask the user before any git operation.
You NEVER commit without explicit user approval.

## Step 1 — Read The Task
READ `.agents/test-tasks.md`. Find ALL files marked `- [ ]` under "Files Created".

## Step 2 — Run Each Test File
```bash
npx playwright test tests/[filepath] --reporter=list
npx playwright test tests/[filepath] --project=target-chromium
npx playwright test tests/[filepath] --headed   # to watch it happen
```

**CRITICAL — shared account, never parallel.** Check `config/pipeline.config.json`'s
`auth.existing.sharedAccount`. If `true`, the backend allows only ONE active session for
that account — running more than one file that logs into it at the same time makes the
workers kick each other's session (login/HUD never loads). Run that group single-worker:
```bash
npx playwright test tests/[shared-account-dir]/ --project=target-chromium --workers=1
```
Fresh-account tests are immune and may run fully parallel. If a failure looks like a
login/session timeout and several shared-account files ran together, the fix is
`--workers=1`, NOT a selector/timeout edit.

## Step 3 — Handle Results

### If ALL Tests Pass ✅
1. Show the user the results summary.
2. ASK the user:
   ```
   ✅ All tests passing!

   Results:
   - [test name] ✅

   Should I commit these to git?
   Commit message will be:
   "test: add [feature] e2e tests from explore review"

   Reply YES to commit or NO to skip.
   ```
3. WAIT for user response. Only if YES, run the git commands.

### If Tests Fail ❌

**FIRST, classify the failure — this decides whether you may heal it at all:**
- **Locator / environment failure** (element not found, timeout, navigation, dialog/cookie
  block, session kick) → the test's *intent* is fine, only its *addressing* broke. Healable —
  work the checklist below.
- **Assertion failure** (the element was found, but its value/state/text is not what the test
  expected) → the app behaved differently than documented. This is a **candidate real bug**, NOT
  a heal target. Do NOT touch the assertion to make it pass. Mark **NEEDS REVIEW**, leave the
  test failing, and flag to the user as a possible regression.

**HARD RULE — LEGAL HEALS ONLY (never break):**
A heal may ONLY edit *addressing and timing*: selectors/locators, `waitForSelector`/
`waitForResponse`/waits, timeouts sourced from config, `goto`/navigation, and setup/imports.
A heal may **NEVER**:
- delete or comment out an `expect(...)` / test / step,
- change a matcher (`toBeVisible`→`toBeAttached`, tighten→loosen),
- change an expected value, or flip `.not.`,
- add `test.skip`/`test.fixme`/`.only`,
- wrap an assertion in `try/catch` or `.catch(() => {})` to swallow the failure.
The moment a fix would require any of the above, it is **not a heal — it's masking a bug.** Stop,
mark NEEDS REVIEW, and escalate. This is enforced mechanically by `scripts/heal-gate.mjs` (Step 3.5)
and the pre-commit hook; a heal that trips it cannot be committed.

Work through this checklist in order, applying ONE fix at a time:

**Fix 1 — Selector not found:**
```typescript
await page.waitForSelector('[selector]', { state: 'visible' });
```

**Fix 2 — Async/background response timing** (see `config.asyncPattern`):
```typescript
await Promise.all([
  page.waitForResponse(pipelineConfig.asyncPattern.urlGlob),
  page.click('[selector]'),
]);
```

**Fix 3 — Dialog blocking:**
```typescript
await page.keyboard.press('Escape');
```

**Fix 4 — Wrong URL / no baseURL:**
```typescript
await page.goto(pipelineConfig.app.baseURL + 'some/path');
```

**Fix 5 — Timeout too short:**
```typescript
test.setTimeout(pipelineConfig.timeouts.longFlow);
```

**Fix 6 — Cookie/consent banner blocking clicks:**
```typescript
await page.getByRole('button', { name: /accept|agree/i }).click({ timeout: 5000 }).catch(() => {});
```

**Fix 7 — Shared-account session kick** (login/session timeout when several files using
the shared account ran together):
```bash
npx playwright test tests/[dir]/ --project=target-chromium --workers=1
```
Do NOT edit selectors/timeouts for this one — it's a concurrency issue, not a code bug.

After each fix, re-run the test **once**.
If still failing after one fix attempt → mark as **NEEDS REVIEW**, do not commit, flag to user.

## Step 3.5 — Heal Gate (mechanical over-heal check) — REQUIRED before any commit ask

If you healed ANY spec this run, run the gate before presenting results for commit:
```bash
npm run heal-gate                 # checks every spec that differs from its baseline
# or target the healed files:  node scripts/heal-gate.mjs tests/<path>.spec.ts
```
- **Exit 0 / CLEAN** → heals were addressing/timing only; proceed to the commit ask.
- **Exit 1 / BLOCKED** → a heal changed an assertion (removed/weakened/skipped/swallowed). Do
  **NOT** proceed to commit. Revert that assertion to its baseline, re-diagnose as a possible
  real bug, and mark the file **NEEDS REVIEW**. The pre-commit hook enforces this independently,
  so a blocked heal cannot be committed even with approval — fix the heal, don't bypass the gate.

The gate is a no-op when nothing was healed, so a clean generate-and-pass run skips it instantly.

## Step 4 — Update Both Log Files

### Append to `.agents/execution-log.md`
```markdown
## Execution Log - [DATE]

| Test File | Project | Status | Action |
|-----------|---------|--------|--------|
| file.spec.ts | target-chromium | ✅ PASS | Committed |
| file.spec.ts | target-chromium | ❌ FAIL | Needs Review |

### Fixes Applied
- [filename] - [what was changed and why]

### Needs Human Review
- [filename] - [exact error and reason fix was not possible]
```

### Write to `.agents/pipeline-status.md`
```markdown
## Pipeline Status - [DATE]

| Stage | Status |
|-------|--------|
| Explore | ✅ Complete |
| Tests Written | ✅ Complete |
| Tests Passing | [X] of [Y] |
| Commit Approved | ⏳ Waiting / ✅ Done / ❌ Not approved |

- App tested: [app.name]
- Branch: [current branch name]
- Tests committed: [list of committed files or none]
- Next action: [what needs human attention]
```

## Step 5 — Final Report To User
```
🤖 Execution Complete

| File | Status | Action |
|------|--------|--------|
| [file] | ✅ | Committed |
| [file] | ❌ | Needs Review |

Fixes Applied: [X]
Committed: [X] files
Needs Your Attention: [X] files

Logs saved to:
📁 .agents/execution-log.md
📁 .agents/pipeline-status.md
```
