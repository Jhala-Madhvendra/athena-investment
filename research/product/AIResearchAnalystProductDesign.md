# AI Research Analyst Product Design

## 1. Why is AI being introduced only after the deterministic financial engines?

Because AI needed something real to interpret. Sprints 1–7 built ratios, business intelligence, market data, DCF, and Comps — a complete, independently-correct analytical foundation with no AI involved at all. Introducing the AI layer *on top of* that foundation, rather than alongside or before it, means the AI's job is narrowly scoped to synthesis and explanation of numbers that are already known to be right (unit-tested, verified against real data across seven prior sprints) — never to being the thing that has to be right about a calculation in the first place. Building it in the other order — AI first, deterministic engines later — would have meant either the AI fabricating numbers Athena didn't have yet, or the whole feature waiting on nothing being demoable in between.

## 2. What user problem does the AI Research Analyst solve?

Athena's investor already has seven tabs of correct numbers and no single place that connects them. The problem isn't "I can't find the P/E" or "I don't know the health score" — those are one click away — it's "now that I have all of this, what does it actually mean about this company, and what does it mean *together*." The AI Research Analyst answers that synthesis question the way reading a written research note answers it better than scanning seven data tables yourself, without asking the user to do the connecting work themselves.

## 3. Why is this better than a generic chatbot?

A generic chatbot invites arbitrary questions, which means arbitrary, potentially unverifiable answers — every single turn would need its own grounding guarantee, and a user could ask something Athena has no data to answer at all, with no reliable way to signal that boundary. A fixed-shape report generator, by contrast, lets Athena guarantee something concrete and testable for *every* report, every time: every field traces to a specific pre-computed value, every section follows the same validated schema, and there is no way for a user's phrasing of a question to accidentally lead the model somewhere ungrounded. It trades chat's flexibility for a much stronger, verifiable trust guarantee — the right trade for a first AI feature in a financial product where a wrong or fabricated answer has real consequences.

## 4. Why should the AI interpret rather than calculate?

Because Athena already has calculation engines that are unit-tested against hand-verified expected values (337 backend tests as of this sprint) — a standard no LLM's arithmetic can be held to on a per-call basis. An LLM asked to calculate a ratio or a DCF might get simple cases right most of the time, but "probably right most of the time" is a categorically different, weaker guarantee than "verified correct by a deterministic test suite," and a financial product should not quietly downgrade its accuracy guarantee in exchange for a more conversational-sounding number. Keeping calculation entirely in Sprints 1–7's engines and giving the AI only already-computed values to interpret preserves the stronger guarantee everywhere it matters.

## 5. Why do users need transparent evidence?

Because a fluent, well-organized paragraph is not, by itself, evidence of anything — an investor reading "the company demonstrates strong financial health" has no way to independently check that claim unless it's tied back to a specific number they can verify themselves. The evidence-chip design (`sectionEvidence`, rendered per section in `AIResearch.jsx`) exists to make every interpretive claim traceable to a real Athena metric — turning "trust the AI" into "check the AI," which is the only posture appropriate for a financial analysis tool.

## 6. Why is report generation preferable to chat for this initial use case?

Beyond the grounding argument in Section 3: a report is a stable artifact a user can read start to finish, share a screenshot of, or return to later and expect to see the same thing (until they explicitly regenerate it) — a chat transcript is inherently ephemeral and personalized to one conversation, which doesn't fit "equity research report" as a concept at all. Starting with report generation also gives Athena a much smaller, fully-specifiable surface to get right (one fixed schema, validated every time) before ever taking on the much larger open-ended-interaction problem a chat interface would introduce.

## 7. How should the product communicate uncertainty?

Layered, the same way Sprint 6's DCF communicates it (`DCFProductDesign.md` Q6 — this sprint deliberately reuses that playbook): an explicit "Data unavailable" string wherever a context section couldn't be built, rather than silent omission; a `dataGaps`/`considerations` section naming specific methodology caveats (an auto-selected peer set, an illustrative cost-of-debt assumption) instead of a single generic disclaimer; and four separate, explicitly labeled freshness timestamps (Report Generated At / Market Data As Of / Financial Data Period / Valuation Calculation Date) so the report never implies a single-point-in-time consistency it doesn't actually have.

## 8. What user research would validate this feature?

Whether users can, after reading a report, correctly say which specific Athena metrics justified a given claim — the direct comprehension check for whether the evidence-chip design is actually read, not just present. Whether users treat "Regenerate" as a meaningful action (they've noticed the report can go stale) or never use it at all, which would suggest the freshness bar isn't landing. Whether users who read a report subsequently visit the underlying DCF/Comps/Ratios tabs to verify a claim — the direct behavioral signal that the evidence design is functioning as "check the AI" rather than "trust the AI blindly."

## 9. What metrics would determine whether users find the AI useful?

- **Generate-to-read-through rate**: of users who click "Generate Research Report," what fraction scroll through the full report versus abandoning after the Executive Summary — a proxy for whether the deeper sections add real value or are skipped.
- **Regenerate rate over time**: how often a user returns to an already-generated report and explicitly regenerates it, versus treating the first report as sufficient indefinitely.
- **Evidence-chip interaction** (if instrumented): whether users hover/click evidence chips at all, the direct usage signal for whether the traceability design is being used as intended.
- **Cross-navigation to source tabs**: whether reading an AI report correlates with subsequent visits to Valuation/Ratios/Business Analysis tabs for the same ticker — evidence the report is prompting verification and deeper investigation rather than being taken as a final answer, the same posture Sprint 6 hopes for around its own valuation-gap framing.

## 10. What future AI features could be added?

A comparison mode generating one synthesized report across a user's whole watchlist, reusing the same context-builder/validator pipeline per ticker. Natural-language explanation of a single metric on hover, scoped narrowly enough to keep the same grounding guarantees (a bounded, single-metric context, not open chat). Sector- or portfolio-level synthesis once cross-company aggregation exists. None of these should relax the core principle this sprint establishes — the AI interprets, Athena's engines calculate — regardless of how the surface area grows.

## Why does Athena persist AI research reports when DCF and Comps results are never persisted?

This is a deliberate, considered departure from the DCF/Comps precedent (`DCFProductDesign.md`, `ComparableCompaniesProductDesign.md`), not an oversight. DCF and Comps are cheap, fast, purely local computation — recomputing on every request costs nothing and guarantees the result always reflects the very latest stored data and the user's current inputs. An LLM call is neither cheap nor fast — it costs real money per call and takes seconds, not milliseconds — so treating it the same way (recompute on every page view) would mean paying for and waiting on a fresh report every single time a user simply revisits a company they already looked at. Persisting the latest report per ticker (`ai.model.js`, keyed on `{ticker, contextVersion}`) and only regenerating on an explicit user action respects both the sprint's own "do not automatically regenerate on every page load" instruction and the basic economics of an LLM-backed feature — the same reasoning `market.service.js`'s quote/history caching already applies to Yahoo Finance calls for cost/latency reasons, extended here to a much more expensive external dependency.

## Product Management interview questions

**Q1: Why not let users chat with the AI about their portfolio companies — wouldn't that be more engaging?**
A: More engaging in the short term, but it reopens exactly the grounding risk Section 3 explains — every chat turn would need the same closed-context, validated-output guarantee a report gets, applied to arbitrary user phrasing instead of one fixed prompt Athena fully controls. Report generation is the smaller, safer surface to get right first; a more conversational interface, if ever built, would need to inherit the same context-and-validation discipline, not abandon it for engagement.

**Q2: How would you prioritize what to build next for this feature given limited engineering time?**
A: I'd want the Section 8/9 signals first — specifically, whether users are actually reading evidence chips and whether reading a report correlates with visiting source tabs — before committing to any of the Section 10 ideas. My working hypothesis, absent that data, would be a watchlist-comparison report, since it reuses the existing pipeline almost entirely rather than introducing new grounding risk.

**Q3: A stakeholder asks why the AI report can't just give a Buy/Sell rating like several fintech competitors do. How do you respond?**
A: The same answer Sprint 6 already gives for DCF (`DCFProductDesign.md` Q1), now enforced twice over — once in the system prompt, once in a code-level regex check on the validated output — because natural-language output is an *easier* place for a recommendation to sneak in than a structured API field, not a harder one. A rating implies a certainty level none of Athena's underlying models claim to have, and Athena is positioned as an analytical tool, not an adviser — a distinction this feature protects as deliberately as DCF and Comps already do.

**Q4: Why does Athena depart from its "never persist derived analysis" precedent specifically for AI reports?**
A: Because the two costs that make on-demand recomputation free for DCF/Comps (money, latency) are not free for an LLM call — see the dedicated section above. Persisting isn't a general precedent shift; it's a scoped response to one feature genuinely having different unit economics than everything before it.

**Q5: What's the biggest product risk in this feature as shipped?**
A: That a user reads a fluent, well-organized report and mistakes fluency for verification — the same risk every LLM-backed product faces, and one no amount of "this is interpretation, not fact" framing fully eliminates on its own. The mitigation is structural, not just copy: every claim is tied to a real, checkable Athena metric via evidence chips, so a skeptical user always has a concrete way to verify rather than only a disclaimer asking them to be skeptical in the abstract.
