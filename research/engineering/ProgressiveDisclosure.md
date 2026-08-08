# Engineering Concept: Progressive Disclosure

## What it is

A UI pattern where a page shows a conclusion first and defers supporting detail behind a deliberate action (a click, a tab switch) rather than presenting everything at once. Overview is built entirely around it: every section is a condensed summary of a full detail view that already exists elsewhere in the app, reachable in exactly one click.

## Why we use it

The sprint's core product problem was that Athena's information, while correct, required visiting six tabs to form one opinion about a company. Progressive disclosure is the direct technical answer to that: it lets a single page carry the *conclusion* of five separate engines (company profile, ratios, business analysis, market data) without becoming five pages' worth of tables. The alternative — showing everything on one page — doesn't remove information, it just removes the *hierarchy* between "what you need to know now" and "what you need to know if you dig in," which is precisely the problem being solved.

## Alternatives considered

- **One long page with every metric from every module.** Rejected explicitly by the sprint's product principle ("insights over raw data... do not display every available metric") — this is the state Athena was actively moving away from.
- **Collapsible/expandable sections on the same page (accordion pattern).** A legitimate alternative for progressive disclosure that keeps the user on one URL. Rejected here because Athena already has a working, bookmarkable tab architecture (`Tabs.jsx` + route-per-tab) that every other module uses — introducing a second disclosure mechanism (accordions) alongside the existing one (tabs) would fragment the navigation model for no real benefit, when the existing tabs already serve as the "expand" affordance.
- **Modal/drawer detail views launched from Overview.** Rejected for the same reason — it would be a second navigation paradigm competing with the tab bar that already works and that users already build muscle memory around.

## Trade-offs

- **Pro:** Overview stays short and fast to scan regardless of how much detail exists behind it — the health score component breakdown, the full 5–7 insight list's context, the full ratio table, and the interactive price chart can all keep growing in their own tabs without Overview growing at all.
- **Pro:** reuses an existing, proven navigation mechanism (route-per-tab) instead of inventing a new one, so users don't have to learn two different ways to "see more" in the same app.
- **Con:** information that's genuinely useful but doesn't cleanly summarize into one line (e.g., the historical price chart, the health score's five component scores) is invisible on Overview by design — a user who wants that detail *must* know to click through; there's no partial preview. This is an accepted cost of the pattern, not an oversight — see the product doc's discussion of why a chart specifically was left out.

## How Athena implements it

Two concrete mechanisms: (1) drill-down links — Financial Health's "View full breakdown →" into Business Analysis, Market Performance's "View details →" into Market Intelligence, and a footer linking to every remaining tab; (2) deliberate omission — Overview shows a health *score* (one number) rather than its five components, shows five *period returns* rather than the price chart that produced them, and shows the top-priority insights the analysis engine already selected rather than re-deriving a longer list. Nothing on Overview is a truncated preview of a longer list rendered inline (e.g., "show 3 of 11 ratios, click to see more") — each summary is either the single most important figure (the health score) or a complete-in-itself smaller set (five performance periods, five business-performance rows), with the *rest* of the detail living entirely in its own tab rather than partially bleeding into Overview.

## Interview questions

1. *"How is progressive disclosure on Overview different from just showing a paginated or truncated list?"* — Tests whether the candidate distinguishes *summarization* (showing the single number that matters, e.g., one health score standing in for five component scores) from *truncation* (showing the first N of a longer list and hiding the rest) — Athena deliberately does the former; truncation would still be "raw data, just less of it."
2. *"Why reuse the existing tab bar for drill-down instead of building a dedicated 'expand' interaction for Overview specifically?"* — Should identify that a second, page-specific navigation pattern would fragment the mental model users already have (tabs = how you see more in this app), and that reusing an existing, working mechanism is lower engineering cost and lower learning cost than a bespoke one, even though a custom accordion or drawer might look slightly more tailored to Overview specifically.
