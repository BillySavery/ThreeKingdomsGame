// Three Kingdoms Daily stats Worker
// POST /play  -> logs one finished game
// GET  /day?game=full-ranks&date=2026-11-03&score=8 -> public summary of today's results for one game
// POST /pick  -> Nine Provinces: logs one right answer in one square
// GET  /picks?game=nine-provinces&date=2026-11-15 -> how often each answer was used in each square
// GET  /rank?game=nine-provinces&date=2026-11-15&player=ID -> one player's rarity rank among everyone who finished
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

    // ---- Nine Provinces: log one right answer in one square (rarity) ----
    // Table: picks (game, puzzle_date, player, cell, answer), one answer per player per square per day
    if (url.pathname === "/pick" && request.method === "POST") {
      let d;
      try {
        const text = await request.text();
        if (text.length > 1000) throw new Error("too big");
        d = JSON.parse(text);
      } catch {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }
      const game = String(d.game || "").toLowerCase();
      const date = String(d.date || "");
      const player = String(d.player || "");
      const cell = int(d.cell);
      const answer = String(d.answer || "").slice(0, 60);
      if (!/^[a-z0-9-]{2,40}$/.test(game) || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !/^[a-zA-Z0-9-]{8,64}$/.test(player) || cell == null || cell < 0 || cell > 8 || !answer) {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }
      await env.DB.prepare(
        `INSERT OR IGNORE INTO picks (game, puzzle_date, player, cell, answer) VALUES (?, ?, ?, ?, ?)`
      ).bind(game, date, player, cell, answer).run();
      return new Response("ok", { headers: cors(origin) });
    }

    // ---- Nine Provinces: how often each answer was used in each square today ----
    if (url.pathname === "/picks" && request.method === "GET") {
      const game = String(url.searchParams.get("game") || "").toLowerCase();
      const date = String(url.searchParams.get("date") || "");
      if (!/^[a-z0-9-]{2,40}$/.test(game) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }
      const rows = (await env.DB.prepare(
        `SELECT cell, answer, COUNT(*) AS n FROM picks WHERE game = ?1 AND puzzle_date = ?2 GROUP BY cell, answer`
      ).bind(game, date).all()).results;
      const players = (await env.DB.prepare(
        `SELECT COUNT(DISTINCT player) AS p FROM picks WHERE game = ?1 AND puzzle_date = ?2`
      ).bind(game, date).first())?.p || 0;
      const cells = {};
      for (const r of rows) (cells[r.cell] = cells[r.cell] || {})[r.answer] = r.n;
      return new Response(JSON.stringify({ game, date, players, cells }), {
        headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      });
    }

    // ---- Nine Provinces: where one player's rarity score ranks among everyone who finished that day ----
    // Rarity per square = share of right answers in that square that used the same officer (min 1), empty square = 100. Lower is better.
    if (url.pathname === "/rank" && request.method === "GET") {
      const game = String(url.searchParams.get("game") || "").toLowerCase();
      const date = String(url.searchParams.get("date") || "");
      const player = String(url.searchParams.get("player") || "");
      if (!/^[a-z0-9-]{2,40}$/.test(game) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-zA-Z0-9-]{8,64}$/.test(player)) {
        return new Response("bad request", { status: 400, headers: cors(origin) });
      }
      const rows = (await env.DB.prepare(
        `WITH tot AS (SELECT cell, COUNT(*) AS t FROM picks WHERE game = ?1 AND puzzle_date = ?2 GROUP BY cell),
              cnt AS (SELECT cell, answer, COUNT(*) AS n FROM picks WHERE game = ?1 AND puzzle_date = ?2 GROUP BY cell, answer),
              fin AS (SELECT DISTINCT player FROM plays WHERE game = ?1 AND puzzle_date = ?2)
         SELECT f.player AS player,
                COALESCE(SUM(MAX(1, CAST(ROUND(100.0 * c.n / t.t) AS INTEGER))), 0) + 100 * (9 - COUNT(p.cell)) AS score
         FROM fin f
         LEFT JOIN picks p ON p.game = ?1 AND p.puzzle_date = ?2 AND p.player = f.player
         LEFT JOIN cnt c ON c.cell = p.cell AND c.answer = p.answer
         LEFT JOIN tot t ON t.cell = p.cell
         GROUP BY f.player`
      ).bind(game, date).all()).results;
      const me = rows.find((r) => r.player === player);
      const body = { game, date, players: rows.length, score: me ? me.score : null,
        rank: me ? 1 + rows.filter((r) => r.score < me.score).length : null };
      return new Response(JSON.stringify(body), {
        headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
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

      // Chart data. Up to 20 points: one bar per score. Bigger scores (Battle Map): ten bands.
      // One point games (Mystery Officer, 15 guesses): guesses taken by solvers, in bands of three.
      const max = int(url.searchParams.get("max")) || 0;
      let sql;
      if (max === 1) sql = `SELECT MIN(CAST(mistakes / 3 AS INTEGER), 4) AS k, COUNT(*) AS n FROM plays WHERE game = ?1 AND puzzle_date = ?2 AND score = 1 AND mistakes IS NOT NULL GROUP BY k`;
      else if (max > 20) sql = `SELECT MIN(CAST(score * 10 / ${max} AS INTEGER), 9) AS k, COUNT(*) AS n FROM plays WHERE game = ?1 AND puzzle_date = ?2 AND score IS NOT NULL GROUP BY k`;
      else sql = `SELECT score AS k, COUNT(*) AS n FROM plays WHERE game = ?1 AND puzzle_date = ?2 AND score IS NOT NULL GROUP BY k LIMIT 50`;
      const rows = (await env.DB.prepare(sql).bind(game, date).all()).results;

      const plays = sum?.plays || 0;
      const dist = {};
      for (const r of rows) dist[r.k] = r.n;
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
