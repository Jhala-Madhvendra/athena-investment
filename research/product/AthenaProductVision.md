# Athena Product Vision

## North Star

**Athena helps self-directed investors research companies, form and record structured investment decisions, manage what they actually own, and learn from the outcomes of those decisions over time.**

This is a deliberate rewrite of the "example" north star in the Sprint 19 brief, not a rubber-stamp of it. The example said "make structured decisions" — this version says "form and record structured investment decisions" because the verb that matters isn't "decide" (Athena can't decide anything for a user) but "record": the entire Phase 2 gap this sprint identified is that Athena currently has no persistent memory of a user's reasoning, only of their holdings. The word "learn" stays, but is anchored to "outcomes of those decisions," not learning in the abstract — Athena is not an education platform with courses and quizzes; it's an investing tool where the learning loop is *your own past decisions viewed in hindsight*, which is a narrower and more defensible claim.

## Why not "AI-powered investment platform"?

Because AI is not what makes Athena's 18 sprints of work valuable. Every AI feature Athena has (Research Report, Scenario Explanation) is explicitly built to be replaceable — see `research/engineering/AIProviderAbstraction.md` — and both are opt-in narrations of numbers a deterministic engine already computed. If Athena's AI layer disappeared tomorrow, DCF, Comps, Ratios, Portfolio Analytics, and Scenario stress-testing would all still work identically. A vision statement that leads with AI would misrepresent where the actual product value sits, and would put pressure on future roadmap decisions to add AI surface area for its own sake rather than where grounding and cost justify it — exactly the mistake `AIResearchAnalystProductDesign.md` Section 3 already argues against for chat.

## Primary user

**The serious self-directed investor** — someone who manages their own portfolio, wants more analytical depth than a brokerage summary page gives them, but doesn't have (or want) a paid terminal or a financial advisor.

Evidence this is already who Athena serves, not an aspirational target: the DCF page exposes WACC breakdowns and per-year FCFF waterfalls with labeled assumption sources; Comps exposes peer statistics and implied-valuation tables; Scenario analysis resolves multi-factor shock precedence with visible rule chips. None of this is being simplified or hidden behind a "simple mode" — a casual investor would find several of these pages overwhelming, and Athena has made no attempt across 18 sprints to soften that. Building for this user going forward means: keep showing the math, keep labeling assumptions, and resist any roadmap pressure to add a "just tell me what to do" surface, which would betray the exact users Athena has spent 18 sprints earning trust with.

## Secondary user

**The finance/MBA student.** Not because Athena has built anything student-specific, but because the entire `research/finance/*.md` corpus (95 files) already reads like a structured curriculum — every ratio, every DCF component, every portfolio risk metric has its own concept doc with formula, intuition, common mistakes, and interview questions. This audience gets value from Athena's *transparency-by-design* (labeled assumption sources, methodology disclosures, "why" documents) independent of whether they ever invest real money. Building for this user mostly means: don't let future Decide/Learn features lose the same pedagogical rigor — a Thesis or Decision record should be as legible to someone studying it as a DCF form already is.

## Explicitly excluded, for now

- **Professional analyst / portfolio manager** — no multi-portfolio support, no client reporting, no team/collaboration primitives exist or are planned before Phase 6. Building for this user now would mean over-engineering identity and data isolation for a use case with zero current infrastructure to support it.
- **Investment club** — requires multi-user sharing on a single portfolio, which doesn't exist and isn't close (Athena's entire data model is single-user-scoped by `userId`).
- **Casual retail investor wanting a simplified app** — see primary user above. Athena is not simplifying, and pretending to also serve this user without simplifying would just mean bad UX for everyone.

## Competitive positioning

Athena is not trying to compete with any of the following head-on. Instead:

| Product | What it does well | What Athena does differently |
|---|---|---|
| **Yahoo Finance** | Broad, fast, free market data | Athena adds the *engines* Yahoo doesn't have: DCF, Comps, Health Score, Scenario stress-testing — analysis, not just data |
| **TradingView** | Charting, technical analysis, community | Athena has no charting/TA ambitions at all — it's fundamentals- and decision-oriented, not price-action-oriented |
| **Seeking Alpha** | Human-written analyst opinions and ratings | Athena explicitly never gives ratings or recommendations (enforced structurally, not just by copy) — it shows you the math and lets you form your own view |
| **Portfolio trackers (generic)** | Track what you own, compute returns | Athena adds risk decomposition (beta, Sharpe, correlation, exposure) and now the Decide/Learn loop these tools don't attempt |
| **Excel** | Total flexibility, no data plumbing | Athena removes the data-wrangling tax (fetching statements, aligning history) and gives pre-built, tested engines — at the cost of Excel's flexibility |
| **Bloomberg-style terminals** | Institutional-grade breadth, real-time everything | Athena is free, self-directed-investor-scoped, and radically narrower — it doesn't attempt real-time or institutional breadth at all |
| **Personal finance apps (Mint/YNAB-style)** | Budgeting, spending categorization, net worth | Athena is investment-specific and explicitly will not become a budgeting tool (see `ProductBoundaries.md`) |

**The workflow Athena can actually own**: *the connected loop from researching a company, through recording why you decided what you decided, to reviewing whether that reasoning held up* — no competitor above does all three in one connected product. Yahoo/TradingView/Seeking Alpha stop at research. Portfolio trackers stop at management. None of them close the loop back to "was I right, and why."

## Athena v1 / v2 / v3

- **v1 (feels like a complete product)** — what exists today plus Phase 2's Decision record: a user can research a company, form and record a thesis, track what they own, and see risk/performance. This is a coherent, complete-feeling product even without Phases 3–6.
- **v2 (transforms it into a platform)** — Phase 3 (real portfolio depth: cash, dividends, tax lots, multi-portfolio) plus Phase 4 (monitoring becomes push, not pull) plus Phase 5 (the review loop closes: decisions vs. outcomes). At this point Athena is doing something no single competitor above does end-to-end.
- **v3 (genuinely differentiated)** — Phase 6: goals tied to real portfolio progress, rebalancing simulation grounded in the same Scenario engine already built, and a Learn pillar mature enough to surface patterns across a user's own decision history ("your theses involving high-growth small caps have underperformed your thesis-average by X" — a real, personal, evidence-backed insight no generic tool can produce because no generic tool has the user's own decision history to mine).

## Success metrics (directional, none instrumented yet)

Matching the existing product's own discipline (`WatchlistAndPortfolioProductDesign.md`, `IntelligentAlertsProductDesign.md` both explicitly decline to instrument metrics without validated need) — these are what would be worth measuring once a feature exists, not a build-now checklist:

- Research-to-Decision conversion: of tickers researched, what fraction get a recorded decision (Phase 2+)
- Decision-to-Review rate: what fraction of recorded decisions get revisited after a stated holding period (Phase 5+)
- Watchlist-to-Portfolio conversion (already relevant today, still uninstrumented)
- Repeat-visit cadence around Alerts (already relevant today)
- Thesis edit/regenerate rate, mirroring DCF's assumption-edit-rate signal for "are users engaging or just clicking through"

Avoided on purpose: raw engagement vanity metrics (session count, DAU) with no product question attached — every metric above answers a specific question about whether a *pillar* is working, not just whether people are opening the app.
