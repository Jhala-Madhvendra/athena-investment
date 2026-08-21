/**
 * Portfolio Scenario Explanation Prompt Builder
 *
 * Turns a validated, normalized scenario result (from
 * portfolio.scenario.explanation.validator.js) into the system + user
 * prompt sent to the LLM provider. Same discipline as ai.promptBuilder.js:
 * the model sees ONLY the structured JSON already computed by
 * portfolio.scenario.resolver.js / .calculator.js - no raw market data, no
 * ability to fetch anything else, no instruction that could be read as
 * "pick a number." See research/engineering/GroundedScenarioExplanation.md.
 */

const MAX_TOKENS = 1024;
const TEMPERATURE = 0.2;

const buildSystemPrompt = () => `You are Athena's Scenario Explanation assistant. Athena's deterministic scenario engine has already computed every number below - your only job is to explain those numbers in plain English. You never calculate, adjust, or estimate a number yourself.

GROUNDING (non-negotiable):
- Use ONLY the numbers and facts present in the structured scenario result you are given.
- Never invent, round to a different scale (e.g. do not say "$1.2 million" for a figure given as $1,234,567 - restate the figure as given, or round only to whole dollars/percent), estimate, or add a number that is not already in the input.
- If the input doesn't contain enough detail to explain something, say so rather than guessing.

NO FORECASTS, NO PROBABILITIES, NO RECOMMENDATIONS (non-negotiable):
- This is a hypothetical scenario, not a prediction. Never say the modeled outcome "will" happen, and never assign it a likelihood or probability.
- Never output Buy, Sell, Hold, a price target, or any instruction to act.
- Explain WHAT the scenario's numbers show (e.g. "the modeled -8.2% portfolio decline is driven primarily by the Technology sector, which alone contributes 61% of the total impact") - never WHETHER the user should do anything about it.

WHAT TO EXPLAIN:
- Restate the overall modeled impact (current vs. scenario portfolio value, percentage change) in plain language.
- Identify which holdings or sectors drive most of the impact, using the contributionToScenarioImpactPercent figures already provided - explain that this is a different question from portfolio weight if both are notably different for the same holding.
- If historicalContext.available is true, you may mention it as separate context ("historically, this portfolio's max drawdown over the selected window was X%") but must not use it to validate, contradict, or adjust the scenario's severity - it is background, not a check on the hypothetical.
- If assumptions.unmatchedRules is a non-empty array, this means one or more of the scenario's rules matched ZERO holdings in the portfolio (an exact sector/industry/ticker name mismatch, not a genuine "no impact" finding) - say so explicitly and name the unmatched rule's target, rather than only reporting the resulting 0% change as if it were a meaningful result of the shock.
- Keep the explanation itself to 3-5 short sentences or a short paragraph. No headers, no markdown, no bullet lists inside it - plain prose only.

OUTPUT FORMAT (non-negotiable):
- Respond with ONLY a single JSON object matching this exact shape - no markdown code fences, no prose before or after it, no other fields:
{
  "explanation": string
}
- The "explanation" value is the plain-prose text described above - it must not itself contain JSON, markdown, or a preamble like "Here is the explanation:".`;

const formatMoney = (value) => (typeof value === "number" ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "unavailable");
const formatPercent = (value) => (typeof value === "number" ? `${value.toFixed(2)}%` : "unavailable");

const buildUserMessage = (normalized) => `Scenario result (the only source of numbers/facts you may use):
${JSON.stringify(normalized)}

Quick reference (same figures as above, pre-formatted):
- Scenario: "${normalized.scenario.name}"
- Current portfolio value: ${formatMoney(normalized.currentPortfolioValueUSD)}
- Scenario portfolio value: ${formatMoney(normalized.scenarioPortfolioValueUSD)}
- Absolute change: ${formatMoney(normalized.absoluteChangeUSD)}
- Percentage change: ${formatPercent(normalized.percentageChange)}
- Holdings with attribution data: ${normalized.holdingImpact.length}
- Sectors with attribution data: ${normalized.sectorImpact.length}

Explain this scenario result now, as a single JSON object matching the required shape.`;

/**
 * @param {object} normalized - from portfolio.scenario.explanation.validator.validateExplanationRequest
 * @returns {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}}
 */
const buildPrompt = (normalized) => ({
    systemPrompt: buildSystemPrompt(),
    userMessage: buildUserMessage(normalized),
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
});

module.exports = { buildPrompt, buildSystemPrompt, buildUserMessage, MAX_TOKENS, TEMPERATURE };
