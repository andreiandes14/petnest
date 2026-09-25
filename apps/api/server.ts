import app from "./src/app";
import { initializePetnestData } from "./src/routes/petnest";

// Run once per serverless instance. The initializer caches its promise, and
// individual database-backed routes await the same promise before accessing data.
await initializePetnestData();

export default app;
