/**
 * AI Prompt Builder
 *
 * Turns a context object (from ai.contextBuilder.js) into the system +
 * user prompt sent to the LLM provider. Deliberately does NOT send raw
 * database documents or full financial statements - only the already-
 * compact context JSON (~1.6-2.0KB / ~400-500 tokens, see
 * research/engineering/TokenOptimization.md) plus a short set of framing
 * instructions.
 *
 * The system prompt is the single place that encodes every non-negotiable
 * rule from the Sprint 8 brief: grounding (never invent a number/fact),
 * no buy/sell/recommendation language, the FACT vs INTERPRETATION vs RISK
 * distinction, "Data unavailable" for missing sections, and a closed JSON
 * output schema. ai.validator.js re-checks all of this server-side after
 * the fact - the prompt is guidance, not enforcement.
 */

// Generous headroom above the ~1500-2500 tokens a full, richly-populated
// visible report needs: some providers' newer models (e.g. Gemini's
// "thinking" variants) spend a substantial, prompt-dependent chunk of
// maxOutputTokens on hidden reasoning tokens before ever emitting visible
// text - confirmed empirically against a real Athena context/prompt
// (thoughtsTokenCount 4400 alongside a 2149-token visible report, for one
// real ticker with 5 of 6 context sections available). A tight ceiling
// starves the visible output and produces a truncated, invalid-JSON
// response (finishReason: MAX_TOKENS) rather than a shorter report. This
// ceiling is a cap, not a target - non-thinking providers simply stop
// earlier at their natural completion and are unaffected by the higher
// number; well within every configured provider's own output limit
// (Gemini's outputTokenLimit alone is 65536 for this model).
const MAX_TOKENS = 12288;
const TEMPERATURE = 0.25;

const REPORT_JSON_SHAPE = `{
  "executiveSummary": string,
  "companyOverview": string,
  "businessPerformance": string,
  "financialHealth": string,
  "marketPerformance": string,
  "valuation": string,
  "strengths": string[],
  "risks": string[],
  "considerations": string[],
  "dataGaps": string[],
  "conclusion": string,
  "sectionEvidence": { [sectionName: string]: string[] }
}`;

const buildSystemPrompt = () => `You are Athena's AI Equity Research Analyst. You interpret financial analysis that Athena's deterministic engines have already calculated - you never calculate anything yourself.

GROUNDING (non-negotiable):
- Use ONLY the numbers, facts, and figures present in the context JSON you are given in the user message.
- Never invent, estimate, or extrapolate a number, percentage, company fact, valuation assumption, or peer metric that is not in the context.
- If a context section has "available": false, say "Data unavailable" for that aspect rather than guessing or omitting it silently.

NO INVESTMENT ADVICE (non-negotiable):
- Never output Buy, Sell, Strong Buy, Strong Sell, Hold, a price target, or any statement that the stock "will" rise or fall.
- Reframe valuation gaps as things for the reader to investigate, e.g. "the valuation model suggests further investigation of X assumption" - never as a directive to act.
- Use analytical language: "the analysis indicates...", "the company demonstrates...", "a key risk is...", "investors may want to investigate...".

FACT vs INTERPRETATION vs RISK/CONSIDERATION:
- Keep factual restatement (a ratio or price exactly as given in the context) separate from interpretive commentary (what a trend implies).
- "strengths" and "risks" must each be traceable to specific context values - do not include a qualitative claim unsupported by the data you were given.
- "considerations" covers analytical caveats and methodology limitations (e.g. an auto-selected peer set, an illustrative assumption) - flagged in the context itself where relevant.

OUTPUT FORMAT (non-negotiable):
- Respond with ONLY a single JSON object matching this exact shape - no markdown code fences, no prose before or after it:
${REPORT_JSON_SHAPE}
- Every string field must be non-empty. Narrative fields: 2-5 sentences. "strengths"/"risks"/"considerations": 3-6 short bullet-style entries each.
- "sectionEvidence" maps each narrative section name to an array of context field paths (from the "Evidence field paths you may cite" list in the user message) that support what you wrote in that section. Only use paths from that list - never invent a path.
- Do not include any field not listed in the shape above.`;

const buildUserMessage = (context, evidenceAllowList) => `Company: ${context.ticker}
Context generated at: ${context.generatedAt}

Structured Athena context (the only source of facts/figures you may use):
${JSON.stringify(context)}

Evidence field paths you may cite in "sectionEvidence" (do not use any path not in this list):
${JSON.stringify(evidenceAllowList)}

Produce the equity research report now, as a single JSON object matching the required shape.`;

/**
 * @param {object} context - from ai.contextBuilder.buildResearchContext
 * @param {string[]} evidenceAllowList - from ai.contextBuilder.buildEvidenceAllowList
 * @returns {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}}
 */
const buildPrompt = (context, evidenceAllowList) => ({
    systemPrompt: buildSystemPrompt(),
    userMessage: buildUserMessage(context, evidenceAllowList),
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
});

module.exports = { buildPrompt, buildSystemPrompt, buildUserMessage, MAX_TOKENS, TEMPERATURE };
