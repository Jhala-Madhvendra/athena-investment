# Engineering Concept: Grounded News Summarization

## Why raw news should not simply be sent to an LLM

Sending raw article text (or worse, raw headlines with no structure) straight to an LLM invites two specific failure modes: the model can blend multiple articles into a single fabricated "event" that never happened as described, and it can fill gaps in incomplete or ambiguous articles with plausible-sounding invented detail — both are classic hallucination patterns, and both are hard to catch after the fact because the output *reads* fluently either way. Athena's answer is to never let the LLM be the news retrieval or interpretation-of-fact layer at all: the deterministic pipeline (`backend/news/`) retrieves, normalizes, deduplicates, and classifies news entirely without AI, and only a small, structured, already-verified summary of that output (title/description/source/date/category/url — never full article text) is ever handed to the LLM, via `ai.contextBuilder.js`'s `buildRecentEventsSection`.

## Why source attribution matters

An AI-generated claim with no attached source is unfalsifiable by the reader — there's no way to check whether "the company reported strong earnings" is accurate without independently searching for it. Athena's evidence-citation mechanism (`sectionEvidence`, extended in Sprint 10 to include article URLs alongside the existing context field paths) exists specifically so every sentence in the "Recent Developments" section of an AI research report can be traced back to a real, clickable article the user can independently verify — the same trust mechanism Sprint 8 built for numeric claims (citing `ratios.profitability.grossMargin` rather than asserting a number unattributed) extended to news claims.

## How stale information can affect AI analysis

An LLM has no innate sense of "how old is this fact" unless the data explicitly carries a timestamp and the prompt tells it to care. If Athena fed news without dates, a six-month-old leadership change and yesterday's earnings release would look equally "current" to the model, and a report generated today could describe stale news as if it just happened. Every event in `recentEvents.events` carries `publishedAt`, and the system prompt (`ai.promptBuilder.js`) instructs the model to ground its "Recent Developments" narrative in the dated events it's given rather than assume currency — the same discipline Sprint 8 already applied to market data (`marketDataAsOf`) and DCF calculation timestamps.

## How news should be incorporated into financial analysis

Never as a direct override of a computed metric — always as *context* connected to metrics that already exist. The prompt explicitly instructs the model to relate a development to an existing context value only when that value is actually present (e.g. an earnings event alongside the already-computed `revenueCAGR` or `healthScore`), and to keep the factual restatement of what happened separate from any interpretive claim about what it might mean. This mirrors the sprint's core instruction: the deterministic pipeline is the source of truth for *facts*; the AI's role is bounded interpretation, never recalculation.

## How hallucination risk is reduced

Three layers, defense-in-depth: (1) the LLM only ever sees pre-verified, structurally-typed events — it cannot invent an event because it was never given open-ended "go find news" latitude; (2) `sectionEvidence.recentDevelopments` citations are checked server-side against the exact set of article URLs the model was given (`ai.validator.js`'s `sanitizeSectionEvidence`, reusing the Sprint 8 evidence-allow-list mechanism) — a hallucinated URL is silently stripped, never shown to the user as if it were real; (3) the system prompt's FACT-vs-INTERPRETATION rule for recent developments is the same non-negotiable pattern already enforced for every other report section, giving the model one consistent instruction to follow rather than a special case to remember.

## Interview questions

1. *"Why does Athena's evidence-allow-list mechanism work for both numeric context fields and news article URLs, using the same code path?"* — Because the underlying guarantee is identical in both cases — "only cite something that was actually given to you, verified server-side, not self-reported by the model" — the allow-list is just a set of strings the model is allowed to reference; whether those strings are dot-paths (`dcf.intrinsicValuePerShare`) or full URLs is an implementation detail the sanitizer doesn't need to care about.
2. *"What would happen if Athena fed full article text to the LLM instead of title/description/source/date/category/url?"* — Token cost would rise substantially with no proportional benefit (Sprint 8's context is deliberately kept to ~1.6-2KB — see `TokenOptimization.md`), and it would blur the line between "Athena's classified summary of an event" and "the article's own words," making it harder to guarantee the model isn't just paraphrasing (or misquoting) third-party content it doesn't have redistribution rights to reproduce.
