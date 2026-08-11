# Investment Research Report

## 1. What it means

An investment research report is a structured document that synthesizes a company's fundamentals, business performance, financial health, market pricing, and valuation into sections a reader can navigate independently — distinct from a single number, a chat answer, or a raw data dump. Athena's AI-generated report follows the same structural convention professional research uses: Executive Summary up front, supporting detail (Business Performance, Financial Health, Market Performance, Valuation) in the middle, and a clearly separated Strengths/Risks/Considerations/Conclusion at the end.

## 2. Why it matters

The *shape* of a research report is not arbitrary — it's optimized for how investors actually consume information: skim the Executive Summary for the gist, then drop into whichever section addresses the specific question at hand (is this company healthy? is it cheap or expensive?), and check Risks before acting on anything. A wall of undifferentiated prose, or a chat transcript, doesn't support that consumption pattern — which is a direct, practical reason Sprint 8 specifies a fixed report structure and validates it server-side, rather than letting the LLM produce free-form text.

## 3. How professional analysts use it

Analysts write to a template for the same reason Athena enforces one: consistency across companies and across time lets a reader who's used to the format find what they need without re-learning the document's structure every time, and it forces the analyst to actually address every dimension (health, market, valuation) rather than writing at length about whichever aspect happens to be most interesting. Athena's `REQUIRED_STRING_SECTIONS`/`REQUIRED_ARRAY_SECTIONS` in `ai.validator.js` are the code-level equivalent of a firm's house style guide — every generated report has the same shape, every time, checked mechanically rather than by convention alone.

## 4. How Athena implements it

The exact schema — `executiveSummary`, `companyOverview`, `businessPerformance`, `financialHealth`, `marketPerformance`, `valuation`, `strengths[]`, `risks[]`, `considerations[]`, `dataGaps[]`, `conclusion`, `sectionEvidence` — is defined once in `ai.validator.js` and referenced by `ai.promptBuilder.js` when instructing the model what to produce, so the two can never silently drift apart (a test in `ai.promptBuilder.test.js` asserts this directly). The frontend (`AIResearch.jsx`) renders every section as its own visually distinct block, narrative sections labeled "AI Interpretation" with evidence chips, list sections color-coded by tone (Strengths green, Risks red, Considerations amber) — deliberately not a chat UI, per the sprint's explicit "this is a research report, not a conversation" instruction.

## 5. What AI can and cannot safely do with this concept

**Can:** populate each section of a fixed, well-understood report template using only Athena's own pre-computed figures; keep the report concise (the Executive Summary is explicitly instructed not to repeat every metric). **Cannot:** decide the report's structure itself, add or omit sections, or free-form its way outside the schema — `ai.validator.js` rejects any response with unexpected top-level fields, which would catch a model deciding to add, say, a `"recommendation"` field on its own initiative.

## 6. Common mistakes

- **Confusing "report" with "chat log."** A chat-style presentation implies a back-and-forth conversation the user can steer; Athena's report is a fixed artifact generated from a fixed context — presenting it conversationally would misrepresent what it actually is and invite users to "ask it questions" it isn't built to safely answer.
- **Letting report freshness go unstated.** A report combining data from different points in time (a live quote, a financial statement filed months ago, a DCF calculated at generation time) without labeling each figure's timestamp implies a false single-point-in-time consistency — Athena's freshness bar (Report Generated At / Market Data As Of / Financial Data Period / Valuation Calculation Date) exists specifically to prevent that.

## 7. Interview questions

**Q: Why does the report separate Strengths/Risks/Considerations from the narrative sections instead of weaving them into the prose?**
A: Distinct list sections are scannable in a way embedded prose isn't — an investor checking "what could go wrong here" shouldn't have to re-read five paragraphs to extract that information, and a validator can mechanically guarantee those lists are non-empty and populated in a way it couldn't guarantee for prose-embedded equivalents.

**Q: The report shows "Market Data As Of" and "Financial Data Period" as two different timestamps. Why does that distinction matter?**
A: Because they genuinely aren't the same point in time — a live market quote is minutes old, while the underlying financial statements are typically months old (the most recent filed fiscal year). Presenting them under one undifferentiated "as of" date would imply a consistency the underlying data doesn't actually have, which is exactly the kind of subtle misrepresentation the sprint's "AI should not imply all data represents the same point in time" instruction is guarding against.

**Q: Why regenerate the whole report rather than letting a user ask a follow-up question about one section?**
A: A follow-up-question interface reopens the open-ended-chat risk this design deliberately avoids (see `AIEquityResearch.md` Q1) — every follow-up would need the same context-grounding and validation guarantees the full report gets, for a much less controllable interaction shape. Regenerating the whole report keeps every generated artifact equally grounded and equally validated.
