import "dotenv/config";
import cluster from "node:cluster";
import os from "node:os";

const WORKERS = 4;

if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} started`);
  console.log(`Starting ${WORKERS} workers...`);

  for (let i = 0; i < WORKERS; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} exited`);
  });
} else {
  await import("./server.js");
}