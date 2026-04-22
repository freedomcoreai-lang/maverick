/* mav-wallet.js - MAVERICK multi-wallet connect + SIWE + tier display.
 *
 * Supports ~90% of real-world wallet situations via four routes:
 *   1. Injected wallet  (MetaMask, Rabby, Brave, Coinbase extension, Phantom-EVM, OKX)
 *   2. Coinbase Wallet mobile (universal-link → in-app DApp browser)
 *   3. MetaMask / Trust / Rainbow / Safe / Zerion mobile (app-scheme deep link)
 *   4. Hardware wallets via Ledger Live / Trezor Suite mobile apps (WalletConnect)
 *
 * Picks the right flow by device and by which wallet the user selects.
 * Desktop without extension → shows QR / install CTA.
 */

(function () {
    'use strict';

    const GATE = '/api/gate';
    const BASE_CHAIN_ID = 8453;
    const BASE_CHAIN_HEX = '0x2105';
    const SIWE_DOMAIN = window.location.host;
    const SIWE_STATEMENT = 'Sign in to MAVERICK to unlock your tier access. This request will not trigger any blockchain transaction or cost gas.';
    const DAPP_URL = window.location.origin + '/pages/access.html';

    let _lastStatus = null;
    const _subs = new Set();

    function emit() {
        _subs.forEach((fn) => { try { fn(_lastStatus); } catch (_) {} });
    }

    const FC_API_KEY = (typeof FC_API_HEADERS === 'object' && FC_API_HEADERS['X-API-Key'])
        || 'fcweb_60fd94aa2d910f38a9f3e0557076791a';

    // Owner PIN — captured from ?owner=<PIN> on any page load and persisted in
    // localStorage so it auto-attaches as X-Owner-Key on every API request.
    // Scrubs the PIN from the URL so it doesn't linger in history / share links.
    (function captureOwnerPin() {
        try {
            const u = new URL(window.location.href);
            const pin = u.searchParams.get('owner');
            if (pin) {
                localStorage.setItem('mav_owner_key', pin);
                u.searchParams.delete('owner');
                history.replaceState({}, '', u.toString());
            }
        } catch (_) {}
    })();
    function getOwnerKey() {
        try { return localStorage.getItem('mav_owner_key') || ''; } catch (_) { return ''; }
    }

    function mergeHeaders(h) {
        const out = Object.assign({ 'X-API-Key': FC_API_KEY }, h || {});
        const ok = getOwnerKey();
        if (ok) out['X-Owner-Key'] = ok;
        return out;
    }

    // Expose the header-merger for sibling scripts (signals-page.js, access-page.js)
    window.fcOwnerKey = getOwnerKey;
    window.fcMergeHeaders = mergeHeaders;

    async function _json(url, opts) {
        const o = Object.assign({ credentials: 'same-origin' }, opts || {});
        o.headers = mergeHeaders(o.headers);
        const r = await fetch(url, o);
        if (!r.ok) {
            let body = '';
            try { body = (await r.json()).error || ''; } catch (_) {}
            throw new Error(body || ('HTTP ' + r.status));
        }
        return r.json();
    }

    async function status() {
        // PIN handling now happens in captureOwnerPin() at module init — every
        // request via _json() auto-attaches X-Owner-Key from localStorage.
        try { _lastStatus = await _json(GATE + '/status'); }
        catch (e) { _lastStatus = { authenticated: false, address: null, tier: 'none', balance_mav: 0 }; }
        emit();
        return _lastStatus;
    }

    function isMobile() {
        return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    }
    function detectInjectedName() {
        const e = window.ethereum;
        if (!e) return null;
        if (e.isRabby)           return 'Rabby';
        if (e.isMetaMask)        return 'MetaMask';
        if (e.isCoinbaseWallet)  return 'Coinbase Wallet';
        if (e.isBraveWallet)     return 'Brave Wallet';
        if (e.isTrust || e.isTrustWallet) return 'Trust';
        if (e.isPhantom)         return 'Phantom';
        if (e.isOkxWallet)       return 'OKX Wallet';
        if (e.isTokenPocket)     return 'TokenPocket';
        if (e.isBitKeep)         return 'Bitget Wallet';
        if (e.isFrame)           return 'Frame';
        if (e.isZerion)          return 'Zerion';
        if (e.isRainbow)         return 'Rainbow';
        return 'Browser Wallet';
    }

    async function _ensureBaseChain(provider) {
        provider = provider || window.ethereum;
        if (!provider) throw new Error('No wallet provider');
        const chainId = await provider.request({ method: 'eth_chainId' });
        if (chainId === BASE_CHAIN_HEX) return;
        try {
            await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: BASE_CHAIN_HEX }],
            });
        } catch (err) {
            if (err && err.code === 4902) {
                await provider.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BASE_CHAIN_HEX,
                        chainName: 'Base',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://mainnet.base.org'],
                        blockExplorerUrls: ['https://basescan.org'],
                    }],
                });
            } else {
                throw err;
            }
        }
    }

    function _buildSiweMessage(address, nonce) {
        const now = new Date().toISOString();
        return (
            SIWE_DOMAIN + ' wants you to sign in with your Ethereum account:\n' +
            address + '\n\n' + SIWE_STATEMENT + '\n\n' +
            'URI: ' + window.location.origin + '\n' +
            'Version: 1\nChain ID: ' + BASE_CHAIN_ID + '\n' +
            'Nonce: ' + nonce + '\n' +
            'Issued At: ' + now
        );
    }

    async function _signInWithProvider(provider) {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        const address = (accounts && accounts[0] ? accounts[0] : '').toLowerCase();
        if (!address) throw new Error('Wallet access denied.');

        await _ensureBaseChain(provider);

        const { nonce } = await _json(GATE + '/nonce');
        const message = _buildSiweMessage(address, nonce);
        const signature = await provider.request({
            method: 'personal_sign', params: [message, address],
        });
        const resp = await _json(GATE + '/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, message, signature }),
        });
        _lastStatus = Object.assign({ authenticated: true }, resp);
        emit();
        return _lastStatus;
    }

    // ─── wallet options ────────────────────────────────────────────────
    // Each entry: {id, label, icon, action}
    // Actions either sign in inline, or redirect to a mobile deep-link.
    function walletOptions() {
        const opts = [];
        const injected = detectInjectedName();
        if (injected) {
            opts.push({
                id: 'injected',
                label: 'Continue with ' + injected,
                sub: 'Detected in this browser',
                icon: '🦊',
                action: () => _signInWithProvider(window.ethereum),
            });
        }
        // Always-available deep-link routes (most useful on mobile browsers)
        const enc = encodeURIComponent(DAPP_URL);
        const host = SIWE_DOMAIN;
        const host_path = host + '/pages/access.html';

        opts.push({
            id: 'metamask-mobile',
            label: 'MetaMask (mobile)',
            sub: 'Opens the app and returns here',
            icon: '🦊',
            action: () => { window.location.href = 'https://metamask.app.link/dapp/' + host_path; },
        });
        opts.push({
            id: 'coinbase-mobile',
            label: 'Coinbase Wallet (mobile)',
            sub: 'iOS + Android, passkey-backed Smart Wallet',
            icon: '🔵',
            action: () => { window.location.href = 'https://go.cb-w.com/dapp?cb_url=' + enc; },
        });
        opts.push({
            id: 'trust-mobile',
            label: 'Trust Wallet (mobile)',
            sub: 'Most popular non-custodial mobile wallet',
            icon: '🛡️',
            action: () => { window.location.href = 'https://link.trustwallet.com/open_url?coin_id=60&url=' + enc; },
        });
        opts.push({
            id: 'rainbow-mobile',
            label: 'Rainbow (mobile)',
            sub: 'Beautiful EVM wallet',
            icon: '🌈',
            action: () => { window.location.href = 'https://rnbwapp.com/link?url=' + enc; },
        });
        opts.push({
            id: 'safe',
            label: 'Safe (multisig)',
            sub: 'Multi-sig vault - connect via Safe UI',
            icon: '🔐',
            action: () => { window.open('https://app.safe.global', '_blank'); },
        });
        opts.push({
            id: 'ledger',
            label: 'Ledger (cold wallet)',
            sub: 'Use Ledger Live → Discover → DApp browser',
            icon: '❄️',
            action: () => { window.open('https://www.ledger.com/ledger-live', '_blank'); },
        });
        opts.push({
            id: 'trezor',
            label: 'Trezor (cold wallet)',
            sub: 'Use via Trezor Suite or MetaMask connection',
            icon: '🗝️',
            action: () => { window.open('https://suite.trezor.io', '_blank'); },
        });
        opts.push({
            id: 'install',
            label: 'I don\'t have a wallet',
            sub: 'Install in 60 seconds (free)',
            icon: '➕',
            action: () => openInstallGuide(),
        });
        return opts;
    }

    // ─── picker modal ──────────────────────────────────────────────────
    let _pickerOpen = false;
    function openPicker() {
        if (_pickerOpen) return;
        _pickerOpen = true;
        const overlay = document.createElement('div');
        overlay.id = 'mav-wallet-picker';
        overlay.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:99999;' +
            'display:flex;align-items:center;justify-content:center;padding:16px;' +
            'font-family:"Inter",sans-serif;backdrop-filter:blur(6px);';

        const card = document.createElement('div');
        card.style.cssText =
            'background:#0f131a;border:1px solid #1f2837;border-radius:18px;padding:22px;' +
            'max-width:420px;width:100%;max-height:90vh;overflow-y:auto;' +
            'box-shadow:0 40px 80px rgba(0,0,0,0.7);';

        const opts = walletOptions();
        card.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">' +
                '<div style="font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;color:#3ea8f5;letter-spacing:2.5px;text-transform:uppercase;">Connect Wallet</div>' +
                '<button id="__mav_close__" style="background:transparent;border:none;color:#8a9fb4;cursor:pointer;font-size:1.4rem;line-height:1;">×</button>' +
            '</div>' +
            '<div style="color:#8a9fb4;font-size:0.82rem;line-height:1.6;margin-bottom:14px;">Pick how you want to sign in. All options are non-custodial - we never see your keys.</div>' +
            '<div id="__mav_opts__" style="display:flex;flex-direction:column;gap:6px;"></div>';

        overlay.appendChild(card);
        document.body.appendChild(overlay);
        const list = card.querySelector('#__mav_opts__');

        opts.forEach((o) => {
            const row = document.createElement('button');
            row.style.cssText =
                'display:flex;align-items:center;gap:12px;padding:13px 14px;' +
                'background:rgba(255,255,255,0.03);border:1px solid #1f2837;border-radius:12px;' +
                'text-align:left;cursor:pointer;color:#e4e8f0;font-family:inherit;width:100%;transition:all 0.2s;';
            row.onmouseover = () => { row.style.borderColor = '#3ea8f5'; row.style.background = 'rgba(62,168,245,0.08)'; };
            row.onmouseout  = () => { row.style.borderColor = '#1f2837'; row.style.background = 'rgba(255,255,255,0.03)'; };
            row.innerHTML =
                '<span style="font-size:1.4rem;width:32px;flex:none;text-align:center;">' + o.icon + '</span>' +
                '<span style="flex:1;min-width:0;">' +
                    '<span style="display:block;font-weight:700;font-size:0.9rem;">' + o.label + '</span>' +
                    '<span style="display:block;color:#8a9fb4;font-size:0.72rem;margin-top:2px;">' + o.sub + '</span>' +
                '</span>' +
                '<span style="color:#3ea8f5;font-family:\'JetBrains Mono\',monospace;font-size:0.8rem;">›</span>';
            row.addEventListener('click', async () => {
                closePicker();
                try {
                    await o.action();
                } catch (e) {
                    alert('Connect failed: ' + (e && e.message ? e.message : e));
                }
            });
            list.appendChild(row);
        });

        card.querySelector('#__mav_close__').addEventListener('click', closePicker);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closePicker(); });
        document.addEventListener('keydown', _escClose);
    }
    function _escClose(e) { if (e.key === 'Escape') closePicker(); }
    function closePicker() {
        const o = document.getElementById('mav-wallet-picker');
        if (o) o.remove();
        _pickerOpen = false;
        document.removeEventListener('keydown', _escClose);
    }

    function openInstallGuide() {
        const msg =
            'To hold $MAV you need a crypto wallet. Three easy picks:\n\n' +
            '1. MetaMask (browser extension on desktop, app on mobile) - metamask.io\n' +
            '2. Coinbase Wallet (app on mobile, Smart Wallet on desktop, passkey-backed) - wallet.coinbase.com\n' +
            '3. Rabby (browser extension, better UX than MetaMask) - rabby.io\n\n' +
            'Install one, come back here, click Connect.';
        alert(msg);
    }

    // ─── public API ────────────────────────────────────────────────────
    async function connect() {
        // Prefer inline injected wallet on desktop
        if (window.ethereum && !isMobile()) {
            return _signInWithProvider(window.ethereum);
        }
        // If a mobile wallet's in-app browser injected ethereum → sign inline
        if (window.ethereum && isMobile()) {
            return _signInWithProvider(window.ethereum);
        }
        // Otherwise show the picker with mobile deep-links + installs
        openPicker();
    }

    async function disconnect() {
        try { await _json(GATE + '/logout', { method: 'POST' }); } catch (_) {}
        _lastStatus = { authenticated: false, address: null, tier: 'none', balance_mav: 0 };
        emit();
    }

    function onChange(fn) {
        _subs.add(fn);
        if (_lastStatus) fn(_lastStatus);
        return () => _subs.delete(fn);
    }
    function tierColor(tier) {
        switch (tier) {
            case 'sovereign': return '#b9c5ff';
            case 'signal':    return '#ffd700';
            case 'observer':  return '#4ecdc4';
            default:          return '#6b7280';
        }
    }
    function shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }

    function injectNavBadge() {
        const navRight = document.querySelector('.nav-right');
        if (!navRight || document.getElementById('mav-wallet-badge')) return;

        const wrap = document.createElement('div');
        wrap.id = 'mav-wallet-badge';
        wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        // Compact on mobile (icon + short tier), fuller on desktop
        wrap.innerHTML =
            '<button id="mav-wallet-btn" style="' +
            'font-family:\'JetBrains Mono\',monospace;font-size:0.56rem;' +
            'padding:5px 9px;border:1px solid var(--border);border-radius:6px;' +
            'background:var(--card);color:var(--text);cursor:pointer;' +
            'letter-spacing:1px;text-transform:uppercase;white-space:nowrap;' +
            'max-width:110px;overflow:hidden;text-overflow:ellipsis;' +
            '">Connect</button>';
        navRight.insertBefore(wrap, navRight.firstChild);

        const btn = document.getElementById('mav-wallet-btn');
        btn.addEventListener('click', async () => {
            if (_lastStatus && _lastStatus.authenticated) {
                window.location.href = '/pages/access.html';
            } else {
                try { await connect(); }
                catch (e) { alert('Wallet connect failed: ' + (e.message || e)); }
            }
        });

        onChange((s) => {
            if (!s) return;
            if (s.authenticated) {
                const tier = (s.tier || 'none').toUpperCase();
                const col = tierColor(s.tier);
                btn.textContent = tier === 'NONE' ? shortAddr(s.address) : tier;
                btn.style.color = col;
                btn.style.borderColor = col;
            } else {
                btn.textContent = 'CONNECT';
                btn.style.color = 'var(--text)';
                btn.style.borderColor = 'var(--border)';
            }
        });
    }

    function init() {
        injectNavBadge();
        status();
        setInterval(status, 120000);
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }

    window.mavWallet = {
        connect, disconnect, status, onChange, tierColor, shortAddr,
        openPicker, closePicker, detectInjectedName,
    };
})();
