# Product Boundaries

## Why this document exists

Athena's credibility across 18 sprints rests on a small number of boundaries that are re-argued in almost every product doc (`DCFProductDesign.md` Q1, `PortfolioRiskProductDesign.md` Section 6, `AIResearchAnalystProductDesign.md` Q3, `AdvancedScenarioProductDesign.md` Section 9) — never give recommendations, never imply certainty the model doesn't have, never let AI invent a number. Sprint 19 is the first point where those boundaries need to be stated once, centrally, as *product* boundaries rather than re-derived per feature. Every future pillar (Decide, Manage-deepening, Learn) inherits these without needing to re-litigate them.

## The boundaries

| Adjacent category | Support it? | Integrate with it? | Avoid it? | Why |
|---|---|---|---|---|
| **Brokerage / order execution** | Never | Maybe, far future, read-only | Yes, as an execution platform | Real-money execution carries regulatory and liability obligations (best execution, custody, KYC) that are a fundamentally different business than an analytics tool. A future read-only broker sync (import real transactions instead of manual entry) is a plausible Phase 3+ integration; Athena placing or routing an order is not on any roadmap. |
| **Bank** | Never | No | Yes | No product reason exists to hold or move user funds. Out of scope permanently. |
| **Tax filing software** | Never | No | Yes | Athena may keep surfacing unrealized/realized gain *estimates* (partially exists today via cost basis) as informational context, but will never compute or claim authority over an actual tax liability — that requires jurisdiction-specific rules Athena has no basis to model correctly, and getting it wrong has real consequences for a user. |
| **Financial advisor** | Never | — | Yes | This is Athena's single most consistently enforced boundary already. Every DCF, Comps, Portfolio Risk, and AI feature explicitly refuses BUY/SELL/HOLD language, both in prompt/copy and in code-level regex checks on AI output. Crossing this line would change Athena's regulatory posture and, per `PortfolioRiskProductDesign.md` Section 6, would make every *other* number on the page less trustworthy by association — once a user sees Athena editorialize once, they reasonably wonder if every number is house-biased. |
| **Automated trading system** | Never | No | Yes | Follows directly from the advisor boundary — an automated system that acts on Athena's analysis would be Athena making the investment decision, which no part of the product is designed to do or should ever be trusted to do. |
| **Cryptocurrency exchange** | Not now | Maybe, data-only asset class, later | Not a priority | Crypto as a *research subject* (price/fundamentals data for a token) is a plausible, low-risk future data-source addition. Crypto as a place to trade is out of scope for the same reasons as brokerage. |
| **Generic AI chatbot** | No | — | Yes | Already explicitly rejected in `AIResearchAnalystProductDesign.md` Q1/Section 3: open-ended chat reopens the grounding problem every fixed-shape AI feature was designed to close. Every future AI surface (a Decide-pillar thesis assistant, a Learn-pillar pattern summarizer) must inherit the same closed-context, validated-output discipline — not trade it away for a more "engaging" conversational interface. |
| **Generic personal finance tracker (budgeting/spending/net worth)** | No | No | Yes | Out of Athena's identity. Athena is investment-specific; a budgeting feature would dilute focus and compete for engineering attention against the Decide/Manage/Learn gap that actually matters to the primary user. |
| **News aggregator** | No (as a destination) | Already integrated (as evidence) | Partially | News already exists (`backend/news/`) but is explicitly a supporting evidence layer for Research and Alerts, never a standalone destination competing with a dedicated news reader. This boundary is already correctly implemented — no change needed, just documented. |

## The one boundary underneath all of these

Every "avoid" row above is really one boundary applied eight different ways: **Athena describes; it does not decide, execute, or hold custody.** Description can be arbitrarily deep (DCF assumption waterfalls, portfolio risk decomposition, scenario attribution) without ever crossing into decision-making on the user's behalf. This is the same line `PortfolioRiskProductDesign.md` draws for portfolio optimization ("describing a portfolio's current characteristics is a well-scoped, honest problem Athena can solve correctly... prescribing changes to it is a different, much harder problem") — Sprint 19's job is to confirm this line holds for every future pillar, not just the ones that already exist.

## Where the Decide pillar sits against this boundary

A recorded `InvestmentDecision` (Phase 2, see `research/finance/InvestmentDecisionFramework.md`) is **user-authored**, not Athena-generated — the user writes their own thesis, bull case, bear case, and reasoning. Athena's role is to supply evidence (pre-computed DCF/Comps/Scenario outputs the user can cite) and to store the record, never to draft the thesis itself or grade its quality. This keeps a future Decide pillar squarely inside "describe," never crossing into "decide for you" — the same discipline applied to a new surface.
