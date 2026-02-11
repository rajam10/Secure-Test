import { Router } from "express";
import attemptsRouter from "./attempts.js";
import eventsRouter from "./events.js";

const router = Router();

// More specific path first so /:id/events/batch is matched before /:id/timer, /:id/submit
router.use("/", eventsRouter);
router.use("/", attemptsRouter);

export default router;
