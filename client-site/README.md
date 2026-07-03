# Delegators — Client Marketing & Portal

A high-performance, single-page application (SPA) serving as the public face and client desk for the **Delegators** platform. Built using React, TypeScript, CSS design tokens, and Vite.

> **2026-07 — launch pass storefront.** A dedicated **`/pricing`** page (linked from the navbar) sells the
> public **Pro** pass (`dlg_lite`, ₹49) and shows **UltraSpeed Beta** (`dlg_ultra`, invite-only).
> The post-purchase **success page** shows a "Pass active" screen with CTAs for SWE clients and Workbench
> for one pass spendable on either surface from the same ₹
> budget; the landing's account panel surfaces the active pass + a link to the centralized per-plan **usage
> dashboard** (`/dashboard`). The cream editorial identity is unchanged. See root [`README.md`](../README.md)
> → *2026-06 Suite Additions*.

## Design Philosophy

This project strictly rejects generic "cyberpunk" neon gradients and AI slop. It implements a warm, sophisticated professional developer brand:
* **Backgrounds:** Warm cream (`#faf8f5`) and rich off-white (`#f2efe9`).
* **Accents:** Earthy burnt orange (`#c2410c`) and sleek slate (`#1c1917`).
* **Typography:** Elegant serif (`Instrument Serif`) for hero statements, legible sans-serif (`Inter`) for layouts, and monospaced (`JetBrains Mono`) for configuration structures.
* **Canvas Particles:** High-performance ambient vector particle systems running floating backdrops.

## Structure

* `/src/styles/` — Highly structured vanilla CSS design tokens, reset rules, layout grids, and bespoke visual components.
* `/src/lib/` — Standardized communication modules:
  * `api.ts` — Complete, safe endpoint connections to the Go backend (`/v1/plans`, `/v1/session/status`, `/v1/session/usage`, `/v1/payment/create`).
  * `auth.ts` — Local credential storage routines.
* `/src/main.ts` — Single entry router managing UI state changes, dynamic template rendering, metric progress computations, real-time logging ledgers, and floating canvas events.

## Commands

```bash
# Install toolchains
npm install

# Run local hot-reloaded development server
npm run dev

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```
