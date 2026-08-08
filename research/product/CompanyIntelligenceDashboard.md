# Company Intelligence Dashboard

## 1. What user problem does the dashboard solve?

Before Sprint 5, Athena's information was correct but scattered: a user researching a company had to visit six separate tabs (Income Statement, Balance Sheet, Cash Flow, Financial Analysis, Business Analysis, Market Intelligence) to answer one question they'd naturally ask first — "how is this company doing, overall?" There was no single page that answered "what am I looking at, is it healthy, and what should I pay attention to" in the time it takes to glance at a screen. The Overview dashboard is that page: a company search now lands directly on a summary that answers the five questions in the sprint's user story, with every deeper number still one click away.

## 2. Why should insights appear before raw financial statements?

Because the question an investor actually asks first is never "what is this company's total operating expenses line item" — it's "should I care about this company at all." Raw statements answer a question only after someone already knows which numbers matter and how to interpret them; insights answer the question directly. Putting statements first would mean everyone has to do the same interpretation work Athena's engines have already done automatically (Sprint 2's ratios, Sprint 3's health score and trend detection) — Overview exists specifically so that work isn't repeated by every user, every time.

## 3. How did we decide what metrics belong above the fold?

Every metric on Overview answers one of the five explicit questions in the sprint's user story (what company, how's the business, how healthy, how's the stock, what to investigate) — nothing was added because it existed in an API response and seemed useful. Concretely: Company Header answers "what am I looking at" with the minimum identifying facts (name, ticker, sector, price) rather than the full company profile (no employee count, no long description, no logo — all of which exist in the Company API but don't help someone decide whether to keep reading). Financial Health leads with a single 0–100 score before its supporting CAGR/ratio figures, because "is this healthy" has one true above-the-fold answer and five supporting ones. We deliberately left "Current Price" out of the Market Performance section even though the sprint's spec lists it there, since it's already shown prominently in the header seconds above — repeating it would be raw-data padding, not a second insight.

## 4. What information did we intentionally leave out?

Full statement line items (every field on the income statement, balance sheet, cash flow — dozens of numbers) stay in their existing tabs. The full insight list beyond what the analysis engine already prioritizes (it caps at 5–7) isn't re-filtered or expanded. Ratio categories not directly tied to one of the five user-story questions (Liquidity's Current/Quick Ratio, Efficiency's Asset Turnover) don't appear on Overview at all — they're one click away on Financial Analysis for someone who wants them, but showing all 11 ratios above the fold would recreate exactly the "too many tables" problem the dashboard exists to fix. Historical price charts are also absent from Overview by design (see the "trade-offs" section below) — the numbers that matter (five period returns) are here; the chart that explains *how* the stock got there is a drill-down, not a summary.

## 5. How does progressive disclosure improve the experience?

Two mechanisms carry it here. First, structurally: Overview shows the conclusion (score, direction, one sentence) and every section either links or is one tab-click from the full detail behind that conclusion (Financial Health → "View full breakdown" into Business Analysis; Market Performance → "View details" into Market Intelligence; a footer of links to every remaining tab). Second, technically: each of Overview's five data sources loads and fails independently rather than gating the whole page on the slowest or least-reliable call — a user sees the company identity and price within moments even if, say, the ratio service is momentarily slow, rather than staring at one blank page waiting for everything.

## 6. What trade-offs were made between completeness and simplicity?

The biggest one: Overview shows zero charts, even though a historical price chart already exists and could technically be dropped in with minimal work. A chart earns its place when it materially improves understanding beyond what a number already conveys — and on a page whose whole purpose is "the fast, condensed read," a chart asks for more visual attention than five clearly-labeled percentage cards, for information the numbers already state. The chart stays where it already lives, on Market Intelligence, reachable in one click for anyone who wants the shape of the trend rather than its headline figures. The second trade-off: the "Profit" row in Business Performance shows a trend direction with no matching narrative insight, because no insight category in the existing engine tracks net-income growth specifically (only revenue growth and operating margin are covered). We chose to show the row honestly incomplete rather than force-fit an unrelated insight or fabricate new categorization logic on the frontend, which would have duplicated calculation authority that belongs in the backend engine.

## 7. What would we test with real users?

Whether a first-time visitor can answer "would I want to look into this company further" within roughly five seconds of the page finishing load, without scrolling. Whether the Financial Health score, on its own, is legible enough that users trust the summary before reading the explanation sentence beneath it — or whether they scroll past the gauge entirely to hunt for numbers they already recognize (P/E, market cap), which would suggest the summary isn't yet doing its job. Whether the drill-down links get clicked at all, or whether users only ever use the top tab bar — if nobody clicks "View full breakdown," that action link is dead weight and the health-score card should probably just live inside Business Analysis's own summary instead. And directly: whether the "Coming Soon" Valuation tab sets the right expectation, or whether users click it repeatedly assuming it's broken.

## 8. What metrics would measure dashboard success?

- **Time-to-first-interaction on a fresh ticker search** — did Overview load and become readable meaningfully faster than the old default (Income Statement, a raw table) did.
- **Drill-down click-through rate** — what fraction of Overview visits result in at least one click into a detail tab; too low might mean Overview is either sufficient on its own (good) or so shallow nobody trusts it (bad) — this metric alone can't distinguish the two, which is exactly why it needs to be paired with qualitative user testing (question 7).
- **Bounce rate directly from Overview** — do users leave the app from this page more or less often than they used to leave from Income Statement, as a proxy for whether the summary answers what they came for.
- **Tab distribution shift** — whether the other five tabs see less traffic post-launch (evidence Overview is absorbing work they used to do) without dropping to zero (evidence it's still a legitimate summary, not a replacement for real research).

## Product Management interview questions

**Q1: Why does Overview omit a full insight list or historical chart when both were readily available to add?**
A: Because the sprint's own product principle — insights over raw data, progressive disclosure — only works if it's actually enforced against convenience. Every "it's easy to add, might as well" addition erodes the thing that makes Overview different from a tab that happens to load first. The chart specifically: a chart demands more visual real estate and attention than the numeric summary it would duplicate, for a page whose entire value proposition is speed of comprehension.

**Q2: How would you decide whether the "Business Analysis" tab should be removed now that Overview covers most of its content?**
A: Not from intuition — from the click-through data described in question 7. If drill-down traffic into Business Analysis from Overview's "View full breakdown" link is high, it's earning its place as a genuine detail view. If it's near zero, that's evidence Overview's summary is already sufficient and the tab is now redundant surface area, at which point the honest move is to fold its unique value (the CAGR component breakdown) into Overview directly rather than maintain a page nobody visits.

**Q3: The sprint spec explicitly lists "Current Price" as a Market Performance metric, but it's missing from that section. Walk me through that call.**
A: It's not missing — it's deliberately not repeated. It's already the second thing a user sees, in the header, seconds above. Repeating a number a user just read isn't a second insight; it's the "don't overload the page" principle from the same spec being taken seriously over a literal read of a metric checklist. When two instructions from the same brief are in tension, the resolution should serve the stated product principle, not the itemized list.

**Q4: How would you prioritize what to build next for this dashboard given limited engineering time?**
A: I'd want the click-through and time-to-comprehension data from question 8 before committing to anything — but my working hypothesis, given the sprint explicitly deferred it, is a working Valuation tab. Every other section on Overview answers "how is this business doing," and Market Performance answers "how is the market pricing it" — but nothing yet answers whether that price is reasonable relative to the business, which is arguably the single most-asked investor question this dashboard doesn't yet touch.

**Q5: This dashboard pulls from five separate backend services on every page load. How do you think about the product risk of that, not just the engineering risk?**
A: The product risk is that one slow or failing service makes the whole page feel broken, even if four of five sections are fine. That's why every section fails and loads independently rather than gating on the slowest call — a user should be able to trust the sections that *did* load, rather than losing confidence in the whole page because one metric shows an error. A product that visibly degrades gracefully reads as more reliable than one that occasionally shows nothing at all, even though the underlying failure rate is identical.
