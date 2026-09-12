/**
 * Portfolio Digest Prompt Builder
 *
 * Same two-part shape as earnings.aiPromptBuilder.js - a single narrative
 * field, not an 8-section report, scaled to a whole portfolio instead of
 * one ticker. Turns portfolioDigest.contextBuilder.js's compact context
 * into a system + user prompt.
 */

const MAX_TOKENS = 3072;
const TEMPERATURE = 0.25;

const DIGEST_JSON_SHAPE = `{
  "narrative": string,
  "holdingHighlights": [{ "ticker": string, "note": string }],
  "evidenceUsed": string[]
}`;

const buildSystemPrompt = () => `You are Athena's AI analyst, writing a short weekly digest of a user's actual investment portfolio. You interpret figures Athena's deterministic engines have already calculated - you never calculate anything yourself.

GROUNDING (non-negotiable):
- Use ONLY the numbers and facts present in the context JSON you are given in the user message.
- Never invent, estimate, or extrapolate a number, percentage, or fact not in the context.
- If a figure is missing or null in the context, do not guess it or imply a value for it.
- "recentNews" entries are the only news you may reference - never use outside knowledge about any company.

NO INVESTMENT ADVICE (non-negotiable):
- Never output Buy, Sell, Strong Buy, Strong Sell, Hold, a price target, or any statement that the stock "will" rise or fall.
- Never suggest rebalancing, adding to, or trimming any position.
- Use analytical language: "the portfolio's biggest mover this week was...", "X reported...".

OUTPUT FORMAT (non-negotiable):
- Respond with ONLY a single JSON object matching this exact shape - no markdown code fences, no prose before or after it:
${DIGEST_JSON_SHAPE}
- "narrative" is 3-6 sentences summarizing what's notable across the whole portfolio this period (overall return, the best/worst performer, any notable news).
- "holdingHighlights" covers at most 5 individual holdings worth calling out (a big move, a headline) - omit it (empty array) if nothing stands out beyond the narrative.
- "evidenceUsed" lists the field paths (from the "Evidence field paths you may cite" list in the user message) that support what you wrote. Only use entries from that list - never invent one.
- Do not include any field not listed in the shape above.`;

const buildUserMessage = (context, evidenceAllowList) => `Structured Athena portfolio digest context (the only source of facts/figures you may use):
${JSON.stringify(context)}

Evidence field paths you may cite in "evidenceUsed" (do not use any path not in this list):
${JSON.stringify(evidenceAllowList)}

Write this week's portfolio digest now, as a single JSON object matching the required shape.`;

/**
 * @param {object} context - from portfolioDigest.contextBuilder.buildDigestContext
 * @param {string[]} evidenceAllowList - from buildEvidenceAllowList below
 * @returns {{systemPrompt: string, userMessage: string, maxTokens: number, temperature: number}}
 */
const buildPrompt = (context, evidenceAllowList) => ({
    systemPrompt: buildSystemPrompt(),
    userMessage: buildUserMessage(context, evidenceAllowList),
    maxTokens: MAX_TOKENS,
    temperature: TEMPERATURE,
});

// ---------------------------------------------------------------------------
// Evidence allow-list - same flat-dot-path technique as
// earnings.aiPromptBuilder.js's buildEvidenceAllowList.
// ---------------------------------------------------------------------------

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

const buildEvidenceAllowList = (context) => {
    const paths = [];
    if (context.summary) {
        flattenPaths(context.summary, "summary", paths);
    }
    (context.holdings || []).forEach((holding, index) => {
        flattenPaths(
            { weightPercent: holding.weightPercent, returnPercent: holding.returnPercent },
            `holdings[${index}]`,
            paths
        );
        (holding.recentNews || []).forEach((article) => {
            if (article.url) paths.push(article.url);
        });
    });
    return paths;
};

module.exports = { buildPrompt, buildSystemPrompt, buildUserMessage, buildEvidenceAllowList, MAX_TOKENS, TEMPERATURE };
