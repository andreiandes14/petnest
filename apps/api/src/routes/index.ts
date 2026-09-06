import { Router, type IRouter } from "express";
import healthRouter from "./health";
import petnestRouter from "./petnest";

const router: IRouter = Router();

router.use(healthRouter);
router.use(petnestRouter);

export default router;
