import type { ServerWebSocket } from "bun";
import { ChessAPI } from "../api/chess/website";

// 
//  Local HTTP + WebSocket server for the chess board UI.
// 
//     --> Started automatically by app/launch.ts <--
// 

const PORT = Number(process.env.PORT ?? 3000);
const clients = new Set<ServerWebSocket<unknown>>();

const server = Bun.serve({
    port: PORT,
    fetch(req, server) {
        const url = new URL(req.url);

        if (url.pathname === "/ws") {
            if (server.upgrade(req)) return;
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        return new Response(Bun.file(new URL("./index.html", import.meta.url)));
    },
    websocket: {
        open(ws) {
            clients.add(ws);
        },
        close(ws) {
            clients.delete(ws);
        },
        message() {},
    },
});

console.log(`Chess board running at http://localhost:${server.port}`);
console.log("Opening Chess.com...");

const chess = new ChessAPI({ debug: false });
await chess.login("yopahej101@faxzu.com", "JJdK123123!");
const board = await chess.startGame();

board.startLiveScreenshot(1000, (dataUrl) => {
    for (const client of clients) {
        client.send(dataUrl);
    }
});
