# Materialist Dialectics Page API Contract

## Goal

This document fixes the first backend contract for the public `Dialectics` page.

The contract is intentionally small and stateless so the first Vercel runtime can ship without a database. The client sends local thread history on every request. If cost or latency becomes a real issue, the next revision can move session state to KV or switch to `previous_response_id`.

## Endpoint

- Method: `POST`
- Path: `/api/materialist-dialectics/chat`
- Content-Type: `application/json`

## Access Topology

The preferred public path is still `https://luxi.blog/api/materialist-dialectics/chat`.

In production, that path should be terminated by a same-origin gateway layer and then forwarded to the actual model runtime. The current repository now includes a Cloudflare Worker gateway under [`runtime/materialist-dialectics-proxy`](../runtime/materialist-dialectics-proxy/README.md).

Recommended request flow:

1. Browser -> `https://luxi.blog/api/materialist-dialectics/chat`
2. Cloudflare Worker gateway -> upstream runtime endpoint
3. Upstream runtime -> model provider

The front-end may keep a direct external fallback endpoint for emergencies, but the gateway path should be treated as the stable primary route.

## Request Body

```json
{
  "page": "materialist-dialectics",
  "sessionId": "6f5e8cf8-4be1-49d4-9db6-5085cbcf8c2f",
  "messages": [
    {
      "role": "user",
      "kind": "question",
      "content": "How should I judge whether this conflict is structural or temporary?"
    },
    {
      "role": "assistant",
      "kind": "follow_up",
      "content": "Please clarify the timeline, your bottom line, and the other side's stated goal."
    }
  ],
  "input": "We have been stuck in the same argument for six months."
}
```

## Request Rules

- `page` must equal `materialist-dialectics`.
- `sessionId` must be a non-empty string.
- `messages` is the server-confirmed thread state before the new turn. Do not duplicate the current `input` inside it.
- `input` is the new user turn.
- The backend should reject empty `input`.
- V1 should cap `input` length to the same value used by the page shell.

## Response Body

```json
{
  "status": "answer",
  "message": "This is not mainly a mood problem. It is a judgment problem about incompatible goals...",
  "meta": {
    "questionType": "contradiction",
    "disclaimer": true,
    "sessionId": "6f5e8cf8-4be1-49d4-9db6-5085cbcf8c2f"
  }
}
```

## Response Rules

- `status` must be one of:
  - `answer`
  - `follow_up`
  - `reject`
- `message` must be plain text, already safe to render without Markdown parsing.
- `meta.questionType` should be one of:
  - `contradiction`
  - `ism_error`
  - `epistemology`
  - `strategy`
  - `alignment`
  - `execution`
  - `out_of_scope`
  - `unknown`
- `meta.disclaimer` should be `true` for decision-heavy or professionally sensitive answers.

## Error Semantics

- `400` invalid payload
- `429` rate limited
- `500` model call failed
- `503` runtime unavailable

Suggested error body:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests from this client. Please retry later."
  }
}
```

## Backend Behavior

The backend should do the following in order:

1. Validate payload shape.
2. Run rate limiting before the model call.
3. Apply the page's public-safety boundaries before normal analysis.
4. Convert the skill into a stable system prompt.
5. Return only one assistant turn per request.

## Non-Goals In V1

- No streaming
- No server-side history store
- No Markdown rendering contract
- No auth
- No share links
- No analytics payload beyond basic server logs

## Why Stateless V1

This version matches the current deployment stage:

- the page is static
- the backend will start on serverless functions
- the shell already keeps local state in `localStorage`

That gives the project a clean first milestone:

- page structure is stable
- API shape is fixed
- backend can be implemented without waiting for a database decision
