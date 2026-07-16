import { Page } from '@playwright/test';

export class StillfrontPage {
  constructor(private page: Page, private mobile = false) {}

  private async act(locator: ReturnType<Page['locator']>) {
    return this.mobile ? locator.tap() : locator.click();
  }

  async acceptAllCookies() {
    const button = this.page.getByRole('button', { name: 'Allow all cookies' });
    if (await button.count()) await this.act(button.first());
  }

  async search(query: string) {
    await this.act(this.page.getByRole('button', { name: 'Search button' }).first());
    await this.page.getByRole('searchbox').first().fill(query);
    await this.page.keyboard.press('Enter');
  }

  async clickMainNavLink(name: string) {
    await this.act(
      this.page.getByRole('navigation', { name: 'Main menu' }).getByRole('link', { name, exact: true })
    );
  }
}
