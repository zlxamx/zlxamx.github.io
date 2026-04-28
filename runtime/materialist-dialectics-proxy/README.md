# Materialist Dialectics Proxy

This directory contains the same-origin gateway for the public `Dialectics` page.

## Why This Exists

The blog itself is deployed as a static site on GitHub Pages. That means:

- the page can live at `https://luxi.blog/dialectics/`
- the browser cannot post to a serverless function on the same origin by default
- direct calls to a `*.vercel.app` hostname can be unstable for mainland visitors

This Worker fixes the access path by terminating requests on `https://luxi.blog/api/materialist-dialectics/chat`.

It now supports two execution modes:

- direct runtime mode: the Worker calls DeepSeek itself
- upstream fallback mode: the Worker forwards to the old Vercel runtime when no model key is configured on Cloudflare

## What It Does

- accepts `POST` and `OPTIONS` on `/api/materialist-dialectics/chat`
- enforces an origin allowlist before forwarding browser requests
- preserves the caller IP through `x-forwarded-for`
- can run the full public runtime directly on Cloudflare
- streams direct DeepSeek runtime responses to the browser as SSE
- falls back to the old upstream runtime when no provider key is configured
- returns `502` or `504` when the upstream runtime is unreachable

## Configurable Vars

- `DEEPSEEK_MODEL`
- `UPSTREAM_URL`
- `ALLOWED_ORIGINS`
- `INPUT_LIMIT`
- `MAX_HISTORY_MESSAGES`
- `MAX_OUTPUT_TOKENS`
- `REQUEST_TIMEOUT_MS`

Defaults live in [`wrangler.jsonc`](./wrangler.jsonc).

## Optional Secrets

- `DEEPSEEK_API_KEY`

If `DEEPSEEK_API_KEY` is present, the Worker runs the full dialectics runtime directly on Cloudflare and stops depending on the upstream Vercel function.

## Deploy With Cloudflare

1. Put the `luxi.blog` zone on Cloudflare.
2. Ensure the DNS records for `luxi.blog` and `www.luxi.blog` are proxied.
3. Create a Worker from this directory or use the GitHub Actions workflow in this repository.
4. Deploy the Worker.
5. Confirm that `https://luxi.blog/api/materialist-dialectics/chat` responds.

## GitHub Actions Secrets

The included workflow expects these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Optional model secrets:

- `DEEPSEEK_API_KEY`

## Local Check

```bash
npm install
npm run check
```

## Notes

- This Worker keeps the front-end path same-origin, so the page does not need to know the upstream hostname.
- If `DEEPSEEK_API_KEY` is configured on Cloudflare, the Worker owns model calling, safety policy, rate limiting, and provider credentials directly.
- If no model key is configured on Cloudflare, the Worker falls back to the old upstream runtime.
- The direct Worker runtime is DeepSeek-only, matching the Vercel runtime contract.
- Once this Worker is live, the page should primarily use `apiPath = "/api/materialist-dialectics/chat"` and treat the external `apiURL` only as a backup.
- `UPSTREAM_URL` is stored as a normal Worker var because it is a public endpoint, not a credential.
