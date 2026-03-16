import type { Browser } from "playwright";
import { chromium, firefox, webkit } from "playwright";

export class BrowserManager {
  private browser: Browser | null = null;
  private headless: boolean;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async openNewBrowser(
    browserType: "chromium" | "firefox" | "webkit" = "chromium",
  ): Promise<void> {
    if (this.browser) {
      console.warn(
        "A browser instance is already open. Closing it before opening a new one.",
      );
      await this.closeBrowser();
    }

    switch (browserType) {
      case "chromium":
        this.browser = await chromium.launch({ headless: this.headless });
        break;
      case "firefox":
        this.browser = await firefox.launch({ headless: this.headless });
        break;
      case "webkit":
        this.browser = await webkit.launch({ headless: this.headless });
        break;
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser
        .close()
        .then(() => {
          console.log("Browser closed just fine.");
        })
        .catch((error) => {
          console.error("Couldn't stop browser:", error);
        });
      this.browser = null;
    } else {
      console.warn("No browser instance to close.");
    }
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  isBrowserOpen(): boolean {
    return this.browser !== null;
  }
}
