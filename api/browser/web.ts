import { existsSync } from "fs";
import type { BrowserContext, Page } from "playwright";
import { BrowserManager } from "./browser";

const SESSION_PATH = "session.json";

export class BrowserNavigationManager {
  private browserManager: BrowserManager;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  async toUrl(url: string): Promise<void> {
    let browser = this.browserManager.getBrowser();
    if (!browser) {
      await this.browserManager.openNewBrowser("chromium");
      browser = this.browserManager.getBrowser();
    }

    if (!this.page) {
      const hasSession = existsSync(SESSION_PATH);
      this.context = await browser!.newContext(
        hasSession ? { storageState: SESSION_PATH } : {},
      );
      this.page = await this.context.newPage();
    }

    await this.page
      .goto(url)
      .then(() => {
        console.log(`Opened ${url} just fine.`);
      })
      .catch((error) => {
        console.error(`Couldn't visit ${url}:`, error);
      });
  }

  async saveSession(): Promise<void> {
    if (!this.context) {
      throw new Error("No browser context to save.");
    }

    await this.context.storageState({ path: SESSION_PATH });
    console.log(`Session saved to ${SESSION_PATH}.`);
  }

  getPage(): Page | null {
    return this.page;
  }
}
