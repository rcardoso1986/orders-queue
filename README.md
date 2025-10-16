# H&W Orders Processing System (Dockerized, BullMQ, MongoDB, Redis)

## Overview

This project is a full-stack solution for generating, queuing, and processing a large volume of orders (1,000,000+), with priority handling for DIAMANTE (VIP) orders. The system is fully containerized using Docker Compose and leverages Node.js, BullMQ, MongoDB, and Redis. It includes a real-time dashboard for monitoring and control.

---

## Features

- **Order Generation:** Generate up to 1 million orders with random customer data and priority tiers (DIAMANTE, OURO, PRATA, BRONZE).
- **Priority Queueing:** Orders are enqueued and processed with DIAMANTE (VIP) orders having higher priority.
- **Order Processing:** Orders are processed by workers using BullMQ and results are saved to MongoDB.
- **Real-Time Dashboard:** Web UI displays metrics, processing times, queue status, and logs in real time.
- **Live Logs:** All backend logs (including from detached scripts) are streamed to the browser via SSE.
- **Reset Functionality:** Easily clear all orders, statuses, and queues from the UI.

---

## Architecture

- **API:** Node.js/Express, exposes endpoints for order generation, queueing, processing, metrics, and logs.
- **Workers:** Node.js scripts for processing jobs from BullMQ queues.
- **MongoDB:** Stores orders and processing status.
- **Redis:** Used by BullMQ for job management and Pub/Sub for log streaming.
- **Frontend:** Bootstrap + Vanilla JS dashboard for control and monitoring.

---

## Requirements

- Docker & Docker Compose
- Node.js (for local development/scripts)
- Ports 3000 (API/UI), 6379 (Redis), 27017 (MongoDB) available

---

## Getting Started

1. **Build and start all services:**
   ```bash
   docker compose up --build
   ```

2. **Access the dashboard:**
   - Open [http://localhost:3000/pedidos](http://localhost:3000/pedidos)

---

## UI Controls

- **Gerar Pedidos (Generate Orders):** Starts the order generation process (waits for completion before enabling queueing).
- **Processar Pedidos (Process Orders):** Enqueues and starts processing orders (runs worker jobs).
- **Resetar Banco (Reset Database):** Clears all orders, statuses, and queues (safe to use only when no jobs are running).

**Note:**  
Buttons are automatically enabled/disabled based on the current state to prevent invalid actions (e.g., cannot process while generating or reset while processing).

---

## Metrics & Monitoring

- **Order Generation Time:** Shows how long it took to generate DIAMANTE and NORMAL orders.
- **Processing & Saving Times:** Displays processing and saving times per priority.
- **Start/End Timestamps:** Shows when processing started and finished for each priority.
- **Total Execution Time:** Shows the total time for the full process.
- **Processed Counts:** Displays how many orders were processed per type (VIP and Normal).
- **Queue Status:** Real-time stats for BullMQ queues (pending, active, completed, failed, average time).
- **Live Logs:** All backend logs are streamed to the UI in real time.

---

## Configuration

- Adjust `.env` for:
  - `TOTAL_ORDERS` (default: 1000000)
  - `CHUNK_SIZE` (default: 10000)
  - `BULK_BATCH` (default: 5000)
  - `REDIS_HOST`, `REDIS_PORT`, `MONGO_URL`, etc.

---

## Implementation Notes

- Order generation and queueing run as detached child processes to avoid blocking the API.
- All logs (including from detached scripts) are published via Redis Pub/Sub and streamed to the frontend.
- The system is designed for high throughput and can be tuned via environment variables.

---

## Troubleshooting

- **Redis connection errors:** Ensure `REDIS_HOST` is set to `redis` in Docker Compose, and the Redis service is running.
- **MongoDB slow queries:** For very large datasets, ensure MongoDB has enough resources and consider adding indexes.
- **UI not updating:** Check browser console and backend logs for errors.

---

## License

MIT