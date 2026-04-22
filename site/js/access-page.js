/* access-page.js - dual-rail (crypto + Stripe) UX for /pages/access.html.
 * Extracted from inline <script> to comply with strict CSP (script-src 'self').
 */
(function () {
    'use strict';

    // --- CRYPTO RAIL ---
    const cryptoNC = document.getElementById('crypto-not-connected');
    const cryptoC  = document.getElementById('crypto-connected');
    const railCrypto = document.getElementById('rail-crypto');
    const addrEl  = document.getElementById('wallet-addr');
    const tierPill = document.getElementById('tier-pill');
    const balEl   = document.getElementById('wallet-balance');
    const balSub  = document.getElementById('wallet-balance-sub');
    const buyBtn  = document.getElementById('buy-mav-btn');
    const connectBtn    = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');

    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            connectBtn.textContent = 'SIGN IN WALLET…';
            connectBtn.disabled = true;
            try {
                await window.mavWallet.connect();
            } catch (e) {
                alert('Connect failed: ' + (e && e.message ? e.message : e));
                connectBtn.textContent = 'CONNECT WALLET';
                connectBtn.disabled = false;
            }
        });
    }
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', async () => {
            await window.mavWallet.disconnect();
        });
    }

    if (window.mavWallet && typeof window.mavWallet.onChange === 'function') {
        window.mavWallet.onChange((s) => {
            if (!s) return;
            if (s.authenticated) {
                cryptoNC.style.display = 'none';
                cryptoC.style.display = 'flex';
                cryptoC.style.flexDirection = 'column';
                cryptoC.style.gap = '10px';
                railCrypto.classList.add('active');
                addrEl.textContent = s.address;
                const tier = (s.tier || 'none').toUpperCase();
                tierPill.textContent = tier;
                tierPill.style.color = window.mavWallet.tierColor(s.tier);
                balEl.textContent = (s.balance_mav || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' MAV';
                if (s.token_deployed) {
                    balSub.textContent = 'Tier auto-updates within 60s of any balance change.';
                    buyBtn.style.display = 'inline-block';
                } else {
                    balSub.textContent = 'Pre-launch grace - Observer tier free. $MAV launches soon.';
                }
                updateTierTags(s.tier, s.token_deployed);
            } else {
                cryptoNC.style.display = 'block';
                cryptoC.style.display = 'none';
                railCrypto.classList.remove('active');
            }
        });
    }

    // --- FIAT RAIL ---
    const fiatNS = document.getElementById('fiat-not-subscribed');
    const fiatS  = document.getElementById('fiat-subscribed');
    const railFiat = document.getElementById('rail-fiat');
    const subEmailEl = document.getElementById('sub-email');
    const subBtn = document.getElementById('subscribe-btn');
    const magicLink = document.getElementById('magic-link');
    const portalBtn = document.getElementById('portal-btn');
    const subLogoutBtn = document.getElementById('sub-logout-btn');

    let selectedTier = 'signal';
    let selectedCycle = 'monthly';
    document.querySelectorAll('.ax-tier-choice').forEach((el) => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.ax-tier-choice').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            selectedTier = el.dataset.tier;
        });
    });

    const FC_API_KEY = (typeof FC_API_HEADERS === 'object' && FC_API_HEADERS['X-API-Key'])
        || 'fcweb_60fd94aa2d910f38a9f3e0557076791a';
    const apiFetch = (url, opts) => {
        const o = Object.assign({ credentials: 'same-origin' }, opts || {});
        o.headers = (typeof window.fcMergeHeaders === 'function')
            ? window.fcMergeHeaders(o.headers)
            : Object.assign({ 'X-API-Key': FC_API_KEY }, o.headers || {});
        return fetch(url, o);
    };

    async function loadPlans() {
        try {
            const r = await apiFetch('/api/sub/plans');
            const d = await r.json();
            const byT = {};
            (d.plans || []).forEach(p => byT[p.tier] = p);
            // New plans response uses monthly_display / annual_display.
            // Default tier-choice buttons show monthly. Pick whichever
            // field is present so older API responses still render too.
            const pickDisplay = (p) => p && (p.monthly_display || p.display || '');
            const setPrice = (id, p) => {
                const el = document.getElementById(id);
                if (el && p) el.textContent = pickDisplay(p);
            };
            setPrice('price-signal',    byT.signal);
            setPrice('price-pro',       byT.pro);
            setPrice('price-sovereign', byT.sovereign);
            if (!d.stripe_enabled) {
                subBtn.disabled = true;
                subBtn.textContent = 'SUBSCRIPTIONS OPENING SOON';
            }
        } catch (e) { /* ignore */ }
    }

    if (subBtn) {
        subBtn.addEventListener('click', async () => {
            const email = (subEmailEl.value || '').trim();
            if (!email || !email.includes('@')) {
                alert('Please enter a valid email.');
                return;
            }
            subBtn.disabled = true;
            subBtn.textContent = 'OPENING CHECKOUT…';
            try {
                const r = await apiFetch('/api/sub/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tier: selectedTier, billing_cycle: selectedCycle, email }),
                });
                const d = await r.json();
                if (d.url) {
                    window.location.href = d.url;
                } else {
                    alert(d.error || 'Checkout failed.');
                    subBtn.disabled = false;
                    subBtn.textContent = 'SUBSCRIBE & WATCH';
                }
            } catch (e) {
                alert('Checkout failed: ' + e);
                subBtn.disabled = false;
                subBtn.textContent = 'SUBSCRIBE & WATCH';
            }
        });
    }

    if (magicLink) {
        magicLink.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt('Enter your subscription email:');
            if (!email) return;
            const r = await apiFetch('/api/sub/magic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            const d = await r.json();
            alert(d.message || 'Check your email.');
        });
    }

    if (portalBtn) {
        portalBtn.addEventListener('click', async () => {
            const r = await apiFetch('/api/sub/portal', { method: 'POST' });
            const d = await r.json();
            if (d.url) window.location.href = d.url;
            else alert(d.error || 'Portal failed.');
        });
    }

    if (subLogoutBtn) {
        subLogoutBtn.addEventListener('click', async () => {
            await apiFetch('/api/sub/logout', { method: 'POST' });
            await refreshSubStatus();
        });
    }

    async function refreshSubStatus() {
        try {
            const r = await apiFetch('/api/sub/status');
            const d = await r.json();
            if (d.authenticated) {
                fiatNS.style.display = 'none';
                fiatS.style.display = 'flex';
                fiatS.style.flexDirection = 'column';
                fiatS.style.gap = '10px';
                railFiat.classList.add('active');
                document.getElementById('sub-email-display').textContent = d.email;
                const tier = (d.tier || 'none').toUpperCase();
                const tierPillSub = document.getElementById('sub-tier-pill');
                tierPillSub.textContent = tier;
                tierPillSub.style.color = window.mavWallet
                    ? window.mavWallet.tierColor(d.tier)
                    : '#f5a623';
                updateTierTags(d.tier, true);
            } else {
                fiatNS.style.display = 'block';
                fiatS.style.display = 'none';
                railFiat.classList.remove('active');
            }
        } catch (e) { /* ignore */ }
    }

    function updateTierTags(currentTier, tokenDeployed) {
        const order = ['none', 'observer', 'signal', 'sovereign'];
        const myIdx = order.indexOf(currentTier || 'none');
        const tags = {
            observer:  document.getElementById('status-observer'),
            signal:    document.getElementById('status-signal'),
            sovereign: document.getElementById('status-sovereign'),
        };
        Object.entries(tags).forEach(([n, el]) => {
            if (!el) return;
            const tIdx = order.indexOf(n);
            const unlocked = tIdx <= myIdx;
            el.className = 'status-tag ' + (unlocked ? 'unlocked' : (tokenDeployed ? 'locked' : 'soon'));
            el.textContent = unlocked ? 'Unlocked' : (tokenDeployed ? 'Locked' : 'Pre-launch');
        });
    }

    // Magic-link / Stripe success query handling
    const u = new URL(window.location.href);
    if (u.searchParams.get('magic')) {
        const t = u.searchParams.get('magic');
        apiFetch('/api/sub/verify-magic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: t }),
        }).then(r => r.json()).then(d => {
            if (d.ok) { alert('Signed in as ' + d.email); refreshSubStatus(); }
            else { alert(d.error || 'Link expired.'); }
            u.searchParams.delete('magic');
            history.replaceState({}, '', u);
        });
    }
    if (u.searchParams.get('sub') === 'success') {
        alert('Subscription activated. Welcome.');
        u.searchParams.delete('sub');
        u.searchParams.delete('email');
        history.replaceState({}, '', u);
    }

    loadPlans();
    refreshSubStatus();
    setInterval(refreshSubStatus, 60000);
})();
