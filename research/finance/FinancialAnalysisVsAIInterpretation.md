# Financial Analysis vs. AI Interpretation

## 1. What it means

Financial *analysis* is the deterministic, reproducible calculation of a number from source data — revenue CAGR, ROE, WACC, intrinsic value per share. Financial *interpretation* is a judgment about what that number means, in context, for this company at this time. Athena draws this line as an architectural boundary, not just a conceptual one: every number in an AI research report comes from Sprints 1–7's calculation engines; every sentence of prose around those numbers comes from the LLM, and only the LLM.

## 2. Why it matters

Conflating the two is the single most common way AI-in-finance products go wrong: if the model that writes the prose is also the model computing the numbers, a hallucinated or slightly-off figure becomes indistinguishable from a real one, because both arrive in the same fluent sentence. Keeping analysis and interpretation as separate pipeline stages — with a hard, code-enforced handoff between them (context JSON in, structured JSON out) — means a wrong number in an Athena AI report can only ever be a bug in a deterministic, unit-tested engine (which is testable, and was tested — 337 backend tests), never a silent LLM arithmetic error (which is not reliably testable at all).

## 3. How professional analysts use it

A junior analyst building a model and a portfolio manager reading the resulting write-up are, functionally, doing analysis and interpretation as two separate steps performed by two different people with two different skill sets and two different sources of accountability — the model builder is accountable for the math being right; the write-up author is accountable for the judgment being sound, and their prose is expected to explicitly reference the model's outputs, not silently re-derive its own. Athena's architecture mirrors that division of labor with a machine boundary instead of an organizational one: `backend/valuation`, `backend/ratio`, `backend/analysis` are the model-builder; the LLM behind `ai.promptBuilder.js` is the write-up author, and it never gets write access to the model.

## 4. How Athena implements it

The boundary is literally a data structure: `ai.contextBuilder.js` produces a plain JSON object containing only already-computed values (never formulas, never raw statements the LLM could "recompute" from); `ai.promptBuilder.js`'s system prompt instructs the model that this JSON is the *only* source of facts it may use; and `ai.validator.js` checks the model's output against a schema and an evidence allow-list built from the same context object, so even the model's own citations are constrained to real, already-computed fields. No code path in the AI domain calls into `dcf.engine.js`, `ratio.calculator.js`, or any formula module directly from the LLM's output — the LLM only ever sees already-finished numbers.

## 5. What AI can and cannot safely do with this concept

**Can:** point out that a specific already-computed ratio and a specific already-computed growth figure, taken together, suggest a coherent story (e.g., margin expansion alongside revenue growth); flag when the analysis-layer data itself is incomplete ("Data unavailable") rather than pretending otherwise. **Cannot:** be given raw financial statements and asked to compute a ratio itself — even if it would probably get simple cases right, "probably right" is not the standard Athena's deterministic engines are held to (unit-tested against hand-verified expected values), and there is no way to hold an LLM's arithmetic to that same standard on every call.

## 6. Common mistakes

- **Assuming a more capable model narrows the gap enough to let it calculate too.** Model capability doesn't change the argument — even a highly capable model's arithmetic isn't independently verifiable per-call the way a unit-tested formula is; the risk isn't "will it usually get this right" but "can this specific answer be trusted without re-deriving it," and the answer for a stochastic model is no.
- **Treating "the AI explained a number correctly" as validation that it could compute similar numbers reliably.** Explaining a number Athena already computed only requires reading comprehension, not arithmetic — a much lower bar than deriving the number in the first place.

## 7. Interview questions

**Q: Where exactly is the line between "financial analysis" and "AI interpretation" enforced in Athena's code?**
A: At the context boundary — `ai.contextBuilder.js` is the only file in the AI domain permitted to import from `backend/ratio`, `backend/analysis`, `backend/valuation`; everything downstream of it (`ai.promptBuilder.js`, the LLM provider, `ai.responseParser.js`, `ai.validator.js`) only ever sees the resulting JSON, never the source engines.

**Q: A user asks the AI report to explain *why* the health score is 78 instead of higher. Is that interpretation or analysis?**
A: Interpretation — the number 78 and its five component scores are analysis, already computed by `health.score.js`; explaining what a 78 with a comparatively weak liquidity component *means* for the investor reading it is exactly the synthesis work the LLM is scoped to do, using only the component breakdown Athena's context already hands it.

**Q: Why not let the AI at least double-check Athena's math as a sanity check?**
A: Because a stochastic model's "sanity check" carries no more reliability guarantee than its primary output — if it disagreed with a unit-tested formula, there's no principled reason to trust the LLM's number over the formula's, and surfacing that disagreement to a user would create doubt about a correct number for no real benefit.
