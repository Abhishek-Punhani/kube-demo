import { BaseApp } from "../../shared/baseApp";
import { DatabaseManager } from "../../shared/dbManager";
import { QueueManager } from "../../shared/queueManager";
import { allowedOrigins, config } from "./config";
import { setupQueues } from "./queue.setup";

// Initialize database
const db = DatabaseManager.getInstance(config);

// Initialize queue manager
const queueManager = QueueManager.getInstance();

// Initialize app with auth-specific configuration
const app = new BaseApp({
  serviceName: "DemoServer",
  config: config,
  enableSessions: true,
  enableFileUpload: true,
  enableQueues: true,
  customRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Stricter for auth service
  },
  customCors: {
    origin: allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  },
});

// Setup routes

// Start server and initialize auth-specific queues
async function startServer() {
  await app.start(db, config.PORT);

  // Initialize auth server queues and workers
  if (app.queueManager) {
    await setupQueues(app.queueManager);
  }
}

startServer();

process.on("SIGTERM", () => app.shutdown(db));
process.on("SIGINT", () => app.shutdown(db));
