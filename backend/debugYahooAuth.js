const fetch = global.fetch || require('node-fetch');
const getAuthentication = async () => {
  const headers = { 'User-Agent': 'Mozilla/5.0 AthenaFinance/1.0' };
  const cookieResponse = await fetch('https://fc.yahoo.com', { headers, redirect: 'manual' });
  const rawCookie = cookieResponse.headers.getSetCookie ? cookieResponse.headers.getSetCookie()[0] : cookieResponse.headers.get('set-cookie');
  const cookie = rawCookie?.split(';')[0];
  console.log('cookie', cookie);
  const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', { headers: { ...headers, Cookie: cookie } });
  console.log('crumb status', crumbResponse.status);
  const crumb = await crumbResponse.text();
  console.log('crumb', crumb);
  return { cookie, crumb };
};
(async () => {
  try {
    const auth = await getAuthentication();
    const symbol = 'RS';
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`;
    const params = new URLSearchParams({ modules: 'assetProfile,price', crumb: auth.crumb });
    const quote = await fetch(`${url}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 AthenaFinance/1.0',
        Accept: 'application/json',
        Cookie: auth.cookie,
      },
    });
    console.log('quote status', quote.status);
    const quoteJson = await quote.json();
    console.log(JSON.stringify(quoteJson, null, 2));
  } catch (error) {
    console.error(error);
  }
})();
