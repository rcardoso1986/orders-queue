const logEl = document.getElementById('log');
function log(txt) {
  logEl.textContent += txt + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

const genBtn = document.getElementById('gen');
const enqueueBtn = document.getElementById('enqueue');
const resetBtn = document.getElementById('reset');

/**
 * setButtons.
 *
 * @author	Rafael Cardoso
 * @since	v0.0.1
 * @version	v1.0.0	Thursday, October 16th, 2025.
 * @global
 * @param	mixed	{ gerar = true, processar = true, resetar = true }	
 * @return	void
 */
function setButtons({ gerar = true, processar = true, resetar = true }) {
  genBtn.disabled = !gerar;
  enqueueBtn.disabled = !processar;
  resetBtn.disabled = !resetar;
}

document.getElementById('gen').onclick = async () => {
  setButtons({ create: false, process: false, reset: false });
  log('Creating Orders...');
  await fetch('/generate', { method:'POST' })
  .then(r=>r.json())
  setTimeout(updateStatusLoop, 5000);
  setTimeout(updateQueuesLoop, 5000);
};

document.getElementById('enqueue').onclick = async () => {

  setButtons({ create: false, process: false, reset: false });

  log('Processing orders...');
  await fetch('/enqueue', { method:'POST' }).then(r=>r.json());
  setTimeout(updateStatusLoop, 5000);
  setTimeout(updateQueuesLoop, 5000);
};

document.getElementById('reset').onclick = async () => {
  setButtons({ create: false, process: false, reset: false });

  log('Resetting DB and Redis...');
  await fetch('/reset', { method:'POST' }).then(r=>r.json());
  setTimeout(updateStatusLoop, 5000);
  setTimeout(updateQueuesLoop, 5000);
};

let statusLoopActive = true;
let queuesLoopActive = true;

/**
 * @var		async	function
 * @global
 */
async function updateStatusLoop() {
  try {
    const r = await fetch('/orders').then(r=>r.json())

    document.getElementById('vipTotal').textContent = r.vip.total ?? '-';
    document.getElementById('vipCount').textContent = r.vip.count;
    document.getElementById('vipFirst').textContent = r.vip.firstStart ? new Date(r.vip.firstStart).toLocaleString() : '-';
    document.getElementById('vipLast').textContent = r.vip.lastFinish ? new Date(r.vip.lastFinish).toLocaleString() : '-';
    document.getElementById('vipAvg').textContent = r.vip.avgProcessingMs ? r.vip.avgProcessingMs.toFixed(2) : '-';

    document.getElementById('normalTotal').textContent = r.normal.total ?? '-';
    document.getElementById('normalCount').textContent = r.normal.count;
    document.getElementById('normalFirst').textContent = r.normal.firstStart ? new Date(r.normal.firstStart).toLocaleString() : '-';
    document.getElementById('normalLast').textContent = r.normal.lastFinish ? new Date(r.normal.lastFinish).toLocaleString() : '-';
    document.getElementById('normalAvg').textContent = r.normal.avgProcessingMs ? r.normal.avgProcessingMs.toFixed(2) : '-';

    document.getElementById('diamanteGenTime').textContent =
      r.generation && r.generation.diamante != null
        ? r.generation.diamante.toFixed(2) + ' s'
        : '-';
    document.getElementById('normalGenTime').textContent =
      r.generation && r.generation.normal != null
        ? r.generation.normal.toFixed(2) + ' s'
        : '-';
        
    const pedidosRestantes = (r.vip.total - r.vip.count) + (r.normal.total - r.normal.count);
    
 if (r.vip.total === 0 && r.normal.total === 0) {
      // Nenhum pedido criado ainda
      setButtons({ create: true, process: false, reset: true });
    } else if (pedidosRestantes === (r.vip.total + r.normal.total)) {
      // Todos os pedidos criados, nenhum processado ainda
      setButtons({ create: false, process: true, reset: true });
      setTimeout(updateStatusLoop, 1000);
    } else if (pedidosRestantes > 0) {
      // Processamento em andamento
      setButtons({ create: false, process: false, reset: false });
      setTimeout(updateStatusLoop, 1000);
    } else {
      // Tudo pronto, pode gerar, processar ou resetar novamente
      setButtons({ create: true, process: true, reset: true });
      log('All requests have been processed. Stopping metrics update..');
    }
  } catch (e) {
    log('Error updating metrics: ' + (e.message || e));
    setTimeout(updateStatusLoop, 5000);
  }
}

/**
 * @var		async	function
 * @global
 */
async function updateQueuesLoop() {
  try {
    const r = await fetch('/queue-status').then(r=>r.json());

    document.getElementById('vipWaiting').textContent = r.vip.waiting;
    document.getElementById('vipActive').textContent = r.vip.active;
    document.getElementById('vipCompleted').textContent = r.vip.completed;
    document.getElementById('vipFailed').textContent = r.vip.failed;
    document.getElementById('vipQueueAvg').textContent = r.vip.avgMs ? r.vip.avgMs.toFixed(2) : '-';

    document.getElementById('normalWaiting').textContent = r.normal.waiting;
    document.getElementById('normalActive').textContent = r.normal.active;
    document.getElementById('normalCompleted').textContent = r.normal.completed;
    document.getElementById('normalFailed').textContent = r.normal.failed;
    document.getElementById('normalQueueAvg').textContent = r.normal.avgMs ? r.normal.avgMs.toFixed(2) : '-';

    const jobsRestantes = r.vip.waiting + r.vip.active + r.normal.waiting + r.normal.active;
 if (jobsRestantes > 0) {
      // Enquanto houver jobs, não pode resetar nem gerar/processar de novo
      setButtons({ create: false, process: false, reset: false });
      setTimeout(updateQueuesLoop, 1000);
    } else {
      // Quando filas vazias, libera tudo
      setButtons({ create: true, process: true, reset: true });
      queuesLoopActive = false;
      log('All queues are empty. Stopping queue updates.');
    }
  } catch (e) {
    log('Error updating queues: ' + (e.message || e));
    setTimeout(updateQueuesLoop, 5000);
  }
}

updateStatusLoop();
updateQueuesLoop();

const evt = new EventSource('/logs/stream');
evt.onmessage = e => {
  log(e.data);
};