import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tariffRouter from "./tariff";
import botRouter from "./bot";
import usersRouter from "./users";
import scheduleRouter from "./schedule";
import servicesRouter from "./services";
import licenseRouter from "./license";
import geminiRouter from "./gemini";
import automodRouter from "./automod";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tariffRouter);
router.use(botRouter);
router.use(usersRouter);
router.use(scheduleRouter);
router.use(servicesRouter);
router.use(licenseRouter);
router.use(geminiRouter);
router.use(automodRouter);

export default router;
