# Materialist Dialectics Proxy

This directory contains the same-origin gateway for the public `Dialectics` page.

## Why This Exists

The blog itself is deployed as a static site on GitHub Pages. That means:

- the page can live at `https://luxi.blog/dialectics/`
- the browser cannot post to a serverless function on the same origin by default
- direct calls to a `*.vercel.app` hostname can be unstable for mainland visitors

This Worker fixes the access path by terminating requests on `https://luxi.blog/api/materialist-dialectics/chat` and forwarding them server-side to the actual runtime.

## What It Does

- accepts `POST` and `OPTIONS` on `/api/materialist-dialectics/chat`
- enforces an origin allowlist before forwarding browser requests
- preserves the caller IP through `x-forwarded-for`
- relays the upstream response without changing the page contract
- returns `502` or `504` when the upstream runtime is unreachable

## Configurable Vars

- `UPSTREAM_URL`
- `ALLOWED_ORIGINS`
- `REQUEST_TIMEOUT_MS`

Defaults live in [`wrangler.jsonc`](./wrangler.jsonc).

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

## Local Check

```bash
npm install
npm run check
```

## Notes

- This Worker keeps the front-end path same-origin, so the page does not need to know the upstream hostname.
- The upstream runtime still owns model calling, safety policy, rate limiting, and provider credentials.
- Once this Worker is live, the page should primarily use `apiPath = "/api/materialist-dialectics/chat"` and treat the external `apiURL` only as a backup.
- `UPSTREAM_URL` is stored as a normal Worker var because it is a public endpoint, not a credential.
