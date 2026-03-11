import { BrowserManager } from "../browser/browser";
import { BrowserNavigationManager } from "../browser/web";
import { BoardManager } from "./board";

const loginUrl: string = "https://www.chess.com/login";
const gameUrl: string = "https://www.chess.com/play/online/new?action=createLiveChallenge&base=600&timeIncrement=0&rated=rated";

export class ChessAPI {
    private browserManager: BrowserManager;
    private browserNavigationManager: BrowserNavigationManager;
    private debug: boolean;

    constructor({ debug = false }: { debug?: boolean } = {}) {
        this.debug = debug;
        this.browserManager = new BrowserManager(!debug);
        this.browserNavigationManager = new BrowserNavigationManager(this.browserManager);
    }

    async openChess(): Promise<void> {
        await this.browserNavigationManager.toUrl("https://www.chess.com");
    }

    // 
    //  --> Game stuff <--
    // 

    async startGame(): Promise<BoardManager> {
        await this.browserNavigationManager.toUrl(gameUrl);

        const page = this.browserNavigationManager.getPage();
        if (!page) {
            throw new Error("No page available after navigation.");
        }

        await page.waitForSelector("wc-chess-board", { timeout: 30000 });

        return new BoardManager(page);
    }

    // 
    //  --> Manage user login details <--
    // 

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
        await page.waitForURL("https://www.chess.com/**", {
            waitUntil: "domcontentloaded"
        }).then(() => {
            console.log("Login successful, navigated to Chess.com.");
        }).catch((error) => {
            console.error("Login failed or navigation didn't happen as expected:", error);
        });

        await this.browserNavigationManager.saveSession();

        console.log("Logged into Chess.com just fine.");
        console.log(`Saved session for ${username} to session.json.`);
    }
}