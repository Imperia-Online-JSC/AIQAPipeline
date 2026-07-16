import { Page } from '@playwright/test';

export class RottenTomatoesPage {
  constructor(private page: Page, private mobile = false) {}

  private async act(locator: ReturnType<Page['locator']>) {
    return this.mobile ? locator.tap() : locator.click();
  }

  async acceptCookies() {
    const button = this.page.getByRole('button', { name: 'I Accept' });
    if (await button.count()) await this.act(button.first());
  }

  private async openFilter(name: string) {
    await this.act(this.page.getByRole('button', { name }).first());
  }

  /**
   * Filter option rows are custom <select-label data-qa="option-<slug>"> elements
   * wrapping a nameless <select-checkbox>/<select-radio> — they expose no accessible
   * name, so getByRole(name) can't target them. data-qa is the stable hook instead.
   * The page renders several hidden duplicates of each row (responsive breakpoint
   * variants) sharing the same data-qa, so scope to the one actually visible.
   */
  private optionRow(slug: string) {
    return this.page.locator(`[data-qa="option-${slug}"]:visible`);
  }

  async selectSort(optionSlug: string) {
    await this.openFilter('SORT');
    await this.act(this.optionRow(optionSlug));
  }

  /** GENRE / RATING / TOMATOMETER share this pattern: open menu, check an option, click APPLY. */
  async selectAndApply(filterName: 'GENRE' | 'RATING' | 'TOMATOMETER', optionSlug: string) {
    await this.openFilter(filterName);
    await this.act(this.optionRow(optionSlug));
    await this.act(this.page.getByRole('button', { name: 'APPLY' }));
  }

  /**
   * The Coming Soon list changes daily, so tests target "whichever movie is first"
   * rather than a hard-coded title. Returns the title that was actually clicked.
   */
  async openFirstMovieDetail(): Promise<string> {
    const link = this.page.locator('a[href^="/m/"]:visible').first();
    const title = (await link.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    await link.scrollIntoViewIfNeeded();
    await this.act(link);
    return title;
  }

  async clickFirstWatchlistButton(): Promise<string> {
    const button = this.page.getByRole('button', { name: /^Add .+ to your watchlist$/ }).first();
    const name = (await button.getAttribute('aria-label')) ?? (await button.textContent()) ?? '';
    await this.act(button);
    return name;
  }
}
