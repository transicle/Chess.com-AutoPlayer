export function getBestMaiaElo(ratingStr: string): string {
  const defaultElo = process.env.MAIA_ELO ?? "1600";
  if (!ratingStr) return defaultElo;
  const match = ratingStr.match(/\d+/);
  if (!match) return defaultElo;
  const rating = parseInt(match[0]);
  if (isNaN(rating)) return defaultElo;
  let elo = Math.round(rating / 100) * 100;
  if (elo < 1100) elo = 1100;
  if (elo > 1900) elo = 1900;
  return String(elo);
}

export async function moveToMaia(
  moveOrMoves: string | string[],
  currentClockSec: number,
  targetElo?: string,
): Promise<string | null> {
  try {
    const elo = targetElo ?? process.env.MAIA_ELO ?? "600";
    const initialClock = Number(process.env.MAIA_INITIAL_CLOCK ?? 180);
    const url = `https://www.maiachess.com/api/v1/play/get_move?maia_name=maia_kdd_${elo}&initial_clock=${initialClock}&current_clock=${currentClockSec}&maia_version=maia3`;
    let bodyToSend: string;
    let contentType = "application/json";
    if (Array.isArray(moveOrMoves)) {
      bodyToSend = JSON.stringify(moveOrMoves);
    } else {
      const s = String(moveOrMoves || "");
      const ogPattern = /^[A-Z0-9]+x[A-Z0-9]+$/i;
      if (ogPattern.test(s) && !s.startsWith("[")) {
        bodyToSend = s;
        contentType = "text/plain";
      } else {
        bodyToSend = JSON.stringify([s]);
      }
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0",
        "Content-Type": contentType,
      },
      body: bodyToSend,
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res) return null;
    const j = await res.json().catch(() => null);
    if (!j) return null;
    if (Array.isArray(j) && j.length) return String(j[0]);
    if (typeof j === "string") return j;
    if (j.move) return String(j.move);
    if (j.best_move) return String(j.best_move);
    for (const k of Object.keys(j)) {
      if (typeof j[k] === "string" && /[a-h][1-8]/i.test(j[k])) return j[k];
    }
    return null;
  } catch (e) {
    return null;
  }
}
