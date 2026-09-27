import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
const app = express();
app.use(pinoHttp({
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
}));
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", router);
app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found." });
});
const errorHandler = (error, req, res, _next) => {
    const status = error.status;
    if (error instanceof SyntaxError && status === 400) {
        res.status(400).json({ error: "Request body must contain valid JSON." });
        return;
    }
    req.log.error({ err: error }, "Unhandled API request error");
    res.status(500).json({ error: "Something went wrong. Please try again." });
};
app.use(errorHandler);
export default app;
//# sourceMappingURL=app.js.map