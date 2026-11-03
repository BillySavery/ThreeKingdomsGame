// Three Kingdoms Daily stats Worker
// POST /play  -> logs one finished game
// GET  /day?game=full-ranks&date=2026-11-03&score=8 -> public summary of today's results for one game
// GET  /stats?key=YOUR_KEY -> private stats page
//
// Deploy: Cloudflare dashboard > Workers & Pages > tkstats > Edit code, paste this whole file, Deploy.
// The DB (D1) binding and STATS_KEY secret already on the Worker are kept as they are.

const ALLOWED_ORIGINS = [
  "https://threekingdomsgame.co.uk",
  "https://www.threekingdomsgame.co.uk",
  "https://billysavery.github.io",
];

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": ok,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(origin) });
    }

    // ---- Log a finished game ----
    if (url.pathname === "/play" && request.method === "POST") {
      let d;
      try {
        const text = await request.text();
        if (text.length > 2000) throw new Error("too big");
        d = JSON.parse(text);
      } catch {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }

      const game = String(d.game || "").toLowerCase();
      const date = String(d.date || "");
      const player = String(d.player || "");
      if (!/^[a-z0-9-]{2,40}$/.test(game) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !/^[a-zA-Z0-9-]{8,64}$/.test(player)) {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }

      // One result per player per game per day; first result wins
      await env.DB.prepare(
        `INSERT OR IGNORE INTO plays
         (game, puzzle_date, player, score, max_score, mistakes, hint, perfect, country)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        game, date, player,
        int(d.score), int(d.max), int(d.mistakes),
        d.hint ? 1 : 0, d.perfect ? 1 : 0,
        request.cf?.country || null
      ).run();

      return new Response("ok", { headers: cors(origin) });
    }

    // ---- Public: how everyone did today on one game ----
    if (url.pathname === "/day" && request.method === "GET") {
      const game = String(url.searchParams.get("game") || "").toLowerCase();
      const date = String(url.searchParams.get("date") || "");
      const score = int(url.searchParams.get("score"));
      if (!/^[a-z0-9-]{2,40}$/.test(game) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }

      const sum = await env.DB.prepare(
        `SELECT COUNT(*) AS plays, SUM(perfect) AS perfect,
                ROUND(AVG(score), 2) AS avg_score, ROUND(AVG(mistakes), 2) AS avg_mistakes,
                SUM(CASE WHEN score < ?3 THEN 1 ELSE 0 END) AS below,
                SUM(CASE WHEN score = ?3 THEN 1 ELSE 0 END) AS equal
         FROM plays WHERE game = ?1 AND puzzle_date = ?2`
      ).bind(game, date, score ?? -1).first();

      const rows = (await env.DB.prepare(
        `SELECT score, COUNT(*) AS n FROM plays
         WHERE game = ?1 AND puzzle_date = ?2 AND score IS NOT NULL
         GROUP BY score ORDER BY score LIMIT 50`
      ).bind(game, date).all()).results;

      const plays = sum?.plays || 0;
      const dist = {};
      for (const r of rows) dist[r.score] = r.n;
      const body = {
        game, date, plays,
        perfect: sum?.perfect || 0,
        avg_score: sum?.avg_score,
        avg_mistakes: sum?.avg_mistakes,
        dist,
        // share of players who scored lower or the same as the score asked about
        pct_below: score == null || !plays ? null : Math.round(1000 * (sum.below || 0) / plays) / 10,
        pct_equal: score == null || !plays ? null : Math.round(1000 * (sum.equal || 0) / plays) / 10,
      };
      return new Response(JSON.stringify(body), {
        headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      });
    }

    // ---- Private stats page ----
    if (url.pathname === "/stats") {
      if (!env.STATS_KEY || url.searchParams.get("key") !== env.STATS_KEY) {
        return new Response("Not found", { status: 404 });
      }

      const q = (sql) => env.DB.prepare(sql).all().then((r) => r.results);

      const [overall, byGame, daily, countries, days] = await Promise.all([
        q(`SELECT COUNT(*) AS plays,
                  COUNT(DISTINCT player) AS players,
                  (SELECT COUNT(*) FROM (SELECT player FROM plays GROUP BY player
                     HAVING COUNT(DISTINCT puzzle_date) > 1)) AS came_back,
                  (SELECT COUNT(*) FROM (SELECT player FROM plays GROUP BY player
                     HAVING COUNT(DISTINCT game) > 1)) AS multi_game
           FROM plays`),
        q(`SELECT game, COUNT(*) AS plays, COUNT(DISTINCT player) AS players,
                  SUM(perfect) AS perfect,
                  ROUND(100.0 * SUM(perfect) / COUNT(*), 1) AS perfect_pct,
                  ROUND(AVG(score), 1) AS avg_score,
                  ROUND(AVG(mistakes), 1) AS avg_mistakes,
                  ROUND(100.0 * SUM(hint) / COUNT(*), 1) AS hint_pct
           FROM plays GROUP BY game ORDER BY plays DESC`),
        q(`SELECT puzzle_date, game, COUNT(*) AS plays, SUM(perfect) AS perfect,
                  ROUND(100.0 * SUM(perfect) / COUNT(*), 1) AS perfect_pct
           FROM plays WHERE puzzle_date >= date('now', '-14 day')
           GROUP BY puzzle_date, game ORDER BY puzzle_date DESC, plays DESC`),
        q(`SELECT COALESCE(country, '??') AS country, COUNT(DISTINCT player) AS players
           FROM plays GROUP BY country ORDER BY players DESC LIMIT 15`),
        q(`SELECT p.puzzle_date AS day, COUNT(*) AS games, COUNT(DISTINCT p.player) AS players,
                  COUNT(DISTINCT CASE WHEN f.first_day = p.puzzle_date THEN p.player END) AS new_players,
                  COUNT(DISTINCT CASE WHEN f.first_day < p.puzzle_date THEN p.player END) AS returning_players,
                  SUM(p.perfect) AS perfect
           FROM plays p JOIN (SELECT player, MIN(puzzle_date) AS first_day FROM plays GROUP BY player) f
             ON f.player = p.player
           GROUP BY p.puzzle_date ORDER BY p.puzzle_date DESC LIMIT 60`),
      ]);

      const table = (rows) => {
        if (!rows.length) return "<p class='muted'>No data yet</p>";
        const cols = Object.keys(rows[0]);
        return `<table><thead><tr>${cols.map((c) => `<th>${c.replace(/_/g, " ")}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td>${r[c] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      };

      const o = overall[0] || {};
      const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>TK Daily Stats</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#14110f;color:#eee}
h1{margin:0 0 16px}h2{margin:28px 0 8px;font-size:18px;color:#d4a24c}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
.card{background:#221d19;border-radius:10px;padding:14px}.card b{display:block;font-size:28px;color:#d4a24c}
table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow-x:auto}
th,td{padding:6px 10px;border-bottom:1px solid #333;text-align:left;white-space:nowrap}
th{color:#aaa;font-weight:600;text-transform:capitalize}.muted{color:#888}
</style></head><body>
<h1>Three Kingdoms Daily stats</h1>
<div class="cards">
  <div class="card"><b>${o.plays ?? 0}</b>games finished</div>
  <div class="card"><b>${o.players ?? 0}</b>unique players</div>
  <div class="card"><b>${o.came_back ?? 0}</b>came back another day</div>
  <div class="card"><b>${o.multi_game ?? 0}</b>played 2+ games</div>
</div>
<h2>Day by day</h2>${table(days)}
<h2>By game (all time)</h2>${table(byGame)}
<h2>Last 14 days</h2>${table(daily)}
<h2>Top countries</h2>${table(countries)}
</body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    return new Response("Not found", { status: 404 });
  },
};
