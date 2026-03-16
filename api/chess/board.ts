import type { Page } from "playwright";
import { Chess } from "chess.js";
import type { PlayerData, BoardInfo } from "./types";
import {
  scrapePlayerData,
  scrapeMovesFromPage,
  getBoardInfo,
  handlePromotion,
  detectGameOver,
  startNewGame
} from "./scrapers";
import { getBestMaiaElo, moveToMaia } from "./maia";

export class BoardManager {
  private page: Page;
  private _fastLoopRunning = false;
  private _slowIntervalId: ReturnType<typeof setInterval> | null = null;
  private _cdpSession: any = null;
  private _isMoving = false;
  private moves: string[] = [];
  private debug: boolean;

  constructor(page: Page, debug = false) {
    this.page = page;
    this.debug = debug;
    this.page.on("console", (msg) => {
      if (msg.text().startsWith("[Trace]") || msg.text().startsWith("[Maia]")) {
        console.log(`[Browser] ${msg.text()}`);
      }
    });
  }

  async boardScreenshot(): Promise<string> {
    const buf = await this.page.locator("wc-chess-board").screenshot();
    return `data:image/png;base64,${buf.toString("base64")}`;
  }

  async boardScreenshotFast(): Promise<Buffer | null> {
    try {
      return await this.page
        .locator("wc-chess-board")
        .screenshot({ type: "jpeg", quality: 60 })
        .catch(() => null);
    } catch {
      return null;
    }
  }

  private squareToPixel(
    square: string,
    rect: { left: number; top: number; width: number; height: number },
    flipped: boolean,
  ): { x: number; y: number } | null {
    if (!square || square.length < 2) return null;
    const file = "abcdefgh".indexOf(square.charAt(0));
    const rank = Number(square.charAt(1)) - 1;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    const squareSize = rect.width / 8;
    const col = flipped ? 7 - file : file;
    const row = flipped ? rank : 7 - rank;
    return {
      x: rect.left + col * squareSize + squareSize / 2,
      y: rect.top + row * squareSize + squareSize / 2,
    };
  }

  async moveOnPage(
    moveUci: string,
  ): Promise<{ ok: boolean; debug?: any }> {
    if (!moveUci || moveUci.length < 4)
      return { ok: false, debug: "invalid-move" };
    const move = moveUci
      .trim()
      .toLowerCase()
      .replace(/[-x#\\+]/g, "");
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length > 4 ? move.charAt(4) : null;

    const info = await getBoardInfo(this.page);
    if (!info) return { ok: false, debug: "no-board-info" };

    const fromPx = this.squareToPixel(from, info.rect, info.flipped);
    const toPx = this.squareToPixel(to, info.rect, info.flipped);
    if (!fromPx || !toPx) return { ok: false, debug: "bad-coords" };

    this._isMoving = true;
    let ok = false;
    try {
      const moveCountBefore = await this.page
        .evaluate(() => {
          const el = document.querySelector("wc-simple-move-list, .move-list, .moves, .moves-history");
          return el?.textContent?.length ?? 0;
        })
        .catch(() => 0);

      await this.page.mouse.move(fromPx.x, fromPx.y);
      await new Promise((r) => setTimeout(r, 50));
      await this.page.mouse.down();
      await new Promise((r) => setTimeout(r, 50));
      await this.page.mouse.move(toPx.x, toPx.y, { steps: 5 });
      await new Promise((r) => setTimeout(r, 50));
      await this.page.mouse.up();
      await new Promise((r) => setTimeout(r, 50));

      if (promotion) {
        await new Promise((r) => setTimeout(r, 200));
        await handlePromotion(this.page, promotion);
      }

      await new Promise((r) => setTimeout(r, 250));
      const moveCountAfter = await this.page
        .evaluate(() => {
          const el = document.querySelector("wc-simple-move-list, .move-list, .moves, .moves-history");
          return el?.textContent?.length ?? 0;
        })
        .catch(() => 0);
      ok = moveCountAfter > moveCountBefore;
    } finally {
      this._isMoving = false;
    }
    if (ok) console.log(`✓ move ${moveUci} succeeded`);
    return { ok, debug: { from, to, promotion, flipped: info.flipped } };
  }

  async sanMove(san: string): Promise<boolean> {
    try {
      if (!san || !san.trim()) return false;
      const orig = san.trim();
      let s = orig.replace(/\+|#|!/g, "").replace(/\s+/g, "");
      s = s.replace(/^p([a-h][1-8])$/i, "$1");

      if (/^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/i.test(s)) {
        const uci = s.toLowerCase();
        const res = await this.moveOnPage(uci).catch(() => ({ ok: false }));
        if (res.ok) {
          this.moves.push(uci);
          return true;
        }
        return false;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  private parseClockToSeconds(clockStr: string | undefined): number {
    if (!clockStr) return 180;
    const m = clockStr.trim().match(/(\d+):(\d{1,2})/);
    if (!m) return 180;
    const minutes = Number(m[1]);
    const seconds = Number(m[2]);
    return minutes * 60 + seconds;
  }

  liveScreenshot(
    intervalMs: number = 1000,
    onUpdate: (dataUrl: string) => void,
    onFrame?: (jpegBuf: Buffer) => void,
  ): void {
    if (this._fastLoopRunning) return;
    const metaIntervalMs = Math.max(intervalMs, 1000);
    this._fastLoopRunning = true;
    let frameCount = 0;
    const t0 = Date.now();

    const captureLoop = async () => {
      while (this._fastLoopRunning) {
        if (this._isMoving) {
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        try {
          if (this.page.isClosed()) break;
          if (onFrame) {
            const buf = await this.boardScreenshotFast();
            if (buf) {
              onFrame(buf);
              frameCount++;
            }
          } else {
            const dataUrl = await this.boardScreenshot().catch(() => null);
            if (dataUrl) {
              onUpdate(JSON.stringify({ board: dataUrl }));
              frameCount++;
            }
          }
        } catch (err) { }
        if (frameCount > 0 && frameCount % 150 === 0) {
          const elapsed = (Date.now() - t0) / 1000;
          console.log(`Board FPS: ${(frameCount / elapsed).toFixed(1)} (${frameCount} frames in ${elapsed.toFixed(1)}s)`);
        }
        await new Promise((r) => setTimeout(r, intervalMs <= 100 ? intervalMs : 0));
      }
    };
    captureLoop().catch(() => { });

    let lastTurnPlayed = -1;
    let lastTurnPlayedTime = 0;
    let autoStartPending = false;

    this._slowIntervalId = setInterval(async () => {
      try {
        if (this.page.isClosed()) return;

        const isGameOver = await detectGameOver(this.page);
        if (isGameOver && !autoStartPending) {
          autoStartPending = true;
          console.log("[AutoStart] Game over detected. Waiting to initiate new game...");
          const pauseMs = Math.floor(Math.random() * 30000) + 20000;
          setTimeout(async () => {
            try {
              await startNewGame(this.page);
              autoStartPending = false;
            } catch (e) {
              autoStartPending = false;
            }
          }, pauseMs);
          return;
        }

        const playerData = await scrapePlayerData(this.page).catch(() => null);
        const rawPageMoves = await scrapeMovesFromPage(this.page).catch(() => []);
        const pageMoves: string[] = [];

        try {
          const chess = new Chess();
          for (const m of rawPageMoves) {
            const res = chess.move(m);
            if (!res) throw new Error(`Parse error: ${m}`);
            pageMoves.push(res.from + res.to + (res.promotion || ""));
          }
        } catch (e) {
          return;
        }

        if (pageMoves.length < this.moves.length) {
          this.moves = [...pageMoves];
        }
        for (let i = this.moves.length; i < pageMoves.length; i++) {
          const mv = pageMoves[i];
          if (mv) this.moves.push(mv);
        }

        const boardInfo = await getBoardInfo(this.page).catch(() => null);
        if (boardInfo) {
          const isWhite = !boardInfo.flipped;
          const isOurTurn = isWhite ? pageMoves.length % 2 === 0 : pageMoves.length % 2 === 1;

          if (isOurTurn && lastTurnPlayed === pageMoves.length) {
            if (Date.now() - lastTurnPlayedTime > 3500) {
              lastTurnPlayed = -1;
            }
          }

          if (!isOurTurn) {
            lastTurnPlayed = -1;
          }

          if (isOurTurn && lastTurnPlayed !== pageMoves.length && pageMoves.length === rawPageMoves.length) {
            lastTurnPlayed = pageMoves.length;
            lastTurnPlayedTime = Date.now();
            const clockSec = this.parseClockToSeconds(playerData?.bottom?.clock);
            const opponentRating = playerData?.top?.rating || "";
            const currentElo = getBestMaiaElo(opponentRating);

            try {
              const suggested = await moveToMaia(pageMoves, clockSec, currentElo);
              if (suggested) {
                let isLegal = false;
                try {
                  const virtualBoard = new Chess();
                  for (const m of pageMoves) virtualBoard.move(m);
                  virtualBoard.move(suggested);
                  isLegal = true;
                } catch { }

                if (isLegal) {
                  let delayMs = Math.floor(Math.random() * 4000) + 2000;
                  if (clockSec < 20) {
                    delayMs = Math.floor(Math.random() * 1000) + 500;
                  }
                  await new Promise((r) => setTimeout(r, delayMs));
                  const newPageMoves = await scrapeMovesFromPage(this.page).catch(() => null);
                  if (!newPageMoves || newPageMoves.length === rawPageMoves.length) {
                    const result = await this.moveOnPage(suggested).catch(() => null);
                    if (!result || !result.ok) lastTurnPlayed = -1;
                  } else {
                    lastTurnPlayed = -1;
                  }
                } else {
                  lastTurnPlayed = -1;
                }
              } else {
                lastTurnPlayed = -1;
              }
            } catch {
              lastTurnPlayed = -1;
            }
          }
        }
        if (playerData) {
          onUpdate(JSON.stringify({
            type: "meta",
            players: playerData,
            moves: this.moves,
            movesFromPage: pageMoves,
            maiaElo: getBestMaiaElo(playerData?.top?.rating || ""),
          }));
        }
      } catch (e) { }
    }, metaIntervalMs);
  }

  stopLive(): void {
    this._fastLoopRunning = false;
    if (this._slowIntervalId) {
      clearInterval(this._slowIntervalId);
      this._slowIntervalId = null;
    }
    if (this._cdpSession) {
      try { this._cdpSession.detach().catch(() => { }); } catch { }
      this._cdpSession = null;
    }
  }
}
