---
name: pipeline
description: >
  Run the generic AI QA pipeline end to end — Explore (agent-browser) → Generate
  Playwright tests → Execute & heal → ask before commit — against whatever app is
  configured in config/pipeline.config.json. Use when the user runs "/pipeline", says
  "run the pipeline" / "pipeline orchestrator", "explore X then write and run tests",
  or asks Claude to take the executor role.
---

# Pipeline Orchestrator (Claude Code) — invoked as `/pipeline`

You are running the **generic AI QA pipeline** as the orchestrator. You carry all three
stages yourself and execute each one inline, against whatever app is named in
**`config/pipeline.config.json`**.

## Authoritative rules
The full, detailed stage rules live in **`.github/prompts/pipeline.prompt.md`** — that
file is shared with GitHub Copilot and is the single source of truth. **Read it now and
follow it exactly.** The per-stage detail is in the sibling prompt files:
- `.github/prompts/explore.prompt.md` (Stage 1)
- `.github/prompts/generate.prompt.md` (Stage 2)
- `.github/prompts/execute.prompt.md` (Stage 3)

## Claude Code tool mapping
| Stage | What you do |
|-------|-------------|
| 1. Explore | Use the **agent-browser** skill (`agent-browser skills get core`, then drive it via the CLI). Write findings to `.agents/feedback.md`. NEVER touch a URL outside `config/pipeline.config.json`'s `app.allowedURLs`. |
| 2. Generate | Use `Read`/`Grep` to study `config/pipeline.config.json`, `tests/helpers/`, `tests/`; use `Write`/`Edit` to create/extend the page object and specs. Record them in `.agents/test-tasks.md`. Never put specs in `/specs/`. |
| 3. Execute (Copilot role) | Use `Bash`: `npx playwright test tests/[file] --reporter=list` (add `--project=target-chromium` as needed). **Add `--workers=1` whenever `auth.existing.sharedAccount` is `true` and more than one such file runs together.** Heal failures with the fix checklist in `execute.prompt.md`, ONE fix + re-run per failure. |
| 3. Commit | Only after the user replies **YES**. Then `git add` / `git commit` the passing files. Update `.agents/execution-log.md` and `.agents/pipeline-status.md`. |

## Before doing anything
Read `config/pipeline.config.json`. If `app.name`, `app.baseURL`, or `auth.strategy` still
contain `CHANGE_ME`, stop and ask the user to fill the config in for the target app before
running any stage.

## Hard rules (never break)
- ONLY browse URLs listed in `config/pipeline.config.json`'s `app.allowedURLs` — never
  production, never a domain the user hasn't explicitly allow-listed.
- **NEVER run tests sharing a `sharedAccount: true` account in parallel.** Run those
  suites with `--workers=1`. Fresh-account tests may run parallel.
- **NEVER commit without explicit user approval.** Present results, ask, then wait.
- A failing test is never committed unless it intentionally documents a known bug (note it).
- Stop and ask whenever the task, expected behaviour, or a failure is ambiguous
  (see "Human Escalation Rules" in `pipeline.prompt.md`).

## Running a single stage
If the user only asks for one stage, run just that stage:
- "Explore [feature]" → Stage 1 only
- "Write tests from feedback" → Stage 2 only
- "Run new tests" / "take the executor role" → Stage 3 only

## Start
1. Read `config/pipeline.config.json` — if unfilled, ask the user to point it at a target app first.
2. Read `.agents/pipeline-status.md`. If a previous run shows `IN PROGRESS`, ask whether to
   continue or start fresh.
3. Resolve any ambiguous task details per `pipeline.prompt.md`.
4. Execute the stages in order, updating the `.agents/` files after each stage.
