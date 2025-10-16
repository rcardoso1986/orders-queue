import { connect } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { faker } from '@faker-js/faker';
import 'dotenv/config';

const TOTAL = parseInt(process.env.TOTAL_ORDERS || '1000000', 10);
const CHUNK = parseInt(process.env.CHUNK_SIZE || '10000', 10);

/**
 * randomTier.
 *
 * @author	Rafael Cardoso
 * @since	v0.0.1
 * @version	v1.0.0	Thursday, October 16th, 2025.
 * @global
 * @return	string
 */
function randomTier() {
  const r = Math.random();
  if (r < 0.02) return 'DIAMANTE';
  if (r < 0.20) return 'OURO';
  if (r < 0.55) return 'PRATA';
  return 'BRONZE';
}

/**
 * makeOrder.
 *
 * @author	Rafael Cardoso
 * @since	v0.0.1
 * @version	v1.0.0	Thursday, October 16th, 2025.
 * @global
 * @return	void
 */
function makeOrder(i) {
  const tier = randomTier();
  return {
    _id: uuidv4(),
    orderId: `ord_${Date.now()}_${i}`,
    cliente: {
      nome: faker.person.fullName(),
      email: faker.internet.email()
    },
    valor: parseFloat((Math.random() * 1000).toFixed(2)),
    tier,
    observations: '',
    priority: tier === 'DIAMANTE' ? 'DIAMANTE' : 'NORMAL',
    createdAt: new Date(),
    processed: false
  };
}

(async () => {
  console.log(`Iniciando geração de pedidos...`);

  const db = await connect();
  const orders = db.collection('orders');
  const status = db.collection('process_status');

  // Limpa status anterior de geração
  await status.deleteMany({ type: 'generation' });

  // Geração DIAMANTE
  const startDiamante = Date.now();
  let generatedDiamante = 0;
  let generated = 0;
  while (generated < TOTAL) {
    const batchSize = Math.min(CHUNK, TOTAL - generated);
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(makeOrder(generated + i));
    }
    // Separa DIAMANTE e NORMAL
    const batchDiamante = batch.filter(o => o.priority === 'DIAMANTE');
    const batchNormal = batch.filter(o => o.priority === 'NORMAL');
    if (batchDiamante.length > 0) {
      await orders.insertMany(batchDiamante);
      generatedDiamante += batchDiamante.length;
    }
    if (batchNormal.length > 0) {
      await orders.insertMany(batchNormal);
    }
    generated += batchSize;
    console.log(`Generated: ${generated}/${TOTAL}`);
  }
  const endDiamante = Date.now();

  // Salva tempo de geração DIAMANTE
  await status.insertOne({
    type: 'generation',
    priority: 'DIAMANTE',
    startedAt: new Date(startDiamante),
    finishedAt: new Date(endDiamante),
    durationSeconds: (endDiamante - startDiamante) / 1000
  });

  // Geração NORMAL (apenas para registro de tempo)
  const diamanteDocs = await orders.countDocuments({ priority: 'DIAMANTE' });
  const startNormal = endDiamante;
  const endNormal = Date.now();
  await status.insertOne({
    type: 'generation',
    priority: 'NORMAL',
    startedAt: new Date(startNormal),
    finishedAt: new Date(endNormal),
    durationSeconds: (endNormal - startNormal) / 1000
  });
  process.exit(0);
})();