# AI QA Pipeline

A three-stage, app-agnostic AI QA pipeline: point it at any web app and it explores,
writes Playwright tests, runs them, heals common failures, and asks before committing.

Originally extracted from a game-specific test suite (Imperia Online) where the same
Explore → Generate → Execute pattern was hard-coded to one game's URLs, one shared test
account, and one backend's async-response quirks. This version pulls all of that into
`config/pipeline.config.json` so the same prompts run against a different target app.

## How it works

1. **Explore** — browses the app configured below via the `agent-browser` CLI
   (Playwright MCP browser as a documented fallback only), documents bugs, coverage gaps,
   and the concrete selectors/flows it found. Writes `.agents/feedback.md`.
2. **Generate** — turns that into a Playwright page-object helper
   (`tests/<app.testDir>/helpers/<AppName>Page.ts`, generated fresh the first time, extended
   on later runs) and `.spec.ts` files under the same target folder. Writes
   `.agents/test-tasks.md`.
3. **Execute** — runs the new tests, applies a small fix checklist to common failures
   (selector timing, async waits, dialogs, cookie banners, shared-account collisions),
   and asks for explicit approval before committing anything to git.

All three stages are one prompt file each under `.github/prompts/`, shared verbatim
between GitHub Copilot and Claude Code — `pipeline.prompt.md` is the source of truth,
`.claude/skills/pipeline/SKILL.md` is Claude Code's thin entry point (`/pipeline`).

## Point it at a target app

Edit `config/pipeline.config.json`:

```json
{
  "app": {
    "name": "MyApp",
    "testDir": "my-app",
    "baseURL": "https://staging.myapp.com/",
    "allowedURLs": ["https://staging.myapp.com/"]
  },
  "auth": { "strategy": "none" }
}
```

- `app.testDir` is the kebab-case folder slug for this target under `tests/`. Everything the
  pipeline generates for the app lands in `tests/<testDir>/` (specs) and
  `tests/<testDir>/helpers/` (its page object), so each target is a self-contained folder.
  Derive it once from `app.name` (`MyApp` → `my-app`) and keep it stable across runs.

- `auth.strategy`: `none` (public pages only), `fresh-registration` (self-registers a
  unique account per run — safe to parallelize), or `existing-credentials` (a real
  account — put creds in `.env`, referenced by the env-var names in the config, never
  in the JSON itself).
- `auth.existing.sharedAccount: true` if the backend only allows one session per account
  (like Imperia's `sqla`) — the pipeline then forces `--workers=1` for suites using it.
- `asyncPattern`: if the app updates the UI via background XHR/fetch (not full page
  navigations), set `type: "networkResponse"` and a `urlGlob` so generated tests wait on
  the real response instead of a fixed sleep.

`app.allowedURLs` is a hard guardrail — the Explore stage refuses to navigate anywhere
not on that list, so a misconfigured or ambiguous task can't wander onto production.

## Run it

```bash
npm install
npx playwright install   # first time only

# Full pipeline (Claude Code):
# /pipeline  — or say "explore <feature> then write and run tests"

# Individual stages:
# "Explore <feature>"              -> Stage 1 only
# "Write tests from feedback"      -> Stage 2 only
# "Run new tests"                  -> Stage 3 only

# Directly:
npx playwright test
npx playwright test --project=target-chromium
npx playwright show-report
```

## Directory layout

- `config/pipeline.config.json` — the only file you need to edit per target app
- `.github/prompts/` — the four stage prompts (shared source of truth for Copilot + Claude)
- `.claude/skills/pipeline/` — Claude Code's `/pipeline` entry point
- `.agents/` — run-to-run communication files (`feedback.md`, `test-tasks.md`,
  `execution-log.md`, `pipeline-status.md`) plus `archive/` (durable QA trail, committed)
- `tests/_shared/` — cross-target test infrastructure (`fixtures.ts`, `screen.ts`)
- `tests/<app.testDir>/` — one self-contained folder per target app: its `.spec.ts` files
  plus its page object under `helpers/<AppName>Page.ts`

### Test folder structure

Each target the pipeline is pointed at gets its own folder, so tests never pile into one
shared directory as targets accumulate:

```
tests/
  _shared/                     # infra shared by every target
    fixtures.ts                #   headed-run screen-fill auto-fixture
    screen.ts                  #   screen-size detection for fullscreen runs
  my-app/                      # a target (app.testDir = "my-app")
    helpers/
      MyAppPage.ts             #   generated/extended page object
    login.spec.ts
    search.spec.ts
  another-app/                 # a second target — fully independent
    helpers/AnotherAppPage.ts
    checkout.spec.ts
```

A spec in `tests/<target>/` imports shared infra as `../_shared/fixtures` and its own page
object as `./helpers/<AppName>Page`. Adding or removing a target is a single folder with no
cross-target coupling. This repo's remote ships only `tests/_shared/` and this structure —
point the config at your app and the first pipeline run creates your target folder.

## Known limitation

This is a demo-ready, lightly-parameterized version, not a fully pluggable
architecture — genuinely novel auth flows (SSO, MFA, OAuth popups) or apps with no
stable selectors at all will still need a human to extend `generate.prompt.md`'s
patterns or hand-tune the generated page object.
