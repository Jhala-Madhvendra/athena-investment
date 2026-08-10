# Peer Selection

## 1. Definition

Peer selection is the process of choosing which companies belong in the comparison group a target company's implied valuation will be built from. It is the single most consequential judgment call in a Comparable Company Analysis — get the peer group wrong, and every downstream multiple, statistic, and implied value inherits that mistake.

## 2. The "formula" (there isn't one)

Deliberately, there is no scoring formula here. The sprint brief this feature was built against is explicit: *"Do NOT automatically assume that companies in the same sector are automatically comparable."* Peer selection in Athena is, for this version of the feature, **entirely manual and user-controlled** — see `PeerSelectionEngine.md` for the engineering side of that decision.

## 3. Intuition

Two companies sharing a sector label ("Technology") can have nothing in common economically — a hardware manufacturer and a SaaS company both sit in "Technology" yet have entirely different margin structures, capital intensity, and growth profiles. A sector or industry tag is, at best, a starting filter, never a comparability verdict.

## 4. Why peer selection matters

Every multiple's peer statistic is only as trustworthy as the peer group it's computed from. A peer group padded with companies that merely *sound* similar, but differ meaningfully in growth, margin, or capital structure, will produce a Median or Mean that reflects that mismatch — not a genuine read on how the market values businesses like the target.

## 5. When manual selection is appropriate (now)

For Athena's first version of this feature, manual selection is the right default specifically *because* automatic similarity scoring is a hard, genuinely judgment-laden problem (see Section 7) that the team has not yet built — and a wrong automatic recommendation, presented with algorithmic authority, is more dangerous than an empty list the user has to fill in themselves. See `ComparableCompaniesProductDesign.md` for the full product reasoning.

## 6. When it can go wrong

- **Sector-only filtering** — the mistake this doc opens with.
- **Anchoring on the first few companies that come to mind** rather than systematically considering growth, scale, and geography.
- **Including a peer for convenience** (because its data happens to already be in Athena) rather than because it's genuinely comparable — see Section 7's "geography" and "revenue scale" factors specifically.
- **Not revisiting the peer group** as the target's own business evolves — a comparable set chosen when a company was pre-revenue may be entirely wrong once it matures.

## 7. What makes a company comparable

The factors an analyst should weigh, none of which Athena currently scores automatically:

- **Industry and business model** — not just the sector label, but *how the company actually makes money* (marketplace vs. direct sales, subscription vs. transactional, asset-heavy vs. asset-light).
- **Revenue scale** — a $50M-revenue company and a $50B-revenue company in the same industry are rarely priced the same way, even adjusted for growth.
- **Market capitalization** — a rough proxy for maturity, analyst coverage, and liquidity.
- **Geography** — different markets price risk, growth, and cost of capital differently; a peer group mixing developed- and emerging-market companies conflates those differences into one multiple.
- **Growth profile** — see `ComparableCompanyAnalysis.md`'s note on why faster-growing companies rationally deserve higher multiples.

## 8. How Athena implements it

`GET /api/valuation/:ticker/comps/available-peers` (`comps.peerSelector.js`) surfaces **candidates only** — companies already known to Athena (previously searched or imported), queried directly from the `Company` and `FinancialStatement` models, with each candidate's sector, industry, market cap, and (where imported) latest revenue shown for the user to evaluate. It deliberately does not call any live market API for this — browsing candidates should be fast, and doesn't need a live quote per row. Every response includes a `limitation` string, verbatim explaining that this is a **convenience list of known companies, not a computed similarity or recommendation set.** `comps.validator.js` then enforces the mechanical guardrails once the user has made their choice: the target cannot be its own peer, duplicates are silently removed, and at least 2 peers are required.

## 9. Common mistakes

- **Mistaking "candidate" for "recommended."** Athena's peer-selection endpoint intentionally never uses recommendation language, precisely to avoid this.
- **Selecting peers Athena has no data for.** A ticker can be added to the peer list, but if it has no imported financial statements it's excluded from the calculation with a stated reason (`comps.service.js`'s `unavailablePeers`) — never silently dropped without explanation, and never fabricated.
- **Treating "same sector" as sufficient justification**, the specific mistake this doc's Section 3 warns against.

## 10. Interview questions

*"Why does Athena not automatically suggest 'comparable' companies for a target?"* — Because a wrong automatic suggestion, presented with the implicit authority of "the system chose this," is more dangerous than an empty list a human has to fill in — see `ComparableCompaniesProductDesign.md`. Real comparability judgment (business model, growth trajectory, geography) requires context Athena's current data model (sector/industry tags, market cap, revenue) is nowhere near rich enough to capture reliably.

*"What data would you need to build a genuine automatic peer-recommendation engine, and why doesn't Athena have it yet?"* — At minimum: a finer-grained business-model classification than sector/industry tags (e.g. actual revenue-model taxonomy), a growth-and-margin-trajectory fingerprint per company (not just a point-in-time snapshot), and some notion of competitive-set data (who a company itself, or analysts, actually consider its peers). Athena today has sector/industry strings, a point-in-time market cap, and whatever revenue has been imported — enough to *inform* a human's judgment, not enough to responsibly automate it.
