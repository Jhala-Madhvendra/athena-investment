# Earnings Events

## 1. What it means

An earnings event is a company's scheduled disclosure of its financial results for a period (usually a quarter) — revenue, net income, EPS, and typically forward guidance — plus the market's reaction to how those results compare against analyst expectations. The number itself and the *surprise* relative to consensus are two separate things that both matter.

## 2. Why investors care

Earnings events are the single most reliable, recurring, structured data point in equity research — every public company produces one on a predictable cadence, unlike ad-hoc news. They're also the moment a company's own management publicly commits to a version of reality (results, guidance) that can be checked against actual outcomes next quarter, making earnings history a track record of credibility as much as a performance record.

## 3. How analysts use it

Analysts build a pre-earnings estimate (their own model's expected revenue/EPS), compare it to the actual reported number and to consensus, and use the *direction and size* of the surprise to update forward assumptions — a beat driven by one-time items is read differently than a beat driven by durable margin expansion. Guidance given alongside results often matters more to the stock reaction than the historical numbers themselves, since it's the market's best forward-looking input until the next event.

## 4. How it relates to financial statements

An earnings event *is* the announcement of a financial statement — the income statement, and often abbreviated balance sheet/cash flow figures, released ahead of (or alongside) the formal 10-Q/10-K filing. It's the fastest path from "quarter closed" to "public financial statement," which is why it's the highest-signal recurring news category Athena classifies (`Earnings` in `news.classifier.js`).

## 5. How it can affect valuation

A reported beat or miss directly updates the trailing figures a DCF's revenue growth and margin assumptions are derived from (see `research/finance/RevenueCAGR.md`, `research/finance/DCF.md`); guidance updates the *forward* assumptions the model projects. A large enough surprise, positive or negative, is one of the more common triggers for an analyst to fully re-run a valuation rather than treat it as noise.

## 6. Limitations

- **A beat/miss against consensus is relative, not absolute** — a company can miss consensus while still growing healthily, or beat consensus off a weak prior-year base.
- **One-time items distort the headline number** — a tax benefit or asset sale can inflate EPS without reflecting the underlying business.
- **Guidance is management's own forecast**, not an audited figure, and carries its own incentive biases.

## 7. How Athena uses it

Athena's news classifier flags earnings-related headlines (keywords: "earnings," "quarterly results," "EPS," "beat estimates," "guidance," etc. — see `backend/news/news.classifier.js`) into the `Earnings` category, deterministically and without judging materiality. The classification is a *label*, not an analysis — Athena's actual earnings-driven metrics (revenue CAGR, margin trends, health score) are computed independently by the Sprint 2/3 engines from stored financial statements, not derived from the news event itself. The AI Research Analyst's "Recent Developments" section (Sprint 10, see `AIContextWithExternalSources.md`) is the one place an earnings *event* and Athena's own *computed* metrics are explicitly connected in prose — and even there, only as an observation, never as a recalculation.

## 8. Interview questions

1. *"Why can a stock fall on an earnings beat?"* — Because the market prices expectations, not just results; if guidance disappoints, or the beat is driven by unsustainable one-time items, or the "whisper number" (informal expectations above published consensus) was higher than the reported beat, the stock can fall even though the headline number technically beat consensus.
2. *"How does Athena distinguish an earnings headline from a generic revenue headline?"* — By keyword rule, not semantics: `news.classifier.js` weights title matches on earnings-specific terms ("EPS," "quarterly results," "Q1"–"Q4") higher than the more general "Revenue / Financial Results" category's terms, and falls back to "Other" rather than guessing when the signal is ambiguous or the two categories tie.
