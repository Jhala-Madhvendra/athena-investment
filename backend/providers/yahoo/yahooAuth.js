const fetchWithTimeout = require("../../utils/fetchWithTimeout");

// Yahoo's cookie+crumb pair is not single-use - re-fetching it on every API
// call multiplies traffic to Yahoo's auth endpoints for no reason and makes
// hitting Yahoo's rate limit far more likely. Cache it for a short window
// and share one in-flight request across concurrent callers.
const AUTH_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedAuth = null; // { cookie, crumb, expiresAt }
let pendingAuth = null;

const fetchFreshAuthentication = async () => {
    const headers = {
        "User-Agent": "Mozilla/5.0 AthenaFinance/1.0",
    };
    const cookieResponse = await fetchWithTimeout("https://fc.yahoo.com", {
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

    const crumbResponse = await fetchWithTimeout(
        "https://query1.finance.yahoo.com/v1/test/getcrumb",
        { headers: { ...headers, Cookie: cookie } }
    );

    if (!crumbResponse.ok) {
        const body = await crumbResponse.text().catch(() => "");

        throw new Error(
            `Yahoo Finance crumb request failed. ` +
            `Status: ${crumbResponse.status}. ` +
            `Body: ${body.slice(0, 500)}`
        );
    }

    const crumb = await crumbResponse.text();

    if (!crumb) {
        throw new Error("Yahoo Finance returned an empty authentication crumb.");
    }

    return { cookie, crumb };
};

const getYahooAuthentication = async () => {
    if (cachedAuth && cachedAuth.expiresAt > Date.now()) {
        return { cookie: cachedAuth.cookie, crumb: cachedAuth.crumb };
    }

    if (!pendingAuth) {
        pendingAuth = fetchFreshAuthentication()
            .then((auth) => {
                cachedAuth = { ...auth, expiresAt: Date.now() + AUTH_CACHE_TTL_MS };
                return auth;
            })
            .finally(() => {
                pendingAuth = null;
            });
    }

    return pendingAuth;
};

/** Test-only: clears the cached auth so tests don't leak state across runs. */
getYahooAuthentication._resetCache = () => {
    cachedAuth = null;
    pendingAuth = null;
};

module.exports = getYahooAuthentication;
