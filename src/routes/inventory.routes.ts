import express from "express";
import {
  getAllInventory,
  getProductInventory,
  updateInventory,
  bulkUpdateInventory,
  getLowStockAlerts,
} from "../controller/inventoryController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = express.Router();

// All inventory routes require authentication
router.use(protect);

// Public inventory routes (authenticated users can view)
router.get("/", getAllInventory);
router.get("/alerts", getLowStockAlerts);
router.get("/:productId", getProductInventory);

// Admin-only inventory routes
router.put("/bulk", adminOnly, bulkUpdateInventory);
router.put("/:productId", adminOnly, updateInventory);

export default router;
