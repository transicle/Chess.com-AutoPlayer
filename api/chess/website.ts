import { BrowserManager } from "../browser/browser";
import { BrowserNavigationManager } from "../browser/web";
import { BoardManager } from "./board";

const loginUrl: string = "https://www.chess.com/login";
const gameUrl: string =
  "https://www.chess.com/play/online/new?action=createLiveChallenge&base=600&timeIncrement=0&rated=rated";

export class ChessAPI {
  private browserManager: BrowserManager;
  private browserNavigationManager: BrowserNavigationManager;
  private debug: boolean;

  constructor({ debug = false }: { debug?: boolean } = {}) {
    this.debug = debug;
    this.browserManager = new BrowserManager(!debug);
    this.browserNavigationManager = new BrowserNavigationManager(
      this.browserManager,
    );
  }

  async openChess(): Promise<void> {
    await this.browserNavigationManager.toUrl("https://www.chess.com");
  }

  async startGame(): Promise<BoardManager | null> {
    const maxRetries = 10;
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.browserNavigationManager.toUrl(gameUrl);

        const page = this.browserNavigationManager.getPage();
        if (!page) {
          continue;
        }

        await page.waitForSelector("wc-chess-board", { state: "attached", timeout: 15000 });
        return new BoardManager(page, this.debug);
      } catch (e) {
        console.warn(`[Retry ${i + 1}] Board not found, retrying...`);
        await Bun.sleep(5000);
      }
    }
    return null;
  }

  async signup(
    email: string,
    password: string,
    username: string,
  ): Promise<void> {
    const registerUrl = "https://www.chess.com/register";
    await this.browserNavigationManager.toUrl(registerUrl);

    const page = this.browserNavigationManager.getPage();
    if (!page) {
      throw new Error("No page available after navigation.");
    }

    console.log("Signing up for new Chess.com account...");

    try {
      const continueEmailBtn = page.locator(
        'button:has-text("Continue with Email")',
      );
      await continueEmailBtn.click();
      await page.waitForTimeout(1000);

      await page.fill("#registration_email", email);
      console.log(`Filled email: ${email}`);

      await page.fill("#registration_password", password);
      console.log("Filled password");

      const continueBtn = page.locator('button:has-text("Continue")').first();
      await continueBtn.click();
      await page.waitForTimeout(2000);

      await page.waitForSelector("#registration_username", { timeout: 10000 });
      console.log("Username field appeared");

      await page.fill("#registration_username", username);
      console.log(`Filled username: ${username}`);

      await page.waitForTimeout(1000);

      const finalBtn = page.locator('button:has-text("Continue")').last();
      await finalBtn.click();

      await page
        .waitForURL("https://www.chess.com/**", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
        .then(() => {
          console.log("Account signup successful, navigated to Chess.com.");
        })
        .catch((error) => {
          console.error("Account signup might have failed:", error);
        });

      await this.browserNavigationManager.saveSession();
      console.log(`Successfully created and signed up account: ${username}`);
    } catch (error) {
      console.error("Error during signup process:", error);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<void> {
    await this.browserNavigationManager.toUrl(loginUrl);

    const page = this.browserNavigationManager.getPage();
    if (!page) {
      throw new Error("No page available after navigation.");
    }

    if (!page.url().includes("chess.com/login")) {
      console.log("Already logged in, skipped login form.");
      return;
    }

    await page.fill("#login-username", username);
    await page.fill("#login-password", password);
    await page.click("#login");
    await page
      .waitForURL("https://www.chess.com/**", {
        waitUntil: "domcontentloaded",
      })
      .then(() => {
        console.log("Login successful, navigated to Chess.com.");
      })
      .catch((error) => {
        console.error(
          "Login failed or navigation didn't happen as expected:",
          error,
        );
      });

    await this.browserNavigationManager.saveSession();

    console.log("Logged into Chess.com just fine.");
    console.log(`Saved session for ${username} to session.json.`);
  }
}
