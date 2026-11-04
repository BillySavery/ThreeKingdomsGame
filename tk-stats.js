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
      box.style.cssText = "box-sizing:border-box;width:100%;margin:14px auto 12px;max-width:420px;padding:12px 14px;border:1px solid rgba(217,164,65,.35);border-radius:10px;background:rgba(0,0,0,.18);font-size:13px;line-height:1.5;text-align:left";
      box.hidden = true;
      // go above the row the share button sits in, so it never squeezes in beside the button
      var end = document.getElementById("end"), at = share;
      while (end && at.parentNode && at.parentNode !== end && end.contains(at.parentNode)) at = at.parentNode;
      at.parentNode.insertBefore(box, at);
    }
    var max = Number(result.max) || 0, score = Number(result.score);
    var url = BASE + "/day?game=" + encodeURIComponent(game) + "&date=" + (result.date || todayUK()) + (max ? "&max=" + max : "") +
      (Number.isFinite(score) ? "&score=" + score : "");
    var fmt = function (n) { return Math.round(n * 10) / 10; };
    var go = function () {
      fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (!d || !d.plays) return;
        var lines = [];
        lines.push("<b style='color:#d9a441;letter-spacing:.08em;text-transform:uppercase;font-size:11px'>Today across all players</b>");
        var pc = function (n) { return Math.round(n) + "%"; };
        var p1, p2;
        if (max === 1) {
          // Mystery Officer: solved at all, and solved in three guesses or fewer
          p1 = "<b>" + pc(100 * d.avg_score) + "</b> solved it";
          p2 = "<b>" + pc(100 * d.perfect / d.plays) + "</b> solved it in 3 guesses or fewer";
        } else {
          p1 = "<b>" + pc(100 * d.perfect / d.plays) + "</b> got a perfect game";
          p2 = d.pct_below == null ? "" : "You beat <b>" + pc(d.pct_below) + "</b> of players";
        }
        lines.push(p1 + (p2 ? "<br>" + p2 : ""));
        if (d.dist) {
          var keys = [], lab = function (k) { return String(k); }, mine = score;
          if (max === 1) { keys = [0, 1, 2, 3, 4]; lab = function (k) { return (k * 3 + 1) + "-" + (k * 3 + 3); }; mine = result.mistakes != null && score ? Math.min(4, Math.floor(result.mistakes / 3)) : null; }
          else if (max > 20) { var step = max / 10; for (var j = 0; j < 10; j++) keys.push(j); lab = function (k) { return String(Math.round(k * step)); }; mine = Math.min(9, Math.floor(score / step)); }
          else for (var i = 0; i <= max; i++) keys.push(i);
          var top = 0;
          keys.forEach(function (k) { top = Math.max(top, d.dist[k] || 0); });
          var bars = keys.map(function (k) {
            var c = d.dist[k] || 0;
            return "<div style='display:flex;align-items:center;gap:6px;font-size:11px'><span style='width:34px;text-align:right;color:#a8987f'>" + lab(k) + "</span>" +
              "<span style='height:9px;border-radius:2px;background:" + (k === mine ? "#d9a441" : "#5a4632") + ";width:" + (top ? Math.max(c ? 3 : 0, 88 * c / top) : 0) + "%'></span></div>";
          }).join("");
          lines.push("<div style='margin-top:8px;display:grid;gap:2px'>" + (max === 1 ? "<span style='font-size:11px;color:#a8987f'>Guesses taken by solvers</span>" : "") + bars + "</div>");
        }
        box.innerHTML = lines.join("<br>").replace(/<br><div/g, "<div");
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
