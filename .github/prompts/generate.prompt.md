---
mode: agent
description: Generate stage — converts explore feedback into a page-object helper and Playwright tests
---

<!-- No `tools:` line — inherit the global picker. This stage writes test files with the
     file editor (`edit`/`Write`), reads context with `read`/`search`, and may use the
     Playwright MCP test-generator. It never runs the terminal or git. -->

# Generate Stage — Generic AI QA Pipeline

> **Pipeline note:** When invoked by `pipeline.prompt.md`, `.agents/feedback.md` is
> already written — skip straight to Step 1 (read files). When done, update
> `.agents/pipeline-status.md` Stage 2 row to ✅ and signal that Stage 3 can begin.
>
> **Tooling — identical for both tools.** Reads context (`read`/`search` in Copilot,
> `Read`/`Grep` in Claude) and **writes files with the file editor** (`edit` in Copilot,
> `Write`/`Edit` in Claude). The Playwright MCP test-generator may be used to scaffold
> specs. No terminal, no git.

## Your Role
Convert Explore-stage findings into working Playwright tests. You NEVER run terminal
commands or git operations.

## Step 1 — Read Before Writing Anything
In this exact order:
1. READ `.agents/feedback.md` — get all scenarios and the "Selectors & Flows Observed" section
2. READ `config/pipeline.config.json` — app name, **`app.testDir`** (the folder slug for this
   target), auth strategy, async pattern, timeouts
3. CHECK `tests/<app.testDir>/helpers/` for an existing `<AppName>Page.ts` from a previous run
4. SCAN `tests/<app.testDir>/` for similar existing tests

> **Per-target layout.** Everything for one target lives under `tests/<app.testDir>/`:
> its specs sit directly in that folder and its page object at
> `tests/<app.testDir>/helpers/<AppName>Page.ts`. Cross-target infrastructure
> (`fixtures.ts`, `screen.ts`) lives once in `tests/_shared/` and is never duplicated
> per target. Never write into another target's folder.

## Step 2 — Page Object: Generate or Extend
There is **no hand-written page object for this app ahead of time** — that's the point of
this pipeline: it points at whatever app the config names and builds its own model of it.

- If `tests/<app.testDir>/helpers/<AppName>Page.ts` does **not** exist yet: generate one now, using the
  "Selectors & Flows Observed" section of `.agents/feedback.md` as your source of truth.
  Prefer stable selectors in this priority order: `getByRole` (with accessible name) >
  `getByLabel`/`getByPlaceholder` > `data-testid` > CSS id > everything else last, and only
  as a last resort. Give it the shape below (adapt method names to what the app actually has):

```typescript
import { Page } from '@playwright/test';

export class <AppName>Page {
  constructor(private page: Page, private mobile = false) {}

  private async act(locator: ReturnType<Page['locator']>) {
    return this.mobile ? locator.tap() : locator.click();
  }

  async clickButton(name: string) {
    const byRole = this.page.getByRole('button', { name });
    if (await byRole.count()) return this.act(byRole.first());
    // fall back to input[value=name] / anchor text, mirroring what Explore observed
  }

  async closeDialog() {
    await this.page.keyboard.press('Escape');
  }

  // Add one method per distinct flow Explore documented (login, submit-form, etc.)
}
```

- If it **does** exist: extend it — add methods for newly-discovered flows, don't rewrite
  working ones.

## Step 3 — Plan Before Coding
For each SCENARIO in `.agents/feedback.md`:
- Decide the test file path: `tests/<app.testDir>/[name].spec.ts` (a feature subfolder under
  the target dir is fine for large targets, e.g. `tests/<app.testDir>/login/[name].spec.ts`)
- Decide the timeout from `config/pipeline.config.json`'s `timeouts` block:
  `simple` (default), `sharedAccount` (existing-credentials + `sharedAccount: true`), or
  `longFlow` (multi-step tutorials/onboarding)
- Decide auth per `config/pipeline.config.json`'s `auth.strategy`
- **If `auth.existing.sharedAccount` is `true` and this spec uses that account**, it MUST
  set `test.describe.configure({ mode: 'serial' })` and use the `sharedAccount` timeout —
  these suites are run single-worker (`--workers=1`). Fresh-account specs don't need this.

## Step 4 — File Placement Rules (CRITICAL)
- ✅ All specs → `tests/<app.testDir>/[name].spec.ts` (feature subfolders under the target
  dir are fine: `tests/<app.testDir>/<feature>/[name].spec.ts`)
- ✅ Page-object helper → `tests/<app.testDir>/helpers/<AppName>Page.ts`
- ✅ Shared infra (`fixtures.ts`, `screen.ts`) already lives in `tests/_shared/` — import it,
  never copy it into a target folder
- ❌ NEVER write into another target's `tests/<other>/` folder
- ❌ NEVER put specs in `/specs/` — reserved for markdown plans, not executed

## Step 5 — Patterns To Always Follow

### Basic Test Structure
Always import `test`/`expect` from `../_shared/fixtures`, never directly from
`@playwright/test` — that shared module wraps them with an auto-fixture that makes headed
runs (CLI `--headed` or the VS Code Playwright extension's Run/Debug buttons) fill whichever
screen currently has focus. Importing straight from `@playwright/test` silently skips it.

> **Import paths** assume the spec sits directly in `tests/<app.testDir>/`. From there:
> shared infra is `../_shared/...`, the target's own page object is `./helpers/...`, and the
> config is `../../config/pipeline.config.json`. Add one more `../` to the first two if you
> nest the spec in a feature subfolder.
```typescript
import { test, expect } from '../_shared/fixtures';
import { <AppName>Page } from './helpers/<AppName>Page';
import pipelineConfig from '../../config/pipeline.config.json';

test.describe('[Feature] - [SCENARIO_ID from feedback]', () => {

  // Shared-account suites ONLY — serialize so this file's logins never collide:
  // test.describe.configure({ mode: 'serial' });
  test.setTimeout(pipelineConfig.timeouts.simple);

  test.beforeEach(async ({ page }) => {
    // navigation and setup
  });

  test('[SCENARIO_ID] - [clear description]', async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });

});
```

### Fresh Account Pattern (auth.strategy = fresh-registration)
```typescript
test('[SCENARIO_ID] - [description]', async ({ page }, testInfo) => {
  const ts = testInfo.workerIndex + Date.now();
  const username = pipelineConfig.auth.fresh.usernamePattern.replace('{ts}', String(ts));
  const password = pipelineConfig.auth.fresh.passwordPattern;
  const email = pipelineConfig.auth.fresh.emailPattern.replace('{ts}', String(ts));
  const app = new <AppName>Page(page);

  await page.goto(pipelineConfig.auth.fresh.registerUrl);
  // ... fill registration form using selectors Explore documented
});
```

### Existing Account Pattern (auth.strategy = existing-credentials)
```typescript
test.beforeEach(async ({ page }) => {
  const username = process.env[pipelineConfig.auth.existing.usernameEnvVar]!;
  const password = process.env[pipelineConfig.auth.existing.passwordEnvVar]!;
  await page.goto(pipelineConfig.auth.existing.loginUrl);
  // ... fill login form using selectors Explore documented, then any postLoginExtraStep
});
```

### Async Response Pattern (config.asyncPattern.type = networkResponse)
```typescript
await Promise.all([
  page.waitForResponse(pipelineConfig.asyncPattern.urlGlob),
  page.click('[selector]'),
]);
// OR, when there's no clean single response to key off:
await page.waitForSelector('[result-selector]', { state: 'visible' });
```

### Multi-Step Flow Pattern
```typescript
const executeStep = async (name: string, fn: () => Promise<void>) => {
  const start = Date.now();
  try {
    await fn();
    console.log(`✅ ${name} -> passed (${((Date.now() - start) / 1000).toFixed(2)}s)`);
  } catch (e) {
    console.log(`❌ ${name} -> failed after ${((Date.now() - start) / 1000).toFixed(2)}s: ${e.message}`);
    throw e;
  }
};
```

## Step 5.5 — Snapshot Specs For The Heal-Gate (over-heal baseline)

Immediately after writing/extending the specs — and **before** the Execute stage can heal
them — copy each generated/modified spec to a baseline mirror so the over-heal gate can tell a
legitimate locator repair from a masked assertion change:

```bash
# for every spec you created or changed this run:
mkdir -p ".agents/heal-baseline/$(dirname tests/<path>.spec.ts)"
cp "tests/<path>.spec.ts" ".agents/heal-baseline/tests/<path>.spec.ts"
```

This mirrors the file at `tests/...` to `.agents/heal-baseline/tests/...` (same sub-path). The
directory is gitignored — it's per-run scratch. The gate (`scripts/heal-gate.mjs`) diffs the
healed spec against this snapshot; without it, a freshly-generated spec that gets weakened in the
same run has nothing to diff against (a committed test would fall back to `git HEAD`). Do this for
every spec, new or extended.

## Step 6 — When Done Write To `.agents/test-tasks.md`

```markdown
## Tests Ready - [DATE]

**Source:** `.agents/feedback.md` session [DATE]

### Files Created
- [ ] tests/[testDir]/[filename].spec.ts - [scenario covered]

### Page Object
- [ ] tests/[testDir]/helpers/[AppName]Page.ts - created new / extended existing

### Recommended Run Commands
npx playwright test tests/[testDir]/[filename].spec.ts --reporter=list
npx playwright test tests/[testDir]/[filename].spec.ts --project=target-chromium

### Notes For Execute Stage
- [any async-timing considerations]
- [any account setup needed]
- [any selectors that may need adjustment]

### Status
- [ ] Pending run by Execute Stage
```

## When Done Tell The User
```
✅ Tests written from feedback
📁 Created [X] test files:
- tests/[file1]
📋 Tasks written to .agents/test-tasks.md

Next step: Run the tests
Command: "Run new tests from test tasks"
```
