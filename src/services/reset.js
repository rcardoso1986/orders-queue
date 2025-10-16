import { connect } from '../db.js';

(async () => {
  const db = await connect();
  await db.collection('orders').deleteMany({});
  await db.collection('process_status').deleteMany({});
  console.log('Reset finished.');
  process.exit(0);
})();