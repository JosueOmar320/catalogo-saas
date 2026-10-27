# Vitrina — website, catalog and PDF builder for small businesses

[![CI](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/ci.yml/badge.svg)](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/codeql.yml/badge.svg)](https://github.com/JosueOmar320/catalogo-saas/actions/workflows/codeql.yml)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ECF8E?logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)

**English** · [Español](README.es.md)

A multi-tenant SaaS where a small business (a café, a hardware store, a service studio…) builds its own website **without code**. The site doubles as a **product and service catalog** that takes orders over WhatsApp, and exports to a **print-ready PDF**. **Garfield**, an AI assistant, edits the site from plain-language requests.

### ▶ [Try the dashboard live](https://catalogo-saas-nu.vercel.app) — no sign-up

Click **Try the dashboard** on the landing page and you get your own pre-filled test business: products, orders, reviews and analytics. Edit anything; nothing is public, and it is deleted after 24 hours. You can also browse the [sample site](https://catalogo-saas-nu.vercel.app/demo) or download the [PDF catalog](https://catalogo-saas-nu.vercel.app/demo/pdf).

![The site editor with Garfield: asked to "add an FAQ section", it adds and fills it, with undo and next-step suggestions](docs/images/panel-garfield.jpg)

**At a glance:** 1,000+ automated tests · Row Level Security on all 26 tables · 28 migrations · 60 merged pull requests, each one through CI · English and Spanish UI.

## What it does

- **Visual site builder:** pages, 27 section types, 10 site templates, themes with typography and spacing scales, navbars (including a vertical one) and footers. Live preview on desktop, tablet and phone, plus undo/redo and version history.
- **Catalog and orders:** search, filters, custom attributes, product options, wholesale pricing, seasonal products and favorites. Visitors build an order that is sent over WhatsApp and also lands in the dashboard's order inbox.
- **PDF catalog:** generated from the same sections and theme as the website, so the two never drift apart.
- **Garfield AI:** a chat assistant in the editor and across the dashboard. Simple requests are resolved instantly without an LLM. Creative ones go to Gemini, Claude or a local model, which can only *propose* typed, validated actions.
- **Business tools:**
  - customers list and order inbox
  - instant push notifications (installable PWA)
  - sales funnel analytics (visits → product views → cart → order, by traffic source)
  - reviews with replies
  - QR labels, CSV import and export, scheduled prices
- **Platform:**
  - an admin console with an audit log
  - per-business feature toggles
  - custom domains (`mystore.com`, provisioned through the Vercel API)
  - sandboxed custom HTML, CSS and widgets
  - Spanish and English UI
  - a public demo account (see above)

Every feature, area by area: [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md) (Spanish).

## Screenshots

**The public site** a business gets: home, catalog with filters, product page and phone view.

<table>
  <tr>
    <td width="50%"><img src="docs/images/site-home.jpg" alt="Sample site built with Vitrina" /></td>
    <td width="50%"><img src="docs/images/site-menu.jpg" alt="Catalog with search, categories and filters" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/site-product.jpg" alt="Product page with options and WhatsApp order" /></td>
    <td width="50%" align="center"><img src="docs/images/site-mobile.jpg" alt="The catalog on a phone" width="45%" /></td>
  </tr>
</table>

**The PDF catalog**, generated from the same site.

![PDF catalog generated from the same site](docs/images/pdf-catalog.jpg)

**The dashboard:** home with a guided tour, WhatsApp order inbox, and the sales funnel by traffic source.

<table>
  <tr>
    <td width="33%"><img src="docs/images/panel-home.jpg" alt="Dashboard home of the test account" /></td>
    <td width="33%"><img src="docs/images/panel-orders.jpg" alt="Order inbox with WhatsApp orders" /></td>
    <td width="33%"><img src="docs/images/panel-stats.jpg" alt="Sales funnel and traffic sources" /></td>
  </tr>
</table>

## Engineering highlights

| Topic | Decision | Why |
| --- | --- | --- |
| Multi-tenant isolation | Row Level Security on all 26 tables and on Storage, composite foreign keys `(business_id, id)`, and `SECURITY DEFINER` functions with an empty `search_path` for privileged operations. | A bug in the app, or a direct call to the REST API, cannot cross tenants. 436 database tests run every migration on real Postgres (PGlite) and check it. |
| Public site performance | One RPC per business (`get_public_catalog`), cached with ISR and a per-business tag. The anonymous role cannot read tables. The public bundle stays free of Zod (enforced by a test). | An uncached visit costs a single database call, and publishing invalidates only that business. |
| One model, two renderers | The same sections and design tokens render to React on the web and to `@react-pdf/renderer`. | The PDF always matches the site, and there is a single design system to maintain. |
| Safe saves | The editor works in memory and saves in one transaction with optimistic versioning (`site_version`). | No half-saved states, and two people can't silently overwrite each other. |
| Constrained AI | The model returns typed actions (Zod) that go through the same reducer and permissions as the UI. It works without an API key. | A malicious prompt can't do anything the user couldn't already do. |
| Untrusted code | Custom HTML is sanitized on the server. Scripts run only inside a sandboxed `srcdoc` iframe without `allow-same-origin`. Custom CSS is scoped to the site. | Every tenant shares one origin with the dashboard, so tenant scripts must never run on it. |
| Custom domains | `proxy.ts` resolves the host to a business (cached lookup) and rewrites to the same cached pages. Domains are added and verified through the Vercel API. | One deployment serves every tenant's domain. The proxy runs on platform hosts only where a session is needed, so the public catalog stays cheap. |
| Public demo | Each visitor gets a private test business (created with the service role, seeded with orders and 60 days of analytics). It can't be published (a database trigger), stays out of the admin and the audit log, is rate-limited, and is purged by a daily cron. | Anyone can try the real dashboard without an account, and nothing they write ever becomes public. |
| Hardened inputs | SSRF-safe downloads (the IP is checked at connect time), CSV formula neutralization, rate-limited login, strict security headers. | These are the usual SaaS attack surfaces, each covered by tests. |

More detail, in Spanish: [architecture](docs/ARQUITECTURA.md) · [setup, deployment, testing and security guide](docs/GUIA.md) · [i18n](docs/I18N.md) · [Garfield AI](docs/GARFIELD-AI.md) · [changelog](CHANGELOG.md).

## Architecture

```mermaid
flowchart LR
  V[Visitor] -->|mystore.com or /catalogo/slug| P(proxy.ts)
  O[Business owner] -->|/dashboard| P
  P --> N[Next.js 16 on Vercel<br/>Server Components · Server Actions · ISR]
  N -->|session + RLS| DB[(Supabase Postgres<br/>RLS on every table)]
  N --> S[(Supabase Storage)]
  N -->|typed actions| AI[Garfield<br/>local router → Gemini / Claude / Ollama]
  N -->|domains| VA[Vercel API]
  N -->|web push| WP[Push services]
  N -->|weekly email| R[Resend]
```

## Quality

| Layer | Tests | What they cover |
| --- | --- | --- |
| Database | 436 | Every migration in order, RLS per table and role, plan limits, admin RPCs, audit log, retention, custom domains, demo accounts. Runs on PGlite, no Docker needed. |
| Unit | 472 | Security (SSRF, redirects, storage paths), editor reducer, Garfield router and executors, PDF, orders, analytics, domains. Line coverage is 94%. |
| End-to-end | 58 | Public site, landing and ordering on desktop and mobile, with automated accessibility checks (axe, WCAG 2.1 AA). |
| End-to-end, signed in | 49 | Full flows against a local Supabase in Docker: admin creates a business, owner publishes, a visitor orders, inbox, analytics, custom domain, demo account. |

CI runs on every pull request: typecheck and lint, all of the tests above, a production build, `npm audit`, dependency review, gitleaks and CodeQL. Dependabot keeps dependencies current. No job needs secrets.

## Tech stack

Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript (strict) · Supabase (Postgres, Auth, Storage) · Zod 4 · MUI 9 (dashboard only) · `@react-pdf/renderer` · sharp · Web Push · Playwright · Vercel.

## Run it locally

Requires Node.js 24 (see `.nvmrc`).

```bash
npm ci
```

```bash
npm run dev
```

The landing page, `/demo` and `/demo/pdf` work without any backend. The dashboard needs Supabase; follow the [setup guide](docs/GUIA.md#configurar-supabase).

```bash
npm run check
```

That runs typecheck, lint, unit tests and database tests, with no Docker or Supabase required.

## About the project

A solo project by **Josue Flores**, built from September 27, 2026 and deployed on Vercel with Supabase. Every change went through a pull request with the full CI suite; the [changelog](CHANGELOG.md) lists them stage by stage, and each technical audit is in [docs/auditorias](docs/auditorias).

- GitHub: [@JosueOmar320](https://github.com/JosueOmar320)

## License

© 2026 Josue Flores. **All rights reserved.** The source is published for review and portfolio purposes only. It may not be copied, modified, distributed or used commercially without written permission. See [LICENSE](LICENSE).
