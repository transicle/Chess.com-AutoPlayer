import type { ServerWebSocket } from "bun";
import { ChessAPI } from "../api/chess/website";
const PORT = Number(process.env.PORT ?? 3000);
const clients = new Set<ServerWebSocket<unknown>>();
const server = Bun.serve({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      console.log(`[WS] Upgrade request: ${req.url}`);
      if (server.upgrade(req)) {
        console.log("[WS] Upgrade successful");
        return;
      }
      console.error("[WS] Upgrade failed");
      return new Response("WebSocket upgrade failed", { status: 400 });
    }
    return new Response(Bun.file(new URL("./index.html", import.meta.url)), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
    async message(ws, message) {
      try {
        let text = null;
        if (typeof message === "string") text = message;
        else if (message instanceof ArrayBuffer)
          text = new TextDecoder().decode(message);
        if (!text) return;
        const obj = JSON.parse(text);
        if (obj && obj.type === "manual-move" && typeof obj.move === "string") {
          try {
            const ok = await (board as any)
              .sanMove(obj.move)
              .catch(() => false);
            ws.send(JSON.stringify({ type: "manual-move-result", ok }));
          } catch (e) {
            ws.send(JSON.stringify({ type: "manual-move-result", ok: false }));
          }
        }
      } catch (e) { }
    },
  },
});
console.log(`Chess board running at http://localhost:${server.port}`);
console.log("Opening Chess.com...");
const chess = new ChessAPI({ debug: true });
await chess.login(
  process.env.CHESS_USERNAME as string,
  process.env.CHESS_PASSWORD as string,
);
const board = await chess.startGame();
if (board) {
  const requestedMs = Number(process.env.REFRESH_RATE) || 0;
  const targetFps = Number(process.env.TARGET_FPS) || 30;
  const frameInterval = requestedMs || Math.round(1000 / targetFps);
  board.liveScreenshot(
    frameInterval,
    (jsonStr) => {
      for (const client of clients) {
        client.send(jsonStr);
      }
    },
    (jpegBuf) => {
      for (const client of clients) {
        client.send(jpegBuf);
      }
    },
  );
} else {
  console.error("Failed to start game after retries. Dashboard will remain idle.");
}
