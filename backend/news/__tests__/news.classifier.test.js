const { classifyArticle, CATEGORIES } = require("../news.classifier");

describe("classifyArticle", () => {
    it("classifies an earnings headline with high confidence", () => {
        const result = classifyArticle({
            title: "Acme Corp reports Q3 earnings, beats estimates",
            description: "Quarterly results showed EPS ahead of consensus.",
        });

        expect(result.category).toBe("Earnings");
        expect(result.confidence).toBe("high");
    });

    it("classifies an acquisition headline", () => {
        const result = classifyArticle({
            title: "Acme Corp to acquire rival startup in $2B deal",
            description: "The acquisition is expected to close next quarter.",
        });

        expect(result.category).toBe("Acquisition / Merger");
    });

    it("classifies a leadership headline", () => {
        const result = classifyArticle({
            title: "Acme Corp CEO steps down, board appoints interim leader",
            description: null,
        });

        expect(result.category).toBe("Leadership");
    });

    it("classifies a regulatory headline", () => {
        const result = classifyArticle({
            title: "Regulator opens investigation into Acme Corp practices",
            description: "The lawsuit alleges antitrust violations.",
        });

        expect(result.category).toBe("Regulation / Legal");
    });

    it("classifies Indian-market headlines (Sensex/Nifty) as Market / Stock", () => {
        // Regression: real RELIANCE.NS headlines from Marketaux fell through
        // to "Other" before Indian-market terms were added to the keyword list.
        const result = classifyArticle({
            title: "Stock Markets Today: Sensex, Nifty Dip as Strait of Hormuz Tensions Keep Crude Prices High",
            description:
                "Indian benchmark indices Sensex and Nifty saw declines in early trade, primarily due to elevated crude oil prices.",
        });

        expect(result.category).toBe("Market / Stock");
    });

    it("classifies a second real-world Sensex/Nifty headline as Market / Stock", () => {
        const result = classifyArticle({
            title: "Sensex, Nifty slip at open; cement, metals drag as Apollo Hospitals leads gains",
            description: "Sensex and Nifty open lower as cement and metals decline, while Apollo Hospitals leads morning gains.",
        });

        expect(result.category).toBe("Market / Stock");
    });

    it("classifies FII/DII flow commentary as Market / Stock", () => {
        const result = classifyArticle({
            title: "FIIs turn net buyers in July after months of outflows",
            description: "Foreign investors returned to Indian equities as DIIs also stayed net buyers.",
        });

        expect(result.category).toBe("Market / Stock");
    });

    it("falls back to Other with low confidence when no keywords match", () => {
        const result = classifyArticle({
            title: "A quiet day for Acme Corp",
            description: "Nothing notable happened.",
        });

        expect(result.category).toBe("Other");
        expect(result.confidence).toBe("low");
    });

    it("falls back to Other when two categories tie for the top score", () => {
        const result = classifyArticle({
            title: "Acme Corp announces dividend and partnership",
            description: null,
        });

        expect(result.category).toBe("Other");
        expect(result.confidence).toBe("low");
    });

    it("never returns a category outside the fixed enum", () => {
        const result = classifyArticle({ title: "Random unrelated headline", description: null });

        expect(CATEGORIES).toContain(result.category);
    });
});
