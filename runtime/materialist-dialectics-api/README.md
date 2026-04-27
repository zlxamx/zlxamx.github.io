# Materialist Dialectics API

This directory is a standalone Vercel runtime for the public `Dialectics` page.

## What It Does

- receives public page requests
- applies a first-pass rate limit
- blocks obvious self-harm / violence / illegal-use requests before normal analysis
- calls DeepSeek behind the same page contract
- returns one of three statuses:
  - `answer`
  - `follow_up`
  - `reject`

## Deploy On Vercel

1. Create a new Vercel project.
2. Set the project root directory to `runtime/materialist-dialectics-api`.
3. Add the environment variables from `.env.example`.
4. Deploy.
5. Keep `params.materialistDialectics.apiPath = "/api/materialist-dialectics/chat"` in the blog's `hugo.toml` as the preferred same-origin path.
6. Copy the deployed endpoint and write it back to `params.materialistDialectics.apiURL` in the blog's `hugo.toml` as the fallback endpoint.
7. Put a reverse proxy or custom-domain gateway in front of the runtime if you want mainland visitors to stop depending on direct access to the `*.vercel.app` hostname.

The repository includes a ready-to-deploy Cloudflare gateway at [`../materialist-dialectics-proxy`](../materialist-dialectics-proxy/README.md).

## Required Environment Variables

- `DEEPSEEK_API_KEY`

## Recommended Environment Variables

- `DEEPSEEK_MODEL`
- `ALLOWED_ORIGINS`
- `INPUT_LIMIT`
- `MAX_HISTORY_MESSAGES`
- `MAX_OUTPUT_TOKENS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

Suggested starting provider and model for this public page:

- `DEEPSEEK_MODEL=deepseek-chat`

## Notes

- V1 uses in-memory rate limiting. It is intentionally simple and will not behave like a distributed limiter.
- V1 is stateless. The page sends local thread history on each request.
- This runtime is DeepSeek-only. Keep provider fallback decisions at the gateway layer instead of adding divergent model behavior here.
- If you later need stronger abuse protection, move rate limiting to Redis and keep the API contract unchanged.
- `ALLOWED_ORIGIN` still works for older deployments, but `ALLOWED_ORIGINS` is now the preferred comma-separated whitelist.
- GitHub Pages cannot serve this runtime from the same origin by itself. If the blog stays on GitHub Pages, the `/api/materialist-dialectics/chat` path only works after you add a reverse proxy or move the public entrypoint to a platform that can proxy dynamic requests.

## Offline Eval Checks

The eval fixture lives in [`evals/cases.json`](./evals/cases.json). It covers heavy decisions, relationship decisions, team management, learning method, AI strategy, short prompts, long-context prompts, self-harm boundaries, illegal manipulation, and current-politics boundaries.

Run the fixture check without calling a model:

```bash
npm run eval:check
```

You can also validate a saved model result file:

```bash
npm run eval:check -- ./evals/results.json
```

The result file can be an array of objects like:

```json
[
  {
    "id": "quit-freelance-heavy-decision",
    "result": {
      "status": "answer",
      "message": "...",
      "meta": {
        "questionType": "contradiction",
        "disclaimer": true,
        "analysisPaths": []
      }
    }
  }
]
```

The checker validates response status, question type, disclaimer behavior, analysis path count, grounded quotes, and required or forbidden phrases for each case.
