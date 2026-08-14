# Watchlist vs. Portfolio

## 1. Definition

**Watchlist** = "I am interested in this company." **Portfolio** = "I own this investment." They are deliberately separate concepts in Athena, not two views of the same underlying data.

## 2. The "formula"

Not applicable — this is a conceptual distinction, not a calculation. The formula difference is really a *data* difference:

```
Watchlist entry  = { ticker, addedAt }
Portfolio holding = { ticker, shares, averagePurchasePrice, purchaseDate }
```

A watchlist entry carries no financial commitment; a holding is inseparable from one.

## 3. Intuition

Research and ownership are different mental modes. Watching a company costs nothing and carries no stake — it's how you build a mental map of what's interesting before committing capital. Owning a company means real money is at risk and every number attached to it (cost basis, gain/loss, return) only exists *because* you bought in.

## 4. Why investors care

Conflating the two invites a specific behavioral trap: treating "I've been watching this and it's up 20%" as equivalent to "I own this and I'm up 20%." They are not the same feeling or the same financial reality, and a product that blurs them risks reinforcing FOMO-driven decisions (chasing a watched stock's paper gains) or hindsight bias (retroactively feeling like a missed watchlist gain was a real loss).

## 5. Limitations

- **Athena doesn't auto-sync the two.** Adding a company to your Portfolio doesn't add it to your Watchlist, and vice versa — a manual "Add to Watchlist" action exists on each Portfolio holding row (and reuses the exact same `POST /api/watchlist` endpoint), but nothing happens automatically. This is intentional, not an oversight: automatic syncing would blur the exact line this document is about.
- **A company can legitimately exist in both** — watching a stock you also own (to track sentiment/price separately from your position) is a normal, supported use case, not a contradiction.

## 6. How Athena implements it

Two entirely separate collections with different mutation semantics: `Watchlist` (one embedded array per user, ticker either present or absent, no per-entry edit) vs `Holding` (one document per purchase lot, independently editable/deletable) — see WatchlistArchitecture.md and PortfolioDataModel.md for why the underlying data models are structurally different, not just conceptually different. Two separate API surfaces (`/api/watchlist`, `/api/portfolio`) reinforce the same boundary at the product layer.

## 7. Common mistakes

- **Treating "add to watchlist" as an implicit investment decision** — it's the opposite; it's explicitly a zero-commitment action.
- **Building one unified "companies I care about" list** that mixes the two — this was considered and rejected for Sprint 9 specifically because the sprint's own product principle is "do not mix the two concepts."

## 8. Interview questions

1. *"Why not just add a `owned: boolean` flag to a single unified list instead of two separate features?"* — Because the two need fundamentally different data (a holding needs shares/price/date; a watchlist entry needs neither) and fundamentally different UX (editing a holding is a core action; a watchlist entry has nothing to edit). A shared boolean flag would still require two different data shapes underneath, so the "unification" would be cosmetic while adding complexity everywhere the distinction actually matters.
2. *"What's the product risk of merging Watchlist and Portfolio into one page?"* — Users could misread paper interest as paper ownership, or vice versa — e.g. seeing a 30% "gain" on a stock they were only watching (measured from when they added it, not from a purchase) could be mistaken for actual investment performance. Keeping them visually and structurally separate keeps "research" and "money at risk" from bleeding into each other.
