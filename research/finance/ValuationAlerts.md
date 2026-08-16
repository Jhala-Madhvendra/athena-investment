# Valuation Alerts

## 1. Definition

A valuation alert would notify an investor that a company's intrinsic value estimate (DCF) or comparable-company implied value range has moved meaningfully, or that the market price has crossed from a discount to a premium relative to that estimate (or vice versa). **Sprint 11 does not ship any valuation alert rules.** This document exists specifically to explain why, and what would need to change for a future sprint to add them.

## 2. Why investors care (if it existed)

"Market price moved from a 15% DCF discount to a 3% premium" is exactly the kind of signal the sprint brief's own examples describe — a market price re-rating relative to a fundamentals-based estimate is often more informative than the price move alone, since it frames the move against *something*, not just against yesterday's close.

## 3. Formula (if it existed)

```
DCF % change            = (intrinsicValue_new - intrinsicValue_prior) / intrinsicValue_prior * 100
Valuation gap crossing  = sign(upsideDownsidePercent) changed, or crossed a ±10% band
```

## 4. Appropriate comparison period

A DCF or comps valuation isn't tied to a fiscal year the way financial-statement alerts are — it changes continuously as the market price and (less frequently) the underlying financials move, so the natural comparison is "the last time this was computed" rather than a fixed period. That's exactly the kind of comparison that needs a persisted snapshot (see `research/engineering/SnapshotArchitecture.md`).

## 5. Limitations — why this category was deferred

Both of Athena's valuation methodologies have a hard input requirement the app deliberately never auto-fills:

- **DCF** requires `preTaxCostOfDebt`, and `dcfInput.mapper.js`'s `buildDefaults()` always returns it as `{value: null, source: "required_user_input"}`, for every ticker, with no fallback — enforced independently at both the frontend form and `valuation.validator.js`. See `research/finance/CostOfDebt.md`: *"guessing one would be presenting a fabricated number as if it meant something."* An unattended monitoring pass has no cost-of-debt figure to run a DCF with, for any ticker, ever, under the current architecture.
- **Comps** requires a peer list, and peer selection is deliberately user-controlled — `comps.peerSelector.js` explicitly documents that Athena has "no industry-classification similarity engine... no automatic 'these companies are comparable' judgment." There is no default/persisted peer set a background job could run against.

Given both constraints, shipping a "Valuation" alert category with rules that either fabricate a cost-of-debt assumption or invent an automatic peer set would violate the exact principles those two engines were built around. Rather than compromise either, valuation alerts are deferred as a category — `ALERT_TYPES` in `alert.model.js` still includes `VALUATION` for forward compatibility, but no rule in `alert.engine.js` ever produces one, and the frontend's filter chips (`AlertFilters.jsx`) deliberately omit it so a user never sees an always-empty filter.

## 6. False positives (if it existed)

DCF is documented elsewhere in this codebase as "highly sensitive to assumptions" (`valuation.service.js`'s own disclaimer) — a naive valuation-change alert re-run with even slightly different market inputs (a moved risk-free rate, a different beta reading) could fire on assumption noise rather than a genuine re-rating, which is part of why any future implementation would need a *stored, stable* assumption set rather than re-deriving "suggested" defaults fresh each run.

## 7. How Athena implements it

It doesn't, yet. The path to unblocking this, sketched for a future sprint: let a user explicitly save a DCF assumption set (including their own cost-of-debt figure) for a ticker via the existing DCF form — a small new "track this valuation" feature. Monitoring would then rerun DCF only for tickers with a saved set, using the user's own real numbers, never a fabricated one. Because DCF assumptions are inherently user-chosen (not an objective fact about the ticker), this would necessarily be a *per-user* concept — unlike the ticker-shared approach that would otherwise be preferred for efficiency (see `SnapshotArchitecture.md`).

## 8. Common mistakes

- Assuming "valuation alerts are hard to build" means "skip validating why" — the actual reason is architectural (no unattended input path exists), not effort. Documenting that distinction matters because the fix is a specific, scoped feature (saved assumptions), not an open-ended research problem.
- Building a workaround that silently defaults `preTaxCostOfDebt` to *something* (e.g., risk-free rate + a spread) just to make DCF alerts "work" — this is exactly the anti-pattern `CostOfDebt.md` documents Athena refusing to do, and doing it quietly inside an alert rule would undermine that principle in a place a user is less likely to notice than the DCF form itself.

## 9. Interview questions

1. *"Why doesn't Athena have valuation alerts if the sprint brief's own examples ask for them?"* — Both DCF and Comps have a genuine, load-bearing input gap that Athena's existing architecture deliberately never fills automatically (cost of debt, peer selection). Shipping the feature would require either fabricating those inputs — contradicting a design principle established in earlier sprints — or inventing new persistence Athena doesn't have. Naming the gap explicitly and deferring it is more honest than a half-working alert that quietly guesses.
2. *"What's the actual blocker for DCF specifically?"* — `preTaxCostOfDebt` has no default anywhere in the codebase, by design (see `CostOfDebt.md`), because unlike a broad market-level figure (equity risk premium, terminal growth rate), a company's actual borrowing cost has no reasonable proxy Athena's data can derive — guessing one would be fabrication, not a starting estimate.
3. *"How would you unblock DCF-based alerts without violating that principle?"* — Let the user supply the number once (via the existing DCF form) and persist it as their own chosen baseline; monitoring reruns DCF with that saved, real assumption set. The number is still never fabricated — it's the user's own input, just reused across monitoring runs instead of re-entered every time.
4. *"Why is Comps a separate problem from DCF, not the same fix?"* — DCF's gap is one missing number; Comps' gap is an entire missing peer-selection judgment ("which companies are actually comparable"), which `comps.peerSelector.js` explicitly says Athena has no engine for. Saving a user's DCF assumption is a narrow fix; auto-selecting comparable companies is a different, larger feature (an industry-similarity engine) that doesn't exist yet.
