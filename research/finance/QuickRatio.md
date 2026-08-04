# Quick Ratio

## 1. What it is

The Quick Ratio (a.k.a. the "Acid-Test Ratio") is a stricter version of the Current Ratio. It measures a company's ability to cover current liabilities using only its *most liquid* assets — cash and receivables — deliberately excluding inventory.

## 2. Why investors care

Inventory is the least reliable current asset: it can be slow-moving, obsolete, or only sellable at a discount in a crunch. By excluding it, the Quick Ratio answers a harder, more conservative question than the Current Ratio: "could this company meet its short-term obligations *without* having to sell inventory?" This matters most for businesses where inventory is bulky, slow-turning, or vulnerable to obsolescence (manufacturers, hardware retailers) — for those companies, a healthy Current Ratio propped up entirely by inventory can mask real liquidity risk that the Quick Ratio exposes.

## 3. The formula

```
Quick Ratio = (Cash & Cash Equivalents + Accounts Receivable) / Current Liabilities
```

Note: the classic textbook formula is `(Current Assets − Inventory) / Current Liabilities`. Athena uses the equivalent "build up the liquid assets directly" form below, since inventory isn't a separately stored field.

## 4. Which financial statements are used

**Balance Sheet only.** `cashAndCashEquivalents`, `accountsReceivable`, and `currentLiabilities` are all balance sheet line items.

## 5. How Athena calculates it

`quickRatio(statement)` in [ratio.formulas.js](../../backend/ratio/ratio.formulas.js):

```js
const quickRatio = (statement) => {
  const cash = statement.balanceSheet.cashAndCashEquivalents;
  const receivables = statement.balanceSheet.accountsReceivable;
  const currentLiabilities = statement.balanceSheet.currentLiabilities;

  const numerator = typeof cash === "number" && typeof receivables === "number" ? cash + receivables : null;
  return safeDivide(numerator, currentLiabilities);
};
```

This formula is slightly more defensive than most others in the engine: because it needs to **sum two fields before dividing**, it explicitly checks both are numbers before adding them — if either `cash` or `receivables` is missing, the numerator is set to `null` rather than silently computing with `NaN` (e.g., `undefined + 500`). Passing `null` into `safeDivide` then correctly short-circuits to a `null` result, which the frontend renders as "N/A" rather than a misleading number.

## 6. Interview question

*"A company's Current Ratio is 2.0 but its Quick Ratio is 0.4. What does that gap tell you, and what would you want to check next?"*

(Correct answer: the bulk of current assets is tied up in inventory. Next step: check inventory turnover / days-inventory-outstanding to see if that inventory is actually moving, or if it's stale — the gap alone doesn't prove a problem, but it's the trigger to look closer.)
