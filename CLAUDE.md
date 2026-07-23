# CLAUDE.md — Generic AI QA Pipeline

## Project Overview
A generic, app-agnostic Playwright test pipeline. It explores, generates tests for, and
executes tests against **whatever web app is configured in `config/pipeline.config.json`**
— it has no hard-coded target of its own. See `README.md` for the full picture.

## Key Commands
```bash
npx playwright test                            # Run all generated tests
npx playwright test --project=target-chromium  # Run against the configured app
npx playwright test --headed                   # Run with visible browser
npx playwright show-report                      # Open last HTML report
```

## Before Doing Anything In This Repo
Read `config/pipeline.config.json`. If `app.name`, `app.baseURL`, or `auth.strategy` still
say `CHANGE_ME`, stop and ask the user which app to point the pipeline at before running
any stage — do not guess a target or invent a URL.

## Environments & Projects (`playwright.config.ts`)
- **target-chromium / target-firefox / target-webkit**: point at `config/pipeline.config.json`'s
  `app.baseURL` — this is the one config value that drives every project's `baseURL`.
- **Mobile Chrome** (Pixel 5) / **Mobile Safari** (iPhone 13): touch-enabled mobile projects,
  same `baseURL`.
- Because `baseURL` is always set from config, specs should use relative paths
  (`page.goto('some/path')`), never a hard-coded absolute URL.

## Page Object: `tests/<app.testDir>/helpers/<AppName>Page.ts`
Each target gets its own folder under `tests/` (the slug comes from `app.testDir` in the
config), and that folder holds both the target's specs and its page object under
`helpers/`. Unlike a hand-maintained helper for one app, this file **does not exist until
the Generate stage creates it** from Explore-stage findings, then gets extended on later
runs. See `.github/prompts/generate.prompt.md` Step 2 for the generation rules (selector
priority: `getByRole` > `getByLabel`/`getByPlaceholder` > `data-testid` > CSS id, in that
order).

## Registration / Login Patterns
Driven entirely by `config/pipeline.config.json`'s `auth` block — see `README.md` for the
three strategies (`none` / `fresh-registration` / `existing-credentials`) and
`.github/prompts/generate.prompt.md` for the exact code patterns each one generates.

## Shared Account — Never Run In Parallel (if `auth.existing.sharedAccount: true`)
If the configured app only allows one active session per account, tests using that
account must not run concurrently with each other:
- Run that suite single-worker: `npx playwright test tests/<dir>/ --workers=1`.
- Each such spec file sets `test.describe.configure({ mode: 'serial' })` and uses the
  `timeouts.sharedAccount` value from the config.
- Fresh-account tests are immune and may run fully parallel.

## Step Wrapper Convention
Multi-step specs use an inline `executeStep` helper for timing and uniform logging (see
`.github/prompts/generate.prompt.md` Step 5). Log format:
`✅ Step name -> passed (3.21s)` / `❌ Step name -> failed after 3.21s: <message>`.

## Test Timeouts
Read from `config/pipeline.config.json`'s `timeouts` block (`simple`, `sharedAccount`,
`longFlow`) rather than hard-coded numbers in specs. There is no global timeout override
in `playwright.config.ts` — set per test via `test.setTimeout(...)`.

## Directory Conventions
- `tests/` — one folder per target app, plus the shared `_shared/` folder
- `tests/_shared/` — cross-target test infrastructure (`fixtures.ts`, `screen.ts`); shared by
  every target, never duplicated into a target folder
- `tests/<app.testDir>/` — everything for one target: its `*.spec.ts` files (directly inside,
  or in feature subfolders) and its page object under `helpers/<AppName>Page.ts`
- Each target folder is self-contained — adding or removing a target is one folder, with no
  cross-target coupling
- `config/pipeline.config.json` — the only file you edit to point at a new target app
  (`app.testDir` sets that target's folder slug)
- `.agents/` — run-to-run communication files; `.agents/archive/` is the durable, committed
  QA trail, the rest (`feedback.md`, `test-tasks.md`, `execution-log.md`) reset every run

---

## Agent Orchestration System

### How The Pipeline Works
Three stages run in sequence, all inline in one orchestrator (no separate agent hand-off):
1. **Explore** → browses the configured app, writes findings
2. **Generate** → reads findings, writes/extends the page object and tests
3. **Execute** → runs tests, fixes issues, asks before committing

### Shared Communication Files (`.agents/`)
- `.agents/feedback.md` — Explore stage writes here
- `.agents/test-tasks.md` — Generate stage writes here
- `.agents/execution-log.md` — Execute stage logs here
- `.agents/pipeline-status.md` — overall pipeline status

### Authoritative Prompts
The full stage-by-stage rules live in `.github/prompts/`:
- `pipeline.prompt.md` — orchestrator, source of truth for both Copilot and Claude Code
- `explore.prompt.md`, `generate.prompt.md`, `execute.prompt.md` — one per stage

Claude Code's entry point is `.claude/skills/pipeline/SKILL.md` (invoked as `/pipeline`),
which points back at `pipeline.prompt.md` rather than duplicating its rules.

### Pipeline Quick Reference
- Start full pipeline: "Explore `<feature>` then write and run tests" or `/pipeline`
- Individual stages: "Explore `<feature>`" / "Write tests from feedback" / "Run new tests"
- Check status: "Show pipeline status" → reads `.agents/pipeline-status.md`

### Hard Rules (never break)
- ONLY navigate within `config/pipeline.config.json`'s `app.allowedURLs` — never production,
  never an un-allow-listed domain.
- **NEVER commit without explicit user approval.** Present results, ask, then wait.
- A failing test is never committed unless it intentionally documents a known bug (note it).
- Stop and ask the user whenever the task, expected behaviour, or a failure is ambiguous.

### Testing Third-Party Live Sites (e.g. IMDB)
Some configured targets are public third-party production sites, not an app the user owns. Read-only
UI/UX, navigation, search, and response-time-consistency testing against them is in scope and is not
what the "never production" rule above is guarding against — that clause is about not bypassing an
app's own staging/allow-listed environment, not a ban on exploring a live public site the way a normal
user would. When the target is a third-party site:
- Keep `app.allowedURLs` scoped to only the pages actually explored/tested.
- Never perform state-mutating actions (rate, review, add-to-list, sign up, post) — this is why such
  targets should use `auth.strategy: none`.
- Keep worker concurrency at normal test-suite levels; don't scale up parallelism to load-test someone
  else's production infrastructure.
