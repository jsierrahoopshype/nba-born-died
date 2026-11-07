// NBA Born & Died (HoopsMatic). Everything here works on this site's own files:
// the rows already in the page, the small index files (search.json: name,
// page, career years, weight; surprise.json: page, weight; facts.json:
// sentence, page) and, for "today", the static page of the visitor's date. No third-party requests.
(function () {
  "use strict";
  var doc = document;
  doc.documentElement.classList.remove("no-js");
  var ROOT = new URL(doc.body.getAttribute("data-root") || "./", location.href);
  var MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
    "november", "december"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
    "November", "December"];

  function getJSON(rel) {
    return fetch(new URL(rel, ROOT).href, { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  // ------------------------------------------------------------ search
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[.'’`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  }
  function within1(a, b) {          // edit distance <= 1
    if (a === b) return true;
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
  }
  var INDEX = null, loading = null;
  function loadIndex(input) {
    if (INDEX) return Promise.resolve(INDEX);
    if (!loading) {
      loading = getJSON(input.getAttribute("data-index").replace(/^(\.\.\/)*/, "")).then(function (rows) {
        INDEX = rows.map(function (r) {
          var k = norm(r[0]);
          return { name: r[0], url: r[1], yrs: r[2], w: r[3], toks: k.split(" "), compact: k.replace(/ /g, "") };
        });
        return INDEX;
      });
    }
    return loading;
  }
  function score(e, qt, qc) {
    // 2: every query word starts a name word; 1: the same with one typo allowed
    // in words of 4+ letters; also accepts the name without spaces ("aj", "oneal").
    if (qc.length >= 2 && e.compact.indexOf(qc) === 0) return 2;
    var exact = true;
    for (var i = 0; i < qt.length; i++) {
      var t = qt[i], hit = false, fuzzy = false;
      for (var j = 0; j < e.toks.length; j++) {
        var w = e.toks[j];
        if (w.indexOf(t) === 0) { hit = true; break; }
        if (t.length >= 4 && (within1(t, w) || within1(t, w.slice(0, t.length)))) fuzzy = true;
      }
      if (!hit) { if (!fuzzy) return 0; exact = false; }
    }
    return exact ? 2 : 1;
  }
  function search(q) {
    var qn = norm(q);
    if (!qn) return [];
    var qt = qn.split(" "), qc = qn.replace(/ /g, "");
    var out = [];
    for (var i = 0; i < INDEX.length; i++) {
      var s = score(INDEX[i], qt, qc);
      if (s) out.push([s, INDEX[i]]);
    }
    out.sort(function (a, b) { return b[0] - a[0] || b[1].w - a[1].w; });
    return out.slice(0, 8).map(function (x) { return x[1]; });
  }
  doc.querySelectorAll(".gsearch").forEach(function (input) {
    var list = doc.getElementById(input.getAttribute("aria-controls"));
    var results = [], sel = -1;
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); sel = -1; }
    function render() {
      if (!input.value.trim()) { close(); return; }
      list.innerHTML = results.length ? results.map(function (e, i) {
        var a = doc.createElement("a");
        a.href = new URL(e.url, ROOT).href;
        a.textContent = e.name;
        var y = doc.createElement("span");
        y.className = "yrs";
        y.textContent = e.yrs;
        a.appendChild(y);
        return '<li role="option" id="gs-o' + i + '" aria-selected="' + (i === sel) + '">' + a.outerHTML + "</li>";
      }).join("") : '<li class="none">No player found.</li>';
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      if (sel >= 0) input.setAttribute("aria-activedescendant", "gs-o" + sel); else input.removeAttribute("aria-activedescendant");
    }
    input.addEventListener("focus", function () { loadIndex(input); });
    input.addEventListener("input", function () {
      loadIndex(input).then(function () { results = search(input.value); sel = results.length ? 0 : -1; render(); });
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" && results.length) { sel = (sel + 1) % results.length; render(); e.preventDefault(); }
      else if (e.key === "ArrowUp" && results.length) { sel = (sel - 1 + results.length) % results.length; render(); e.preventDefault(); }
      else if (e.key === "Escape") { close(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        loadIndex(input).then(function () {
          results = search(input.value);
          var pick = results[sel >= 0 && sel < results.length ? sel : 0];
          if (pick) location.href = new URL(pick.url, ROOT).href;
        });
      }
    });
    input.form.addEventListener("submit", function (e) { e.preventDefault(); });
    doc.addEventListener("click", function (e) { if (!input.form.contains(e.target)) close(); });
  });

  // ------------------------------------------------------------ surprise me
  var PICKS = null;
  doc.querySelectorAll("[data-surprise]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      (PICKS ? Promise.resolve(PICKS) : getJSON("surprise.json").then(function (p) { PICKS = p; return p; }))
        .then(function (picks) {
          var here = location.pathname, total = 0, i;
          for (i = 0; i < picks.length; i++) total += picks[i][1];
          for (var tries = 0; tries < 5; tries++) {
            var r = Math.random() * total;
            for (i = 0; i < picks.length; i++) { r -= picks[i][1]; if (r <= 0) break; }
            var url = new URL(picks[Math.min(i, picks.length - 1)][0], ROOT);
            if (url.pathname !== here) { location.href = url.href; return; }
          }
        })
        .catch(function () { location.href = a.href; });
    });
  });

  // ------------------------------------------------------------ home facts: a fresh pick on each visit
  // facts.json holds [sentence, page] pairs. The page ships the build's daily
  // pick; here it is replaced by a random one from the pool.
  doc.querySelectorAll(".facts-grid[data-pool]").forEach(function (grid) {
    var show = parseInt(grid.getAttribute("data-show") || "6", 10);
    getJSON(grid.getAttribute("data-pool")).then(function (pool) {
      if (!pool || pool.length < show) return;
      pool = pool.slice();
      for (var i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = pool[i];
        pool[i] = pool[j]; pool[j] = t;
      }
      var frag = doc.createDocumentFragment();
      pool.slice(0, show).forEach(function (f) {
        var a = doc.createElement("a");
        a.className = "fact";
        a.href = new URL(f[1], ROOT).href;
        var v = doc.createElement("span");
        v.className = "fv";
        v.textContent = f[0];
        var go = doc.createElement("span");
        go.className = "fa";
        go.textContent = "See it →";
        a.appendChild(v);
        a.appendChild(go);
        frag.appendChild(a);
      });
      grid.textContent = "";
      grid.appendChild(frag);
    }).catch(function () { /* keep the build's pick */ });
  });

  // ------------------------------------------------------------ birthday finder
  // Opens the date's own page (its birthday view), so the address to share is
  // that page's. Days that don't exist in the month are clamped (Feb. 29 stays).
  doc.querySelectorAll("form[data-bfinder]").forEach(function (form) {
    var ms = form.querySelector("[data-month]"), ds = form.querySelector("[data-day]");
    var dim = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var t = new Date();
    ms.value = String(t.getMonth() + 1);
    ds.value = String(t.getDate());
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mo = parseInt(ms.value, 10), d = Math.min(parseInt(ds.value, 10), dim[mo - 1]);
      location.href = new URL("on-this-day/" + MONTHS[mo - 1] + "-" + d + "/#birthdays", ROOT).href;
    });
  });

  // ------------------------------------------------------------ today, in the visitor's calendar
  var now = new Date();
  var md = ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
  doc.querySelectorAll(".today-box").forEach(function (box) {
    var frag = box.querySelector("#today-fragment");
    if (!frag || frag.getAttribute("data-md") === md) return;
    var slug = MONTHS[now.getMonth()] + "-" + now.getDate();
    var pageUrl = new URL("on-this-day/" + slug + "/", ROOT);
    fetch(pageUrl.href, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var d = new DOMParser().parseFromString(html, "text/html");
        var nf = d.getElementById("today-fragment");
        if (!nf) return;
        // Links in the fetched page are relative to that page.
        d.querySelectorAll("[href],[src]").forEach(function (el) {
          ["href", "src"].forEach(function (k) {
            var v = el.getAttribute(k);
            if (v && !/^(https?:|#|data:)/.test(v)) el.setAttribute(k, new URL(v, pageUrl).href);
          });
        });
        var h = nf.querySelector(".day-h");
        var oldH = frag.querySelector(".day-h");
        if (h && oldH && /^Today/.test(oldH.textContent)) h.textContent = "Today: " + MONTH_NAMES[now.getMonth()] + " " + now.getDate();
        frag.replaceWith(doc.importNode(nf, true));
        var nav = box.querySelector(".daynav"), nnav = d.querySelector(".daynav");
        if (nav && nnav) nav.replaceWith(doc.importNode(nnav, true));
      }).catch(function () { /* keep the build date's version */ });
  });

  // ------------------------------------------------------------ sortable tables and filters
  function cellValue(row, i) {
    var td = row.cells[i];
    if (!td) return "";
    return td.hasAttribute("data-v") ? td.getAttribute("data-v") : td.textContent.trim();
  }
  function refresh(table) {
    var st = table._state || (table._state = { q: "", status: "all", all: false });
    var limit = parseInt(table.getAttribute("data-limit") || "0", 10);
    var shown = 0, matched = 0;
    Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
      var ok = (!st.q || r.textContent.toLowerCase().indexOf(st.q) !== -1) &&
        (st.status === "all" || r.getAttribute("data-status") === st.status);
      if (ok) matched += 1;
      var vis = ok && (st.all || !limit || shown < limit);
      if (vis) shown += 1;
      r.hidden = !vis;
    });
    var more = doc.querySelector('[data-more-for="' + table.id + '"]');
    if (more) {
      more.hidden = !limit || matched <= limit;
      more.textContent = st.all ? "Show fewer ↑" : "Show all " + matched.toLocaleString("en-US") + " →";
    }
    var count = doc.querySelector('[data-count-for="' + table.id + '"]');
    if (count) count.textContent = matched.toLocaleString("en-US") + (matched === 1 ? " player" : " players");
  }
  doc.querySelectorAll("table[data-sort]").forEach(function (table) {
    var ths = table.tHead.rows[0].cells;
    Array.prototype.forEach.call(ths, function (th, i) {
      var btn = th.querySelector("button");
      if (!btn) return;
      btn.addEventListener("click", function () {
        var num = th.getAttribute("data-type") === "num";
        var cur = th.getAttribute("aria-sort");
        var dir = cur === "ascending" ? "descending" : cur === "descending" ? "ascending" : (num ? "descending" : "ascending");
        Array.prototype.forEach.call(ths, function (h) { h.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", dir);
        var body = table.tBodies[0];
        var rows = Array.prototype.slice.call(body.rows);
        rows.sort(function (a, b) {
          var va = cellValue(a, i), vb = cellValue(b, i);
          if (va === "" && vb === "") return 0;
          if (va === "") return 1;
          if (vb === "") return -1;
          var c = num ? parseFloat(va) - parseFloat(vb) : va.localeCompare(vb);
          return dir === "ascending" ? c : -c;
        });
        rows.forEach(function (r) { body.appendChild(r); });
        refresh(table);
      });
    });
  });
  doc.querySelectorAll("table[data-filterable]").forEach(refresh);
  doc.querySelectorAll("[data-filter-for]").forEach(function (input) {
    var table = doc.getElementById(input.getAttribute("data-filter-for"));
    input.addEventListener("input", function () { table._state.q = input.value.trim().toLowerCase(); refresh(table); });
  });
  doc.querySelectorAll("[data-status-for]").forEach(function (group) {
    var table = doc.getElementById(group.getAttribute("data-status-for"));
    group.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-status]");
      if (!b) return;
      group.querySelectorAll("button").forEach(function (x) { x.classList.toggle("active", x === b); x.setAttribute("aria-pressed", String(x === b)); });
      table._state.status = b.getAttribute("data-status");
      refresh(table);
    });
  });
  doc.querySelectorAll("[data-more-for]").forEach(function (btn) {
    var table = doc.getElementById(btn.getAttribute("data-more-for"));
    btn.addEventListener("click", function () { table._state.all = !table._state.all; refresh(table); });
  });

  // ------------------------------------------------------------ view chips (lifespan) and age chips
  doc.querySelectorAll("[data-views-for]").forEach(function (group) {
    var box = doc.getElementById(group.getAttribute("data-views-for"));
    function show(v) {
      var ok = false;
      group.querySelectorAll("button").forEach(function (x) {
        var on = x.getAttribute("data-view") === v; ok = ok || on;
        x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on));
      });
      if (!ok) return false;
      box.querySelectorAll(":scope > [data-view]").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-view") === v); });
      return true;
    }
    group.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-view]");
      if (!b) return;
      show(b.getAttribute("data-view"));
      history.replaceState(null, "", "#" + b.getAttribute("data-view"));
    });
    if (location.hash && show(location.hash.slice(1))) box.scrollIntoView();
  });
  doc.querySelectorAll("[data-ages-for]").forEach(function (group) {
    var table = doc.getElementById(group.getAttribute("data-ages-for"));
    group.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-age]");
      if (!b) return;
      var on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("active", on);
      table.classList.toggle("hide-" + b.getAttribute("data-age"), !on);
    });
  });
})();
