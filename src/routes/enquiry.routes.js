import { Router } from "express";
import * as c from "../controllers/enquiry.controller.js";
const router = Router();
router.get("/", c.getOrders);
router.get("/:id", c.getOrder);
router.post("/", c.createOrder);
export default router;
