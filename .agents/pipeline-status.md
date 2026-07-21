# Pipeline Status
> Updated by each stage after completing its work

## Current Status: AWAITING COMMIT APPROVAL ⏳

| Stage | Status |
|-------|--------|
| Explore | ✅ Complete |
| Tests Written | ✅ Complete |
| Tests Passing | 4 of 4 (search suite, headless + headed) |
| Commit Approved | ⏳ Waiting |

- App tested: Stillfront (https://www.stillfront.com/en/)
- Branch: main
- Tests committed: none yet
- Next action: awaiting user YES/NO to commit:
  1. Search tests — 3 new spec files (search-toggle, search-no-results, search-empty-query)
     + StillfrontPage.ts extension (openSearchBox/searchToggleButton)
  2. Headed-fullscreen fix — tests/helpers/fixtures.ts (new), playwright.config.ts
     (simplified, no more argv-sniffing), 13 spec files' import switched to the shared
     fixtures module, package.json test:headed:chromium script

## Note
- The headed-maximize fix was redesigned this run: the previous approach (detecting
  `--headed` via `process.argv`) never worked for VS Code's Playwright extension, which
  drives tests through its own test-server protocol instead of a literal `--headed` CLI
  flag — confirmed by decompiling the extension. Replaced with a runtime check in
  tests/helpers/fixtures.ts (`testInfo.project.use.headless === false`), which reflects the
  effective value regardless of invocation path, and resizes explicitly via CDP (Chromium)
  or setViewportSize (Firefox/WebKit) to whichever screen currently has focus. Verified via
  CLI `--headed` (still works) and confirmed headless runs are unaffected (8/8 coming-soon
  tests pass both ways). NOT yet verified against the actual VS Code Run/Debug button —
  awaiting user confirmation.
