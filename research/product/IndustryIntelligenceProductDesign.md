# Industry Intelligence Product Design

## 1. Why should companies not be evaluated in isolation?

Because every prior Athena feature — DCF, Comps, Business Analysis, Earnings — answers a question about the company *by itself*, and none of them can distinguish "this company is executing well" from "this company happens to sit in a favorable industry right now." A 20% operating margin means something completely different for a grocery retailer than for enterprise software, and a company reading its own margin trend in isolation (Sprint 3's Business Analysis) has no way to know which world it's in. Industry Intelligence exists specifically to close that gap — not by replacing any prior feature, but by giving every number those features already compute a reference point.

## 2. Why does industry context matter to an investor's decision?

Because relative performance, not absolute performance, is usually the more decision-relevant signal. An investor comparing two companies with identical 15% revenue growth needs to know that one is in an industry growing at 8% (genuine outperformance) and the other is in an industry growing at 20% (actually underperforming its own space) before either growth number means anything for a decision. Industry Intelligence surfaces exactly that comparison, without resolving it into a recommendation — the investor still has to decide what the relative read means for their thesis.

## 3. Why can the median be more useful than the mean for this kind of benchmark?

Because a reference universe of tracked companies is exactly the kind of small, potentially-skewed sample where one atypical inclusion can distort a mean far more than it should — a single hyper-growth or distressed company in an otherwise ordinary peer set can pull a mean operating margin far from what's actually typical for the group, while barely moving the median. Since Athena cannot itself judge whether every company in a reference universe is a genuinely representative peer (the same limitation Sprint 7 already documents for Comps), defaulting every industry comparison to the statistic that's structurally more resistant to one bad inclusion is the safer product default — see `research/finance/MeanVsMedian.md`.

## 4. Why must the benchmark universe be transparent?

Because "industry average" is a claim of completeness Athena cannot honestly make — the reference universe is only the companies a user has previously searched or imported, never a complete market census. Presenting a 4-company benchmark with the same confident framing as a 40-company one would let the UI imply authority the underlying data doesn't have. Every comparison in Athena's Industry tab states its universe size and level explicitly ("Industry benchmark based on 4 tracked companies") specifically so a reader can calibrate how much weight to give the comparison — the same "show your work" discipline Sprint 6's DCF and Sprint 7's Comps already established, applied here to sample transparency instead of calculation transparency.

## 5. Why is automatic peer selection NOT being made authoritative?

Because Sprint 7 already established, and this sprint deliberately reaffirms, that Athena's data (sector/industry strings, market cap, revenue) is too coarse to make a trustworthy comparability judgment on its own — a wrong automatic peer group presented with algorithmic confidence is a worse outcome than an empty list a human has to evaluate themselves (see `research/finance/PeerSelection.md`). Industry Intelligence's "Potential Peers" list is explicitly framed as suggestions, ranked by a simple, explainable heuristic (market-cap proximity within the resolved reference universe) — never auto-applied to a calculation, and never labeled a recommendation.

## 6. Why are "potential peers" and "selected peers" different concepts?

Because they serve genuinely different purposes at different points in a user's workflow. "Potential peers" is a *discovery* concept — a starting point for a human to evaluate, produced automatically from a broad reference universe. "Selected peers" (Sprint 7's Comps peer set) is a *commitment* concept — a small, deliberately curated group a user has reviewed and chosen specifically because they'll be used to produce an implied valuation. Collapsing the two would mean either watering down Comps' deliberate curation requirement, or making Industry Intelligence's broader suggestions feel more authoritative than they've earned.

## 7. How does Industry Intelligence support Comparable Company Analysis?

As an on-ramp, not a replacement: the "Use for Comparable Analysis" action on a suggested peer pre-fills Sprint 7's existing peer picker via navigation state — the exact same `addPeer()` a manual search-and-click would trigger — so a user starting from Industry Intelligence doesn't have to separately search for a company they've already seen suggested. Nothing is calculated or committed until the user explicitly reviews the pre-filled list and clicks Calculate on the Comps tab; the hand-off saves a search, not a decision.

## 8. How does this feature support investor decision-making?

By answering a question none of Sprints 1–12 could: "is this good *for its industry*, or just good?" A user who has already seen a company's absolute financials (Sprint 1), health (Sprint 3), valuation (Sprints 6–7), and recent results (Sprint 12) gets, with Industry Intelligence, the missing calibration layer — whether those numbers are exceptional, typical, or lagging *relative to what's realistic for a business like this one*. It deliberately stops short of resolving that calibration into a recommendation, consistent with every other Athena feature.

## 9. What user behavior is expected?

A user arrives at the Industry tab from an already-open company (via the sidebar nav, alongside Earnings/Valuation/News), scans the Company vs. Industry table for anything materially above or below the median, reads the Relative Strengths/Weaknesses summary as a quick take, and — for a subset of users actively building a valuation — clicks through to "Potential Peers" and from there into Comps. The expectation is a short, comparative visit (a calibration check), not a long analytical session the way a DCF build might be.

## 10. What user research should validate?

Whether users correctly understand "industry benchmark based on N tracked companies" as a partial, Athena-specific reference set rather than a market-wide average — the same comprehension risk Sprint 7's `PeerSelection.md` already flags for its own limitation messaging, now applied to a feature that surfaces automatically rather than only after a user builds a peer list themselves. Whether the neutral framing ("above the industry median," never "better") is actually read as neutral, or whether users mentally translate it into a judgment anyway. Whether "Potential Peers" meaningfully increases Comps engagement (a peer-suggestion-to-Comps conversion signal) or is mostly ignored in favor of manual peer search. And whether users can articulate, after using the page, why a suggested peer isn't automatically part of their Comps analysis — a direct test of whether the "suggestions vs. selected peers" distinction (Section 6) actually lands.

## Product metrics worth watching (not instrumented this sprint)

Industry page views per company, count of Company-vs-Industry comparisons rendered, potential-peer-to-Comps conversion rate, and return visits to the Industry tab after an initial view. None of these are implemented as analytics events in this sprint — consistent with the brief's own caution ("Do not implement analytics solely for these metrics unless justified") and Athena's existing practice of not adding instrumentation ahead of a concrete decision it would inform.

## Product Management interview questions

**Q1: Why build Industry Intelligence as a separate tab instead of just adding industry context to the existing Financial Analysis or Business Analysis tabs?**
A: Those tabs already answer "how has this company itself performed over time" — adding a second, structurally different axis of comparison (against a reference universe, not against the company's own history) to the same page would conflate two different mental models a reader has to hold simultaneously. A dedicated tab keeps "how did we do" (Business/Financial Analysis) and "how do we compare" (Industry) as separate, clearly-labeled questions — consistent with how Sprint 12 kept Earnings separate from Business Analysis for the same reason (period-over-period vs. multi-year trend).

**Q2: A stakeholder asks why Athena doesn't just call it "Industry Average" instead of "Industry Median, based on N tracked companies" — isn't the simpler label better for a general audience?**
A: Simpler, but inaccurate in a way that matters — "average" implies both a specific statistic (mean) Athena deliberately doesn't lead with (see Section 3) and a completeness (all companies in the industry) Athena genuinely doesn't have (see Section 4). A general audience deserves accuracy over familiarity here, especially since the whole point of the feature is giving a trustworthy reference point — a mislabeled one undermines the feature's core value proposition.

**Q3: How would you decide whether to eventually make "Potential Peers" the default Comps peer set, saving the user a click?**
A: Only after the user-research question in Section 10 is answered — specifically, whether users are actually reviewing suggested peers before treating them as comparable, or just accepting whatever's suggested. If it's the latter, pre-selecting them by default would quietly convert a "suggestion the user is expected to scrutinize" into a "default the user is likely to accept without scrutiny" — exactly the failure mode Sprint 7 built manual peer selection to avoid in the first place. I'd want that evidence before changing the interaction model, not assume it.

**Q4: Why does the sprint explicitly forbid showing Buy/Sell language here, when a percentile ranking already implies a judgment to most readers?**
A: Because a percentile or a percentage-point gap is a fact about relative position, while "Buy" is a claim about future price action — conflating the two would mean Athena's copy making an investment call it has no basis for. The risk you're describing (readers implicitly translating "78th percentile" into "good") is real and exactly why Section 10 flags it as something to validate with real users rather than assume is a non-issue just because the literal copy stays neutral.
