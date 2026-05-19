(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function ensureAtlasLink() {
    var menus = Array.prototype.slice.call(document.querySelectorAll(".mobile-dropdown"));
    menus.forEach(function (menu) {
      if (menu.querySelector('.fc-fam-link[data-fc="atlas"]')) return;

      var quantum = menu.querySelector('.fc-fam-link[data-fc="quantum"]');
      if (!quantum) return;

      var link = document.createElement("a");
      link.className = "fc-fam-link";
      link.setAttribute("data-fc", "atlas");
      link.href = "https://atlas.freedomcore.io/";
      link.innerHTML = 'ATLAS <span class="fc-fam-desc">Market Intel</span>';

      if (document.body && document.body.getAttribute("data-site") === "atlas") {
        link.className += " fc-mobile-current";
      }

      quantum.insertAdjacentElement("afterend", link);
    });
  }

  function ensureLocalNotesLink() {
    var site = document.body ? document.body.getAttribute("data-site") : "";
    var hrefs = {
      atlas: "https://atlas.freedomcore.io/notes/",
      maverick: "https://maverick.freedomcore.io/notes/",
      shadow: "https://shadow.freedomcore.io/notes/",
      pumphouse: "https://memes.freedomcore.io/notes/"
    };
    var labels = {
      atlas: "Research Notes",
      maverick: "Maverick Notes",
      shadow: "SHADOW Notes",
      pumphouse: "Pumphouse Notes"
    };
    if (!hrefs[site]) return;

    var menus = Array.prototype.slice.call(document.querySelectorAll(".mobile-dropdown"));
    menus.forEach(function (menu) {
      if (menu.querySelector('a[href*="/notes/"]')) return;
      var divider = menu.querySelector(".fc-fam-divider");
      var link = document.createElement("a");
      link.href = hrefs[site];
      link.textContent = labels[site];
      if (divider && divider.nextSibling) {
        divider.parentNode.insertBefore(link, divider.nextSibling);
      } else {
        menu.appendChild(link);
      }
    });
  }

  function ensureCommandLink() {
    var menus = Array.prototype.slice.call(document.querySelectorAll(".mobile-dropdown"));
    menus.forEach(function (menu) {
      if (menu.querySelector('a[data-fc-role="command"]')) return;
      var link = document.createElement("a");
      link.href = "https://command.freedomcore.io/";
      link.setAttribute("data-fc-role", "command");
      link.style.cssText = "margin-top:8px;border-top:1px solid var(--border,rgba(255,255,255,0.08));padding-top:10px;color:var(--gold,#ffd700);font-weight:600;letter-spacing:0.04em;";
      link.textContent = "COMMAND";
      menu.appendChild(link);
    });
  }

  ready(function () {
    ensureAtlasLink();
    ensureLocalNotesLink();
    ensureCommandLink();

    var buttons = Array.prototype.slice.call(document.querySelectorAll(".nav-hamburger[aria-controls]"));
    if (!buttons.length) return;

    buttons.forEach(function (button) {
      var menu = document.getElementById(button.getAttribute("aria-controls"));
      if (!menu) return;
      button.setAttribute("data-fc-family-nav", "true");

      function setOpen(open) {
        menu.classList.toggle("open", open);
        button.setAttribute("aria-expanded", open ? "true" : "false");
      }

      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        setOpen(!menu.classList.contains("open"));
      });

      menu.addEventListener("click", function (event) {
        if (event.target && event.target.closest && event.target.closest("a")) {
          setOpen(false);
        }
      });

      document.addEventListener("click", function (event) {
        if (!menu.classList.contains("open")) return;
        if (menu.contains(event.target) || button.contains(event.target)) return;
        setOpen(false);
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setOpen(false);
      });
    });
  });
}());
