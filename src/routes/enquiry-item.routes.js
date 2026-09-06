import { Router } from "express";
import { getAll } from "../controllers/enquiry-item.controller.js";
const router = Router();
router.get("/", getAll);
export default router;
