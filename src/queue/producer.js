import { connect } from '../db.js';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import 'dotenv/config';

/**
 * @var		mixed	connection
 * @global
 */
const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null, 
  enableReadyCheck: false 
});

const vipQueue = new Queue('vipQueue', { connection });
const normalQueue = new Queue('normalQueue', { connection });

const BATCH = parseInt(process.env.BULK_BATCH || '5000', 10);

(async () => {
  const db = await connect();
  const ordersCol = db.collection('orders');
  await enqueueOrders(vipQueue, ordersCol, 'DIAMANTE', 'VIP');
  await enqueueOrders(normalQueue, ordersCol, 'NORMAL', 'NORMAL');
  process.exit(0);
})();

/**
 * @var		async	function
 * @global
 */
async function enqueueOrders(queue, ordersCol, priority, batchLabel) {
  console.log(`Put orders in queue ${batchLabel}`);
  const cursor = ordersCol.find({ priority, processed: { $ne: true } }).batchSize(BATCH);
  let added = 0;
  while (await cursor.hasNext()) {
    const docs = [];
    for (let i = 0; i < BATCH && await cursor.hasNext(); i++) {
      const o = await cursor.next();
      docs.push(o);
    }
    if (docs.length) {
      const jobs = docs.map(d => ({
        name: 'processOrder',
        data: { id: d._id },
        opts: { jobId: String(d._id) }
      }));
      await queue.addBulk(jobs);
      added += docs.length;
      console.log(`${batchLabel} queued: ${added}`);
    }
  }
}