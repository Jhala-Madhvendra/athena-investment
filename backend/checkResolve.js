const service = require('./services/company.service');
(async () => {
  try {
    console.log('resolveTicker function exists:', typeof service.resolveTicker);
    const name = 'Reliance';
    const ticker = await service.resolveTicker(name);
    console.log('resolved ticker', ticker);
  } catch (err) {
    console.error('error', err.message);
    console.error(err.stack);
  }
})();
