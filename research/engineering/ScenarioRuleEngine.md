# Scenario Rule Engine

## Definition

A small, deterministic engine that takes a portfolio's current holdings plus a list of hypothetical shock rules and resolves them into per-holding effective shocks — the core of Sprint 16's scenario feature. Split into two pure modules, `backend/portfolio/portfolio.scenario.resolver.js` (rule matching + precedence, see `ScenarioPrecedence.md`) and `portfolio.scenario.calculator.js` (turning a resolved shock into a value/attribution result, see `research/finance/ScenarioAttribution.md`) — mirroring the existing `portfolio.calculator.js` / `portfolio.analytics.calculator.js` split of "pure math module, no I/O" that every prior sprint's engine already follows.

## Why it exists

Sprint 15's commit message claimed a scenario engine existed; inspection before writing any code (`git show --stat` on that commit) showed it didn't — only transaction-ledger and historical-reconstruction code was actually delivered. A pure, dependency-free rule engine was therefore built from scratch, deliberately structured to answer the sprint's harder new requirement (multiple simultaneous, possibly overlapping shocks) rather than only the simpler single-shock case Sprint 15 described.

## Alternatives considered

- **One monolithic function doing matching, precedence, and math together** — rejected because it would make precedence logic (a genuinely separate concern, see `ScenarioPrecedence.md`) untestable in isolation from the arithmetic, and harder to reason about when debugging "why did this holding get this shock."
- **Letting the resolver also compute dollar values** — rejected in favor of resolver-produces-`effectiveShockPercent`, calculator-produces-dollars, because the two questions ("which rule applies" and "what does that rule do to this holding's value") have genuinely different failure modes and genuinely different tests.
- **A rules-engine library (e.g., a generic condition/action DSL)** — rejected as unnecessary complexity for five fixed `targetType`s with a fixed precedence order; a general-purpose rules engine would add a dependency and an abstraction layer to solve a problem five `if`/`switch` branches already solve clearly.

## Athena implementation

`resolver.resolveScenario(holdings, rules)` returns one entry per holding: `{..., appliedRule, effectiveShockPercent, overriddenRules, unevaluableRules, unaffected}`. `calculator.calculateScenarioImpact(resolvedHoldings)` turns that into `{currentPortfolioValueUSD, scenarioPortfolioValueUSD, absoluteChangeUSD, percentageChange, holdingImpact, sectorImpact}`. Neither module touches Mongoose, `fetch`, or the LLM layer — `portfolio.scenario.service.js` is the only I/O boundary, fetching holdings (`portfolio.service.js`), sector/industry (`Company` model), and beta (`marketService`) once per request and handing plain objects to the pure engine. This mirrors Sprint 14's `portfolio.analytics.service.js` → `portfolio.analytics.{calculator,risk,exposure,correlation}.js` boundary exactly — same reuse discipline, new domain.

## Testing strategy

Every precedence and overlap case named in the sprint brief is a direct unit test against `resolver.js` alone, with no database, no HTTP, no market data — `portfolio.scenario.resolver.test.js` covers single-asset, sector, portfolio-wide, and market/beta shocks; asset-overrides-sector; sector-overrides-market; the MARKET-beta-unavailable fallthrough (a genuinely separate case from ordinary precedence, see `ScenarioPrecedence.md`); and unaffected holdings. `portfolio.scenario.calculator.test.js` covers the worked dollar examples straight from the sprint brief (AAPL -30% → -$60,000), −100%/+100% edge shocks, an empty portfolio, and the weight-vs-contribution distinction. `portfolio.scenario.service.test.js` mocks only the I/O boundary (`portfolio.service`, `Company.find`, `marketService`, `portfolioAnalyticsService`) and exercises the real resolver/calculator underneath — so a service-layer test failure means the wiring is wrong, not the math, and vice versa.

## Interview questions

1. **"Why split the scenario engine into a resolver and a calculator instead of one module?"** — They answer genuinely different questions with genuinely different failure modes: "which single rule governs this holding" (a matching/precedence problem) versus "what does that governing shock do to this holding's value and how does it roll up to the portfolio" (an arithmetic/aggregation problem). Splitting them means a precedence bug and a rounding bug show up in different, more specific test files instead of one large one.
2. **"Why is neither module aware of MongoDB, HTTP, or the LLM layer?"** — So the actual scenario math can be unit-tested in milliseconds with plain JS objects, verified deterministic and correct, and reused unchanged regardless of how holdings data is fetched or how the result is eventually served — the same "pure calculator, impure service" boundary every prior sprint's engine (DCF, Comps, Portfolio Analytics) already established in this codebase.
3. **"How would you extend the rule model to support a new targetType (e.g., COUNTRY)?"** — Add it to `resolver.js`'s `TARGET_TYPES` and `PRECEDENCE_RANK` (deciding where it ranks relative to the existing five), add a case to `ruleMatchesHolding()`, add validation for it in `portfolio.scenario.validator.js`, and the calculator needs no changes at all — it only ever consumes `effectiveShockPercent`, never `targetType` directly, which is exactly why the split in Section "Alternatives considered" pays off here.
