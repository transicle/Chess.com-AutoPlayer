import type { Page } from "playwright";

// 
//  Manage reading and rendering the Chess.com board state.
// 
//     --> Captures screenshots of wc-chess-board <--
// 

export class BoardManager {
    private page: Page;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    constructor(page: Page) {
        this.page = page;
    }

    async getBoardScreenshot(): Promise<string> {
        const buf = await this.page.locator("wc-chess-board").screenshot();
        return `data:image/png;base64,${buf.toString("base64")}`;
    }

    startLiveScreenshot(intervalMs: number = 1000, onUpdate: (dataUrl: string) => void): void {
        if (this.intervalId) {
            console.warn("Live board is already running.");
            return;
        }

        console.log("Starting live screenshot rendering...");
        this.intervalId = setInterval(async () => {
            const dataUrl = await this.getBoardScreenshot().catch((err) => {
                console.error("Error capturing board:", err);
                return null;
            });
            if (dataUrl) {
                onUpdate(dataUrl);
            }
        }, intervalMs);
    }

    stopLive(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("Live board stopped.");
        }
    }
}
