const { formatAlertBatch } = require("../alertNotificationFormatter");

const alert = (ticker, title) => ({ ticker, title });

describe("formatAlertBatch", () => {
    it("singularizes the title for exactly one alert", () => {
        const result = formatAlertBatch([alert("AAPL", "Price drop")]);
        expect(result.title).toBe("1 new alert on your portfolio");
    });

    it("pluralizes the title for multiple alerts", () => {
        const result = formatAlertBatch([alert("AAPL", "Price drop"), alert("MSFT", "Margin declined")]);
        expect(result.title).toBe("2 new alerts on your portfolio");
    });

    it("lists each alert's ticker and title on its own line", () => {
        const result = formatAlertBatch([alert("AAPL", "Price drop"), alert("MSFT", "Margin declined")]);
        expect(result.message).toBe("AAPL: Price drop\nMSFT: Margin declined");
    });

    it("caps the listed alerts at 10 and notes the remainder", () => {
        const alerts = Array.from({ length: 13 }, (_, i) => alert(`T${i}`, "Alert"));
        const result = formatAlertBatch(alerts);

        expect(result.message.split("\n").filter((line) => line.startsWith("T"))).toHaveLength(10);
        expect(result.message).toContain("...and 3 more.");
    });

    it("builds the url from appBaseUrl when given, omits it otherwise", () => {
        expect(formatAlertBatch([alert("AAPL", "x")], "https://app.example.com").url).toBe("https://app.example.com/alerts");
        expect(formatAlertBatch([alert("AAPL", "x")]).url).toBeUndefined();
    });
});
