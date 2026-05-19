# MAVERICK

A self-evolving AI trading organism. Built in public. Published open.

**Live site:** [freedomcore.io](https://freedomcore.io)
**Twitter:** [@freedomcoreai](https://x.com/freedomcoreai)
**Chain:** Base (Coinbase L2)

---

## What this repository is

Everything in this repo is the public face of MAVERICK:

- **`/site`** - The complete source of [freedomcore.io](https://freedomcore.io). Static HTML, vanilla CSS, vanilla JS. Zero framework. Zero build step. Every scroll, every tier card, every indicator panel on the live dashboard - it's in here.
- **`/contract`** - The full `MAV.sol` ERC-20 contract deployed to Base. Fixed 1B supply, minting permanently disabled at deploy. Verifiable byte-for-byte on BaseScan once live.
- **`/docs`** - Step-by-step launch runbooks. The exact commands that take the contract from written to deployed, liquidity seeded, and LP locked for 24 months.

## What this repository is NOT

The trading brain is not in here. The live bot, the 1000-generation swarm that rewrites it, the champion codebase, the data pipeline, the forensic crime-scene logs - all of that stays private. That's the edge. Publishing the AI's internal mutations would let anyone front-run us within 48 hours.

What's published is the shopfront and the token contract. Anyone can inspect both, fork them, run their own copy. Nothing tracks you here. Nothing phones home. Nothing needs trusting that you can't verify yourself.

## Canonical MAV contract

```
Chain:      Base (chain ID 8453)
Contract:   0xTBD_AFTER_DEPLOYMENT
BaseScan:   https://basescan.org/token/0xTBD
Aerodrome:  https://aerodrome.finance/swap?from=eth&to=0xTBD
LP locked:  https://team.finance/view-coin/0xTBD (24 months)
```

**Any other contract address pretending to be $MAV is a fraud.** The real one ships from this repo, verifiable byte-for-byte on BaseScan.

## Access tiers

$MAV is a utility access token. It does not grant equity, dividends, or any share of trading profit. It gates access to the [freedomcore.io](https://freedomcore.io) dashboard.

| Tier | Hold $MAV | Card Alt | Annual Alt | Access |
|---|---|---|---|---|
| **Spectator** | — | free | free | Marketing site, security audit, public roadmap, launch story, historical performance |
| **Observer** | 1,000 (free pre-launch) | free with wallet | free with wallet | Live champion card (read-only), Hall of Fame archive, **1-hour daily preview** of swarm evolution feed, wallet-tracked identity ready to upgrade |
| **Signal** | 2,000 | $29 / mo | $232 / yr | Everything above + real-time trade signals, entry/exit/stop alerts, engine + symbol filtering, weekly swarm vote |
| **Pro** | 7,500 | $79 / mo | $632 / yr | Everything above + **unlimited swarm evolution feed**, **AI agent intelligence chain**, weekly DNA mutation deep-dives, multi-channel alert routing |
| **Sovereign** ⭐ | 20,000 | $199 / mo | $1,592 / yr | Everything above + **copy-trading webhook (full autonomy)**, REST API, custom risk overrides, weighted architecture vote, white-glove onboarding |

Token-holders and card-subscribers land in the same tier system. Pick whichever rail fits. Annual saves 33% on either.

Pricing reflects 12-platform competitor research (Cryptohopper, 3Commas, Token Metrics, Nansen, Messari, CryptoQuant, Bybit/Bitget copy trading, TradingView). Prosumer ceiling for self-serve crypto tooling is ~$200/mo; we set Sovereign at $199 deliberately. Copy-trading is in **Pro** (the middle tier 60-70% of buyers pick), not gated behind Sovereign.

## Security

The live site is independently graded **A+** by:
- [Mozilla Observatory](https://observatory.mozilla.org/analyze/freedomcore.io)
- [SecurityHeaders.com](https://securityheaders.com/?q=freedomcore.io&followRedirects=on)
- [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=freedomcore.io)

Full 13-month hardening timeline lives on the site at [/pages/security.html](https://freedomcore.io/pages/security.html).

### About the `FC_API_KEY` string in the source

You will see `fcweb_RETIRED_KEY_ROTATED_20260514` hardcoded in several JS files. **This is intentional and not a leak.** It is a public CSRF-style bot-bouncer, shipped in plaintext to every browser that loads freedomcore.io. Anyone can grab it from view-source. Its only job is to filter out the most casual scraping. Real API protection lives in nginx (rate limiting, origin pinning, method whitelisting, and per-route gating). Automated secret scanners will flag it; the `.gitguardian.yml` at the repo root marks it as a known false positive.

## Not financial advice

MAVERICK is an experimental AI system. It may lose money. It may crash. It may be switched off. Holders are paying for coverage of a live experiment - nothing else. No equity. No dividends. No share of trading profits. No guaranteed return. Crypto is volatile. $MAV can go to zero. Only participate with capital you can afford to lose entirely.

## Hardening

- Contract ownership renounced at deploy
- Minting permanently disabled at constructor
- Liquidity pool locked for 24 months (Team.Finance)
- Team allocation vests 24 months on-chain (Sablier)
- Every treasury movement publicly verifiable on BaseScan
- Strict Content Security Policy on the site - no inline scripts, no third-party JS loaded without a self-hosted copy
- Every API endpoint rate-limited and header-gated

## License

Website source: MIT. Fork it, learn from it, do whatever you want.
Smart contract: MIT.

## Author

Built solo by [@freedomcoreai](https://x.com/freedomcoreai) from a phone, on a motorway, over 13 months. Driving a chemical tanker by day, directing two AI agents (Gemini 3.1 + Claude 4.7) to write the production code by night.

The long version is at [freedomcore.io/pages/about.html](https://freedomcore.io/pages/about.html).
