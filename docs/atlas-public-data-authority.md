# Atlas Public Data And Authority Surface

Atlas exposes a manifest-driven public proof layer for crawlers, reviewers, and developer platforms. The goal is citation and verification, not automated backlink schemes.

## Canonical Public Contract

- Public data catalog: https://atlas.freedomcore.io/datasets/
- Authority manifest: https://atlas.freedomcore.io/datasets/atlas-authority-manifest.json
- Current version: `20260612-22b666eeb28f`
- Content hash: `22b666eeb28f2d176bb8e1b083d5075b2c34dd0f327ece949fd13d08e5d09aa3`
- Generated at: `2026-06-12T19:46:33Z`
- Public indexable symbol URLs: `177`
- Total generated symbol pages tracked locally: `226`

## Dataset Landing Pages

- Atlas Symbol Coverage Index: https://atlas.freedomcore.io/datasets/atlas-symbol-coverage/ (version `20260612-22b666eeb28f`, hash `39c1bbcd00ed`)
- Atlas Market Pulse Dataset: https://atlas.freedomcore.io/datasets/atlas-market-pulse/ (version `20260612-22b666eeb28f`, hash `ad18cc1ca818`)
- Atlas Security Posture Evidence: https://atlas.freedomcore.io/datasets/atlas-security-posture/ (version `20260612-22b666eeb28f`, hash `36edc602c944`)

## Machine Outputs

- Authority manifest JSON: https://atlas.freedomcore.io/datasets/atlas-authority-manifest.json
- Dataset sitemap XML: https://atlas.freedomcore.io/datasets/sitemap.xml
- Symbol updates RSS: https://atlas.freedomcore.io/feeds/atlas-symbol-updates.xml
- Symbol coverage JSON: https://atlas.freedomcore.io/datasets/atlas-symbol-coverage/atlas-symbol-coverage.json
- Symbol coverage CSV: https://atlas.freedomcore.io/datasets/atlas-symbol-coverage/atlas-symbol-coverage.csv
- Market pulse JSON: https://atlas.freedomcore.io/datasets/atlas-market-pulse/atlas-market-pulse.json
- Security posture JSON: https://atlas.freedomcore.io/datasets/atlas-security-posture/atlas-security-posture.json

## Adaptive Rules

- Public routes are stable canonical contracts.
- Facts inside those routes update only when the manifest content hash changes.
- Sitemap `lastmod`, RSS build date, file mtimes, and static response validators should not churn on unchanged material.
- GitHub markdown is a provenance mirror, not the canonical source of truth.
- Category, taxonomy, and faceted pages are excluded from symbol exports and RSS items.

## Provenance

- builder: /root/FreedomCore_Tools/python/atlas_authority_assets.py
- stock_sitemap: https://atlas.freedomcore.io/stocks/sitemap.xml
- daily_context_cache: /root/Atlas_Backend/cache/daily_contexts
- market_pulse: https://atlas.freedomcore.io/stocks/atlas-pulse.json
- github_mirror: https://github.com/freedomcoreai-lang/maverick/blob/main/docs/atlas-public-data-authority.md

## Search Policy

Atlas will not use paid links, automated comment drops, link exchanges, fake directories, or generated third-party link networks. Public authority should come from useful crawlable data, reproducible security evidence, and reachable documentation.

## Citation

When referencing Atlas public datasets, cite the dataset landing page rather than this mirror or a transient homepage module:

```text
Atlas Public Data Catalog
https://atlas.freedomcore.io/datasets/
```
