import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
// Preserve exact bytes for PayMongo's HMAC while keeping ordinary JSON routes unchanged.
app.use("/api/webhooks/paymongo", express.raw({ type: "application/json", limit: "1mb", inflate: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", router);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (error instanceof SyntaxError && status === 400) {
    res.status(400).json({ error: "Request body must contain valid JSON." });
    return;
  }
  if (status === 413) {
    res.status(413).json({ error: "The request is too large. Please use a smaller file." });
    return;
  }

  req.log.error({ err: error }, "Unhandled API request error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
};

app.use(errorHandler);

export default app;
