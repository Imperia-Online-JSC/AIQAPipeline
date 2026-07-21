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
2. READ `config/pipeline.config.json` — app name, auth strategy, async pattern, timeouts
3. CHECK `tests/helpers/` for an existing `<AppName>Page.ts` from a previous run
4. SCAN `tests/` for similar existing tests

## Step 2 — Page Object: Generate or Extend
There is **no hand-written page object for this app ahead of time** — that's the point of
this pipeline: it points at whatever app the config names and builds its own model of it.

- If `tests/helpers/<AppName>Page.ts` does **not** exist yet: generate one now, using the
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
- Decide the test file path: `tests/[name].spec.ts` (or a subfolder matching the feature area)
- Decide the timeout from `config/pipeline.config.json`'s `timeouts` block:
  `simple` (default), `sharedAccount` (existing-credentials + `sharedAccount: true`), or
  `longFlow` (multi-step tutorials/onboarding)
- Decide auth per `config/pipeline.config.json`'s `auth.strategy`
- **If `auth.existing.sharedAccount` is `true` and this spec uses that account**, it MUST
  set `test.describe.configure({ mode: 'serial' })` and use the `sharedAccount` timeout —
  these suites are run single-worker (`--workers=1`). Fresh-account specs don't need this.

## Step 4 — File Placement Rules (CRITICAL)
- ✅ All specs → `tests/[name].spec.ts` (or a feature subfolder under `tests/`)
- ✅ Page-object helpers → `tests/helpers/<AppName>Page.ts`
- ❌ NEVER put specs in `/specs/` — reserved for markdown plans, not executed

## Step 5 — Patterns To Always Follow

### Basic Test Structure
Always import `test`/`expect` from `../helpers/fixtures`, never directly from
`@playwright/test` — that shared module wraps them with an auto-fixture that makes headed
runs (CLI `--headed` or the VS Code Playwright extension's Run/Debug buttons) fill whichever
screen currently has focus. Importing straight from `@playwright/test` silently skips it.
```typescript
import { test, expect } from '../helpers/fixtures';
import { <AppName>Page } from '../helpers/<AppName>Page';
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

## Step 6 — When Done Write To `.agents/test-tasks.md`

```markdown
## Tests Ready - [DATE]

**Source:** `.agents/feedback.md` session [DATE]

### Files Created
- [ ] tests/[folder]/[filename].spec.ts - [scenario covered]

### Page Object
- [ ] tests/helpers/[AppName]Page.ts - created new / extended existing

### Recommended Run Commands
npx playwright test tests/[folder]/[filename].spec.ts --reporter=list
npx playwright test tests/[folder]/[filename].spec.ts --project=target-chromium

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
