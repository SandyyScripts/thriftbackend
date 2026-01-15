import express from "express";
import {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  getAllOrders,
  bulkUpdateOrders,
  cancelOrder,
} from "../controller/orderController";
import { protect, optionalAuth } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = express.Router();

// Create order supports guest checkout
router.post("/", optionalAuth, createOrder);

// Get user's orders (requires authentication)
router.get("/", protect, getUserOrders);

// Cancel order (user can cancel own, admin can cancel any)
router.post("/:id/cancel", protect, cancelOrder);

// Track order by ID (public - no authentication required)
router.get("/:id", getOrderById);

// Admin routes (admin role required)
router.put("/:id/status", protect, adminOnly, updateOrderStatus);
router.get("/admin/all", protect, adminOnly, getAllOrders);
router.put("/admin/bulk-update", protect, adminOnly, bulkUpdateOrders);

export default router;

