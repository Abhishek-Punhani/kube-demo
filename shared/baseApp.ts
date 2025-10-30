import express, { Application, Request, Response, NextFunction } from "express";
import morgan from "morgan";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import cookieParser from "cookie-parser";
import compression from "compression";
import fileUpload from "express-fileupload";
import cors from "cors";
import createHttpError from "http-errors";
import session from "express-session";
import MongoStore from "connect-mongo";
import bodyParser from "body-parser";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import http from "http";
import { QueueManager } from "./queueManager";
import { RedisManager } from "./redisManager";
import responseTime from "response-time";

import { errorHandler } from "../middleware/errorHandler";
import { BaseConfig } from "../types/config";
import webSocketService from "./webSocketServer";
import { DatabaseManager } from "./dbManager";

import winston from "winston";
const LokiTransport = require("winston-loki");

export interface AppOptions {
  serviceName: string;
  config: BaseConfig;
  enableSockets?: boolean;
  enableSessions?: boolean;
  enableFileUpload?: boolean;
  enableQueues?: boolean;
  disableCors?: boolean; // new option, default false
  customRateLimit?: {
    windowMs: number;
    max: number;
  };
  customCors?: cors.CorsOptions;
  promClient?: any;
}

export class BaseApp {
  public app: Application;
  public server?: http.Server;
  public io?: Server;
  public queueManager?: QueueManager;
  public promClient?: any;
  private config: BaseConfig;
  private serviceName: string;
  private logger?: winston.Logger;

  constructor(options: AppOptions) {
    this.app = express();
    this.config = options.config;
    this.serviceName = options.serviceName;
    this.promClient = require("prom-client");

    this.setupLogger();
    this.setupPrometheus();

    this.initializeMiddleware(options);

    if (options.enableSockets) {
      this.initializeSocketIO();
    }

    if (options.enableQueues) {
      this.initializeQueues();
    }
  }

  private setupLogger(): void {
    const lokiHost =
      (this.config as any).LOKI_URL ||
      process.env.LOKI_URL ||
      "http://localhost:3000";

    this.logger = winston.createLogger({
      level: (this.config as any).LOG_LEVEL || process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format:
            this.config.NODE_ENV === "production"
              ? winston.format.json()
              : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple()
                ),
        }),
        new LokiTransport({
          host: lokiHost,
          labels: { service: this.serviceName },
          json: true,
          // optional: add timeout/interval options if needed
          // timeout: 10000,
        }),
      ],
      exitOnError: false,
    });
  }

  private async setupPrometheus(): Promise<void> {
    if (this.promClient) {
      const reqResTime = new this.promClient.Histogram({
        name: "http_request_duration_seconds",
        help: "Duration of HTTP requests in seconds",
        labelNames: ["method", "route", "status_code"],
        buckets: [1, 2, 5, 50, 100, 200, 300, 400, 500],
      });
      const TotalRequestCounter = new this.promClient.Counter({
        name: "http_requests_total",
        help: "Total number of HTTP requests",
      });
      const collectDefaultMetrics = this.promClient.collectDefaultMetrics;
      collectDefaultMetrics({ timeout: 5000 });
      this.app.use(
        responseTime((req: Request, res: Response, time: number) => {
          TotalRequestCounter.inc();
          reqResTime
            .labels(req.method, req.path, res.statusCode.toString())
            .observe(time);
        })
      );
      this.app.get("/metrics", async (req: Request, res: Response) => {
        res.set("Content-Type", this.promClient.register.contentType);
        res.end(await this.promClient.register.metrics());
      });
    }
  }

  private initializeMiddleware(options: AppOptions): void {
    // Trust proxy for deployment
    this.app.set("trust proxy", 1);

    // Morgan logging (stream to winston)
    const morganStream = {
      write: (message: string) => {
        if (this.logger) {
          this.logger.info(message.trim());
        } else {
          process.stdout.write(message);
        }
      },
    };

    // Development logging (uses winston via morganStream)
    if (this.config.NODE_ENV !== "production") {
      this.app.use(morgan("dev", { stream: morganStream }));
    } else {
      // In production use combined format
      this.app.use(morgan("combined", { stream: morganStream }));
    }

    // Security middleware
    this.app.disable("x-powered-by");
    this.app.use(
      helmet({
        contentSecurityPolicy: false,
      })
    );

    // Rate limiting
    const rateLimitConfig = options.customRateLimit || {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
    };

    const limiter = rateLimit({
      ...rateLimitConfig,
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use("/api/", limiter);

    // CORS configuration
    const corsOptions: cors.CorsOptions = options.customCors || {
      origin: this.config.CLIENT_URL,
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
    };
    // Apply CORS only if not explicitly disabled (default: enabled)
    if (!options.disableCors) {
      this.app.use(cors(corsOptions));
    }

    // Body parsing middleware
    this.app.use(cookieParser() as express.RequestHandler);
    this.app.use(
      bodyParser.urlencoded({ extended: false }) as express.RequestHandler
    );
    this.app.use(express.json({ limit: "10mb" }) as express.RequestHandler);
    this.app.use(
      express.urlencoded({ extended: false }) as express.RequestHandler
    );

    // Session middleware (optional)
    if (options.enableSessions !== false) {
      this.initializeSessions();
    }

    // File upload (optional)
    this.app.use(
      "/",
      fileUpload({
        useTempFiles: true,
        tempFileDir: "/tmp/",
        limits: { fileSize: 50 * 1024 * 1024 },
      }) as unknown as express.RequestHandler
    );

    // Health check endpoint
    this.app.get("/health", (req: Request, res: Response) => {
      res.status(200).json({
        status: "OK",
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    });

    // Security and optimization
    this.app.use("/", (req, res, next) => {
      // Only sanitize req.body and req.params, not req.query
      if (req.body) mongoSanitize.sanitize(req.body);
      if (req.params) mongoSanitize.sanitize(req.params);
      next();
    });
    this.app.use(compression());

    // Attach socket.io to request object for route handlers
    this.app.use("/", (req: any, res, next) => {
      req.io = this.io;
      next();
    });
  }

  private initializeSessions(): void {
    this.logger?.info("Initializing sessions");
    const store = MongoStore.create({
      mongoUrl: this.config.DB_URL,
      crypto: {
        secret: this.config.SESSION_SECRET,
      },
      touchAfter: 24 * 3600,
    });

    const sessionConfig: session.SessionOptions = {
      secret: this.config.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: this.config.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
        sameSite: this.config.NODE_ENV === "production" ? "none" : "lax",
      },
      store,
    };

    this.app.use(session(sessionConfig));
  }

  private initializeSocketIO(): void {
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      pingTimeout: 60000,
      cors: {
        origin: this.config.CLIENT_URL,
        credentials: true,
      },
    });

    // Attach socket.io to request object for route handlers
    this.app.use((req: any, res, next) => {
      req.io = this.io;
      next();
    });

    // Initialize global WebSocket service with io instance
    webSocketService.initializeWithIO(this.io);

    // Optionally: Make globally available
    (global as any).io = this.io;
    (global as any).webSocketService = webSocketService;

    this.logger?.info("Socket.IO initialized");
  }

  private async initializeQueues(): Promise<void> {
    this.queueManager = QueueManager.getInstance();
    await this.queueManager.initialize();
    (global as any).queueManager = this.queueManager;
    this.logger?.info("Queues initialized");
  }

  // Method to add routes
  public addRoutes(path: string, router: express.Router): void {
    this.app.use(path, router);
  }
  public initializeErrorHandling(): void {
    // 404 handler
    this.app.use("/", ((req: Request, res: Response, next: NextFunction) => {
      next(createHttpError.NotFound(`Route ${req.originalUrl} not found`));
    }) as express.RequestHandler);

    // Global error handler
    this.app.use("/", errorHandler as unknown as express.ErrorRequestHandler);
  }

  // Method to start the server
  public listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      const serverInstance = this.server || this.app;

      serverInstance.listen(port, () => {
        this.logger?.info(`🚀 ${this.serviceName} listening on port ${port}`);
        resolve();
      });
    });
  }

  // Method to add socket event handlers
  public addSocketHandlers(handler: (io: Server) => void): void {
    if (this.io) {
      handler(this.io);
    } else {
      throw new Error(
        "Socket.IO not initialized. Set enableSockets: true in options."
      );
    }
  }

  // Graceful shutdown
  public async close(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.logger?.info(`🛑 ${this.serviceName} server closed`);
          resolve();
        });
      });
    }
  }

  public async start(db: DatabaseManager, port: number) {
    try {
      await db.connect();

      // Initialize Redis if queues are enabled or if Redis is needed
      // Only connect if not already connected (may have been connected during queue initialization)
      const redisManager = RedisManager.getInstance();
      if (
        process.env.DISABLE_REDIS_QUEUES !== "true" &&
        !redisManager.isReady()
      ) {
        await redisManager.connect();
      }

      await this.listen(port);
      this.logger?.info(`🚀 ${this.serviceName} started successfully`);
    } catch (error) {
      this.logger?.error(`💥 Failed to start ${this.serviceName}:`, error);
      process.exit(1);
    }
  }

  public async shutdown(db: DatabaseManager) {
    this.logger?.info(`🛑 Shutting down ${this.serviceName}...`);
    if (this.queueManager) {
      await this.queueManager.shutdown();
    }

    // Disconnect Redis
    const redisManager = RedisManager.getInstance();
    await redisManager.disconnect();

    await this.close();
    await db.disconnect();
    process.exit(0);
  }
}
