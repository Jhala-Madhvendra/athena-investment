/**
 * News Classifier
 *
 * Deterministic, keyword-based category assignment - explicitly NOT an AI
 * classifier (see Sprint 10 brief and research/product/NewsAndEventIntelligence.md
 * for why event categories are preferred over AI-assigned sentiment).
 *
 * Each category's keywords are checked against the title (weighted higher)
 * and description; the highest-scoring category wins only if that score is
 * unambiguous. A zero score or a tie for first place is not a confident
 * classification, so it falls back to "Other" with low confidence rather
 * than guessing - see research/engineering/NewsCaching.md's sibling doc,
 * NewsNormalization.md, for the reasoning.
 */

const CATEGORIES = [
    "Earnings",
    "Revenue / Financial Results",
    "Product / Business",
    "Acquisition / Merger",
    "Leadership",
    "Regulation / Legal",
    "Capital Allocation",
    "Partnerships",
    "Market / Stock",
    "Other",
];

const CATEGORY_KEYWORDS = {
    Earnings: ["earnings", "quarterly results", "eps", "beat estimates", "miss estimates", "guidance", "q1", "q2", "q3", "q4"],
    "Revenue / Financial Results": ["revenue", "profit", "financial results", "net income", "sales grew", "quarterly report", "full-year results"],
    "Product / Business": ["launch", "unveil", "new product", "new service", "expansion", "release", "rollout"],
    "Acquisition / Merger": ["acquire", "acquisition", "merger", "takeover", "buyout", "to acquire", "deal to buy"],
    Leadership: ["ceo", "cfo", "coo", "appointed", "resigned", "steps down", "named president", "board of directors", "executive"],
    "Regulation / Legal": ["lawsuit", "regulator", "fine", "investigation", "regulatory", "sec probe", "antitrust", "settlement", "compliance"],
    "Capital Allocation": ["buyback", "share repurchase", "dividend", "special dividend", "capital return"],
    Partnerships: ["partnership", "collaborate", "joint venture", "teams up", "strategic alliance", "partners with"],
    // Indian-market terms (sensex, nifty, bse, nse, fii, dii) added after
    // live testing against NSE tickers (e.g. RELIANCE.NS) showed genuinely
    // market-movement headlines - "Sensex, Nifty Dip as..." - falling
    // through to "Other" because the original list was US-headline-phrased.
    "Market / Stock": [
        "stock price",
        "shares rose",
        "shares fell",
        "market cap",
        "analyst rating",
        "price target",
        "downgrade",
        "upgrade",
        "sensex",
        "nifty",
        "bse",
        "nse",
        "fii",
        "dii",
        "benchmark index",
        "benchmark indices",
        "stock market",
        "stock markets",
        "stocks rally",
        "market selloff",
        "foreign investors",
        "domestic investors",
    ],
};

const TITLE_WEIGHT = 2;
const DESCRIPTION_WEIGHT = 1;
const MIN_SCORE_FOR_HIGH_CONFIDENCE = 2;

const countKeywordHits = (text, keywords) => {
    if (!text) return 0;
    const lower = text.toLowerCase();
    return keywords.reduce((count, keyword) => (lower.includes(keyword) ? count + 1 : count), 0);
};

/**
 * @param {{title: string, description?: string|null}} article
 * @returns {{category: string, confidence: "high"|"low", scores: Record<string, number>}}
 */
const classifyArticle = ({ title, description }) => {
    const scores = {};

    Object.entries(CATEGORY_KEYWORDS).forEach(([category, keywords]) => {
        const titleHits = countKeywordHits(title, keywords) * TITLE_WEIGHT;
        const descriptionHits = countKeywordHits(description, keywords) * DESCRIPTION_WEIGHT;
        scores[category] = titleHits + descriptionHits;
    });

    const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topCategory, topScore] = ranked[0];
    const [, secondScore] = ranked[1] || [null, 0];

    if (topScore === 0 || topScore === secondScore) {
        return { category: "Other", confidence: "low", scores };
    }

    return {
        category: topCategory,
        confidence: topScore >= MIN_SCORE_FOR_HIGH_CONFIDENCE ? "high" : "low",
        scores,
    };
};

module.exports = { classifyArticle, CATEGORIES, CATEGORY_KEYWORDS };
