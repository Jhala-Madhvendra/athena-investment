const fetch = global.fetch || require('node-fetch');
(async () => {
  try {
    const name = 'Reliance';
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=10&newsCount=0`;
    console.log('searchUrl', searchUrl);
    const search = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 AthenaFinance/1.0',
        Accept: 'application/json',
      },
    });
    console.log('search status', search.status);
    const searchJson = await search.json();
    console.log('searchJson keys', Object.keys(searchJson));
    console.log('quotes sample', JSON.stringify(searchJson.quotes?.slice(0,10), null, 2));
    if (searchJson.quotes?.length) {
      for (const quote of searchJson.quotes.slice(0, 10)) {
        console.log('quote item', quote.symbol, quote.quoteType, quote.shortname || quote.longname);
      }
    }
    const symbol = searchJson.quotes?.[0]?.symbol;
    if (symbol) {
      const quoteUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,price`;
      console.log('quoteUrl', quoteUrl);
      const quote = await fetch(quoteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 AthenaFinance/1.0',
          Accept: 'application/json',
        },
      });
      console.log('quote status', quote.status);
      const quoteJson = await quote.json();
      console.log('quote json keys', Object.keys(quoteJson));
      console.log(JSON.stringify(quoteJson.quoteSummary?.result?.[0], null, 2));
    }
  } catch (error) {
    console.error(error);
  }
})();
