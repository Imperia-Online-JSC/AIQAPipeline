# Pipeline Status
> Updated by each stage after completing its work

## Current Status: AWAITING COMMIT APPROVAL ⏳

| Stage | Status |
|-------|--------|
| Explore | ✅ Complete |
| Tests Written | ✅ Complete |
| Tests Passing | 8 of 8 |
| Commit Approved | ⏳ Waiting |

- App tested: RottenTomatoes (https://www.rottentomatoes.com/browse/movies_coming_soon/)
- Branch: main
- Tests committed: none yet
- Next action: awaiting user YES/NO to commit the 5 spec files + RottenTomatoesPage helper

## Note
- IMDB (originally targeted for its Release Calendar) is blocked for this pipeline: AWS WAF
  Bot Control returns 403/challenge on every page (confirmed IP/network-level via curl and
  agent-browser from two different networks on the same ISP; not tool- or headed/headless-specific).
  Retargeted to Rotten Tomatoes' "Coming Soon" browse page as the release-calendar equivalent.
- Prior Stillfront run (2026-07-16) is still uncommitted, awaiting separate YES/NO from the user.
  Its files (tests/homepage/, tests/navigation/, tests/search/, tests/helpers/StillfrontPage.ts)
  are untouched by this run and remain pending in git status.
