# Sprint 8 Reflection — AI Equity Research Analyst

*Continuing the `SprintReflection-SprintN.md` convention Sprints 2, 4, 5, 6, and 7 use — see Sprint 6's reflection for the note on why the unsuffixed `SprintReflection.md` holds Sprint 3's reflection instead.*

## 1. What was built

A full AI Equity Research Analyst layer, end to end: a context builder (`backend/ai/ai.contextBuilder.js`) that aggregates six existing Sprint 1–7 engines — company profile, ratios, business intelligence, market data, DCF, comps — in-process into one compact JSON, never recalculating anything; a vendor-agnostic LLM provider abstraction (`providers/llmProvider.js` + `.registry.js`) with a raw fetch-based Anthropic implementation (`providers/anthropic/`), matching this repo's zero-SDK convention for every external API; a prompt builder, response parser, and schema validator (`ai.promptBuilder.js`, `ai.responseParser.js`, `ai.validator.js`) that together guarantee every report the frontend ever sees is grounded, schema-conformant, and free of raw recommendation language; an orchestrating service (`ai.service.js`) with a persistence layer (`ai.model.js`) that reuses a report until the user explicitly regenerates it; two routes (`GET`/`POST /api/ai/:ticker/research-report`) mounted additively into `server.js`; and a new "AI Research" frontend page with evidence-chip traceability, a data-freshness bar, and color-coded strength/risk/consideration sections. 51 new backend tests and 12 new frontend tests were added; the full suite (337 backend, 72 frontend) stayed green throughout, and Sprints 1–7 were never modified except one additive line each in `server.js`, `config/env.js`, and `.env.example`, plus a small, backward-compatible generalization of the shared `fetchWithTimeout` utility.

## 2. Finance concepts learned

The sharpest lesson was that "the AI interprets, Athena calculates" is easy to state and surprisingly easy to violate by accident at the edges — the DCF cost-of-debt gap (Section 6) is the clearest example: Athena's own DCF module has a documented, deliberate policy of *never* fabricating `preTaxCostOfDebt` because it's genuinely company-specific and Athena has no data source for it (`CostOfDebt.md`), which meant a naive "just feed the AI report the same defaults the interactive form gets" approach would have produced a DCF that *always* fails, silently making the richest section of the report unavailable for every single ticker. The second lesson was about what "grounded" actually requires structurally, not just as an instruction: an LLM told "only cite fields I gave you" still needs those citations checked in code against a real allow-list, because an instruction is a request, not a constraint — the same reasoning DCF/Comps already apply to their own no-recommendation rule, now applied to the AI layer's own claims about itself.

## 3. Engineering concepts learned

The most reusable lesson was how much of "AI engineering" is actually ordinary software engineering applied to a new kind of unreliable external dependency — the LLM provider abstraction is structurally identical to the financial-data-provider abstraction Sprint 1 already built, the retry logic is an ordinary bounded-retry pattern, and the validator is a schema check like any other in this codebase, just aimed at model output instead of user input. The second lesson was catching my own spec gap the hard way: while writing the prompt builder, I noticed `ai.validator.js`'s required sections list didn't include `companyOverview`, even though the sprint's own "REPORT STRUCTURE" section explicitly lists it as item 2 of 10 — a gap that had survived through the approved plan and the first validator implementation. Fixing it meant not just adding the field but refactoring the validator's sanitizer to loop over the canonical `REQUIRED_STRING_SECTIONS` list instead of hand-listing fields twice, so this exact class of drift (a field added to one list but not the other) can't silently recur — and adding a test (`ai.promptBuilder.test.js`) that mechanically asserts the prompt's declared schema and the validator's actual schema stay in sync, rather than relying on a comment reminding a future editor to update both.

## 4. Product decisions

Persisting AI reports per ticker — a deliberate, explicitly-documented departure from the DCF/Comps "never persist, always recompute" precedent — was the sprint's most consequential product call, driven by unit economics an LLM call has that local math doesn't (real cost and real latency per call). Report generation over chat was the second: a fixed, validated schema lets Athena guarantee grounding for every report in a way an open chat interface fundamentally can't guarantee per-turn, which mattered enough to trade away chat's flexibility entirely for this first AI feature. The middle-ground resolution to the DCF cost-of-debt gap — accept an optional user-supplied value, fall back to a clearly-labeled illustrative estimate scoped only to the AI domain — was a real-time product decision made mid-implementation (not anticipated by the original plan), balancing "don't fabricate company-specific data" against "don't make the richest report section permanently unavailable for every ticker."

## 5. Important trade-offs

**Comps peer selection: auto-selected-but-labeled vs. omitted entirely.** Sprint 7 made peer selection deliberately user-controlled because Athena has no similarity-scoring data — an AI-triggered report has no user to ask, so the context builder applies a documented heuristic (same sector, closest market cap, top 5) rather than leaving Comps unavailable for every ticker. This is a genuine, acknowledged quality trade-off (an auto-selected peer set is less rigorous than a human-reviewed one), mitigated by surfacing `peerSelectionMethod` in the context and instructing the model to flag it as a consideration rather than presenting it with the same implied confidence as an interactive Comps analysis. **Token cost vs. richness of context.** Excluding raw statements, full price history, and full DCF/Comps calculation detail keeps the context to ~400–500 tokens, but means the AI report is a summary layer, not a replacement for the interactive tabs — a deliberate scope boundary, not an oversight (`TokenOptimization.md`).

## 6. Difficult implementation decisions

The DCF cost-of-debt fork (Sections 2–4) was the hardest call of the sprint, precisely because both "obvious" resolutions were wrong in different ways: marking DCF permanently unavailable respects Athena's existing no-fabrication policy perfectly but makes the AI report structurally worse than it needs to be for every ticker forever; silently defaulting to an illustrative rate without disclosure would have quietly reintroduced the exact fabrication risk Athena's DCF module was built to avoid. The resolution — accept an override, default to a clearly-labeled illustrative estimate, record which happened in both the context (`costOfDebtSource`) and the eventual report's considerations — required pausing mid-implementation to ask rather than guessing at a "reasonable" interpretation, since it directly touched a documented product principle from an earlier sprint, not just a new implementation detail.

## 7. Bugs found and fixed (worth calling out explicitly)

- **`companyOverview` missing from the validator's required-sections list** (Section 3) — caught while writing the prompt builder, before any report generation was ever attempted, by cross-referencing the sprint brief's own report structure against the validator's actual field list. Fixed, and hardened against recurrence with a cross-file sync test.
- **`fetchWithTimeout`'s hardcoded "financial data provider" error message.** The shared timeout utility (used by Yahoo and Twelve Data) had a message and no machine-detectable timeout signal — both wrong for a shared utility now also used by the AI domain. Generalized the message and added an `error.isTimeout` flag; verified all 292 pre-existing tests still passed unchanged before proceeding, since this touched code outside the AI domain.
- Neither bug reached a running system — both were caught by careful reading and cross-referencing against existing documented policy before code was written or tests were run, the same "verify before you build on top of an assumption" discipline Sprint 3's reflection called out as its own hardest-won lesson.

## 8. What was intentionally NOT built

A chat interface (Section 4, and `AIResearchAnalystProductDesign.md` Q1) — deliberately deferred in favor of a fixed-schema report generator for the grounding reasons discussed throughout. Provider-native structured-output/schema-constrained generation (`StructuredLLMOutput.md`) — the current pipeline uses plain prompt instructions plus a defensive parser/retry loop; schema-constrained generation (where a provider supports it) is a documented future optimization, not attempted this sprint to keep the first implementation provider-portable and simple. A real citation/highlighting engine mapping specific sentences to specific source values — the sprint brief explicitly calls for "a simple metadata structure," and the section-level `sectionEvidence` chips satisfy that without the complexity of sentence-level attribution. Multi-provider support beyond the abstraction itself — only Anthropic is actually implemented; the registry pattern makes a second provider a contained addition, not attempted this sprint since there was no second provider to build against.

## 9. User assumptions being made

That users will actually read evidence chips and treat them as a way to verify claims, rather than scrolling past them the way people scroll past a DCF's source-provenance badges (an open question Sprint 6's own reflection already flagged, now inherited by this sprint in a new form). That the illustrative DCF cost-of-debt disclosure (`costOfDebtSource`, surfaced in `considerations`) is noticed and understood, rather than blending into the rest of the report's prose. That "Regenerate" reads as an intentional, meaningful action rather than a button users ignore because the persisted report already looks complete and authoritative on first read.

## 10. What we'd validate with real users

Whether users can, after reading a report, correctly identify which claims are backed by evidence chips they actually checked versus claims they simply took on faith — the direct comprehension test for whether "grounded" as an internal engineering guarantee is actually landing as "verifiable" from the user's side. Whether the auto-selected Comps peer set's disclosure (in `considerations`/`dataGaps`) changes how users weight the Valuation section, or gets skimmed past the same way peer-candidate limitation notices already risk being skimmed in the interactive Comps tab (Sprint 7's own open question). Whether persisting reports (rather than always-fresh) is noticed at all — do users expect a report to reflect the literal current moment, or accept "as of generation time" the way they already accept it for financial statements.

## 11. What would be improved with more time

Provider-native structured output, once evaluated against Anthropic's actual schema-constrained generation support, to reduce reliance on the defensive parser/retry path (`StructuredLLMOutput.md`). A real similarity-scoring signal for the AI-triggered Comps peer selection, once the underlying business-model data exists to make it trustworthy — the same gap Sprint 7's `PeerSelectionEngine.md` already identified, now doubly relevant since the AI flow has no human to fall back on. Instrumenting the actual usage metrics proposed in `AIResearchAnalystProductDesign.md` Section 9 (generate-to-read-through rate, regenerate rate, evidence-chip interaction), so Section 9/10's open questions here have real answers rather than working hypotheses.

## 12. Product Management interview questions

**Q1: Why introduce AI only in Sprint 8, after seven sprints of purely deterministic features?**
A: Because AI needed something real and already-verified to interpret — see `AIResearchAnalystProductDesign.md` Q1. Introducing it earlier would have meant either fabricating numbers Athena didn't have yet, or building a much larger, riskier feature with nothing solid underneath it.

**Q2: Why does Athena persist AI reports when it explicitly never persists DCF or Comps results?**
A: Different unit economics — DCF/Comps are free, instant local computation; an LLM call costs real money and real time per call. Persisting the latest report and only regenerating on explicit user action is the direct, documented consequence of that difference, not a change in Athena's general philosophy (`AIResearchAnalystProductDesign.md`, "Why does Athena persist..." section).

**Q3: A stakeholder wants a Buy/Sell badge on the AI report to match competitor tools. How do you respond?**
A: The same way Sprint 6 already answers this for DCF, now doubled — a recommendation implies a certainty the underlying analysis doesn't have, and natural language is an *easier*, not harder, place for one to sneak in, which is why Sprint 8 enforces the rule twice (prompt instruction plus a code-level check on the validated output).

**Q4: Why build a report generator instead of a chatbot, given chat is the more familiar AI interaction pattern right now?**
A: Grounding. A report is one fixed, fully-specified prompt Athena controls end to end; a chatbot invites arbitrary phrasing that would each need its own grounding guarantee — a much larger, riskier surface for a first AI feature in a financial product (`AIResearchAnalystProductDesign.md` Q3).

**Q5: How would you defend the decision to auto-select Comps peers for the AI report, given Sprint 7 deliberately made peer selection user-controlled?**
A: It's a scoped, disclosed exception, not a reversal — there's no user in an AI-triggered flow to ask, so the alternative was leaving Comps unavailable in every AI report forever. The auto-selected set is explicitly labeled as unvetted in both the context and the resulting report's considerations, preserving the spirit of Sprint 7's transparency principle even though a human isn't the one choosing.

**Q6: What's the single biggest product risk in this feature as shipped?**
A: Fluency being mistaken for verification — a well-organized paragraph reads as trustworthy regardless of whether every claim in it holds up, and no amount of disclaimer text alone fully solves that. The structural mitigation is evidence chips tied to real, checkable Athena metrics, giving a skeptical user a concrete way to verify rather than only being asked to trust (`AIResearchAnalystProductDesign.md` Q5).

**Q7: How would you measure whether this feature is actually useful, not just used?**
A: Generate-to-read-through rate, regenerate rate over time, and — the most direct signal — whether reading a report correlates with subsequent visits to the underlying DCF/Ratios/Comps tabs, which would indicate the report is prompting verification and deeper investigation rather than being taken as a final answer (`AIResearchAnalystProductDesign.md` Section 9).

**Q8: Why not regenerate the report automatically every time a user visits the page, so it's always current?**
A: Cost and the sprint's own explicit instruction against it — every visit would trigger a paid LLM call for data that, in most cases, hasn't meaningfully changed since the last generation. A persisted report plus an explicit Regenerate action gives users control over when they want to pay that cost, in exchange for a report that's current as of generation time, clearly labeled as such via the freshness bar.

**Q9: How should the product communicate that a report might be using stale data?**
A: Four separate, explicitly labeled timestamps — Report Generated At, Market Data As Of, Financial Data Period, Valuation Calculation Date — rather than one generic "as of" date, because those four genuinely aren't the same point in time and collapsing them into one would misrepresent the report's actual freshness (`InvestmentResearchReport.md` Q2).

**Q10: What would you build next for this feature given more engineering time?**
A: I'd want real usage data (Q7) before committing, but my working hypothesis is a watchlist-level comparison report, since it reuses the existing grounded-context-and-validation pipeline almost entirely rather than introducing new grounding risk the way an open chat interface would.

## 13. Engineering / AI interview questions

**Q1: Walk through what happens, end to end, when a user clicks "Generate Research Report."**
A: `ai.controller.js` resolves the ticker and calls `ai.service.js`'s `getOrGenerateReport`. If not regenerating and a persisted report exists for the current `contextVersion`, it's returned immediately with no LLM call. Otherwise, `ai.contextBuilder.js` aggregates six existing services in parallel into a compact context (each section independently try/caught); if every section is unavailable, `InsufficientContextError` is thrown before any LLM call. Otherwise, `ai.promptBuilder.js` builds the prompt, the configured `LLMProvider` calls the model, `ai.responseParser.js` recovers JSON from the raw text, and `ai.validator.js` checks it against the schema and the context's evidence allow-list. One retry, with the specific failure reason appended to the prompt, happens on a parse or validation failure; a provider-level error (rate limit, timeout) is never retried. A successful, validated report is upserted into `AiResearchReport` and returned.

**Q2: Why is the LLM provider abstracted behind an interface identical in shape to `financialDataProvider.js`, rather than something purpose-built for LLMs?**
A: Because the actual problem — decoupling an orchestrator from one vendor's SDK and error shapes so a provider swap doesn't ripple through the codebase — is identical to the one `financialDataProvider.js` already solved for Yahoo/Twelve Data. Reusing a proven pattern from this same codebase was a stronger choice than inventing a new one for a structurally identical problem (`AIProviderAbstraction.md`).

**Q3: Why does `ai.validator.js` reject any response containing a field not in the expected schema, rather than just ignoring extra fields?**
A: An extra field is either an honest formatting slip or a model deciding, on its own initiative, to add something Athena never asked for — a stray `"recommendation"` or `"priceTarget"` field being the specific risk this guards against. Silently ignoring extra fields would let exactly that kind of drift through undetected; rejecting the whole response forces it to be visible and, via the retry mechanism, gives the model one chance to self-correct with the specific problem quoted back to it (`AIResponseValidation.md`).

**Q4: The retry logic calls the LLM a second time on a validation failure but never on a rate-limit error. Why the different treatment?**
A: A validation failure is (probably) a formatting mistake a differently-worded second attempt has a real chance of fixing. A rate-limit error means Athena is already calling the provider too fast — immediately retrying makes that worse, not better. The two failure modes need opposite responses, which is why they're handled at different layers: validation failures are retried inside `attemptReport`'s loop; provider errors propagate straight through with their own status code for the client to handle (`AIErrorHandling.md`).

**Q5: How would you extend this pipeline to support a second LLM provider, e.g. OpenAI?**
A: A new `providers/openai/` folder implementing the same `LLMProvider.generateReport` interface (an `openaiClient.js` low-level HTTP layer plus an `OpenAILLMProvider` adapter mapping OpenAI's errors to the same three generic error classes), one new `case` in `llmProvider.registry.js`'s switch statement, and a new `OPENAI_API_KEY`/model env var. Nothing in `ai.service.js`, `ai.promptBuilder.js`, `ai.responseParser.js`, or `ai.validator.js` would need to change — that's the abstraction boundary doing its job.

## 14. Finance interview questions

**Q1: Walk me through why Athena's AI layer never calculates a financial figure itself.**
A: Because Athena's deterministic engines are held to a standard — unit-tested against hand-verified expected values across 337 backend tests — that a stochastic model's output can't be held to on a per-call basis. Keeping calculation entirely in `backend/ratio`, `backend/analysis`, `backend/valuation` and giving the AI only already-computed values to interpret preserves that stronger guarantee everywhere it matters (`FinancialAnalysisVsAIInterpretation.md`).

**Q2: The AI report shows both a DCF intrinsic value and a Comps implied valuation range for the same company, and they disagree. Is that a bug?**
A: No — they answer different questions with different failure modes (DCF is a function of this company's own forecast cash flows and discount rate; Comps is a function of how the market currently prices similar companies), and a gap between them is informative, not an error to reconcile. The report explicitly frames it as something worth investigating rather than resolving toward one number (`ValuationInterpretation.md`).

**Q3: Why did the DCF section of the AI report almost end up permanently unavailable for every single ticker?**
A: Because Athena's `getDCFDefaults()` always returns `preTaxCostOfDebt` as `null` with source `"required_user_input"` — a deliberate policy, since Athena has no interest-expense or credit-spread data to derive a company-specific borrowing cost from (`CostOfDebt.md`). Feeding those defaults straight into the DCF engine, as an AI-triggered report with no user in the loop would naively do, always fails on that one missing input.

**Q4: How did Sprint 8 resolve the cost-of-debt gap without violating Athena's "never fabricate company-specific data" principle?**
A: By scoping the exception narrowly and disclosing it: the AI context builder accepts an optional user-supplied override, and only falls back to a risk-free-rate-plus-flat-spread illustrative estimate when none is given — a generic, non-company-specific proxy, clearly labeled `costOfDebtSource: "illustrative_default"` in both the context and the eventual report, never presented as a derived, company-specific figure the way the interactive DCF tool's other inputs are.

**Q5: Why does the AI report's Comps section explicitly disclose that its peer set was "auto-selected," and why does that matter?**
A: Because Sprint 7 established that Athena has no genuine similarity-scoring capability, so any automatically-chosen peer set is a lower-confidence starting point than a human-reviewed one — disclosing that (`peerSelectionMethod` in context, surfaced in the report's considerations) lets a reader correctly discount the Comps figure's reliability rather than treating an AI-selected peer set as equivalent to a carefully-built one.

**Q6: What's the difference between the AI report saying "the company demonstrates strong financial health" and it saying "the overall financial health score is 78"?**
A: The second is a fact, lifted directly from `analysis.service.js`'s already-computed health score — it's either accurately transcribed or it's a bug the validator/tests would catch. The first is interpretation — a judgment call about what that number, combined with its component breakdown, means for the reader — and is exactly the kind of synthesis the AI is scoped to add on top of facts it never generates itself (`FinancialAnalysisVsAIInterpretation.md`).

**Q7: Why does the AI report never issue a Buy/Sell recommendation, even though users might want one?**
A: Because a recommendation collapses an assumption-dependent, multi-methodology analysis into a binary implying a certainty none of the underlying models actually have — the identical reasoning Sprint 6 already established for DCF (`DCFProductDesign.md` Q7), now enforced at two layers instead of one (a system-prompt instruction plus a code-level check on the model's actual output).

**Q8: How does the report handle a ticker where, say, Comps data simply isn't available?**
A: The context builder marks that section `{available: false, reason: "..."}`, the prompt instructs the model to say "Data unavailable" for that aspect rather than guess or silently omit it, and the report is still generated using whatever sections *are* available — a partial, honest report rather than either a fabricated Comps figure or a total generation failure over one missing section.

**Q9: Why does the AI report show four separate timestamps instead of one "as of" date?**
A: Because a live market quote, a filed financial statement, and a freshly-run DCF genuinely aren't from the same point in time — a live quote is minutes old, the underlying financials are typically months old. One collapsed timestamp would misrepresent that as a false single-point-in-time consistency the underlying data doesn't have (`InvestmentResearchReport.md` Q2).

**Q10: If you were a fund manager evaluating whether to trust this feature, what would you check first?**
A: Whether the evidence chip behind a specific claim actually points to the metric the claim describes — the direct, mechanical test of whether the "grounded" guarantee holds in practice, not just in the system prompt's instructions. A report that passes that spot-check consistently is one whose synthesis, at minimum, isn't inventing the facts underneath it, even before evaluating whether the interpretive judgment itself is sound.
