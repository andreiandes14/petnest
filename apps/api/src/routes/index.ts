import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import petnestRouter from "./petnest.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(petnestRouter);

export default router;
