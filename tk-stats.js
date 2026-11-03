// Three Kingdoms Daily: report a finished game to the stats Worker
// Add to every game page:  <script src="/tk-stats.js"></script>
// Then call tkReport(...) once, at the moment a game ends.

(function () {
  var BASE = "https://tkstats.billysavery1234.workers.dev";
  var ENDPOINT = BASE + "/play";

  function playerId() {
    try {
      var id = localStorage.getItem("tk_pid");
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID()
              : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
        localStorage.setItem("tk_pid", id);
      }
      return id;
    } catch (e) {
      return "anon-" + Math.random().toString(36).slice(2, 14);
    }
  }

  function todayUK() {
    // Puzzle date in UK time, YYYY-MM-DD
    return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  }

  /**
   * tkReport("full-ranks", { score: 8, max: 10, mistakes: 2, perfect: false })
   * Fields: score, max, mistakes, hint (true/false), perfect (true/false), date (optional)
   */

  /**
   * tkDayStats("full-ranks", { score: 8, max: 10 })
   * Shows how everyone else did today, just above the share button. Quietly does nothing if the stats can't be loaded.
   */
  window.tkDayStats = function (game, result) {
    result = result || {};
    var share = document.getElementById("share");
    if (!share || !share.parentNode) return;
    var box = document.getElementById("tkday");
    if (!box) {
      box = document.createElement("div");
      box.id = "tkday";
      box.setAttribute("aria-live", "polite");
      box.style.cssText = "margin:14px auto 12px;max-width:420px;padding:12px 14px;border:1px solid rgba(217,164,65,.35);border-radius:10px;background:rgba(0,0,0,.18);font-size:13px;line-height:1.5;text-align:left";
      box.hidden = true;
      share.parentNode.insertBefore(box, share);
    }
    var max = Number(result.max) || 0, score = Number(result.score);
    var url = BASE + "/day?game=" + encodeURIComponent(game) + "&date=" + (result.date || todayUK()) +
      (Number.isFinite(score) ? "&score=" + score : "");
    var fmt = function (n) { return Math.round(n * 10) / 10; };
    var go = function () {
      fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.plays) return;
        var lines = [];
        lines.push("<b style='color:#d9a441;letter-spacing:.08em;text-transform:uppercase;font-size:11px'>Today across all players</b>");
        var bits = [d.plays + (d.plays === 1 ? " player" : " players")];
        if (max === 1) bits.push(Math.round(d.avg_score * 100) + "% solved it");
        else {
          bits.push(Math.round(100 * d.perfect / d.plays) + "% got a perfect game");
          if (d.avg_score != null) bits.push("average " + fmt(d.avg_score) + (max ? " / " + max : ""));
        }
        lines.push(bits.join(" · "));
        if (d.plays > 1 && d.pct_below != null && max !== 1) {
          var beat = Math.round(d.pct_below);
          lines.push(beat > 0 ? "You beat <b>" + beat + "%</b> of players." : (d.pct_equal >= 99 ? "Everyone scored the same so far." : "Tough one. Most players did better today."));
        }
        if (d.dist && max && max <= 20) {
          var top = 0, k;
          for (k in d.dist) top = Math.max(top, d.dist[k]);
          var bars = "";
          for (var i = 0; i <= max; i++) {
            var c = d.dist[i] || 0, me = i === score;
            bars += "<div style='display:flex;align-items:center;gap:6px;font-size:11px'><span style='width:18px;text-align:right;color:#a8987f'>" + i + "</span>" +
              "<span style='height:9px;border-radius:2px;background:" + (me ? "#d9a441" : "#5a4632") + ";width:" + (top ? Math.max(c ? 3 : 0, 100 * c / top) : 0) + "%'></span>" +
              "<span style='color:#a8987f'>" + (c || "") + "</span></div>";
          }
          lines.push("<div style='margin-top:6px;display:grid;gap:2px'>" + bars + "</div>");
        }
        box.innerHTML = lines.join("<br>").replace("<br><div", "<div");
        box.hidden = false;
      }).catch(function () {});
    };
    setTimeout(go, 1200); // give this player's own result a moment to land
  };

  window.tkReport = function (game, result) {
    result = result || {};
    var body = JSON.stringify({
      game: game,
      date: result.date || todayUK(),
      player: playerId(),
      score: result.score,
      max: result.max,
      mistakes: result.mistakes,
      hint: !!result.hint,
      perfect: !!result.perfect,
    });
    try { window.tkDayStats(game, result); } catch (e) {}
    try {
      // sendBeacon survives the player closing the tab straight after
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) {}
    fetch(ENDPOINT, { method: "POST", body: body, keepalive: true }).catch(function () {});
  };
})();
