(function () {
  "use strict";

  var API = "/api/atlas";

  var TICKER_DEFAULTS = {
    snapshot: "AAPL",
    crypto_momentum: "BTC",
    red_flag: "BAX",
    earnings_brief: "TSLA",
    council_dossier: "MSTR",
    watchlist_compare: "AAPL, MSFT, NVDA, TSLA, META",
    equity_research: "AMZN",
    macro_event_brief: "SPY",
    dcf_model: "GOOGL",
    comps_model: "NVDA",
    lbo_model: "SHEL",
    ma_buyer_list: "META",
    ic_memo: "AAPL",
    kyc_check: "BARC",
    nav_tieout: "FUND"
  };

  var TEMPLATE_WORKFLOWS = {
    snapshot: "market_snapshot",
    crypto_momentum: "crypto_momentum",
    red_flag: "red_flag_pack",
    earnings_brief: "earnings_analysis",
    council_dossier: "equity_research",
    watchlist_compare: "comps_model",
    equity_research: "equity_research",
    macro_event_brief: "macro_event_brief",
    dcf_model: "dcf_model",
    comps_model: "comps_model",
    lbo_model: "lbo_model",
    ma_buyer_list: "ma_buyer_list",
    ic_memo: "ic_memo",
    kyc_check: "kyc_check",
    nav_tieout: "nav_tieout"
  };

  var WORKFLOW_PRIMARY_TEMPLATE = {
    market_snapshot: "snapshot",
    crypto_momentum: "crypto_momentum",
    red_flag_pack: "red_flag",
    earnings_analysis: "earnings_brief",
    equity_research: "equity_research",
    comps_model: "comps_model",
    dcf_model: "dcf_model",
    lbo_model: "lbo_model",
    ma_buyer_list: "ma_buyer_list",
    ic_memo: "ic_memo",
    kyc_check: "kyc_check",
    nav_tieout: "nav_tieout",
    macro_event_brief: "macro_event_brief"
  };

  var workflowCatalog = {};

  var IDLE_BRIEFS = [
    {
      key: "snapshot",
      asset: "AAPL",
      tier: "free",
      title: "ATLAS SNAPSHOT BRIEF · AAPL",
      lines: [
        "Pulled: market cap, P/E, revenue growth, margin trend, free cash flow, debt profile.",
        "Verdict will resolve to: attractive | watchlist | avoid.",
        "Real numbers populate when Financial Datasets + LLM providers are wired."
      ]
    },
    {
      key: "crypto_momentum",
      asset: "BTC",
      tier: "free",
      title: "ATLAS CRYPTO MOMENTUM · BTC",
      lines: [
        "Pulled: 24h, 7d, 30d, 90d and 1Y returns; drawdown from recent high.",
        "Relative strength against ETH and SOL.",
        "Move classified as breakout, mean reversion, or chop.",
        "Real numbers populate when providers wire."
      ]
    },
    {
      key: "red_flag",
      asset: "BAX",
      tier: "Signal",
      title: "ATLAS RED-FLAG PACK · BAX",
      lines: [
        "Pulled: liquidity, dilution, debt, earnings quality, headline checks.",
        "Surfaces what to verify before treating the asset as investable.",
        "Marks unknowns clearly. No hype.",
        "Real numbers populate when providers wire."
      ]
    },
    {
      key: "earnings_brief",
      asset: "TSLA",
      tier: "Signal",
      title: "ATLAS EARNINGS BRIEF · TSLA",
      lines: [
        "Pulled: 4 quarters of income statement, balance sheet, cash flow.",
        "Highlights acceleration, deterioration, margin pressure, dilution.",
        "Surfaces the 5 numbers an operator should care about.",
        "Real numbers populate when providers wire."
      ]
    },
    {
      key: "council_dossier",
      asset: "MSTR",
      tier: "Pro",
      title: "ATLAS COUNCIL DOSSIER · MSTR",
      lines: [
        "Pulled: facts first, valuation, recent moves, balance-sheet risk.",
        "Bull case · Bear case · Hidden risks.",
        "Priority 0 verification checklist before any view is acted on.",
        "Real numbers populate when providers wire."
      ]
    },
    {
      key: "watchlist_compare",
      asset: "AAPL · MSFT · NVDA · TSLA · META",
      tier: "Pro",
      title: "ATLAS WATCHLIST COMPARE · 5 tickers",
      lines: [
        "Pulled: market cap, P/E, growth, margin, FCF, debt for each.",
        "Ranked from cleanest to riskiest.",
        "Top 3 reasons drive the ranking.",
        "Real numbers populate when providers wire."
      ]
    },
    {
      key: "equity_research",
      asset: "AMZN",
      tier: "Signal",
      title: "ATLAS EQUITY RESEARCH · AMZN",
      lines: [
        "Pulled: fundamentals, valuation frame, chart location, news, macro calendar, and sector exposure.",
        "Outputs: thesis, bull case, bear case, risks, source checklist.",
        "Real numbers populate when market-data and LLM providers wire."
      ]
    },
    {
      key: "dcf_model",
      asset: "GOOGL",
      tier: "Pro",
      title: "ATLAS DCF MODEL · GOOGL",
      lines: [
        "Pulled: historical statements, FCF bridge, WACC inputs, terminal assumptions, peer context.",
        "Outputs: assumptions, sensitivity table outline, unverified-data warnings.",
        "Real model export activates only after provider and spreadsheet rails are cleared."
      ]
    },
    {
      key: "lbo_model",
      asset: "SHEL",
      tier: "Sovereign",
      title: "ATLAS LBO MODEL · SHEL",
      lines: [
        "Pulled: financial base, debt capacity, exit multiple range, downside stress inputs.",
        "Outputs: debt stack, cash sweep, IRR/MOIC cases, committee questions.",
        "Enterprise workflow stays provider-pending until data entitlements are cleared."
      ]
    },
    {
      key: "macro_event_brief",
      asset: "SPY",
      tier: "Signal",
      title: "ATLAS MACRO EVENT BRIEF · SPY",
      lines: [
        "Pulled: economic calendar, prior/forecast/actual, rates, FX, index and sector sensitivity.",
        "Outputs: pre-event setup, post-print read, chart levels to watch.",
        "No fake calendar dates. Live events appear only from an approved provider."
      ]
    },
    {
      key: "kyc_check",
      asset: "BARC",
      tier: "Pro",
      title: "ATLAS KYC COUNTERPARTY CHECK · BARC",
      lines: [
        "Pulled: entity profile, ownership, sanctions/adverse-media source lanes, missing documents.",
        "Outputs: risk flags and operator checklist.",
        "Compliance data providers remain disabled until cleared."
      ]
    },
    {
      key: "nav_tieout",
      asset: "FUND",
      tier: "Sovereign",
      title: "ATLAS NAV TIE-OUT · FUND",
      lines: [
        "Pulled: positions, prices, GL, custodian records, fund accounting exports.",
        "Outputs: reconciliation breaks, pricing exceptions, variance notes, review checklist.",
        "Fund-admin connectors remain disabled until enterprise rails are approved."
      ]
    }
  ];

  var idleTimer = null;
  var idleIndex = 0;
  var idleStopped = false;
  var marketDirectory = {};
  var marketSearchTimer = null;
  var activeMarketClass = "all";
  var marketClassQueries = {
    all: "",
    equity: "",
    index: "",
    forex: "",
    commodity: "",
    crypto: "",
    etf: ""
  };
  var activeMarket = {
    tvSymbol: "NASDAQ:AMZN",
    ticker: "AMZN",
    name: "Amazon",
    assetClass: "Equities",
    region: "United States"
  };

  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function setText(id, text) {
    var el = $(id);
    if (el) el.textContent = text;
  }

  function setPill(id, state, label) {
    var el = $(id);
    if (!el) return;
    el.dataset.state = state;
    el.textContent = label;
  }

  function setList(id, items) {
    var el = $(id);
    if (!el) return;
    var list = Array.isArray(items) ? items : [];
    if (!list.length) {
      el.innerHTML = "<li>provider pending</li>";
      return;
    }
    el.innerHTML = list.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("");
  }

  function setResultState(state, label) {
    var pill = $("tt-result-state");
    var topPill = $("aw-pill-result");
    if (pill) { pill.dataset.state = state; pill.textContent = label || state; }
    if (topPill) { topPill.dataset.state = state; topPill.textContent = label || state; }
    var output = $("tt-result");
    if (output) output.dataset.state = state;
  }

  function setUsageStatus(text, isError) {
    var el = $("tt-usage-status");
    if (!el) return;
    el.textContent = text;
    if (isError) el.dataset.state = "error";
    else delete el.dataset.state;
  }

  function themeForTradingView() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "light" ? "light" : "dark";
  }

  function renderTradingViewChart(tvSymbol) {
    var box = $("atlas-tv-chart");
    var state = $("atlas-chart-state");
    if (!box) return;
    if (state) state.textContent = "loading chart";
    box.dataset.symbol = tvSymbol;
    box.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div></div>';
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.text = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Etc/UTC",
      theme: themeForTradingView(),
      style: "1",
      locale: "en",
      allow_symbol_change: true,
      calendar: false,
      details: true,
      hotlist: true,
      hide_side_toolbar: false,
      support_host: "https://www.tradingview.com"
    });
    script.onload = function () {
      if (state) state.textContent = tvSymbol;
    };
    script.onerror = function () {
      if (state) state.textContent = "chart blocked";
      box.innerHTML = '<div class="atlas-calendar-empty">TradingView chart could not load. Check CSP or network access.</div>';
    };
    box.querySelector(".tradingview-widget-container").appendChild(script);
  }

  function normaliseSymbolInput(value) {
    var text = String(value || "").trim().toUpperCase();
    if (!text) return "NASDAQ:AMZN";
    var known = marketDirectory[text];
    if (known) return known.symbol || known.tvSymbol || text;
    if (text.indexOf(":") !== -1) return text;
    if (text === "SHELL") return "LSE:SHEL";
    if (text === "LLOY") return "LSE:LLOY";
    if (text === "GSK") return "LSE:GSK";
    if (text === "GOLD" || text === "XAUUSD") return "TVC:GOLD";
    if (text === "EURUSD") return "FX:EURUSD";
    if (text === "BTC" || text === "BTCUSD") return "BINANCE:BTCUSDT";
    return "NASDAQ:" + text;
  }

  function setMarketContext(next) {
    activeMarket = {
      tvSymbol: normaliseSymbolInput(next.tvSymbol || next.symbol),
      ticker: String(next.ticker || next.tvSymbol || "AMZN").split(":").pop().toUpperCase(),
      name: next.name || String(next.ticker || next.tvSymbol || "Market"),
      assetClass: next.assetClass || next.asset_class || "Market",
      region: next.region || "Global"
    };
    rememberMarket({
      symbol: activeMarket.tvSymbol,
      ticker: activeMarket.ticker,
      name: activeMarket.name,
      asset_class: activeMarket.assetClass,
      region: activeMarket.region
    });

    setText("atlas-active-symbol-label", activeMarket.name);
    setText("atlas-active-symbol-meta", activeMarket.tvSymbol + " · " + activeMarket.assetClass + " · " + activeMarket.region);
    var input = $("atlas-symbol-input");
    if (input) input.value = activeMarket.tvSymbol;

    var form = $("tt-form");
    if (form && form.elements.ticker) {
      form.elements.ticker.value = activeMarket.ticker;
      refreshPreview(form);
      if (!idleStopped) renderCurrentIdleBrief();
    }

    Array.prototype.forEach.call(document.querySelectorAll(".atlas-asset-rail [data-tv-symbol]"), function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-tv-symbol") === activeMarket.tvSymbol);
    });

    renderTradingViewChart(activeMarket.tvSymbol);
    loadMarketSnapshot(activeMarket.ticker);
  }

  function loadMarketSnapshot(ticker) {
    setText("atlas-market-provider-state", "loading");
    setText("atlas-public-source-state", "SEC loading");
    fetch(API + "/market-snapshot?ticker=" + encodeURIComponent(ticker), {
      credentials: "same-origin"
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      setText("atlas-market-provider-state", data.provider_state || data.status || "unknown");
      var snap = data.snapshot || {};
      setText("atlas-snap-price", snap.price == null ? "provider pending" : String(snap.price));
      setText("atlas-snap-change", snap.day_change_percent == null ? "provider pending" : String(snap.day_change_percent) + "%");
      setText("atlas-snap-source", data.source || "ATLAS backend");
      renderPublicSource(data.free_source, ticker);
    }).catch(function () {
      setText("atlas-market-provider-state", "offline");
      setText("atlas-public-source-state", "offline");
      setText("atlas-snap-price", "backend unavailable");
      setText("atlas-snap-change", "backend unavailable");
      renderPublicSource(null, ticker);
    });
  }

  function renderPublicSource(source, ticker) {
    var factsEl = $("atlas-public-facts");
    var linksEl = $("atlas-public-links");
    if (!source || source.status !== "PUBLIC_SOURCE_READY") {
      setText("atlas-public-source-state", source && source.status ? source.status : "not available");
      setText("atlas-public-company", ticker + " not matched on SEC");
      setText("atlas-public-cik", "none");
      setText("atlas-public-filing", "none");
      if (factsEl) {
        factsEl.innerHTML = "<li>Public SEC data appears here for US-listed tickers. Non-US assets stay on chart and macro context until another free rail is added.</li>";
      }
      if (linksEl) linksEl.innerHTML = "";
      return;
    }

    var company = source.company || {};
    var latest = (source.latest_filings || [])[0] || {};
    var facts = (source.key_facts || []).filter(function (row) {
      return ["RevenueFromContractWithCustomerExcludingAssessedTax", "NetIncomeLoss", "Assets", "Liabilities", "CashAndCashEquivalentsAtCarryingValue", "EarningsPerShareDiluted"].indexOf(row.concept) !== -1;
    }).slice(0, 6);
    var links = source.source_links || {};

    setText("atlas-public-source-state", "SEC live");
    setText("atlas-public-company", company.name || company.ticker || ticker);
    setText("atlas-public-cik", company.cik_str || company.cik || "unknown");
    setText("atlas-public-filing", latest.form ? latest.form + " filed " + (latest.filing_date || "date unknown") : "no recent filing");

    if (factsEl) {
      factsEl.innerHTML = facts.length ? facts.map(function (row) {
        return "<li><strong>" + esc(shortFactName(row.concept, row.label)) + "</strong><span>" + esc(formatFactValue(row.value, row.unit)) + " · " + esc(row.form || "filing") + " · " + esc(row.period_end || row.filed || "period pending") + "</span></li>";
      }).join("") : "<li>SEC matched the company, but no key facts were available from the current XBRL concept list.</li>";
    }

    if (linksEl) {
      linksEl.innerHTML = [
        linkHtml("SEC company", links.sec_company_search),
        linkHtml("latest filing", latest.url),
        linkHtml("facts JSON", links.sec_companyfacts_json)
      ].filter(Boolean).join("");
    }
  }

  function linkHtml(label, url) {
    if (!url) return "";
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(label) + "</a>";
  }

  function shortFactName(concept, label) {
    var names = {
      RevenueFromContractWithCustomerExcludingAssessedTax: "Revenue",
      NetIncomeLoss: "Net income",
      Assets: "Assets",
      Liabilities: "Liabilities",
      CashAndCashEquivalentsAtCarryingValue: "Cash",
      EarningsPerShareDiluted: "Diluted EPS"
    };
    return names[concept] || label || concept;
  }

  function formatFactValue(value, unit) {
    if (value == null || value === "") return "not reported";
    var n = Number(value);
    if (!isFinite(n)) return String(value);
    if (unit === "USD") {
      var abs = Math.abs(n);
      if (abs >= 1000000000000) return "$" + (n / 1000000000000).toFixed(2) + "T";
      if (abs >= 1000000000) return "$" + (n / 1000000000).toFixed(2) + "B";
      if (abs >= 1000000) return "$" + (n / 1000000).toFixed(2) + "M";
      return "$" + n.toLocaleString();
    }
    if (unit === "USD/shares") return "$" + n.toFixed(2) + " / share";
    if (unit === "shares") {
      if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(2) + "B shares";
      if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + "M shares";
      return n.toLocaleString() + " shares";
    }
    return n.toLocaleString() + (unit ? " " + unit : "");
  }

  function rememberMarket(row) {
    if (!row) return;
    var symbol = String(row.symbol || row.tvSymbol || "").toUpperCase();
    var ticker = String(row.ticker || "").toUpperCase();
    if (!symbol) return;
    marketDirectory[symbol] = row;
    if (ticker) marketDirectory[ticker] = row;
  }

  function renderMarketSuggestions(rows) {
    var list = $("atlas-market-symbols");
    if (!list || !Array.isArray(rows)) return;
    rows.forEach(rememberMarket);
    list.innerHTML = rows.slice(0, 80).map(function (row) {
      return '<option value="' + esc(row.symbol) + '" label="' + esc(row.name + " · " + row.exchange + " · " + row.region) + '"></option>';
    }).join("");
  }

  function loadMarketSuggestions(query) {
    var text = String(query || "").trim();
    if (text.length < 2) return;
    fetch(API + "/markets/search?q=" + encodeURIComponent(text) + "&limit=80", {
      credentials: "same-origin"
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      renderMarketSuggestions(data.results || []);
    }).catch(function () {
      renderMarketSuggestions([]);
    });
  }

  function marketApiClass(value) {
    if (value === "index") return "index";
    if (value === "commodity") return "commodity";
    return value || "all";
  }

  function marketLabel(row) {
    return row.name + " · " + row.symbol + " · " + row.region;
  }

  function renderMarketDropdown(rows) {
    var select = $("atlas-market-symbol-select");
    if (!select) return;
    rows.forEach(rememberMarket);
    if (!rows.length) {
      select.innerHTML = '<option value="">No instruments found for this section</option>';
      return;
    }
    select.innerHTML = rows.map(function (row) {
      return '<option value="' + esc(row.symbol) + '">' + esc(marketLabel(row)) + '</option>';
    }).join("");
  }

  function loadMarketBrowser() {
    var regionEl = $("atlas-market-region-filter");
    var state = $("atlas-market-browser-state");
    var region = regionEl ? regionEl.value : "all";
    var assetClass = marketApiClass(activeMarketClass);
    var query = marketClassQueries[activeMarketClass] || "";
    if (state) {
      state.textContent = "Loading " + activeMarketClass + " · " + region + " from ATLAS universe...";
    }
    fetch(API + "/markets/search?q=" + encodeURIComponent(query) + "&region=" + encodeURIComponent(region) + "&asset_class=" + encodeURIComponent(assetClass) + "&limit=350", {
      credentials: "same-origin"
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      var rows = data.results || [];
      renderMarketDropdown(rows);
      if (state) {
        state.textContent = rows.length + " instruments loaded · source: " + (data.provider_state || "market universe");
      }
    }).catch(function () {
      renderMarketDropdown([]);
      if (state) state.textContent = "Market universe unavailable.";
    });
  }

  function wireMarketBrowser() {
    var tabs = $("atlas-market-tabs");
    var regionEl = $("atlas-market-region-filter");
    var select = $("atlas-market-symbol-select");
    if (tabs) {
      Array.prototype.forEach.call(tabs.querySelectorAll("[data-market-class]"), function (btn) {
        btn.addEventListener("click", function () {
          activeMarketClass = btn.getAttribute("data-market-class") || "all";
          Array.prototype.forEach.call(tabs.querySelectorAll("[data-market-class]"), function (other) {
            other.classList.toggle("is-active", other === btn);
          });
          loadMarketBrowser();
        });
      });
    }
    if (regionEl) regionEl.addEventListener("change", loadMarketBrowser);
    if (select) {
      select.addEventListener("change", function () {
        var row = marketDirectory[String(select.value || "").toUpperCase()];
        if (row) setMarketContext(row);
      });
    }
    loadMarketBrowser();
  }

  function initMarketCenter() {
    var rail = document.querySelector(".atlas-asset-rail");
    if (rail) {
      Array.prototype.forEach.call(rail.querySelectorAll("[data-tv-symbol]"), function (btn) {
        btn.addEventListener("click", function () {
          setMarketContext({
            tvSymbol: btn.getAttribute("data-tv-symbol"),
            ticker: btn.getAttribute("data-ticker"),
            name: btn.getAttribute("data-name"),
            assetClass: btn.getAttribute("data-class"),
            region: btn.getAttribute("data-region")
          });
        });
      });
    }

    var symbolForm = $("atlas-symbol-form");
    if (symbolForm) {
      var symbolInput = $("atlas-symbol-input");
      if (symbolInput) {
        symbolInput.addEventListener("input", function () {
          if (marketSearchTimer) clearTimeout(marketSearchTimer);
          marketSearchTimer = setTimeout(function () {
            loadMarketSuggestions(symbolInput.value);
          }, 180);
        });
        loadMarketSuggestions(symbolInput.value);
      }
      symbolForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var input = $("atlas-symbol-input");
        var tvSymbol = normaliseSymbolInput(input ? input.value : "");
        var known = marketDirectory[String(input ? input.value : "").trim().toUpperCase()] || marketDirectory[tvSymbol.toUpperCase()];
        if (known) {
          setMarketContext(known);
          return;
        }
        setMarketContext({
          tvSymbol: tvSymbol,
          ticker: tvSymbol.split(":").pop(),
          name: tvSymbol,
          assetClass: "Market",
          region: tvSymbol.indexOf("LSE:") === 0 ? "London" : "Global"
        });
      });
    }

    wireMarketBrowser();
    setMarketContext(activeMarket);
  }

  function buildPayload(form) {
    var fd = new FormData(form);
    var template = fd.get("template");
    var style = fd.get("style");
    var tickerVal = fd.get("ticker") || "";
    var payload = { template: template, style: style };
    if (template === "watchlist_compare") {
      payload.tickers = tickerVal
        .split(/[,\s]+/)
        .map(function (t) { return t.trim().toUpperCase(); })
        .filter(Boolean);
    } else {
      payload.ticker = tickerVal.trim().toUpperCase();
    }
    return payload;
  }

  function refreshPreview(form) {
    var preview = $("tt-prompt");
    var metrics = $("tt-metrics");
    if (!form || !preview) return;
    var payload = buildPayload(form);
    preview.textContent = JSON.stringify(payload, null, 2);
    if (metrics) {
      var asset = payload.tickers ? payload.tickers.join(", ") : payload.ticker;
      var workflow = workflowForTemplate(payload.template);
      metrics.textContent =
        "[ATLAS] prompt_builder=live target=" + (asset || "—") + "\n" +
        "[WORKFLOW] " + (workflow && workflow.label ? workflow.label : (TEMPLATE_WORKFLOWS[payload.template] || "catalog loading")) + "\n" +
        "[DATA] public_sec=LIVE market_universe=LIVE paid_market_data=PENDING model_briefs=PENDING\n" +
        "[TEMPLATE] " + payload.template + "\n" +
        "[STYLE] " + payload.style + "\n" +
        "[GUARD] no fabricated values; ATLAS returns SEC-backed briefs for matched US tickers and marks other rails pending";
    }
  }

  function workflowForTemplate(template) {
    var workflowId = TEMPLATE_WORKFLOWS[String(template || "")];
    return workflowCatalog[workflowId] || null;
  }

  function tierLabel(tier) {
    if (!tier || tier === "none") return "free";
    return String(tier).toLowerCase();
  }

  function providerShort(state) {
    var text = String(state || "pending");
    if (text.indexOf("disabled") !== -1) return "pending";
    return text.replace(/_/g, " ");
  }

  function updateWorkflowContext(template) {
    var workflow = workflowForTemplate(template);
    if (!workflow) return;
    setText("atlas-selected-workflow-title", workflow.label || "ATLAS Workflow");
    setText("atlas-selected-workflow-summary", workflow.summary || "Workflow catalog ready.");
    setText("atlas-selected-workflow-tier", tierLabel(workflow.required_tier));
    setText("atlas-selected-workflow-category", String(workflow.category || "research").replace(/_/g, " "));
    setText("atlas-selected-workflow-provider", providerShort(workflow.provider_state));
    setList("atlas-selected-workflow-deliverables", workflow.deliverables);
    setList("atlas-selected-workflow-data", workflow.data_requirements);
    setList("atlas-selected-workflow-connectors", workflow.connectors_needed);
  }

  function loadWorkflowCatalog(form, presetSelect) {
    var state = $("atlas-workflow-state");
    fetch(API + "/templates", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var workflows = data.workflows || [];
        workflowCatalog = {};
        workflows.forEach(function (workflow) {
          workflowCatalog[workflow.id] = workflow;
        });
        renderWorkflowTrack(workflows);
        updateWorkflowContext(presetSelect ? presetSelect.value : "snapshot");
        refreshPreview(form);
        if (state) {
          state.textContent = workflows.length + " workflow lanes loaded from ATLAS backend. Providers remain pending until terms and keys clear.";
          state.dataset.state = "ready";
        }
      })
      .catch(function () {
        if (state) {
          state.textContent = "Workflow catalog unavailable. Static fallback cards remain visible.";
          state.dataset.state = "error";
        }
      });
  }

  function renderWorkflowTrack(workflows) {
    var track = $("atlas-workflow-track");
    if (!track || !Array.isArray(workflows) || !workflows.length) return;
    track.innerHTML = workflows.map(function (workflow) {
      var template = WORKFLOW_PRIMARY_TEMPLATE[workflow.id] || "snapshot";
      return '<button class="atlas-template atlas-workflow-card" data-template="' + esc(template) + '" type="button">'
        + '<span class="atlas-template-tier" data-tier="' + esc(tierLabel(workflow.required_tier)) + '">' + esc(tierLabel(workflow.required_tier)) + '</span>'
        + '<h3>' + esc(workflow.label || workflow.id) + '</h3>'
        + '<p>' + esc(workflow.summary || "") + '</p>'
        + '<div class="atlas-workflow-meta">'
        + '<span>' + esc(String(workflow.category || "research").replace(/_/g, " ")) + '</span>'
        + '<span>' + esc((workflow.deliverables || []).length) + ' deliverables</span>'
        + '</div>'
        + '<span class="atlas-template-cta">Open lane &rarr;</span>'
        + '</button>';
    }).join("");
  }

  function applyTickerDefault(form, template) {
    var input = form.elements.ticker;
    if (!input) return;
    var label = $("tt-ticker-label");
    var labelText = label ? label.querySelector(".aw-label-text") : null;
    if (template === "watchlist_compare") {
      input.value = TICKER_DEFAULTS.watchlist_compare;
      if (labelText) labelText.textContent = "Tickers (comma-separated)";
    } else {
      input.value = TICKER_DEFAULTS[template] || "AAPL";
      if (labelText) labelText.textContent = "Asset or ticker";
    }
    updateWorkflowContext(template);
  }

  /* ─── Idle rotation ──────────────────────────────────────────────────── */
  function currentAssetForIdle() {
    var form = $("tt-form");
    if (!form) return "";
    var payload = buildPayload(form);
    return payload.tickers ? payload.tickers.join(" · ") : payload.ticker;
  }

  function renderIdleBrief(brief, assetOverride) {
    var output = $("tt-result");
    if (!output) return;
    var asset = assetOverride || brief.asset;
    var title = brief.title.replace(brief.asset, asset);
    var body =
      title + "\n" +
      "tier: " + brief.tier + "\n" +
      "─────────────────────────────────\n\n" +
      brief.lines.join("\n") + "\n\n" +
      "Try this template: change the dropdown above and hit Run research.\n" +
      "Research output only. Not financial advice. No brokerage execution.";
    output.textContent = body;
    setResultState("idle", "demo · " + brief.key);
  }

  function renderCurrentIdleBrief() {
    renderIdleBrief(IDLE_BRIEFS[idleIndex], currentAssetForIdle());
  }

  function startIdleRotation() {
    if (idleTimer || idleStopped) return;
    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderCurrentIdleBrief();
    if (prefersReduced) return;
    idleTimer = setInterval(function () {
      if (idleStopped) { stopIdleRotation(); return; }
      idleIndex = (idleIndex + 1) % IDLE_BRIEFS.length;
      renderCurrentIdleBrief();
    }, 5500);
  }

  function stopIdleRotation() {
    idleStopped = true;
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
  }

  /* ─── API plumbing ───────────────────────────────────────────────────── */
  function renderResult(data, status) {
    var el = $("tt-result");
    if (!el) return;

    if (status === "ok" && data && data.brief) {
      el.textContent = data.brief;

      // Pick a pill label that reflects the actual scout/cache state so the
      // user knows whether the brief is the fast public-source pass, a
      // cached scout brief, or something else.
      var cache = data.cache || {};
      var apiStatus = data.status || "";
      var srcCount = data.source_count || (Array.isArray(data.sources) ? data.sources.length : 0);
      var label;
      var state;
      if (cache.hit) {
        state = "ready";
        label = "cached · " + srcCount + " sources";
      } else if (cache.queued || apiStatus === "SCOUT_RESEARCH_QUEUED") {
        state = "pending";
        label = "scouts queued · " + srcCount + " sources";
      } else if (apiStatus === "SCOUT_BRIEF_READY") {
        state = "ready";
        label = "scout brief · " + srcCount + " sources";
      } else if (Array.isArray(data.lanes) && data.lanes.length > 0) {
        var refusedLanes = data.lanes.filter(function (l) { return l && l.status === "refused"; }).length;
        state = refusedLanes > 0 ? "pending" : "ready";
        label = (data.lanes.length - refusedLanes) + "/" + data.lanes.length + " lanes · " + srcCount + " sources";
      } else {
        state = "ready";
        label = srcCount ? srcCount + " sources" : "ready";
      }
      setResultState(state, label);
      return;
    }

    if (data && (data.status === "PROVIDER_NOT_CONFIGURED" || data.error === "provider_not_configured")) {
      var workflow = data.workflow || {};
      var workflowText = workflow.label
        ? ("WORKFLOW: " + workflow.label + "\n"
          + "DELIVERABLES: " + ((workflow.deliverables || []).join(" · ") || "provider pending") + "\n"
          + "DATA NEEDED: " + ((workflow.data_requirements || []).join(" · ") || "provider pending") + "\n\n")
        : "";
      el.textContent =
        "BACKEND: ONLINE\n" +
        "DATA + MODEL PROVIDERS: PENDING ACTIVATION\n\n" +
        workflowText +
        (data.message || "Providers being wired by FreedomCore.") + "\n\n" +
        "Once active, your selected template will return a structured " +
        "research brief in this panel. Subscription tier governs which " +
        "templates you can run and how many briefs you get per day.\n\n" +
        (data.footer ? "— " + data.footer : "");
      setResultState("pending", "provider pending");
      return;
    }

    if (data && data.error === "tier_required") {
      el.textContent =
        "TIER GATE\n\n" +
        "This template requires a higher subscription tier" +
        (data.required_tier ? " (" + data.required_tier + ")" : "") + ".\n\n" +
        "Pick a free template (Snapshot, Crypto Momentum) or visit " +
        "/pages/access.html to upgrade.";
      setResultState("error", "needs upgrade");
      return;
    }

    if (data && (data.error === "rate_limited" || data.error === "daily_cap_reached")) {
      el.textContent =
        "DAILY CAP REACHED\n\n" +
        "Free tier: 3 briefs/day. Signal / Pro / Sovereign tiers unlock higher caps.\n\n" +
        "Cap resets at midnight UTC.";
      setResultState("error", "rate limited");
      return;
    }

    if (data && data.error === "unsupported_fields") {
      el.textContent =
        "Request rejected: ATLAS only accepts whitelisted template fields.\n" +
        "Unsupported fields: " + (data.fields ? data.fields.join(", ") : "(unspecified)");
      setResultState("error", "bad fields");
      return;
    }

    if (data && data.error === "invalid_template") {
      el.textContent =
        "Unknown template. Pick one from the dropdown above.";
      setResultState("error", "bad template");
      return;
    }

    if (data && data.error === "invalid_ticker") {
      el.textContent =
        "Invalid ticker format. Try a clean symbol like AAPL or BTC.";
      setResultState("error", "bad ticker");
      return;
    }

    if (data && data.error) {
      el.textContent = "ATLAS error: " + data.error + "\n" + (data.message || "");
      setResultState("error", data.error);
      return;
    }

    el.textContent = "Unexpected response (HTTP " + (status || "?") + "). Try again.";
    setResultState("error", "unknown");
  }

  function loadEconomicCalendar() {
    var state = $("atlas-calendar-state");
    var list = $("atlas-calendar-events");
    var note = $("atlas-calendar-note");
    var regionEl = $("atlas-calendar-region");
    var windowEl = $("atlas-calendar-window");
    var impactEl = $("atlas-calendar-impact");
    if (!list) return;

    var region = regionEl ? regionEl.value : "US";
    var days = windowEl ? windowEl.value : "14";
    var impact = impactEl ? impactEl.value : "all";
    list.innerHTML = '<div class="atlas-calendar-empty">Loading economic calendar rail…</div>';

    fetch(API + "/economic-calendar?region=" + encodeURIComponent(region) + "&days=" + encodeURIComponent(days) + "&impact=" + encodeURIComponent(impact), {
      credentials: "same-origin"
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      if (state) {
        state.textContent = data.provider_state === "disabled_pending_source_terms_and_key"
          ? "provider pending · no fake dates"
          : (data.status || "ready");
      }
      if (note) {
        note.textContent = (data.message || "Economic calendar ready.") + " " + (data.footer || "");
      }

      var events = data.events || [];
      if (events.length) {
        list.innerHTML = renderCalendarHead() + events.map(function (event) {
          return renderCalendarRow({
            time: event.datetime || event.date || "pending",
            region: event.region || event.currency || data.region || region,
            impact: event.impact || event.importance || "scheduled",
            title: event.title || event.name || "Economic event",
            detail: event.category || event.source || "Live calendar event",
            actual: event.actual,
            forecast: event.forecast,
            previous: event.previous
          });
        }).join("");
        return;
      }

      var planned = data.planned_event_types || [];
      if (planned.length) {
        list.innerHTML = renderCalendarHead() + planned.map(function (item, idx) {
          return renderCalendarRow({
            time: "provider pending",
            region: data.region || region,
            impact: plannedImpact(item.name, idx),
            title: item.name || "Macro event",
            detail: ((item.examples || []).join(" · ") || "Examples pending") + ". " + (item.why_it_matters || ""),
            actual: null,
            forecast: null,
            previous: null
          });
        }).join("");
      } else {
        list.innerHTML = '<div class="atlas-calendar-empty">Calendar rail unavailable.</div>';
      }
    }).catch(function (err) {
      if (state) state.textContent = "calendar offline";
      list.innerHTML = '<div class="atlas-calendar-empty">Economic calendar unavailable: ' + esc(err.message) + '</div>';
    });
  }

  function renderCalendarHead() {
    return '<div class="atlas-calendar-head" role="row">'
      + '<span>time</span>'
      + '<span>region</span>'
      + '<span>impact</span>'
      + '<span>event</span>'
      + '<span>actual</span>'
      + '<span>forecast</span>'
      + '<span>previous</span>'
      + '</div>';
  }

  function renderCalendarRow(event) {
    var impact = normaliseImpact(event.impact);
    return '<article class="atlas-calendar-row">'
      + '<div class="atlas-calendar-time" data-label="time">' + renderTime(event.time) + '</div>'
      + '<div class="atlas-calendar-region" data-label="region">' + esc(event.region || "US") + '</div>'
      + '<div data-label="impact"><span class="atlas-impact" data-impact="' + esc(impact) + '">' + esc(impact) + '</span></div>'
      + '<div data-label="event"><strong>' + esc(event.title || "Economic event") + '</strong><small>' + esc(event.detail || "") + '</small></div>'
      + renderMetric("actual", event.actual)
      + renderMetric("forecast", event.forecast)
      + renderMetric("previous", event.previous)
      + '</article>';
  }

  function renderTime(value) {
    var raw = String(value || "pending");
    var pending = /pending/i.test(raw);
    if (pending) return '<span>Pending</span><small>source approval</small>';
    var parts = raw.split("T");
    if (parts.length === 2) {
      return '<span>' + esc(parts[1].replace("Z", "").slice(0, 5) + " UTC") + '</span><small>' + esc(parts[0]) + '</small>';
    }
    return '<span>' + esc(raw) + '</span><small>UTC</small>';
  }

  function renderMetric(label, value) {
    var pending = value == null || value === "";
    return '<div class="atlas-calendar-metric" data-label="' + esc(label) + '" data-pending="' + (pending ? "true" : "false") + '">'
      + esc(pending ? "provider pending" : value)
      + '</div>';
  }

  function normaliseImpact(value) {
    var text = String(value || "medium").toLowerCase();
    if (text.indexOf("high") !== -1 || text.indexOf("red") !== -1) return "high";
    if (text.indexOf("low") !== -1) return "low";
    if (text.indexOf("scheduled") !== -1 || text.indexOf("planned") !== -1) return "medium";
    return text === "medium" ? "medium" : "medium";
  }

  function plannedImpact(name, idx) {
    var text = String(name || "").toLowerCase();
    if (text.indexOf("bank") !== -1 || text.indexOf("inflation") !== -1 || text.indexOf("labour") !== -1) return "high";
    return idx < 3 ? "high" : "medium";
  }

  function runQuery(form) {
    stopIdleRotation();
    var payload = buildPayload(form);
    setResultState("loading", "running…");
    var resultEl = $("tt-result");
    var asset = payload.tickers ? payload.tickers.join(", ") : payload.ticker;
    if (resultEl) resultEl.textContent = "Querying " + payload.template + " for " + asset + "…";

    fetch(API + "/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    }).then(function (res) {
      var ok = res.ok;
      var code = res.status;
      return res.json().then(function (data) {
        return { ok: ok, code: code, data: data };
      }).catch(function () {
        return { ok: ok, code: code, data: { error: "non_json", message: "Server returned non-JSON response" } };
      });
    }).then(function (out) {
      renderResult(out.data, out.ok ? "ok" : "fail");
      loadUsage();
    }).catch(function (err) {
      if (resultEl) {
        resultEl.textContent =
          "Network error: " + err.message + "\n\n" +
          "ATLAS backend is reachable from freedomcore.io, " +
          "maverick.freedomcore.io, and atlas.freedomcore.io. " +
          "If this persists, refresh the page.";
      }
      setResultState("error", "network");
    });
  }

  function loadUsage() {
    fetch(API + "/usage", { credentials: "same-origin" })
      .then(function (res) { return res.json(); })
      .then(function (u) {
        var usage = u && u.usage ? u.usage : null;
        if (!usage) {
          setUsageStatus("ATLAS status unavailable.", true);
          setPill("aw-pill-auth", "anon", "anon");
          setPill("aw-pill-tier", "loading", "tier ?");
          setPill("aw-pill-cap", "loading", "cap ?");
          return;
        }
        var auth = u && u.authenticated;
        var tierLabel = (usage.tier && usage.tier !== "none") ? usage.tier : "free";
        var used = (usage.cap || 0) - (usage.remaining || 0);
        var capPct = (usage.cap || 0) > 0 ? used / usage.cap : 0;
        var capState = usage.limited ? "full" : (capPct >= 0.7 ? "warn" : "ok");

        setPill("aw-pill-auth", auth ? "auth" : "anon", auth ? "subscriber" : "anon");
        setPill("aw-pill-tier", "ok", "tier · " + tierLabel);
        setPill("aw-pill-cap", capState, "cap · " + used + "/" + usage.cap);

        setUsageStatus(
          "Status: " + (auth ? "subscriber" : "anon") +
          " · tier: " + tierLabel +
          " · today: " + used + "/" + usage.cap +
          " (" + usage.remaining + " remaining)",
          !!usage.limited
        );
      })
      .catch(function () {
        setUsageStatus("ATLAS status unavailable — check back shortly.", true);
        setPill("aw-pill-auth", "anon", "offline");
        setPill("aw-pill-tier", "loading", "tier ?");
        setPill("aw-pill-cap", "loading", "cap ?");
      });
  }

  function copyText(id, button) {
    var el = $(id);
    if (!el) return;
    var value = el.innerText || el.textContent || "";
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value).then(function () {
      if (!button) return;
      var old = button.textContent;
      button.textContent = "copied";
      setTimeout(function () { button.textContent = old; }, 1100);
    });
  }

  /* ─── Template gallery handler ───────────────────────────────────────── */
  function wireTemplateGallery(form, presetSelect) {
    document.addEventListener("click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest(".atlas-template[data-template]") : null;
      if (!btn || !presetSelect) return;
      var t = btn.getAttribute("data-template");
      if (!t) return;
      presetSelect.value = t;
      applyTickerDefault(form, t);
      refreshPreview(form);
      var ws = document.querySelector(".atlas-workstation");
      if (ws && ws.scrollIntoView) ws.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = $("tt-form");
    if (!form) return;

    var presetSelect = $("atlas-preset");
    if (presetSelect) {
      presetSelect.addEventListener("change", function () {
        applyTickerDefault(form, presetSelect.value);
        refreshPreview(form);
      });
      applyTickerDefault(form, presetSelect.value);
    }

    Array.prototype.forEach.call(form.querySelectorAll("input, select"), function (field) {
      field.addEventListener("input", function () { refreshPreview(form); });
      field.addEventListener("change", function () { refreshPreview(form); });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      runQuery(form);
    });

    refreshPreview(form);
    loadUsage();
    loadEconomicCalendar();
    initMarketCenter();
    wireTemplateGallery(form, presetSelect);
    loadWorkflowCatalog(form, presetSelect);
    startIdleRotation();

    Array.prototype.forEach.call(document.querySelectorAll("[data-copy-target]"), function (button) {
      button.addEventListener("click", function () {
        copyText(button.getAttribute("data-copy-target"), button);
      });
    });

    ["atlas-calendar-region", "atlas-calendar-window", "atlas-calendar-impact"].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener("change", loadEconomicCalendar);
    });
  });
}());
