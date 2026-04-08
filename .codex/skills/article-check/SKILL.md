---
name: article-check
description: Check Chinese article drafts, Markdown posts, essays, newsletters, and other publishable prose for wording precision, conceptual clarity, tone consistency, punctuation, spacing, capitalization, number formatting, risky vocabulary, and reader-facing structure. Use when Codex needs to review an article before publishing, explain what can and cannot be written, suggest localized rewrites, or enforce a house style distilled from the Hanyang and Geedea essays on writing and wording.
---

# Article Check

Read [references/article-standards.md](references/article-standards.md) before reviewing.

## Workflow

1. Identify the material.
- Accept a full article, a Markdown file, or selected excerpts.
- When the source is Markdown, review the publish-facing text: title, summary, headings, captions, blockquotes, and body text.
- Ignore front matter, code blocks, raw URLs, and reference IDs unless the user explicitly asks to review them too.

2. Run checks in this order.
- Catch hard-rule issues first: punctuation, spacing, capitalization, quotes, number style, and obvious prohibited vocabulary.
- Then check wording and tone: cliches, buzzwords, performative phrasing, unsuitable voice, and empty intensifiers.
- Then check conceptual precision: undefined abstract terms, mixed concepts, mistranslated terms, scope drift, and unsupported certainty.
- Finally check reader experience: self-indulgent openings, paragraphs with no payoff, and length without information gain.

3. Preserve author intent.
- Keep the author's voice when possible. Fix clarity before polish.
- If a line is intentionally colloquial, satirical, or quoted, do not normalize it blindly. Mark it as an intentional exception when the effect is clear.
- Do not rewrite the whole article unless the user asks. Default to local edits.

## Review Priorities

- Treat meaning errors as more serious than style preferences.
- Quote the exact problematic excerpt every time.
- Explain the violated rule in plain Chinese.
- Give the smallest acceptable rewrite that preserves meaning.
- If a key term has no stable definition, say the article needs a working definition instead of pretending there is one correct wording.

## Output Format

Use this structure unless the user asks for something else:

### Verdict

- `可发布`
- `发布前需修改`
- `不建议发布`

### Must Fix

List issues that break meaning, create avoidable ambiguity, violate hard formatting rules, or use clearly prohibited wording. For each issue, include:
- excerpt
- rule
- why it fails
- suggested rewrite

### Should Fix

List clarity, tone, structure, or consistency issues that weaken the article without fully breaking it. Use the same fields as `Must Fix`.

### Polish

List optional tightening, rhythm, or freshness suggestions.

### What Already Works

List the strongest 2-5 choices in the draft so the author knows what to keep.

## Judgment Rules

- If the article uses abstract concepts as load-bearing terms, never pass it without checking whether each term is defined in context.
- If a sentence can be made stronger by replacing an abstract noun with a concrete action, prefer the concrete action.
- If a phrase only signals stance or taste but adds no information, flag it.
- If you are uncertain whether a term is wrong or merely ambiguous, say so explicitly and offer the author a decision they can make.

## Exceptions

- For direct quotations, source titles, or citations, preserve the original wording unless it creates avoidable confusion.
- For fiction, diaries, or deliberately stylized essays, relax the reader-utility rules, but keep hard formatting and concept-consistency checks.
- If the article intentionally breaks a rule, say why the effect works or fails instead of applying a blanket correction.
