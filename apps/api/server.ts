import app from "./src/app.js";
import { initializePetnestData } from "./src/routes/petnest.js";

// Run once per serverless instance. The initializer caches its promise, and
// individual database-backed routes await the same promise before accessing data.
await initializePetnestData();

export default app;
