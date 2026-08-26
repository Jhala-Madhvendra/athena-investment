# Future Architecture

## What it is

The proposed evolution of Athena's system architecture from "financial data → analytics → frontend" into a layered stack that supports the full Discover→Learn lifecycle, without abandoning the feature-vertical pattern that has scaled cleanly across 18 sprints.

```
External Data (Yahoo, TwelveData, Marketaux)
        ↓
Provider Abstraction        (backend/providers/, backend/ai/providers/ — already exists)
        ↓
Canonical Financial Data     (Company, FinancialStatement, MarketHistory, NewsArticle — already exists)
        ↓
Financial Intelligence       (Ratios, DCF, Comps, Industry, Earnings, Business Analysis — already exists)   [RESEARCH]
        ↓
Decision Support             (NEW — InvestmentDecision, citing Financial Intelligence + Scenario as evidence)   [DECIDE]
        ↓
Portfolio Management         (Holdings, Transactions, Portfolio Analytics, Scenario — already exists)   [MANAGE]
        ↓
Monitoring                   (Alerts — already exists, pull-triggered; scheduler is the one new piece)   [MONITOR]
        ↓
Learning / Review            (NEW — comparison views over Decision Support + Portfolio Management, no new engine)   [LEARN]
        ↓
Frontend                     (React, per-page fetch — already exists)
```

AI is drawn outside this vertical stack deliberately — it is a **cross-cutting capability**, called into from Financial Intelligence (Research Report) and, in the future, from Decision Support and Learning, never a layer of its own. This matches how it's already implemented: `backend/ai/` and `backend/portfolio/portfolio.scenario.explanation.*` are siblings of the feature verticals they narrate, not a layer everything passes through.

## Why we use it

The existing feature-vertical pattern (`backend/portfolio/`, `backend/watchlist/`, `backend/alerts/`, each owning its own model/service/controller/routes) has already proven itself across 18 sprints without needing a rewrite — Sprint 19's job is to extend the pattern with two new verticals (Decision Support, Learning), not replace the pattern itself. This is the same reasoning `AIProviderAbstraction.md` used when adding the AI layer: reuse a proven convention rather than introduce a new architectural paradigm for a new feature.

## Alternatives considered

- **A full re-architecture into formal microservices or a CQRS split**, given the "layered stack" language in the sprint brief. Rejected: nothing about Athena's current scale (single MongoDB instance, per-request computation, no evidence of load problems) justifies this complexity. The brief's "External Data → Ingestion → Canonical → Intelligence → Decision Support → Portfolio Management → Monitoring → Learning → Frontend" diagram is a *conceptual* layering that Athena's existing feature-vertical modules already satisfy in practice (each vertical maps to one conceptual layer) — formalizing it into physically separate services would be new infrastructure with no current justification, the same category of premature complexity `ScheduledMonitoring.md` already rejected for a cron scheduler before it was needed.
- **Making AI a formal layer between Portfolio Management and Frontend.** Rejected — this would misrepresent what AI actually does in Athena (narrate specific already-computed outputs, opt-in, per-feature) as if it were a universal pass-through every request goes through. Keeping it cross-cutting and opt-in matches both the current implementation and the AI Boundary principle below.

## Trade-offs

- **Pro:** zero migration cost — every existing vertical stays exactly where it is; Decision Support and Learning are new siblings, not a restructuring of Research/Manage/Monitor.
- **Pro:** the layered *conceptual* diagram gives a shared vocabulary for where a new feature belongs without requiring new physical infrastructure to enforce it.
- **Con:** without a formal enforcement mechanism (e.g., a linter rule or module boundary check), nothing stops a future vertical from reaching directly into another's internals instead of through its service layer — this is already true today and has not caused a problem, so it's an accepted, pre-existing trade-off, not a new one introduced by this document.

## How Athena should implement it

### New vertical: `backend/decisions/` (Phase 2)
Mirrors `backend/portfolio/`'s shape: `decision.model.js`, `decision.service.js`, `decision.controller.js`, `decision.routes.js`, `decision.validator.js`. Its service layer reads (never writes) from `valuation/`, `valuation/comps/`, and `portfolio/portfolio.scenario.*` to populate evidence references — the same read-only cross-vertical reuse `ai.contextBuilder.js` already does today.

### New vertical: `backend/review/` (Phase 5)
No new calculation engine — its service layer joins `decisions/` records against `portfolio/portfolioHistory.service.js` (current price, current holding status) to compute "then vs. now." This vertical is mostly query/aggregation logic over two existing verticals' data, which is why `FutureDataModel.md` classifies it as needing no new persisted entity beyond `InvestmentDecision` itself.

### Scheduler (Phase 4, only when prioritized)
`ScheduledMonitoring.md` already specifies the cheapest correct version: a low-frequency cron calling the existing `runMonitoring` function unchanged. No new architectural layer — an addition to `server.js`'s startup (or a small separate process) that invokes an existing service function on a timer, gated behind whatever job-scheduling library is chosen at that time (not selected now — premature to pick before the feature is prioritized).

### Identity evolution (prerequisite for Phase 4 delivery and cross-device Phase 2/5 persistence)
Not a new layer — a change to the existing `identity/` vertical's model. The bearer-token mechanism can stay as the underlying session credential; what needs to be added is a way to associate a token with a real, recoverable identifier (email at minimum) so a lost browser doesn't mean a lost Decision history. This is flagged here as an architectural dependency, not designed in detail — that's a dedicated future sprint's job, not Sprint 19's.

## AI boundary (restated for the future architecture)

AI never occupies a position in the vertical stack where it would be the source of truth for a number. Its only two positions are: (1) narrating an already-computed value from the vertical directly below it in the diagram (Financial Intelligence → Research Report; Portfolio Management/Scenario → Scenario Explanation), and (2), in a future Decide/Learn extension, helping a user *articulate* their own reasoning (e.g., drafting thesis prose from a user's own bullet points) — never authoring the decision itself, never grading it, never inventing an assumption the user didn't state. Every future AI surface must pass the same test already applied to the two existing ones: can every number in its output be traced back to a value that existed before the AI call ran? If not, it doesn't ship.

## Interview questions

1. *"Why not introduce a formal service-mesh or microservice boundary now, given the roadmap adds two new pillars?"* — Because nothing about current scale or team size justifies it, and the feature-vertical convention already gives each pillar clean isolation within a single deployable app. Physical service separation is a response to independent scaling or deployment needs neither of which exists yet — adding it now would be exactly the kind of infrastructure-ahead-of-need this codebase's own docs (`ScheduledMonitoring.md`, `AdvancedScenarioProductDesign.md` Section 8) repeatedly argue against.
2. *"If Decision Support needs data from three other verticals, doesn't that create tight coupling?"* — It creates the same read-only, service-layer-mediated coupling `ai.contextBuilder.js` already has with five verticals (Company, Financials, Market, Valuation, Analysis) today, which hasn't been a maintenance problem. The rule that keeps it safe is direction: Decision Support reads from Research/Manage; it never gets written to by them, and nothing about adding a Decision changes what Research or Manage compute.
