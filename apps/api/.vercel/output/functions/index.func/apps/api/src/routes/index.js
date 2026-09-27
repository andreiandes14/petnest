import { Router } from "express";
import healthRouter from "./health.js";
import petnestRouter from "./petnest.js";
const router = Router();
router.use(healthRouter);
router.use(petnestRouter);
export default router;
//# sourceMappingURL=index.js.map