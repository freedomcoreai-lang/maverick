/* risk-footer.js — slim FCA-style footer banner injected on every page.
 * Sits at the bottom of the page body, narrow and unobtrusive, but always
 * visible by scroll. Single source of truth for compliance copy across the
 * five-site franchise. Updates land in one file, propagate everywhere on
 * next page load. Real DOM element so screen-readers + crawlers see it.
 *
 * Operator 2026-05-01 — was at the TOP of access.html, ruined the hero;
 * now demoted to a thin bottom strip on every page across the family.
 */
(function () {
    'use strict';
    if (document.getElementById('fc-risk-footer')) return;

    var box = document.createElement('div');
    box.id = 'fc-risk-footer';
    box.setAttribute('role', 'note');
    box.setAttribute('aria-label', 'Risk warning');
    box.style.cssText = [
        'position:relative',
        'background:rgba(42,8,8,0.96)',
        'color:#fca5a5',
        'border-top:1px solid rgba(252,165,165,0.30)',
        'padding:8px 14px',
        'font-family:Inter,system-ui,sans-serif',
        'font-size:0.68rem',
        'line-height:1.5',
        'text-align:center',
        'letter-spacing:0.01em',
        'font-weight:500',
        'max-width:100%',
        'box-sizing:border-box'
    ].join(';');

    box.innerHTML = '<strong style="font-weight:700; color:#fecaca;">Risk warning:</strong> ' +
        'Software service, not investment advice. You may lose all the money you put at risk. ' +
        'Past performance does not guarantee future results. We do not custody funds or run a managed account &mdash; ' +
        'you keep your keys, you keep your decisions. ' +
        '<a href="https://maverick.freedomcore.io/pages/access.html#disclaimers" ' +
        'style="color:#fca5a5; text-decoration:underline; font-weight:600;">Full disclaimers &rsaquo;</a>';

    var attach = function () {
        if (!document.body) return;
        document.body.appendChild(box);
    };
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
})();
