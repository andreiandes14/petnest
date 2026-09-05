import app from "./app";
import { logger } from "./lib/logger";
import { initializePetnestData } from "./routes/petnest";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  await initializePetnestData();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
} catch (err) {
  logger.error({ err }, "Unable to connect to the PetNest database");
  process.exit(1);
}
