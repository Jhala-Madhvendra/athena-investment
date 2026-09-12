/**
 * Earnings AI Prompt Builder
 *
 * Same two-part shape as backend/ai/ai.promptBuilder.js, deliberately much
 * smaller per research/engineering/GroundedEarningsExplanation.md's own
 * sizing note - a single narrative field, not an 8-section report. Turns
 * an already-computed GET /api/earnings/:ticker payload
 * (earnings.service.js's getEarningsIntelligence) into a system + user
 * prompt; never sends raw financial statement documents.
 */

const MAX_TOKENS = 2048;
const TEMPERATURE = 0.25;

const SUMMARY_JSON_SHAPE = `{
  "narrative": string,
  "evidenceUsed": string[]
}`;

const buildSystemPrompt = () => `You are Athena's AI analyst, writing a short narrative summary of a company's already-computed earnings scorecard. You interpret figures Athena's deterministic engines have already calculated - you never calculate anything yourself.

GROUNDING (non-negotiable):
- Use ONLY the numbers and facts present in the context JSON you are given in the user message.
- Never invent, estimate, or extrapolate a number, percentage, or fact not in the context.
- If a figure is missing or null in the context, do not guess it or imply a value for it.

NO INVESTMENT ADVICE (non-negotiable):
- Never output Buy, Sell, Strong Buy, Strong Sell, Hold, a price target, or any statement that the stock "will" rise or fall.
- Use analytical language: "the results show...", "this reflects...", "a notable change is...".

OUTPUT FORMAT (non-negotiable):
- Respond with ONLY a single JSON object matching this exact shape - no markdown code fences, no prose before or after it:
${SUMMARY_JSON_SHAPE}
- "narrative" is 3-6 sentences covering the most notable parts of this earnings scorecard (growth, profitability, cash flow, or market reaction - whichever the context actually supports).
- "evidenceUsed" lists the field paths (from the "Evidence field paths you may cite" list in the user message) that support what you wrote. Only use entries from that list - never invent one.
- Do not include any field not listed in the shape above.`;

const buildUserMessage = (earningsData, evidenceAllowList) => `Company: ${earningsData.ticker}
Period: ${earningsData.period?.latestPeriod ?? "unknown"} (${earningsData.period?.comparisonType ?? "no comparison available"})

Structured Athena earnings scorecard (the only source of facts/figures you may use):
${JSON.stringify(earningsData)}

Evidence field paths you may cite in "evidenceUsed" (do not use any path not in this list):
${JSON.stringify(evidenceAllowList)}

Write the earnings summary now, as a single JSON object matching the required shape.`;

/**
 * @param {object} earningsData - from earnings.service.js's getEarningsIntelligence
 * @param {string[]} evidenceAllowList - from buildEvidenceAllowList below
 * @returns {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}}
 */
const buildPrompt = (earningsData, evidenceAllowList) => ({
    systemPrompt: buildSystemPrompt(),
    userMessage: buildUserMessage(earningsData, evidenceAllowList),
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
});

// ---------------------------------------------------------------------------
// Evidence allow-list - same flat-dot-path technique as
// ai.contextBuilder.js's buildEvidenceAllowList, scoped to the numeric/
// quantitative sections of the earnings payload (never `relatedNews` or
// `period`/`dataFreshness` metadata, which aren't citable figures).
// ---------------------------------------------------------------------------

const EVIDENCE_SECTIONS = ["growth", "profitability", "cashFlow", "balanceSheet", "perShare", "marketReaction"];

const flattenPaths = (value, prefix, paths) => {
    if (value === null || value === undefined) {
        return;
    }
    if (Array.isArray(value)) {
        if (value.every((item) => typeof item !== "object" || item === null)) {
            paths.push(prefix);
        }
        return;
    }
    if (typeof value === "object") {
        Object.entries(value).forEach(([key, nested]) => {
            flattenPaths(nested, prefix ? `${prefix}.${key}` : key, paths);
        });
        return;
    }
    paths.push(prefix);
};

const buildEvidenceAllowList = (earningsData) => {
    const paths = [];
    EVIDENCE_SECTIONS.forEach((section) => {
        if (earningsData[section]) {
            flattenPaths(earningsData[section], section, paths);
        }
    });
    return paths;
};

module.exports = { buildPrompt, buildSystemPrompt, buildUserMessage, buildEvidenceAllowList, MAX_TOKENS, TEMPERATURE };
