const getYahooAuthentication = async () => {
    const headers = {
        "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
    };
    const cookieResponse = await fetch("https://fc.yahoo.com", {
        headers,
        redirect: "manual",
    });
    const rawCookie = cookieResponse.headers.getSetCookie
        ? cookieResponse.headers.getSetCookie()[0]
        : cookieResponse.headers.get("set-cookie");
    const cookie = rawCookie?.split(";")[0];

    if (!cookie) {
        throw new Error("Yahoo Finance authentication cookie could not be retrieved.");
    }

    const crumbResponse = await fetch(
        "https://query1.finance.yahoo.com/v1/test/getcrumb",
        { headers: { ...headers, Cookie: cookie } }
    );

    if (!crumbResponse.ok) {
        throw new Error("Yahoo Finance authentication crumb could not be retrieved.");
    }

    const crumb = await crumbResponse.text();

    if (!crumb) {
        throw new Error("Yahoo Finance returned an empty authentication crumb.");
    }

    return { cookie, crumb };
};

module.exports = getYahooAuthentication;
