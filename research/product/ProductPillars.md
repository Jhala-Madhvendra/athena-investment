# Product Pillars

## Why four pillars, not a flat feature list

Athena's 18 sprints were each scoped and justified individually (see each sprint's own `research/product/*ProductDesign.md`), which was right for building them, but leaves no single place answering "what is Athena *for*, as a whole." The four pillars below aren't a new information architecture (the frontend doesn't need a "Research/Decide/Manage/Learn" tab layout) — they're a categorization of *product intent* that makes it possible to see, at a glance, that Athena is deep in two pillars and has none of the other two.

---

## Pillar 1 — RESEARCH

**Purpose:** "Help me understand an investment."

**What already exists (mature):**
- Financial Statements (Income Statement, Balance Sheet, Cash Flow)
- Financial Analysis (ratios: margins, ROE/ROA, liquidity, leverage)
- Business Analysis (Health Score, trend engine, insight engine, growth CAGR)
- Market Intelligence (price history, market-vs-business performance)
- DCF Valuation (assumptions, forecast, WACC, sensitivity, Bear/Base/Bull scenarios)
- Comparable Companies (peer selection, statistics, implied valuation)
- Industry Intelligence (peer benchmarking, positioning, discovery)
- Earnings Intelligence (period comparison, quality signals, market reaction)
- News & Events (categorized, deduplicated, per-ticker)
- AI Research Report (grounded synthesis across all of the above, evidence-cited)

**Verdict:** This pillar does not need new capabilities in the near term. It needs to stay the evidence base every other pillar draws from — DCF/Comps/Scenario outputs should be *reused as citations* in Decide and Learn, never recomputed or reinterpreted differently in a new pillar.

**Gaps:** None urgent. A persistent "Research Workspace" concept (notes tied to a company, independent of a decision) is evaluated in `research/engineering/FutureDataModel.md` and classified MAYBE — not a gap blocking anything else.

---

## Pillar 2 — DECIDE

**Purpose:** "Help me evaluate and record an investment decision."

**What already exists:**
- Portfolio Scenario Analysis (Bear/Base/Bull, multi-factor stress tests) — the closest thing to decision-support infrastructure, but ephemeral (never persisted) and framed as hypothetical stress-testing, not decision capture
- Watchlist-add — a zero-commitment "I'm interested" signal, carrying no reasoning

**What's missing:**
- Any persistent record of *why* a user did or is considering something
- Bull case / bear case / key assumptions as first-class, retrievable fields
- Any link between a decision and the evidence (DCF value, Comps range, Scenario result) that informed it
- Paper trading / proposed-but-not-executed transactions
- A decision journal

**This is Athena's largest single gap**, and the one this sprint recommends addressing first (Phase 2). It's tractable specifically because Research is already mature — a Decision record's evidence fields can point at outputs that already exist and are already tested, rather than requiring new calculation engines.

**Recommended for NOW/Phase 2:** `InvestmentThesis`/`InvestmentDecision` minimal model — see `research/finance/InvestmentDecisionFramework.md`.
**Recommended for LATER:** Paper trading, rebalancing simulation, investment goals (each depends on Decide's core entity existing first, or on Manage-pillar depth that doesn't exist yet — see below).

---

## Pillar 3 — MANAGE

**Purpose:** "Help me manage what I actually own."

**What already exists (substantial):**
- Holdings (current lots: ticker, shares, average price, purchase date)
- Transactions (BUY/SELL ledger, chronologically replayable)
- Transaction-aware historical reconstruction (`holdingsReconstruction.calculator.js`)
- Portfolio Analytics: volatility, Sharpe Ratio, max drawdown, beta, correlation matrix, sector/industry exposure, concentration (HHI)
- Portfolio Scenario stress-testing (multi-factor, precedence-resolved)

**What's missing (explicitly out of scope by design so far, per `PortfolioCalculationAssumptions.md`'s own "Non-goals" list):**
- Cash (no ledger — deposits/withdrawals untracked)
- Dividends and corporate actions (splits, spin-offs)
- Tax lots / FIFO-LIFO accounting / realized capital gains classification
- Multiple named portfolios per user
- Benchmarking beyond CAPM beta (no "vs. S&P 500 total return" comparison line)
- Portfolio targets / rebalancing recommendations (deliberately deferred — optimization is explicitly out of scope per `PortfolioRiskProductDesign.md` Section 7)

**Verdict:** This pillar is genuinely deep on *analysis* (risk, exposure, historical reconstruction) and genuinely shallow on *bookkeeping* (cash, dividends, tax lots, multi-portfolio). The analysis depth was the right thing to build first — it's what makes Athena more than "a spreadsheet with a nicer UI" — but bookkeeping depth is what Phase 3 needs to add before Goals or true performance attribution become meaningful.

---

## Pillar 4 — LEARN

**Purpose:** "Help me become a better investor."

**What already exists:** Nothing structural. The AI Research Report and Scenario Explanation features are the closest analogs (they explain a number), but neither looks backward at a user's own past decisions — there is no mechanism today for Athena to know a decision was ever made, let alone whether it turned out well.

**What's missing:**
- Any persistent decision history to learn from (depends entirely on Decide pillar existing first)
- Thesis-vs-actual-outcome comparison
- Pattern recognition across a user's own decisions ("your high-conviction theses on small caps have underperformed your average")
- Educational content tied to a user's actual behavior, not generic articles

**Verdict:** Cannot be meaningfully started before Decide exists — there is nothing to review or learn from otherwise. This is why the roadmap sequences Learn (Phase 5) strictly after Decide (Phase 2) and Manage-deepening (Phase 3), not in parallel.

---

## Cross-pillar principle

No pillar should duplicate another's source of truth. Decide records cite Research outputs (DCF value, Comps range) rather than recomputing them. Learn compares Decide records against Manage's actual portfolio performance rather than maintaining its own performance calculation. This mirrors the "compute once, reuse via reference" discipline already established between `ai.contextBuilder.js` (Research → AI) and `portfolio.scenario.explanation.service.js` (Scenario engine → AI) — the same reuse pattern, applied across pillars instead of within one feature.
