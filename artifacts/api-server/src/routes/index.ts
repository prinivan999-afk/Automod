import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tariffRouter from "./tariff";
import botRouter from "./bot";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tariffRouter);
router.use(botRouter);

export default router;
