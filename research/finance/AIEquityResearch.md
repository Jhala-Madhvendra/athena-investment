# AI Equity Research

## 1. What it means

AI Equity Research, as Athena implements it, is an LLM reading Athena's own already-computed financial analysis — ratios, growth, health score, market data, DCF, comps — and writing a structured narrative that explains what those numbers mean, in plain English, organized the way a sell-side or buy-side research note is organized (Executive Summary, Business Performance, Financial Health, Market Performance, Valuation, Strengths, Risks, Considerations, Conclusion). It is explicitly *not* an AI that reads a 10-K and derives its own numbers, and it is not a chatbot answering open-ended questions about a company — it is a fixed-shape report generator constrained to interpret a fixed, pre-computed context.

## 2. Why it matters

Athena's Sprints 1–7 already answer "what are the numbers" (statements, ratios, health score, market data, DCF, comps) — what none of them do is connect those numbers into a single readable narrative the way a human analyst would when writing up a company. An investor staring at seven separate tabs of correct numbers still has to do the synthesis work themselves: which of these ratios actually matter together, does the DCF gap corroborate or contradict the health score, is the elevated P/E explained by the growth rate. AI Equity Research does that synthesis work — and matters specifically *because* every number it references is traceable back to a deterministic calculation, not a model's own arithmetic, which is what makes the synthesis trustworthy rather than merely fluent.

## 3. How professional analysts use it

A professional equity research report (sell-side or buy-side) follows a similar shape for a similar reason: a fund manager reading dozens of names a day needs the analyst's *interpretation* up front (Executive Summary, thesis, key risks), with the supporting math (the model, the comps table, the DCF) available but not re-derived in prose. Analysts are trained to keep factual statements ("revenue grew 8%") separate from judgment calls ("we believe this reflects durable pricing power") — precisely the FACT vs. INTERPRETATION distinction Athena's system prompt enforces mechanically. Professionally, this separation exists so a reader can independently evaluate whether they agree with the analyst's *interpretation* even when they don't dispute the *facts*; Athena's evidence-chip design (see `research/engineering/AIProviderAbstraction.md` and `AIContextBuilder.md`) exists for the identical reason.

## 4. How Athena implements it

`backend/ai/ai.contextBuilder.js` gathers Athena's existing engine outputs (never recalculating anything) into a compact JSON context; `ai.promptBuilder.js` wraps that context in a system prompt that forbids invented numbers and investment recommendations; the configured LLM provider (`ai.service.js` → `providers/llmProvider.registry.js`) turns it into the structured report; `ai.validator.js` rejects anything that doesn't match the required schema before it ever reaches a user. The report is persisted per ticker (`ai.model.js`) so a user isn't paying for (and waiting on) a fresh LLM call every time they revisit a company — see `research/product/AIResearchAnalystProductDesign.md` for why that's a deliberate departure from the DCF/Comps no-persistence precedent.

## 5. What AI can and cannot safely do with this concept

**Can:** interpret a fixed, pre-computed set of figures into prose; identify which combinations of Athena's own metrics look like strengths or risks; flag when data is unavailable rather than silently omitting it; summarize the difference between two valuation methodologies Athena already computed (DCF vs. Comps) without picking a winner. **Cannot:** calculate a ratio, CAGR, WACC, or intrinsic value itself (that stays in `backend/ratio`, `backend/analysis`, `backend/valuation`); invent a peer, a market fact, or a number not present in the context JSON; issue a Buy/Sell/Hold recommendation or a price target; be trusted to have followed its own output schema without a second, code-level validation pass (`ai.validator.js` — the LLM's instructions are guidance, not enforcement).

## 6. Common mistakes

- **Treating LLM fluency as evidence of correctness.** A well-written paragraph with a wrong or fabricated number reads exactly as confidently as one with a correct number — fluency is not a signal of grounding, which is why Athena validates structure and restricts inputs rather than trusting output quality as a proxy for accuracy.
- **Letting the model see more data "just in case."** Sending raw financial statements or full price history invites the model to notice and comment on figures Athena never asked it to interpret, reintroducing exactly the "AI as source of truth" risk the sprint's core principle rejects — see `research/engineering/TokenOptimization.md`.
- **Conflating "the AI can explain the DCF" with "the AI can run the DCF."** Athena's AI reads a DCF result Athena's engine already computed (including handling the cost-of-debt gap — see `research/finance/CostOfDebt.md`); it never touches `dcf.engine.js` or has authority over any assumption.

## 7. Interview questions

**Q: Why generate a report instead of building a chatbot that can answer any question about a company?**
A: A chatbot invites arbitrary questions against arbitrary (and possibly absent) context, making grounding much harder to guarantee turn by turn. A fixed report format lets Athena guarantee, for every field in every report, that it's backed by known, closed context — see `research/product/AIResearchAnalystProductDesign.md` Q3 for the full product reasoning.

**Q: If the AI never calculates anything, what is it actually adding over just showing the seven raw dashboard tabs?**
A: Synthesis. The individual numbers already exist and are already correct; the value is connecting them (does the DCF gap corroborate the health score, does the elevated P/E match the growth rate) into one coherent narrative a reader doesn't have to build themselves — the same value professional analysts add over a raw data terminal.

**Q: How would you defend the claim that this report is "grounded" to a skeptical user?**
A: Every number in the context JSON traces to a specific Athena engine call (`ai.contextBuilder.js`), the system prompt forbids using any figure outside that context, and `ai.validator.js` strips any `sectionEvidence` citation that doesn't match a real context field path — so an ungrounded claim can appear in prose (the LLM isn't infallible), but it can never carry a fabricated citation, and the underlying number it might reference is always independently checkable against the same tabs Athena already shows.
