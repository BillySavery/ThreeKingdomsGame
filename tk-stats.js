// Three Kingdoms Daily: report a finished game to the stats Worker
// Add to every game page:  <script src="/tk-stats.js"></script>
// Then call tkReport(...) once, at the moment a game ends.

(function () {
  var ENDPOINT = "https://tkstats.billysavery1234.workers.dev/play";

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
    try {
      // sendBeacon survives the player closing the tab straight after
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) {}
    fetch(ENDPOINT, { method: "POST", body: body, keepalive: true }).catch(function () {});
  };
})();
