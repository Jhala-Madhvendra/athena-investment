# AI Alert Summarization

## What it is

A hypothetical future feature — "summarize what changed this week" — where an LLM turns a batch of already-detected, already-persisted `Alert` documents into a short narrative. **Not implemented in Sprint 11.** This document exists to explain why detection itself stays deterministic, and how summarization would plug in if it's ever built.

## Why AI should not be responsible for deterministic event detection

Three reasons, in order of how much weight each carries:

1. **Reproducibility.** The sprint brief requires that the same input data and thresholds always produce the same alerts. An LLM call is not guaranteed to be deterministic even at temperature 0 across provider versions, and "why did I get this alert" needs an answer that doesn't depend on when it was asked or which model served the request.
2. **Auditability.** A rule firing because `operatingMargin declined 3.4pp >= 3pp threshold` is a fact anyone can independently verify against the same financial statements. An LLM's judgment that "this seems significant" has no equivalent paper trail — it's a black box exactly where the sprint's own product principle (SIGNAL > NOISE, explainable) most needs transparency.
3. **Hallucination risk in a consequential surface.** An alert is inherently a claim that something specific happened, with a specific magnitude, at a specific time. Handing that claim's *generation* — not just its wording — to a model that can fabricate plausible-sounding numbers is a materially worse failure mode than a wordy or awkwardly-phrased but factually grounded deterministic sentence.

This isn't a novel position for this codebase — `insight.engine.js` (Sprint 3) and `news.classifier.js` (Sprint 10) already establish the same principle for structurally similar problems (rule-based insight generation, rule-based news categorization), and the Alert Engine extends that precedent rather than deviating from it.

## How AI could summarize multiple alerts, if built

The shape would mirror Sprint 8's AI Research architecture closely enough that it's genuinely low-effort to add later:

1. Fetch a user's recent `Alert` documents (already structured, already deterministic — via the existing `GET /api/alerts` path, or a small new service function).
2. Build a compact context object from those documents — titles, messages, severities, tickers, dates — the same "structured JSON in, never raw DB documents" discipline `ai.contextBuilder.js` already follows for research reports.
3. Reuse the existing `llmProvider`/`llmProvider.registry.js` abstraction (`backend/ai/providers/`) to call whichever provider is configured via `AI_LLM_PROVIDER` — no new provider integration needed.
4. Reuse `ai.promptBuilder.js`'s grounding pattern: an explicit instruction to summarize *only* what's in the provided alerts, never invent a number or claim not present in the context.

## How structured alerts reduce hallucination risk if summarization is ever added

The critical property: by the time any AI call happens, every fact has already been deterministically verified — the LLM's only job would be *compressing and phrasing* facts that are already true, not deciding which facts are true. This is a fundamentally lower-risk task than generation-from-scratch, and it's the same reason `ai.contextBuilder.js`'s evidence allow-list pattern works: the model is constrained to a closed set of pre-verified inputs, not asked to reason freely over a raw database.

## How evidence should be preserved

Sprint 8's `buildEvidenceAllowList` + `ai.validator.js`'s `sanitizeSectionEvidence` pattern is the concrete mechanism to reuse, not just the philosophy: flatten every alert field a summary is allowed to cite into an explicit allow-list, and reject (silently drop, not fail) any citation the model produces that isn't in that list. Applied to alert summarization, this would mean a generated summary could never reference a number or a ticker that wasn't actually present in the alerts it was given — the same defense-in-depth Sprint 8 already proved out, just pointed at a different input shape.

## Interview questions

1. *"Why not let an LLM decide which changes are 'significant' directly, instead of hand-coded thresholds?"* — Because that decision needs to be reproducible and auditable in a way LLM judgment structurally can't guarantee — the same underlying data must always produce the same alert, and a user challenging an alert needs a concrete, checkable answer ("margin dropped 3.4pp, threshold is 3pp"), not a model's post-hoc rationale.
2. *"If AI summarization were added, what's the actual new hallucination surface, and how would you close it?"* — The surface is the model inventing a number, date, or claim not present in the alerts it was given. The close is the evidence allow-list: constrain the model's output to only cite fields from a pre-flattened, pre-verified set, and validate every citation server-side after generation — never trust the model's own claim that it stayed grounded.
3. *"Doesn't summarizing *after* deterministic detection defeat the purpose of using AI at all?"* — No — it targets AI at what it's actually good at (natural-language compression and phrasing) and away from what this codebase has repeatedly found it unreliable for in a financial context (precise, verifiable claims about specific numbers). The alternative — trusting an LLM to both decide *and* state what happened — combines the least-verifiable capability with the most consequential one.
4. *"Why wasn't this built in Sprint 11 if it's 'genuinely low-effort'?"* — Low marginal engineering effort doesn't mean it's in scope by default — it's still new product surface (a new endpoint, new UI, a new user-facing behavior) that wasn't validated as needed for this sprint's core goal (turning detection deterministic and reliable). Building it prematurely would trade a clean, reviewable core feature for a larger, less-reviewable one, for a nice-to-have the brief itself frames as optional.
5. *"What would make you reconsider and actually build this?"* — A user who's accumulated enough alerts that scanning the list itself becomes the noise problem Sprint 11 was trying to eliminate in the first place — at that point compressing many *already-verified* alerts into one digest solves a real problem, using an approach (evidence-constrained summarization) that's already been proven safe in this codebase for a structurally similar task.
