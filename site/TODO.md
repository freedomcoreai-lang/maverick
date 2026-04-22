# FreedomCore Website — Master TODO

## COMPLETED
- [x] Domain setup (freedomcore.io + www, SSL, nginx)
- [x] Landing page v1 (hero, engines, intelligence chain, access tiers)
- [x] Modular CSS/JS/HTML architecture
- [x] Live API proxy (GET-only, port 8080)
- [x] Live positions monitor with expandable 3-layer exit cards
- [x] Day/night theme toggle (localStorage)
- [x] Swarm terminal with 4 agent tabs (SWARM/SENTINEL/SHADOW/FLAGSHIP)
- [x] Streamline page v1 (indicators, glossary cards)
- [x] Back navigation bar (top + footer)
- [x] Evaluator V3.0 fix (realistic equity simulation)
- [x] Branding overhaul — Globe logo in nav, dark navy/cyan palette, MAVERICK shimmer title
- [x] Color scheme — Dark navy (#060a10) + cyan (#4ecdc4) + blue (#3ea8f5) throughout
- [x] Light mode — Proper light colours matching brand, not generic white
- [x] Homepage logo — Globe in nav top-left, click to expand overlay
- [x] Fix all links — Twitter, home, back buttons on every page
- [x] NTFY alerts badge — Push notification badge in nav, linked to ntfy topic
- [x] Mobile navigation — Hamburger dropdown with all nav links, staircase animation
- [x] SSL security badge — Clickable padlock with real cert details popup
- [x] Security headers — A+ grade on securityheaders.com (10 headers, CSP hardened, rate limiting)
- [x] Security section on homepage — 6-card grid showing all protections + live verify button
- [x] Full About / Whitepaper — 17-chapter narrative, engine blocks, tech panels, stat rows
- [x] LLM Intelligence page — Swarm evolution feed, AI agent deep-dive
- [x] Signal Feed page — Live signals with filter buttons, auto-refresh
- [x] Market News page — Sentinel/Flagship/Shadow feeds
- [x] Streamline page rebuilt — Stats, architecture, 7 expandable indicator cards
- [x] All inline JS removed — CSP script-src 'self' (no unsafe-inline), A+ security
- [x] Gemini to Claude switch — All Trinity Core agents now use claude --model sonnet -p
- [x] Em dashes purged — All website copy uses natural human punctuation

## HIGH PRIORITY
- [ ] **Position cards** — More detail (ratchet bars, regime narrative, status indicators)
- [ ] **Live swarm API feed** — Real-time mutation visibility for visitors

## API FEEDS
- [x] Swarm/Sentinel/Shadow/Flagship feeds wired through /api/swarm_logs
- [x] Signal database feed wired through /api/signals
- [x] Position feed wired through /api/positions
- [ ] Swarm mutations endpoint — real-time DNA evolution on website
- [ ] News/sentiment aggregation — external news sources
- [ ] Position detail deep-dive — TradingView integration (links added, no chart embed yet)

## FUTURE
- [ ] Dedicated Swarm page — beyond terminal embed, live evolution visibility
- [ ] ntfy integration — wire ALERTS badge as paid feature tier
- [ ] Access tier payment system
- [ ] Copy trading integration page
- [ ] Mobile PWA wrapper
- [ ] TradingView chart embeds — click position to see entry/exit markers
