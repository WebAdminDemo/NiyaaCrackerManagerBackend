import { Router } from "express";
import * as controller from "../controllers/sales.controller.js";

const router = Router();

router.get("/orders", controller.orders);
router.get("/analytics", controller.analytics);
router.get("/top-customers", controller.topCustomers);

router.patch("/orders/:id", controller.updateOrder);
router.put("/orders/:id", controller.updateOrder);
router.patch("/orders/:id/status", controller.updateStatus);
router.patch("/orders/:id/items", controller.updateItems);

export default router;
