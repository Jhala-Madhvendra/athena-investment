# Valuation Interpretation

## 1. What it means

Valuation interpretation is explaining what a valuation *output* implies, without presenting that output as a settled answer — the difference between "the DCF says $198/share, so the stock is undervalued" (a verdict) and "the DCF's base-case intrinsic value sits below the current market price, which may reflect the market pricing in growth beyond the base-case forecast, or the DCF's assumptions being conservative" (interpretation with explicitly held uncertainty). Athena's AI report is built to only ever produce the second kind of statement.

## 2. Why it matters

DCF and Comps (Sprints 6–7) already refuse to collapse their outputs into a recommendation — no code path in either engine maps a valuation gap to a Buy/Sell string, and `research/product/DCFProductDesign.md` documents exactly why. An AI layer sitting on top of those engines is a second, easier-to-get-wrong opportunity to reintroduce exactly what Sprints 6–7 deliberately avoided: natural language is much easier to nudge toward "this means you should buy" than a structured API response is, which is why Sprint 8's system prompt and validator both explicitly re-enforce the no-recommendation rule the underlying engines already established structurally.

## 3. How professional analysts use it

Sell-side price targets exist, but even there, a professional research note frames a target as *this firm's model's output under stated assumptions*, not an objective truth — and the note is expected to explain the reasoning (which assumptions, which methodology) well enough that a reader who disagrees with an assumption can adjust their own view accordingly. Athena's AI report structure — presenting DCF and Comps side by side, explicitly noting they can disagree because they answer different questions with different failure modes (`research/finance/ComparableCompanyAnalysis.md`) — mirrors that same "here's the reasoning, you draw the conclusion" posture, just without ever landing on a price target or rating at all.

## 4. How Athena implements it

`ai.contextBuilder.js`'s `dcf` and `comps` sections carry the same figures the interactive Valuation tab already shows (intrinsic value, upside/downside %, implied valuation range) — nothing new is computed for the AI report. `ai.promptBuilder.js`'s system prompt instructs the model to explain the difference between DCF and Comps without choosing one as "objectively correct," and to reframe valuation gaps as things to investigate rather than act on. `ai.validator.js` runs a soft (non-blocking, logged) regex check for stray buy/sell/price-target language on the `valuation` and `conclusion` fields as a defense-in-depth backstop — see `research/engineering/AIResponseValidation.md`.

## 5. What AI can and cannot safely do with this concept

**Can:** explain in plain language what an intrinsic-value-below-market-price gap or a wide Comps valuation range implies about the model's assumptions versus the market's; note that two methodologies disagreeing is itself informative and worth investigating. **Cannot:** decide which methodology is "right"; convert a valuation gap into a price target, a rating, or any directive language; be trusted to have avoided recommendation language on its own — Athena checks for it after the fact rather than only asking nicely in the prompt.

## 6. Common mistakes

- **Assuming a well-phrased "the analysis indicates..." framing is automatically safe.** Framing alone doesn't guarantee neutrality — "the analysis indicates the stock is significantly undervalued and due for a correction" is still effectively a recommendation wearing hedge words; Athena's soft regex check exists because prompt instructions alone aren't a reliable enough guarantee.
- **Treating a DCF-vs-Comps disagreement as a bug to resolve.** The two methodologies are expected to disagree sometimes — reconciling them into one number would manufacture false consensus, the identical reasoning `ComparableCompaniesProductDesign.md` gives for not averaging Comps' five multiples into one.

## 7. Interview questions

**Q: The AI report says the market price is above the DCF intrinsic value. Isn't that functionally the same as saying "sell"?**
A: Only if it's presented as a conclusion rather than a prompt for investigation — Athena's report explicitly frames the gap as something the reader may want to investigate further (which assumption is driving it, does the sensitivity range still show a gap), and both the system prompt and a code-level regex check exist specifically to prevent that gap from ever being phrased as a directive.

**Q: Why validate for recommendation language at all if the system prompt already forbids it?**
A: Because an LLM's adherence to a system prompt isn't guaranteed on every call — the same principle that governs why `ai.validator.js` validates schema conformance instead of trusting the model followed the JSON format it was told to use. A prompt instruction is guidance; a code check after the fact is enforcement.

**Q: How would you explain to a user why DCF and Comps gave meaningfully different valuations for the same company?**
A: They're not measuring the same thing with different math — DCF is a function of the company's own forecast cash flows and discount rate; Comps is a function of how the market is currently pricing similar companies. A gap between them says the market's collective pricing of peers currently disagrees with what this company's own projected cash flows would justify — which is itself a useful, investigable signal, not an error to reconcile away.
