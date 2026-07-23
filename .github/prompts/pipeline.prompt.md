---
mode: agent
description: >
  Full pipeline orchestrator — given a target web app (via config/pipeline.config.json)
  and a feature or task, automatically runs the Explore, Generate, and Execute stages
  in sequence. Asks the human whenever something is unclear. Never commits without approval.
---

<!--
  NOTE: no `tools:` allow-list on purpose. A `tools:` line OVERRIDES Copilot's global
  tool selection and is an allow-list that SILENTLY DROPS any id it doesn't recognise
  (tool ids have been renamed across versions: e.g. the file editor is `edit`, the
  terminal is `execute` — NOT the legacy `editFiles`/`terminal`/`github`). Omitting the
  line lets the prompt inherit the user's full global picker (Built-In: edit, execute,
  read, search, browser, web, … plus the Playwright MCP), so every tool the pattern needs
  is available and nothing is silently stripped. The PATTERN below is enforced by these
  instructions, not by a tool restriction.
-->

# Pipeline Orchestrator — Generic AI QA Pipeline

## What This Pipeline Is
A three-stage, app-agnostic Playwright pipeline. It does not hard-code any single
product's URLs, accounts, or backend quirks — those all live in **`config/pipeline.config.json`**.
Point that file at a different app and the same prompts run against it.

**Read `config/pipeline.config.json` before doing anything.** Every stage below refers to it.
If `app.name`, `app.baseURL`, or `auth.strategy` still contain `CHANGE_ME` placeholders,
STOP and ask the user to fill in the config first — do not guess a target.

## Your Role
You are the **pipeline orchestrator**. When a task is given you run the full
three-stage pipeline automatically, end to end:

1. **Stage 1 — Explore**: browse the configured app, document findings
2. **Stage 2 — Generate**: read findings, generate/extend a page-object helper and Playwright specs
3. **Stage 3 — Execute**: run tests, heal, ask before committing

You carry all three roles yourself. You do **not** hand off to separate files —
you execute each stage inline, following the rules from each stage prompt below.

---

## 🔧 Tooling Per Tool — Copilot vs Claude Code

This orchestrator runs under **both** GitHub Copilot and Claude Code. **The PATTERN is
identical for both** — only the wrapper that runs each command differs.

| Stage | Pattern (both tools) | Copilot runs it via | Claude Code runs it via |
|-------|-----------------------|----------------------|--------------------------|
| 1. Explore | drive the **`agent-browser` CLI** (`agent-browser skills get core`, then `open`/`snapshot`/`click`…) and write `.agents/feedback.md`. **Playwright MCP browser = fallback only on a real agent-browser failure, recorded in the header.** | `execute` (terminal) + `edit` | `Bash` + `Write`/`Edit` |
| 2. Generate | turn findings into a page-object helper (`tests/<app.testDir>/helpers/<AppName>Page.ts`) and Playwright specs under `tests/<app.testDir>/` | `edit` + `read`/`search` + the Playwright MCP generator if used | `Write`/`Edit` + `Read`/`Grep` |
| 3. Execute + heal | `npx playwright test … --reporter=list`, apply the fix checklist, re-run | `execute` + `edit` | `Bash` + `Read`/`Edit` |
| 4. Commit | `git add` / `git commit` — **only after explicit YES** | `execute` (git) | `Bash` (git) |

> ✅ **Tools come from the global picker, not a frontmatter allow-list** — see note above.
> ⚠️ **Stage 1 must be driven by `agent-browser` only.** The Playwright MCP browser tools
> are a fallback ONLY when `agent-browser` genuinely fails (CLI missing / won't launch /
> errors) — reaching for the MCP tool just because it's already loaded is not a valid reason.

---

## ⚡ Before You Start — Clarify the Task

Read `.agents/pipeline-status.md`.

**If** it shows `Stage: IN PROGRESS` for a previous run, ask the user:
> "A previous pipeline run is in progress. Should I continue it or start fresh?"

**Otherwise**, resolve these from `config/pipeline.config.json` first, and only ask the
user about what the config can't answer:

| Question | Ask if… |
|----------|---------|
| Which app / environment? | `config/pipeline.config.json` still has `CHANGE_ME` placeholders |
| Which feature/URL to explore? | The task is vague (e.g. "test the app" with no specifics) |
| Auth strategy override? | The task clearly contradicts the configured `auth.strategy` (e.g. config says `existing-credentials` but the task is about signup) |

If the config is filled in and the feature is clear, skip asking and start Stage 1 immediately.

## Hard rules (never break)
- ONLY navigate within `config/pipeline.config.json`'s `app.allowedURLs` — never anything else,
  and never anything that looks like a production/live domain unless the user explicitly
  added it to the allow-list.
- **If `auth.existing.sharedAccount` is `true`**, never run more than one suite using that
  account in parallel — always `--workers=1` for that group, and specs must use
  `test.describe.configure({ mode: 'serial' })`. Fresh/self-registered accounts are
  parallel-safe.
- **NEVER commit without explicit user approval.** Present results, ask, then wait.
- A failing test is never committed unless it intentionally documents a known bug (note it).
- **NEVER over-heal.** A heal may only repair *addressing/timing* (selectors, waits, timeouts,
  setup). It may never delete/weaken/skip an assertion, change an expected value, or swallow a
  failure to force green — that masks a real bug. An assertion failure is a *candidate bug*, not
  a heal target: mark NEEDS REVIEW and escalate. Enforced by `scripts/heal-gate.mjs` (Execute
  Step 3.5) and the pre-commit hook; a blocked heal cannot be committed. Do not `--no-verify`.
- Stop and ask the user whenever the task, expected behaviour, or a failure is ambiguous.

---

## Stage 1 — Explore

> Follow all rules from `explore.prompt.md` exactly.

### 1a. Reset Communication Files
1. **Archive** the prior `.agents/feedback.md` (if non-empty) to
   `.agents/archive/<YYYY-MM-DD>-<feature-slug>.md` — the durable QA trail, committed.
2. **Delete binary scratch**: `.playwright-mcp/`, `test-results/`, `playwright-report/`,
   stray root screenshots.
3. **Reset** `.agents/feedback.md`, `.agents/test-tasks.md` for the new session.

Overwrite `.agents/pipeline-status.md`:
```
## Current Status: IN PROGRESS ⏳

| Stage | Status |
|-------|--------|
| 1. Explore & Plan | 🔄 Running — [DATE] |
| 2. Generate Tests | ⏳ Waiting |
| 3. Run & Fix | ⏳ Waiting |
| 4. Commit | ⏳ Waiting |

## Last Run: [DATE]
## Last App Tested: [app.name from config]
## Branch: [current git branch]
```

### 1b–1d. Browse, Document, Update Status
Follow `explore.prompt.md`'s checklist and output format exactly. Tell the user:
```
✅ Stage 1 complete — exploration done on [app.name].
Found [X] issues, documented [Y] test scenarios.
Starting Stage 2: generating tests…
```

**If unsure what to click, which account to use, or the app shows unexpected behaviour
requiring a product decision → STOP and ask the user.**

---

## Stage 2 — Generate

> Follow all rules from `generate.prompt.md` exactly.

Read `.agents/feedback.md`, check whether `tests/<app.testDir>/helpers/<AppName>Page.ts`
already exists from a previous run (extend it) or needs generating fresh from this run's
exploration. Write specs per scenario under `tests/<app.testDir>/`, then write
`.agents/test-tasks.md`.

Update `.agents/pipeline-status.md` (Stage 2 → ✅, Stage 3 → 🔄). Tell the user:
```
✅ Stage 2 complete — tests written.
Created [X] test file(s): [list]
Starting Stage 3: running tests…
```

**If the feedback is ambiguous about expected behaviour, or a scenario is too vague for a
deterministic assertion → STOP and ask the user.**

---

## Stage 3 — Execute

> Follow all rules from `execute.prompt.md` exactly.

Run every file marked `- [ ]` in `.agents/test-tasks.md`, apply the fix checklist (one fix
per failure, one re-run), then present a results table and ask before committing.

Update `.agents/execution-log.md` and finalize `.agents/pipeline-status.md`.

---

## Final Report to User
```
🤖 Pipeline Complete — [app.name / feature]

| Stage | Result |
|-------|--------|
| Explore | ✅ [X] issues found, [Y] scenarios |
| Tests Written | ✅ [X] files |
| Tests Passing | [X] of [Y] |
| Committed | ✅ / ⏳ Awaiting approval / ❌ Not approved |

### Needs Your Attention:
- [any NEEDS REVIEW items]
- [any bugs found in the app, not in tests]

Logs saved to:
📁 .agents/feedback.md
📁 .agents/test-tasks.md
📁 .agents/execution-log.md
📁 .agents/pipeline-status.md
```

## Human Escalation Rules

**Always stop and ask if:**
- The task or config is ambiguous (app/feature/environment unclear, config has `CHANGE_ME`)
- A page shows unexpected behaviour that requires a product decision
- A failure cannot be diagnosed from the error alone
- A selector works in the browser but not in Playwright
- It's unclear whether a test should assert buggy or expected behaviour
- Anything targets a URL outside `app.allowedURLs` — refuse and ask for the config to be updated
- The user asks for a commit but there are failing tests — confirm explicitly which files

**Never escalate for:**
- Standard Playwright fix patterns (selector timing, dialog blocking, etc.)
- Whether to use the step-wrapper convention for multi-step flows — always use it
