# Product Concept: The Financial Health Dashboard

## Why users prefer insights over raw data

The Financial Statements tab already gives a user every number Yahoo Finance reports — but a raw `totalRevenue` of `391,035,000,000` doesn't answer the question an investor actually opened Athena to ask: *"is this a good business, and is it in good financial health?"* Turning three raw statements into an answerable question requires mental math (division, percentage conversion, comparison against some notion of "normal") that most users either can't do quickly, don't trust themselves to do correctly, or simply don't want to do by hand every time they look up a company.

This is the core product bet of Sprint 2: **the Ratio Engine moves Athena from "a data viewer" to "an analysis tool."** A user who searches Apple and clicks Financial Analysis should walk away in ten seconds with a directional read — "profitable, liquid, moderately leveraged, efficient" — that would have taken minutes of manual calculation and cross-referencing to reconstruct from the raw statements. That speed is the actual value proposition; the numbers were already there, but nobody could act on them fast enough to matter.

## Why ratios are grouped into categories

Eleven ungrouped numbers in a flat list ask the user to already know finance well enough to mentally sort them — exactly the expertise gap the product is trying to close. Grouping into **Profitability, Liquidity, Solvency, Cash Flow, and Efficiency** does two things:

1. **It matches how professional analysts actually think.** These five categories are the standard lens for financial statement analysis taught in every finance curriculum and used in every equity research report — so the grouping isn't an arbitrary UI choice, it's teaching the user the *right mental model* for reading a business, one card at a time.
2. **It lets a user answer a narrower question quickly.** "Is this company at risk of running out of cash?" only requires reading the Liquidity and Solvency groups — the user doesn't have to scan past eight unrelated numbers to find the two that answer their actual concern.

This grouping is also why the API response shape (`{ profitability, liquidity, solvency, cashFlow, efficiency }`) mirrors the categories exactly — the backend contract and the product's mental model are the same structure, so no translation layer is needed between what the engine computes and what the page displays.

## How this improves decision-making

A user forming an investment view typically needs to triangulate across *multiple* categories before a decision is defensible — e.g., "high ROE" alone is a weak signal (it might just be leverage — see [[ROE]] and [[DebtToEquity]]), but "high ROE **and** conservative Debt-to-Equity **and** healthy Free Cash Flow" is a much stronger combined signal. By surfacing all five categories on one screen instead of forcing the user to look up and manually combine numbers from disconnected sources, Athena shortens the loop between "curiosity about a company" and "a reasoned judgment about it" — which is the same loop every subsequent Athena feature (DCF valuation, AI-generated reports, investment recommendations) is designed to shorten further. The Ratio Engine is the first rung of that ladder: it's the layer that turns statements into *comparable, groupable signal*, which is the raw material every higher-level insight in later sprints will be built from.
