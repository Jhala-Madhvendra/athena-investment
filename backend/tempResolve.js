const connectDB = require('./config/db');
const mongoose = require('mongoose');
const service = require('./services/company.service');
(async () => {
  try {
    await connectDB();
    const query = 'TESLA';
    console.log('resolveTicker start', query);
    const ticker = await service.resolveTicker(query);
    console.log('resolved ticker:', ticker);
  } catch (err) {
    console.error('error', err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await mongoose.disconnect();
  }
})();
