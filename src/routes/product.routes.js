import { Router } from "express";

import {
  getAll,
  getById,
  create,
  update,
  remove,
  updateStatus
} from "../controllers/product.controller.js";

const router = Router();

router.get("/", getAll);
router.get("/:id", getById);

router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

router.patch("/:id/status", updateStatus);

export default router;