import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tariffRouter from "./tariff";
import botRouter from "./bot";
import usersRouter from "./users";
import scheduleRouter from "./schedule";
import licenseRouter from "./license";
import geminiRouter from "./gemini";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tariffRouter);
router.use(botRouter);
router.use(usersRouter);
router.use(scheduleRouter);
router.use(licenseRouter);
router.use(geminiRouter);

export default router;
