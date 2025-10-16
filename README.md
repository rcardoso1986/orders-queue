# H&W Test Dockerized (CommonJS)

## Overview
Projeto para gerar 1.000.000 pedidos, enfileirar e processar com prioridade para pedidos DIAMANTE.
Tudo containerizado: API, worker, MongoDB e Redis.

## Run
1. Run npm install
2. Build and start:
   ```bash
   docker compose up --build
   ```
3. Open UI: http://localhost:3000/pedidos

## UI buttons
- **Gerar Pedidos**: Triggers the service that creates 1 million orders (waits for completion before starting processing).
- **Processar Pedidos**: Queues the orders and starts processing (the job container runs).
- **Resetar Banco**: Clears orders, process_status, and redis. ()

Notes:
- Generation runs as a detached child process inside API container to avoid blocking.
- Adjust `.env` values for CHUNK_SIZE and BULK_BATCH depending on available resources.

