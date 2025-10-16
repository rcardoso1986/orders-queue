import express, { json } from 'express';
import cors from 'cors';
import { connect } from './db.js';
import { spawn } from 'child_process';
import 'dotenv/config';
import path, { join } from 'path';
import { fileURLToPath } from 'url';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(json());

// Ajuste para ESM (__dirname equivalente)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let sseClients = [];

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
});

app.get('/orders', async (req, res) => {
  const db = await connect();
  const status = db.collection('process_status');
  const orders = db.collection('orders');

  const totalOrders = await orders.aggregate([
    { $match: { priority: { $in: ['DIAMANTE', 'NORMAL'] } } },
    { $group: { _id: '$priority', total: { $sum: 1 } } }
  ]).toArray();

  const totalVip = totalOrders.find(t => t._id === 'DIAMANTE')?.total || 0;
  const totalNormal = totalOrders.find(t => t._id === 'NORMAL')?.total || 0;
  const generation = await status.findOne({ type: 'generation' });

  const vipStats = await status.aggregate([
    { $match: { type: 'process', priority: 'DIAMANTE' } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
        firstStart: { $min: '$start' },
        lastFinish: { $max: '$finished' },
        avgDurationMs: { $avg: { $subtract: ['$finished', '$start'] } },
      },
    },
  ]).toArray();

  const normalStats = await status.aggregate([
    { $match: { type: 'process', priority: 'NORMAL' } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
        firstStart: { $min: '$start' },
        lastFinish: { $max: '$finished' },
        avgDurationMs: { $avg: { $subtract: ['$finished', '$start'] } },
      },
    },
  ]).toArray();

  const diamanteGen = await db.collection('process_status').findOne({ type: 'generation', priority: 'DIAMANTE' });
  const normalGen = await db.collection('process_status').findOne({ type: 'generation', priority: 'NORMAL' });

  res.json({
    generation: {
      diamante: diamanteGen ? diamanteGen.durationSeconds : null,
      normal: normalGen ? normalGen.durationSeconds : null,
      startedAt: generation?.startedAt,
      finishedAt: generation?.finishedAt,
      durationSeconds: generation?.durationSeconds,
    },
    vip: {
      total: totalVip, // total de pedidos VIP
      count: vipStats[0]?.count || 0,
      firstStart: vipStats[0]?.firstStart,
      lastFinish: vipStats[0]?.lastFinish,
      avgProcessingMs: vipStats[0]?.avgDurationMs,
    },
    normal: {
      total: totalNormal, // total de pedidos NORMAL
      count: normalStats[0]?.count || 0,
      firstStart: normalStats[0]?.firstStart,
      lastFinish: normalStats[0]?.lastFinish,
      avgProcessingMs: normalStats[0]?.avgDurationMs,
    },
  });
});


async function cleanQueue(){
  const vipQueue = new Queue('vipQueue', { connection: redisConnection });
  const normalQueue = new Queue('normalQueue', { connection: redisConnection });
  await Promise.all([
    vipQueue.obliterate({ force: true }),
    normalQueue.obliterate({ force: true })
  ]);
}

app.post('/reset', async (req, res) => {
  const db = await connect();
  await db.collection('orders').deleteMany({});
  await db.collection('process_status').deleteMany({});
  await cleanQueue();
  res.json({ ok: true });
});

app.get('/logs/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(r => r !== res);
  });
});

function spawnDetached(cmd, args) {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: 'inherit',
    cwd: __dirname,
  });
  child.unref();
}

app.post('/generate', (req, res) => {
  spawnDetached('node', ['services/generator.js']);
  res.json({ ok: true, message: 'Generator started (detached).' });
});

app.post('/enqueue', (req, res) => {
  spawnDetached('node', ['queue/producer.js']);
  res.json({ ok: true, message: 'Enqueue started (detached).' });
});

app.use('/pedidos', express.static(join(__dirname, 'frontend')));

app.listen(PORT, () => {
  console.log('API running on port', PORT);
});

app.get('/queue-status', async (req, res) => {
  const vipQueue = new Queue('vipQueue', { connection: redisConnection });
  const normalQueue = new Queue('normalQueue', { connection: redisConnection });

  const [vipCounts, normalCounts] = await Promise.all([
    vipQueue.getJobCounts('waiting', 'active', 'completed', 'failed'),
    normalQueue.getJobCounts('waiting', 'active', 'completed', 'failed')
  ]);

  // Tempo médio de processamento (opcional, se quiser calcular pelo BullMQ)
  const [vipJobs, normalJobs] = await Promise.all([
    vipQueue.getJobs(['completed'], 0, 49, false),
    normalQueue.getJobs(['completed'], 0, 49, false)
  ]);
  const avgMs = jobs => {
    if (!jobs.length) return 0;
    const sum = jobs.reduce((acc, job) => acc + (job.finishedOn - job.processedOn), 0);
    return sum / jobs.length;
  };

  res.json({
    vip: {
      ...vipCounts,
      avgMs: avgMs(vipJobs)
    },
    normal: {
      ...normalCounts,
      avgMs: avgMs(normalJobs)
    }
  });
});
app.use('/', (req, res) => {
  res.json({ ok: true, message: 'Api is work fine! :)' });
});