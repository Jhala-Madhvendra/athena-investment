# Equity Value

## 1. Definition

Equity Value is what's actually left over for shareholders after everyone else with a prior claim on the business — principally debt holders — has been accounted for. It's the number that, divided by diluted shares outstanding, produces a per-share intrinsic value comparable to the stock's market price.

## 2. The formula

```
Equity Value = Enterprise Value − Net Debt
where Net Debt = Total Debt − Cash & Cash Equivalents
```

(Equivalently: `Equity Value = Enterprise Value − Debt + Cash`.)

## 3. Intuition

Enterprise Value is the value of the whole operating business, belonging to everyone who financed it. Debt holders have first claim — in a hypothetical full liquidation or sale, they'd need to be paid off (or their debt assumed) before equity holders see anything. Subtracting Total Debt removes what's earmarked for them. Adding back Cash reflects the flip side: cash on the balance sheet isn't a claim against the business, it's an asset equity holders effectively already own outright (an acquirer buying the whole company would get to keep that cash, net of what it costs to retire the debt) — hence "net debt," not gross debt.

## 4. Why investors use it

Equity Value is the bridge from a capital-structure-neutral valuation (EV) to a number that means something for an actual shareholder: what their claim on the business is worth in total, which — divided by share count — is directly comparable to the stock's quoted price. This comparison (IntrinsicValue.md) is the entire point of running a DCF from an individual investor's perspective.

## 5. Limitations & assumptions

Equity Value inherits every assumption behind Enterprise Value (see EnterpriseValue.md). It also assumes the latest reported Debt and Cash balances are a fair snapshot of the company's net financial position *as of today* — a company that issued a large amount of debt or made a large acquisition the day after its last reported balance sheet won't be reflected until the next filing. A negative Net Debt (more cash than debt — a "net cash" position) is not an error; it correctly means Equity Value exceeds Enterprise Value, which Athena's engine and tests explicitly handle as a valid, common case (e.g., cash-rich technology companies).

## 6. How Athena implements it

`backend/valuation/dcf/dcf.formulas.js`:

```js
const netDebt = (totalDebt, cashAndEquivalents) => totalDebt - cashAndEquivalents;
const equityValue = (enterpriseValueAmount, netDebtAmount) => enterpriseValueAmount - netDebtAmount;
```

Both `totalDebt` and `cashAndEquivalents` come from the company's latest stored balance sheet (`dcfInput.mapper.js`'s `buildCapitalStructure()`), not user-entered assumptions — these are objective, reported facts the user doesn't need to (and can't) override, distinguishing them from the genuine *assumptions* (growth, margins, WACC inputs) that do belong to the user. The computed `netDebt` and `equityValue` are both returned in full in the API response and shown as their own line items in `DCFSummary.jsx`, continuing the calculation-transparency chain from Enterprise Value down to the final per-share figure.

## 7. Common mistakes

- **Using gross debt instead of net debt.** Ignoring cash on the balance sheet overstates what's "owed" and understates Equity Value, especially for cash-rich companies.
- **Assuming Net Debt is always positive.** A net-cash company (cash > debt) is common and not an edge case to special-case away — Athena's `netDebt()` and `equityValue()` handle it as ordinary arithmetic, and it's covered by an explicit test (`calculateDCF`'s "handles a net-cash capital structure" test).
- **Forgetting Equity Value still needs to be divided by share count.** Equity Value is a total dollar figure for the whole company — it only becomes comparable to a stock's quoted price after dividing by diluted shares outstanding (IntrinsicValue.md).

## 8. Interview questions

*"A company has an Enterprise Value of $1.5B, $400M of debt, and $600M of cash. What's its Equity Value, and what does the direction of that adjustment tell you?"* — Net Debt = $400M − $600M = −$200M (a net cash position), so Equity Value = $1.5B − (−$200M) = $1.7B — *higher* than Enterprise Value. The direction makes sense: the company's cash pile belongs to shareholders outright and isn't offset by enough debt to matter, so equity holders' claim is worth more than the "pure operating business" value alone.
