// Filtro/orden client-side. El HTML ya trae solo el índice público
// (mainnet + 402 live). No hay tabs de testnet/dead.
(function () {
  var grid = document.getElementById("grid");
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll(".card"));
  var qInput = document.getElementById("q");
  var networkSelect = document.getElementById("network-filter");
  var sortSelect = document.getElementById("sort");
  var clearBtn = document.getElementById("clear-filters");
  var tagFiltersEl = document.getElementById("tag-filters");
  var resultCount = document.getElementById("result-count");
  var emptyState = document.getElementById("empty-state");

  var activeTags = new Set();

  function matches(card) {
    var q = qInput.value.trim().toLowerCase();
    var network = networkSelect.value;

    if (q) {
      var haystack = card.dataset.name + " " + card.dataset.desc;
      if (haystack.indexOf(q) === -1) return false;
    }
    if (network && card.dataset.network !== network) return false;
    if (activeTags.size > 0) {
      var cardTags = card.dataset.tags.split("|");
      var hasAny = Array.prototype.some.call(activeTags, function (t) {
        return cardTags.indexOf(t) !== -1;
      });
      if (!hasAny) return false;
    }
    return true;
  }

  function sortValue(card) {
    var mode = sortSelect.value;
    if (mode === "price-asc" || mode === "price-desc") {
      var v = parseFloat(card.dataset.priceMin);
      return isNaN(v) ? Infinity : v;
    }
    if (mode === "new") {
      return card.dataset.new === "1" ? 0 : 1;
    }
    return card.dataset.name;
  }

  function apply() {
    var visible = 0;
    cards.forEach(function (card) {
      var show = matches(card);
      card.hidden = !show;
      if (show) visible++;
    });

    var mode = sortSelect.value;
    var sorted = cards.slice().sort(function (a, b) {
      var va = sortValue(a), vb = sortValue(b);
      if (va < vb) return mode === "price-desc" ? 1 : -1;
      if (va > vb) return mode === "price-desc" ? -1 : 1;
      return 0;
    });
    sorted.forEach(function (card) { grid.appendChild(card); });

    resultCount.textContent = visible + (visible === 1 ? " endpoint cobrable" : " endpoints cobrables");
    emptyState.hidden = visible !== 0;
  }

  qInput.addEventListener("input", apply);
  networkSelect.addEventListener("change", apply);
  sortSelect.addEventListener("change", apply);

  tagFiltersEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-chip");
    if (!btn) return;
    var tag = btn.dataset.filterTag;
    if (!tag) return;
    if (activeTags.has(tag)) {
      activeTags.delete(tag);
      btn.classList.remove("is-active");
    } else {
      activeTags.add(tag);
      btn.classList.add("is-active");
    }
    apply();
  });

  clearBtn.addEventListener("click", function () {
    qInput.value = "";
    networkSelect.value = "";
    sortSelect.value = "name";
    activeTags.clear();
    tagFiltersEl.querySelectorAll(".filter-chip.is-active").forEach(function (b) {
      b.classList.remove("is-active");
    });
    apply();
  });

  apply();
})();
