# Sprint 7 Reflection — Comparable Company Analysis Engine

*Continuing the `SprintReflection-SprintN.md` convention Sprints 2, 4, 5, and 6 use — see Sprint 6's reflection for the note on why the unsuffixed `SprintReflection.md` holds Sprint 3's reflection instead.*

## 1. What was built

A full Comparable Company Analysis ("Trading Comps") engine, end to end: a framework-independent calculation core (`backend/valuation/comps/comps.formulas.js`, `comps.statistics.js`, `comps.valuation.js`, `comps.engine.js`), peer discovery and validation (`comps.peerSelector.js`, `comps.validator.js`), a mapper (`compsInput.mapper.js`) reusing Sprint 1/4's existing `financials.service`/`market.service`/`company.service` rather than a new Yahoo client, and two endpoints (`GET /:ticker/comps/available-peers`, `POST /:ticker/comps`) mounted additively into the existing `valuation.routes.js`. The frontend adds a "Comps" tab alongside Sprint 6's DCF tab (via a small, additive `Tabs` change to `Valuation.jsx`, not a rewrite), a full `ComparableCompanies.jsx` page with peer search/selection, the peer comparison table, peer statistics, implied valuation, valuation range, and a DCF-vs-Comps comparison that reuses the DCF tab's already-computed result rather than re-fetching or duplicating DCF logic. 76 new backend tests and 10 new frontend tests were added; the full suite (252 backend, 57 frontend) stayed green throughout, and Sprints 1-6 were never modified except the one-line additive route mount.

## 2. Finance concepts learned

The Enterprise-vs-Equity multiple distinction turned out to be the sprint's central discipline, in the same way FCFF-vs-FCFE was Sprint 6's — P/E, P/B, and P/S are equity multiples (numerator and denominator both belong only to shareholders), while EV/EBITDA and EV/Revenue are enterprise multiples (numerator and denominator are both capital-structure-neutral), and mixing them means literally forgetting to bridge through Net Debt, silently overstating or understating an implied share price by the size of the company's leverage. The second real lesson was *why* median beats mean as a default statistic — not as received wisdom, but demonstrably: `[10, 12, 14, 16, 1000]` has a mean of `210.4` (dragged almost entirely toward one bad observation) and a median of `14` (barely moved), which is the concrete argument for why Athena defaults to median rather than just asserting it's "more robust." Outlier handling was the third — a negative-earnings P/E isn't a statistical outlier to smooth over, it's not a real number at all, and the sprint brief's insistence on never fabricating a positive P/E from negative earnings forced a genuine distinction between "exclude because not economically meaningful" and "exclude because statistically unusual" that the engine treats very differently (only the former happens at all).

## 3. Engineering concepts learned

Reuse-without-duplication across two valuation domains was the sprint's sharpest engineering lesson: `comps.valuation.js`'s Enterprise-to-Equity bridge imports `dcf.formulas.js`'s `netDebt()`/`equityValue()` directly rather than reimplementing the same formula a second time, on the reasoning that it's the *identical* financial relationship regardless of whether Enterprise Value came from discounted cash flows or a peer multiple — two copies of the same formula is exactly the kind of thing that quietly drifts out of sync. The formulas/statistics/valuation/engine split (mirroring DCF's formulas/validator/engine split from Sprint 6) proved itself again: each layer was independently unit-testable with hand-computed expected values, and `comps.engine.test.js`'s fixture (one target, two peers, one loss-making so P/E excludes it) was solvable by hand on paper *before* being written as a test, which is what actually caught that my first EV/EBITDA numbers weren't clean round figures and let me fix the fixture rather than debug a false test failure later.

## 4. Product decisions

Peer selection stays entirely manual, with candidate browsing explicitly labeled as "companies Athena already knows about," never "recommended comparables" — the single most consequential product decision of the sprint, since Athena's current data (sector/industry strings, market cap, revenue) genuinely isn't rich enough to make a comparability judgment reliably, and a confidently-wrong automatic suggestion is worse than an empty list a human has to fill in. The Valuation Range (Low/Median/High across every applicable methodology) is shown instead of any single collapsed or averaged number, for the same reason DCF shows a scenario range instead of one point estimate — five multiples genuinely can and do disagree, and averaging them away would manufacture false consensus. Full reasoning in `research/product/ComparableCompaniesProductDesign.md`.

## 5. Important trade-offs

**Peer-data-availability handling: exclude-with-reason vs. hard-fail-the-request.** A peer that structurally validates (well-formed ticker, not the target, not a duplicate) but turns out to have no imported financial statements is excluded from the calculation with a stated reason (`unavailablePeers`), not a request-level failure — the request only fails if *too few* peers end up with usable data (below `MIN_PEERS`). This was a deliberate choice to let a mostly-good peer list still produce a result rather than making one bad ticker block the whole analysis, mirroring the DCF pattern of degrading gracefully (e.g., a failed market-quote fetch) rather than hard-failing wherever possible. **Candidate browsing skips live market data entirely.** `available-peers` shows each candidate's *stored* (import-time) market cap, not a live quote — deliberately, since browsing 25 candidates shouldn't cost 25 live API calls, but it does mean the number shown while browsing can differ from the live figure used once a peer is actually selected and calculated — a trade-off documented directly in `PeerSelectionEngine.md` rather than left implicit.

## 6. Difficult implementation decisions

Deciding where market-price comparison belongs was less obvious than it looks in hindsight, in the same way WACC's placement was genuinely non-obvious in Sprint 6: `comps.engine.js` never sees the current market price at all — `upsideDownsidePercent` is computed one layer up, in `comps.service.js`'s `withMarketComparison()`, applied to the engine's already-pure `impliedValuations`. This mirrors `valuation.service.js`'s identical pattern for DCF exactly, which made the decision easy in hindsight but wasn't obvious until re-reading how Sprint 6 solved the same "the engine shouldn't know about live data" problem first.

## 7. Bugs found and fixed (worth calling out explicitly)

One real bug surfaced during frontend testing, not initial implementation, in the same spirit as Sprint 6's CapEx sign bug — caught by a test, not a syntax check:

- **`PeerSelector.jsx` passed a `URL` object to `fetch()` instead of a string.** `new URL(...)` plus `url.searchParams.set(...)` works fine against a real browser's `fetch`, but the very first frontend test run surfaced it immediately once the peer-search request needed to be intercepted — the test's URL-based mock router expected a string and threw `url.includes is not a function`. Fixed by building the query string with plain template-literal concatenation and `encodeURIComponent`, matching every other fetch call in the codebase (`Valuation.jsx`, `Sidebar.jsx`'s `CompanySearch`) — which was also the actual root cause: this was the one new fetch call in the sprint that deviated from the codebase's established string-URL convention, and deviating from an established pattern is exactly where a subtle bug like this tends to hide.
- **An ESLint-caught unused variable** (`excluded` in `PeerStatisticsTable.jsx`, computed but never read after a refactor) — caught by `eslint .` before it ever reached a test run, a reminder that a full lint pass is worth running even when tests are green.

## 8. What was intentionally NOT built

Automatic peer recommendation/similarity scoring (see Section 4 — deliberately deferred, `research/finance/PeerSelection.md` and `research/engineering/PeerSelectionEngine.md` both document what it would actually require). Comps result persistence — every calculation is dynamic, recomputed from current stored financials, live market quotes, and the request's peer list/statistic, for the same reasoning Sprint 6 applied to DCF (`research/engineering/DynamicValuationCalculation.md`). Auto-importing a peer's financial statements as a side effect of adding it to a peer list — importing stays an explicit, separate action everywhere in the app, and Comps didn't get a silent exception. A live-market-data-backed candidate list for peer browsing (deliberately kept to stored, import-time data — see Section 5).

## 9. User assumptions being made

That users will actually evaluate a candidate's sector/industry/market-cap/revenue before adding it as a peer, rather than adding the first few search results without scrutiny — untested, and the direct analogue of Sprint 6's still-open "do users read the source badges" question, now applied to peer comparability instead of assumption provenance. That a valuation range spanning, say, ₹1,120-₹1,450 reads as "these methodologies genuinely disagree, investigate why" rather than "this tool is imprecise." That users who run both DCF and Comps for the same company treat a gap between the two as a prompt to dig deeper rather than simply picking whichever number is more convenient.

## 10. What we'd validate with real users

Whether users read and act on the `limitation` notice on the peer-candidate list ("these are known companies, not recommendations") or scroll past it — the single most important comprehension check for whether the manual-peer-selection product bet (Section 4) is actually working. Whether the Peer Statistics table's Min/Max/P25/P75 spread gets used to sanity-check a peer group's quality, or whether users only ever look at the headline Valuation Range. Whether a wide DCF-vs-Comps gap prompts users to open both tabs and compare assumptions, or gets ignored in favor of whichever number appeared first.

## 11. What would be improved with more time

A genuine similarity-scoring model for peer candidates, once the underlying business-model/growth-trajectory data exists to make it trustworthy (see `PeerSelectionEngine.md`'s interview answer on exactly this gap). Peer-list persistence, so a user doesn't have to reselect the same peer group every session — deliberately deferred this sprint pending real staleness-handling design (`DynamicValuationCalculation.md`). Surfacing a revenue-scale or market-cap mismatch warning directly in the peer-selection UI at the moment a candidate is added, rather than only visible later in the comparison table (`ComparableCompaniesProductDesign.md` Q5). Instrumenting real usage metrics analogous to Sprint 6's proposed assumption-edit-rate, so the open questions in Section 10 have real answers.

## 12. Product Management interview questions

**Q1: Why doesn't Athena average the five implied values into one number?**
A: See `ComparableCompaniesProductDesign.md` Q1 — the five multiples are different lenses that can legitimately disagree for real economic reasons; averaging manufactures false consensus and hides exactly the signal (which methodology is driving a high or low read) that makes the analysis useful.

**Q2: Why not auto-suggest peers by sector to reduce onboarding friction?**
A: See `ComparableCompaniesProductDesign.md` Q2 — Athena's current data can't make that judgment reliably, and a confidently-wrong suggestion is a worse failure mode than an empty list a human has to fill in themselves.

**Q3: How would you prioritize what to build next given limited engineering time?**
A: Peer-list persistence is the working hypothesis — the current requirement to reselect the same peers every session is real, felt friction — but I'd want the Section 10 user-research signals (do users engage with peer statistics at all) before committing engineering time to it over, say, similarity scoring.

**Q4: Isn't forbidding Buy/Sell language for Comps redundant, given DCF already has that rule?**
A: See `ComparableCompaniesProductDesign.md` Q4 — it's consistency, not redundancy. A Comps "implied value" carries the same misreading risk a DCF "intrinsic value" does, arguably more, since a user-chosen peer group can create a false sense of "I built this number myself, so I trust it."

**Q5: What's the biggest product risk in this feature as shipped?**
A: See `ComparableCompaniesProductDesign.md` Q5 — a carelessly-assembled peer group (added quickly just to clear the 2-peer minimum) producing a Valuation Range that reads with the same authority as a carefully-constructed one, since the range display communicates cross-methodology disagreement well but has no way to communicate peer-group quality.

## 13. Engineering interview questions

**Q1: Why does `comps.engine.js` take plain "company bundles" instead of Mongoose documents or raw Yahoo API responses?**
A: Same reasoning as `dcf.engine.js` (`research/engineering/DCFEngine.md`) — a plain-object contract means the engine is testable with fabricated data, has zero knowledge of where the data came from, and stays reusable regardless of future changes to the database schema or the market-data provider's response shape. Only `compsInput.mapper.js` needs to know about those shapes.

**Q2: Why does `comps.valuation.js` import `dcf.formulas.js`'s `netDebt()`/`equityValue()` instead of reimplementing them?**
A: It's the identical financial relationship (`Equity Value = Enterprise Value − Net Debt`) regardless of whether Enterprise Value came from summed discounted cash flows or a peer multiple applied to EBITDA/Revenue — see `research/finance/EquityValue.md`'s Sprint 7 addendum. Two copies of the same formula in two files is a maintenance liability, not genuine separation of concerns.

**Q3: Why is peer-ticker structural validation (`comps.validator.js`) a separate module from peer-data-availability checking (in `comps.service.js`)?**
A: They run at genuinely different times against genuinely different failure modes — ticker format/dedup/target-exclusion needs no I/O and can fail fast; data availability can only be known after attempting a database fetch per ticker. See `research/engineering/PeerSelectionEngine.md` Q1 for the full reasoning, including why fusing them would cost either unnecessary I/O or a lost fast-fail path.

**Q4: Walk through how you'd prove `comps.statistics.js`'s median implementation is actually more outlier-resistant than its mean implementation, not just assert it.**
A: Feed both the same fixture with one deliberate outlier — `comps.statistics.test.js` uses `[10, 12, 14, 16, 1000]` — and assert the concrete numbers: mean `210.4` (dragged toward the outlier), median `14` (essentially unmoved). A single worked example with real numbers is a stronger proof than a comment asserting the property in the abstract.

**Q5: The `PeerSelector.jsx` URL-object bug (Section 7) only surfaced once a frontend test exercised the fetch call. What does that say about the value of writing frontend tests that actually mock the network layer, versus only testing pure rendering logic?**
A: A component that only renders correctly against already-resolved data can hide a completely broken data-fetching call underneath — the bug here was in *how the request was constructed*, not in what the component did with a response, so no amount of testing the render output alone would have caught it. Mocking `fetch` and asserting the component behaves correctly against realistic request/response cycles is what actually exercises that code path, the same lesson Sprint 6's live-AAPL-data testing taught for the backend CapEx bug, applied here to the frontend.

## 14. Finance interview questions

**Q1: Walk me through the full Comps pipeline, the way Athena implements it.**
A: For target and every peer: compute Enterprise Value (Market Cap + Debt − Cash) and an EBITDA proxy (Operating Income + D&A), then five multiples, each `null` when its denominator isn't a positive number. Aggregate each multiple's valid peer observations into Min/Max/Mean/Median/P25/P75. Apply the selected statistic (Median by default) to the target's own metric — equity multiples go straight to Implied Equity Value; enterprise multiples go to Implied Enterprise Value first, then bridge via Enterprise Value − Net Debt. Divide by diluted shares for Implied Value Per Share, and report the full range across every applicable methodology (`research/finance/ComparableCompanyAnalysis.md`).

**Q2: Why is EV/EBITDA an Enterprise-Value multiple and P/E an Equity-Value multiple?**
A: EV belongs to both debt and equity holders and EBITDA is measured before interest expense — both capital-structure-neutral. Market Cap belongs only to equity holders and Net Income is *after* interest expense — both already reflect the company's actual financing choices. Pairing capital-structure-neutral with capital-structure-neutral (EV/EBITDA), and equity-only with post-financing (P/E), is what keeps each multiple internally consistent (`research/finance/ValuationMultiples.md`, `EVEBITDA.md`).

**Q3: Why does negative EBITDA make EV/EBITDA meaningless, not just "a low number"?**
A: As EBITDA approaches zero from either side, the ratio's magnitude blows up toward infinity, and a small change in EBITDA can flip the multiple's sign entirely — there's no stable, meaningful "low EV/EBITDA" reading anywhere near that boundary. Athena excludes it outright rather than reporting an artificially flipped-positive or misleading value (`research/engineering/OutlierHandling.md`).

**Q4: Why does Athena default to Median over Mean for peer statistics?**
A: A single extreme peer multiple can shift a mean by its full distance from the rest of the group, but can shift a median by at most one rank in the sorted order — demonstrated concretely with `[10, 12, 14, 16, 1000]` producing a mean of `210.4` versus a median of `14` (`research/finance/TradingMultiples.md`).

**Q5: Why does P/E get excluded for a loss-making company instead of showing a negative multiple?**
A: A negative P/E would imply "the market is paying negative dollars for a dollar of earnings," which isn't a meaningful statement — the ratio's whole interpretive frame breaks down once earnings go negative. Athena returns `null` with a stated reason rather than a number that looks real but communicates nothing coherent (`PERatio.md`'s Sprint 7 addendum).

**Q6: What's the difference between P/S and EV/Revenue, and why does Athena keep them as two separate multiples?**
A: They differ by exactly the company's net debt (or net cash) position, scaled by revenue — P/S applies the multiple directly to get Equity Value, EV/Revenue must first produce Enterprise Value and then bridge through Net Debt. For a company with meaningful debt, P/S will look "cheaper" than EV/Revenue for a purely structural reason, not because the company is undervalued (`research/finance/PriceToSales.md`).

**Q7: Why is peer selection judgment (not just the math) the hardest part of Comparable Company Analysis?**
A: Because every downstream statistic and implied value is only as trustworthy as the peer group it's built from, and "comparable" isn't a formula — it depends on business model, revenue scale, market cap, geography, and growth profile, none of which a sector label alone captures (`research/finance/PeerSelection.md`).

**Q8: Why would a faster-growing company deserve a higher P/E than a slower-growing one, all else equal?**
A: A multiple capitalizes a single year's earnings into a price; a faster grower will have materially larger future earnings, so the market rationally pays more per dollar of *today's* earnings for it. Comparing two companies with very different growth rates on the same raw multiple, without adjusting for that, compares two different economic realities as if they were one (`ComparableCompanyAnalysis.md`).

**Q9: A Comps analysis and a DCF for the same company disagree meaningfully. What should an investor conclude?**
A: Not that one is "wrong" — they answer different questions with different failure modes. DCF can be off if its forecast/discount-rate assumptions are off; Comps can be off if the peer group is mispriced or not genuinely comparable. The gap is a prompt to investigate which is more likely, not a verdict either way (`ComparableCompanyAnalysis.md`, `ComparableCompaniesProductDesign.md`).

**Q10: Why does Athena's Comps engine reuse the exact same `netDebt()`/`equityValue()` functions DCF already has, instead of writing new ones?**
A: `Equity Value = Enterprise Value − Net Debt` is the identical relationship regardless of how Enterprise Value was produced — summed discounted cash flows or a peer multiple applied to EBITDA/Revenue. Reusing one implementation avoids two copies of the same formula silently drifting apart over time (`research/finance/EquityValue.md`'s Sprint 7 addendum).

**Q11 (bonus): Why does Athena only compute percentiles (P25/P75) once at least 4 peer observations exist?**
A: Below 4 points, a linearly-interpolated percentile ends up extremely close to (or identical to) the min or max — it doesn't convey meaningfully different information from those two statistics despite looking like a more precise, distinct figure. Reporting it as unavailable is more honest than a number that looks more rigorous than the underlying sample actually supports (`research/finance/TradingMultiples.md`, `research/engineering/StatisticalAggregation.md`).
