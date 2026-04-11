# Materialist Dialectics API

This directory is a standalone Vercel runtime for the public `Dialectics` page.

## What It Does

- receives public page requests
- applies a first-pass rate limit
- blocks obvious self-harm / violence / illegal-use requests before normal analysis
- calls the OpenAI Responses API
- returns one of three statuses:
  - `answer`
  - `follow_up`
  - `reject`

## Deploy On Vercel

1. Create a new Vercel project.
2. Set the project root directory to `runtime/materialist-dialectics-api`.
3. Add the environment variables from `.env.example`.
4. Deploy.
5. Copy the deployed endpoint and write it back to `params.materialistDialectics.apiURL` in the blog's `hugo.toml`.

## Required Environment Variables

- `OPENAI_API_KEY`

## Recommended Environment Variables

- `OPENAI_MODEL`
- `ALLOWED_ORIGIN`
- `INPUT_LIMIT`
- `MAX_HISTORY_MESSAGES`
- `MAX_OUTPUT_TOKENS`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

## Notes

- V1 uses in-memory rate limiting. It is intentionally simple and will not behave like a distributed limiter.
- V1 is stateless. The page sends local thread history on each request.
- If you later need stronger abuse protection, move rate limiting to Redis and keep the API contract unchanged.
