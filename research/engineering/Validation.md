# Engineering Concept: Validation

## What it is

Validation in the Ratio Engine happens at two distinct layers, each catching a different failure mode:

**1. Existence validation — [ratio.validator.js](../../backend/ratio/ratio.validator.js).** Before any ratio math runs, this checks that the stored financial statement actually has the shape the [[FormulaEngine]] assumes: an object, with `incomeStatement`, `balanceSheet`, and `cashFlow` sub-objects all present.

```js
const validateRatioInput = (statement) => {
  const errors = [];
  if (!isObject(statement)) { ... }
  if (!isObject(statement.incomeStatement)) errors.push("incomeStatement is required.");
  if (!isObject(statement.balanceSheet)) errors.push("balanceSheet is required.");
  if (!isObject(statement.cashFlow)) errors.push("cashFlow is required.");
  return { isValid: errors.length === 0, errors };
};
```

If this fails, [ratio.service.js](../../backend/ratio/ratio.service.js) throws a `RatioValidationError` (HTTP 422) before the calculator ever runs — no formula function has to defend against a missing `incomeStatement` object entirely.

**2. Field-level safety — `safeDivide()` inside [ratio.formulas.js](../../backend/ratio/ratio.formulas.js).** Even with the sub-objects guaranteed to exist, individual numeric *fields* inside them (e.g., `totalRevenue`) can still be missing, `undefined`, or the denominator can be `0`. `safeDivide` is the single choke point that turns any of those into a clean `null` instead of `NaN`, `Infinity`, or a thrown `TypeError`.

There's also a **third, upstream layer** not part of the Ratio Engine itself: [financials.service.js](../../backend/financials/financials.service.js) throws a `CompanyNotFoundError` (404) or `FinancialStatementsValidationError` (422) if the ticker doesn't exist or the underlying statements failed their own shape validation at import time — this is what produces the "Missing financial statements" error case before the Ratio Engine is even reached.

## Why we chose this design

**Fail at the boundary, trust everything after it.** Each layer validates exactly what the layer above it cannot assume, and nothing more. `ratio.validator.js` doesn't check individual numeric fields (that's `safeDivide`'s job); `safeDivide` doesn't check whether `incomeStatement` exists (that's the validator's job, and by the time a formula runs, it's already guaranteed). This is what lets 11 formula functions stay simple one-liners instead of every function starting with five defensive `if` checks.

Splitting "does the object shape exist" from "is this specific number safe to divide" also produces **more useful error messages**. A missing `balanceSheet` becomes a 422 with `["balanceSheet is required."]` — actionable and specific — rather than a generic 500 crash from deep inside a formula trying to read `undefined.totalAssets`.

## Alternatives considered

- **Try/catch around the whole calculation and return a generic 500 on any failure.** Rejected: this treats "data is incomplete" (an expected, recoverable case — an investor just sees "N/A" on a card) the same as "the server has a bug" (an unexpected case that should alert engineering). Collapsing those into one status code loses information both the frontend and on-call engineers need.
- **Schema validation library (e.g., Joi, Zod) for the statement shape.** A reasonable choice at larger scale, but for three top-level required keys, a hand-written check is simpler, has zero new dependencies, and is easier for a newer engineer to read without learning a validation DSL.
- **Let Mongoose's own schema validation (required fields on `financials.model.js`) be the only validation.** Rejected as the *sole* line of defense — Mongoose validates on write, but the Ratio Engine reads from storage and must defend against data that predates a schema change, was written by a different code path, or is simply incomplete for a given fiscal year (e.g., a company that doesn't break out `accountsReceivable`).

## Tradeoffs

- **Pro:** every failure mode maps to a distinct, correct HTTP status (404 vs 422 vs a clean `null`/"N/A" — never a raw 500 for expected data gaps).
- **Pro:** formulas stay simple because they can trust the shape-level guarantees already checked upstream.
- **Con:** the same "is this a number" style check (`typeof x === "number"`) is repeated across `safeDivide`, `quickRatio`, and `freeCashFlow` rather than centralized in one shared field-access utility — an acceptable duplication for now, since each check is one line and the alternative (a generic "safe field getter") would add a layer of indirection for marginal benefit at this scale.
