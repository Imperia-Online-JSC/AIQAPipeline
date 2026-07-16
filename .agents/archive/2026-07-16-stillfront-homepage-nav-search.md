# Explore Session
- Date: 2026-07-16
- App: Stillfront
- URL Tested: https://www.stillfront.com/en/
- Auth strategy used: none
- Tested By: Explore Stage
- Exploration tool: agent-browser
- Runner: Claude Code

---

## 🔴 Critical Issues
- None found on the paths tested.

## 🟡 Missing Test Coverage
- Homepage load + cookie consent banner (accept/reject/customize)
- Header search (open searchbox, submit query, verify results page)
- Main navigation (About us, Games, Careers, Investors, News) link destinations
- Games page franchise tiles rendering (Supremacy, Empire, Big, Jawaker, Albion Online, ...)
- Contact us page content (mailto links, no form)
- 404 / unknown-URL handling

## 🟢 Confirmed Working
- Homepage (`/en/`) loads correctly, title "Stillfront Group"
- Cookie consent banner appears on first load; "Allow all cookies" dismisses it and does not reappear on subsequent navigation
- Header search: click search icon → fill query → Enter → navigates to `/en/?s={query}` with a "Search Results for "{query}"" page showing matches
- Main menu "About us" link resolves (redirects to `/en/about-us/this-is-stillfront/`)
- Main menu "Games" link loads `/en/games/` with franchise carousel intact
- Contact us page (`/en/about-us/contact-us/`) renders HQ address, `ir@stillfront.com` / `dpo@stillfront.com` mailto links, and a "View on map" external Google Maps link — no login/form on this app
- Unknown URLs return a proper "Page not found – Stillfront Group" 404 page (verified with a nonsense path) instead of erroring
- No 4xx/5xx responses observed in network traffic during this session (only analytics beacons, all 200/204)

---

## 🧭 Selectors & Flows Observed
- Cookie banner accept: `getByRole('button', { name: 'Allow all cookies' })`
- Header search toggle: `getByRole('button', { name: 'Search button' })` (first occurrence, in Main menu nav) — click reveals `getByRole('searchbox')` + a second `getByRole('button', { name: 'Search button' })` (submit)
- Search flow: click search toggle → `getByRole('searchbox').fill(query)` → `page.keyboard.press('Enter')` → `page.waitForURL('**/?s=' + query)`
- Main menu: `getByRole('navigation', { name: 'Main menu' })` containing top-level `getByRole('link', { name: 'About us' | 'Games' | 'Careers' | 'Investors' | 'News' })` — each also has a sibling `getByRole('button', { name: 'expander' })` for a flyout submenu; the link itself navigates directly without needing the expander
- About us → redirects from `/en/about-us/` to `/en/about-us/this-is-stillfront/` (no standalone landing page, first submenu item is the effective landing page)
- Games page: `/en/games/`, heading "Our Games"; each franchise tile has "Play games:" buttons (e.g. `getByRole('button', { name: 'Supremacy: World War 3' })`) that point to external, non-stillfront.com game domains — **out of `allowedURLs` scope, not followed/asserted**
- Contact us: `/en/about-us/contact-us/` — `getByRole('link', { name: 'ir@stillfront.com' })` (mailto), `getByRole('link', { name: 'dpo@stillfront.com' })` (mailto), "View on map" link → external `google.com/maps` — **out of scope, not followed**
- 404 page: any unmatched path under `/en/` renders `heading`/`title` "Page not found – Stillfront Group"

---

## 📋 Test Scenarios For Generate Stage

### SCENARIO_001
- Feature: Homepage load + cookie consent
- URL: /en/
- Auth: none
- Steps:
  1. Navigate to `/en/`
  2. Assert cookie consent dialog is visible with heading "This website uses cookies"
  3. Click "Allow all cookies"
  4. Assert the dialog is no longer visible
- Expected: Banner dismisses and homepage content (heading "Universe of positive gaming experiences.") is visible
- Actual: Matches expected
- Priority: HIGH
- Suggested file: tests/homepage/cookie-consent.spec.ts

### SCENARIO_002
- Feature: Header search
- URL: /en/
- Auth: none
- Steps:
  1. Navigate to `/en/`, accept cookies
  2. Click the header "Search button"
  3. Fill the revealed searchbox with "games"
  4. Press Enter
- Expected: URL becomes `/en/?s=games` and page title/heading shows Search Results for "games" with at least one result
- Actual: Matches expected
- Priority: HIGH
- Suggested file: tests/search/search-results.spec.ts

### SCENARIO_003
- Feature: Main navigation — Games
- URL: /en/
- Auth: none
- Steps:
  1. Navigate to `/en/`, accept cookies
  2. Click "Games" in the Main menu nav
- Expected: Navigates to `/en/games/`, heading "Our Games" visible
- Actual: Matches expected
- Priority: MEDIUM
- Suggested file: tests/navigation/main-nav.spec.ts

### SCENARIO_004
- Feature: Main navigation — About us redirect
- URL: /en/about-us/
- Auth: none
- Steps:
  1. Navigate directly to `/en/about-us/`
- Expected: Redirects to `/en/about-us/this-is-stillfront/` with a 200-equivalent successful render (not a 404)
- Actual: Matches expected
- Priority: MEDIUM
- Suggested file: tests/navigation/main-nav.spec.ts

### SCENARIO_005
- Feature: Contact us page content
- URL: /en/about-us/contact-us/
- Auth: none
- Steps:
  1. Navigate to `/en/about-us/contact-us/`
- Expected: Page shows heading "Contact us", `mailto:ir@stillfront.com`, and `mailto:dpo@stillfront.com` links; no login form present
- Actual: Matches expected
- Priority: LOW
- Suggested file: tests/navigation/contact-us.spec.ts

### SCENARIO_006
- Feature: 404 handling
- URL: /en/this-page-does-not-exist-xyz/ (or any nonsense path)
- Auth: none
- Steps:
  1. Navigate to an unmatched path under `/en/`
- Expected: A friendly "Page not found – Stillfront Group" page is rendered, no raw server error
- Actual: Matches expected
- Priority: LOW
- Suggested file: tests/navigation/not-found.spec.ts

---

## ✅ Session Complete
- Total issues found: 0
- Total scenarios documented: 6
- Ready for: Generate Stage
