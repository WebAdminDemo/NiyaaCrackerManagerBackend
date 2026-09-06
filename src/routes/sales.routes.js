import { Router } from "express";
import * as c from "../controllers/sales.controller.js";
const router = Router();
router.get("/orders", c.orders);
router.get("/analytics", c.analytics);
router.patch("/orders/:id/status", c.updateStatus);
router.get("/top-customers", c.topCustomers);
export default router;
