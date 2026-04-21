import { Router, type IRouter } from "express";
import healthRouter from "./health";
import leadsRouter from "./leads";
import tariffRouter from "./tariff";
import botRouter from "./bot";
import usersRouter from "./users";
import scheduleRouter from "./schedule";
import licenseRouter from "./license";
import geminiRouter from "./gemini";
import automodRouter from "./automod";
import googleCalendarRouter from "./google-calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(leadsRouter);
router.use(tariffRouter);
router.use(botRouter);
router.use(usersRouter);
router.use(scheduleRouter);
router.use(licenseRouter);
router.use(geminiRouter);
router.use(automodRouter);
router.use(googleCalendarRouter);

export default router;
