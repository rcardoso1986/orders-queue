import 'dotenv/config';
import pkg from 'bullmq';
const { Worker, Queue } = pkg;
import IORedis from 'ioredis';
import { connect } from '../db.js';


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

const vipQueueName = 'vipQueue';
const normalQueueName = 'normalQueue';

/**
 * @var		async	function
 * @global
 */
async function waitForRedis(retries = 20, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const pong = await connection.ping();
      if (pong === 'PONG') {
        console.log('Redis available!');
        return;
      }
    } catch (e) {
      console.log('Waiting for Redis...');
    }
    await new Promise(res => setTimeout(res, delay));
  }
  throw new Error('Redis is unavailable after multiple attempts.');
}

/**
 * createWorker.
 *
 * @author	Rafael Cardoso
 * @since	v0.0.1
 * @version	v1.0.0	Thursday, October 16th, 2025.
 * @global
 * @param	mixed	queueName      	
 * @param	mixed	concurrency    	
 * @param	mixed	priorityLabel  	
 * @param	mixed	observationText	
 * @param	mixed	orders         	
 * @param	mixed	status         	
 * @param	mixed	connection     	
 * @return	mixed
 */
function createWorker(queueName, concurrency, priorityLabel, observationText, orders, status, connection) {
  const worker = new Worker(
    queueName,
    async job => {
      const start = new Date();
      const id = job.data.id;
      await orders.updateOne(
        { _id: id },
        { $set: { processed: true, observations: observationText, processedAt: new Date() } }
      );
      const finished = new Date();
      return { id, start, finished };
    },
    { connection, concurrency }
  );

  worker.on('completed', async (job, result) => {
    await status.insertOne({
      type: 'process',
      priority: priorityLabel,
      jobId: job.id,
      orderId: result.id,
      start: result.start,
      finished: result.finished
    });
  });

  worker.on('drained', () => {
    console.log(`${priorityLabel} Fila finalizada`);
  });

  return worker;
}

(async () => {
  await waitForRedis();

  // Start schedulers
  new Queue(vipQueueName, { connection });
  new Queue(normalQueueName, { connection });

  const db = await connect();
  const orders = db.collection('orders');
  const status = db.collection('process_status');

  // Workers by tiers
  createWorker(
    vipQueueName, 250, 'DIAMANTE', 'enviado com prioridade', orders, status, connection
  );
  createWorker(
    normalQueueName, 250, 'NORMAL', 'processado sem prioridade', orders, status, connection
  );

  console.log(`Jobs rodando VIP e NORMAL`);
})().catch(err => {
  //console.error(err);
  process.exit(1);
});