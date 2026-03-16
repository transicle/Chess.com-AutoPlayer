import type { Page } from "playwright";
import type { PlayerData, BoardInfo, MoveListResult } from "./types";

export async function scrapePlayerData(page: Page): Promise<PlayerData> {
  const topUsername = await page
    .locator("#board-layout-player-top .cc-user-username-component")
    .innerText({ timeout: 500 })
    .catch(() => "");
  const topAvatarRaw = await page
    .locator("#board-layout-player-top .cc-avatar-img")
    .getAttribute("src", { timeout: 500 })
    .catch(() => null);
  const topAvatar = topAvatarRaw ?? "";
  const topRatingRaw = await page
    .locator("#board-layout-player-top .cc-user-rating-white")
    .innerText({ timeout: 500 })
    .catch(() => null);
  const topRating = topRatingRaw ?? "";
  const topClock = await page
    .locator("#board-layout-player-top .clock-time-monospace")
    .innerText({ timeout: 500 })
    .catch(() => "");
  const bottomUsername = await page
    .locator("#board-layout-player-bottom .cc-user-username-component")
    .innerText({ timeout: 500 })
    .catch(() => "");
  const bottomAvatarRaw = await page
    .locator("#board-layout-player-bottom .cc-avatar-img")
    .getAttribute("src", { timeout: 500 })
    .catch(() => null);
  const bottomAvatar = bottomAvatarRaw ?? "";
  const bottomRatingRaw = await page
    .locator("#board-layout-player-bottom .cc-user-rating-white")
    .innerText({ timeout: 500 })
    .catch(() => null);
  const bottomRating = bottomRatingRaw ?? "";
  const bottomClock = await page
    .locator("#board-layout-player-bottom .clock-time-monospace")
    .innerText({ timeout: 500 })
    .catch(() => "");

  let topPanel: string | undefined;
  let bottomPanel: string | undefined;
  try {
    const topBuf = await page
      .locator("#board-layout-player-top")
      .screenshot({ timeout: 500 })
      .catch(() => null);
    if (topBuf) topPanel = `data:image/png;base64,${topBuf.toString("base64")}`;
  } catch {}
  try {
    const bottomBuf = await page
      .locator("#board-layout-player-bottom")
      .screenshot({ timeout: 500 })
      .catch(() => null);
    if (bottomBuf) bottomPanel = `data:image/png;base64,${bottomBuf.toString("base64")}`;
  } catch {}

  return {
    top: { username: topUsername, avatar: topAvatar, rating: topRating, clock: topClock, panel: topPanel },
    bottom: { username: bottomUsername, avatar: bottomAvatar, rating: bottomRating, clock: bottomClock, panel: bottomPanel },
  };
}

export async function scrapeMovesFromPage(page: Page): Promise<string[]> {
  try {
    const result = await page.evaluate(() => {
      function queryShadow(root: Document | ShadowRoot | Element, selector: string): HTMLElement[] {
        let list: HTMLElement[] = Array.from(root.querySelectorAll(selector));
        const all = root.querySelectorAll("*");
        for (let i = 0; i < all.length; i++) {
          const el = all[i];
          if (el && el.shadowRoot) {
            list = list.concat(queryShadow(el.shadowRoot, selector));
          }
        }
        return list;
      }

      const nodes = queryShadow(document, ".node.main-line-ply");
      const moves: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        if (!el) continue;
        let piece = "";
        const icon = el.hasAttribute("data-figurine") ? el : el.querySelector("[data-figurine]");
        if (icon) piece = icon.getAttribute("data-figurine") || "";
        if (!piece) {
          const iconSearch = el.querySelector("span[class*='icon-font-chess'], span[class*='piece'], .icon-font-chess, .piece");
          if (iconSearch) {
            const cls = iconSearch.className.toLowerCase();
            if (cls.includes("queen")) piece = "Q";
            else if (cls.includes("rook")) piece = "R";
            else if (cls.includes("bishop")) piece = "B";
            else if (cls.includes("knight")) piece = "N";
            else if (cls.includes("king")) piece = "K";
          }
        }
        let txt = el.textContent?.replace(/\s+/g, "") || "";
        if (piece && !txt.startsWith(piece)) txt = piece + txt;
        if (/[a-h1-8O0KQRNBx#+=\-]{2,}/i.test(txt)) moves.push(txt);
      }
      return { count: moves.length, moves };
    }).catch(() => null);

    if (result && result.count > 0) return result.moves;
  } catch (e) {}

  try {
    const selectors = [".move-list", ".moves", ".vertical-move-list-component", "wc-chess-moves", ".moves-history"];
    for (const sel of selectors) {
      if ((await page.locator(sel).count().catch(() => 0)) > 0) {
        const text = await page.locator(sel).innerText().catch(() => "");
        if (!text) continue;
        const tokens = text.replace(/\u200B/g, "").split(/\s+/).filter((t) => t && !/^\d+\.$/.test(t));
        const moves = tokens.filter((t) => !/[s:]/i.test(t) && !/^\d+(\.\d+)?$/.test(t) && /[a-h1-8O0KQRNBx#+=\-]{2,}/i.test(t));
        if (moves.length) return moves;
      }
    }
  } catch (e) {}
  return [];
}

export async function getBoardInfo(page: Page): Promise<BoardInfo | null> {
  const info = await page.evaluate(() => {
    const boardEl = document.querySelector("wc-chess-board") as any;
    if (!boardEl) return null;
    const rect = boardEl.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    let flipped = false;
    try {
      if (boardEl.isFlipped === true || boardEl.flipped === true || boardEl._flipped === true) flipped = true;
      else {
        const orient = boardEl.getAttribute("orientation") || boardEl.getAttribute("data-orientation") || boardEl._orientation || boardEl.orientation;
        if (orient === "black" || orient === "b") flipped = true;
      }
      if (!flipped && (document.querySelector('.board-v5.flipped') || boardEl.classList?.contains("flipped"))) flipped = true;
      if (!flipped) {
        const coords = boardEl.querySelectorAll('[class*="coord"], [class*="notation"], .coords-rank, text');
        for (let i = 0; i < coords.length; i++) {
          const el = coords[i] as HTMLElement;
          const txt = el.textContent?.trim();
          if (txt === "1" || txt === "8") {
            const elRect = el.getBoundingClientRect();
            const boardMid = rect.top + rect.height / 2;
            if (txt === "1" && elRect.top < boardMid) { flipped = true; break; }
            if (txt === "8" && elRect.top > boardMid) { flipped = true; break; }
          }
        }
      }
    } catch {}
    return { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, flipped };
  }).catch(() => null);

  if (info) return info;

  return await page.evaluate(() => {
    function findInShadow(root: Document | ShadowRoot | Element): any {
      const b = root.querySelector("wc-chess-board");
      if (b) return b;
      const all = root.querySelectorAll("*");
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el && (el as any).shadowRoot) {
          const found = findInShadow((el as any).shadowRoot);
          if (found) return found;
        }
      }
      return null;
    }
    const boardEl = findInShadow(document);
    if (!boardEl) return null;
    const rect = boardEl.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, flipped: boardEl.flipped || boardEl.isFlipped || false };
  }).catch(() => null);
}

export async function handlePromotion(page: Page, piece: string): Promise<void> {
  const pieceMap: Record<string, string> = { q: "queen", r: "rook", b: "bishop", n: "knight" };
  const pieceName = pieceMap[piece.toLowerCase()] ?? "queen";
  const selectors = [
    `[data-cy="promotion-piece-${piece.toLowerCase()}"]`,
    `.promotion-piece.${pieceName}`,
    `.promotion-${pieceName}`,
    `[class*="promotion"][class*="${pieceName}"]`,
    `[class*="promotion"][class*="${piece.toLowerCase()}"]`,
  ];
  for (const sel of selectors) {
    try {
      if ((await page.locator(sel).count().catch(() => 0)) > 0) {
        await page.locator(sel).first().click({ timeout: 1000 });
        return;
      }
    } catch {}
  }
  try {
    await page.evaluate((targetPiece: string) => {
      const promo = document.querySelector('[class*="promotion"], [data-cy*="promotion"]');
      if (!promo) return false;
      const children = promo.querySelectorAll('[class*="piece"], img, [data-piece]');
      const order = ["q", "r", "b", "n"];
      const idx = order.indexOf(targetPiece.toLowerCase());
      if (idx >= 0 && children[idx]) {
        (children[idx] as HTMLElement).click();
        return true;
      }
      if (children[0]) {
        (children[0] as HTMLElement).click();
        return true;
      }
      return false;
    }, piece);
  } catch {}
}

export async function detectGameOver(page: Page): Promise<boolean> {
  const selectors = [".game-over-modal-container", ".board-modal-container-container", ".board-modal-component"];
  for (const sel of selectors) {
    if (await page.locator(sel).isVisible({ timeout: 500 }).catch(() => false)) return true;
  }
  return false;
}

export async function startNewGame(page: Page): Promise<void> {
  const gameUrl = "https://www.chess.com/play/online/new?action=createLiveChallenge&base=600&timeIncrement=0&rated=rated";
  await page.goto(gameUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
}
