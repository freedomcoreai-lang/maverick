(function () {
  "use strict";

  function textForPrompt(ticker, job, style) {
    var asset = (ticker || "AAPL").trim().toUpperCase();
    var styleText = {
      operator: "Output as a concise FreedomCore operator sheet with thesis, risks, numbers, and follow-up questions.",
      tweet: "Output as a punchy tweet thread with sourced numbers and no hype claims.",
      council: "Output as a council brief with bull case, bear case, red flags, and verdict gates.",
      table: "Output as a tight table with one paragraph verdict."
    }[style] || "Output as an operator sheet.";

    var task = {
      valuation: "Give me current market cap, P/E ratio, revenue growth, margin trend, free cash flow, debt profile, and valuation risk.",
      statements: "Show the last 4 quarters of income statement, balance sheet, and cash flow. Highlight acceleration, deterioration, debt, dilution, and cash generation.",
      crypto: "Pull 1-year price history and compare against BTC, ETH, and SOL. Highlight drawdown, volatility, trend state, and relative strength.",
      risk: "Build a risk and red-flag memo using live financial data, recent statement changes, leverage, cash flow quality, and valuation.",
      screen: "Find five comparable assets with stronger fundamentals or cleaner price trend, then explain why."
    }[job] || "Build a valuation and risk brief.";

    return "Pull " + asset + " from Financial Datasets. " + task + " " + styleText;
  }

  function copyText(id, button) {
    var el = document.getElementById(id);
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

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("tt-form");
    var output = document.getElementById("tt-prompt");
    if (form && output) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var data = new FormData(form);
        output.textContent = textForPrompt(data.get("ticker"), data.get("job"), data.get("style"));
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".tt-copy"), function (button) {
      button.addEventListener("click", function () {
        copyText(button.getAttribute("data-copy-target"), button);
      });
    });
  });
}());
