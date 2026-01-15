import express from "express";
import {
  addToCart,
  getUserCart,
  removeFromCart,
  clearCart,
  getCartCount,
  checkCartAvailability,
  mergeGuestCart,
} from "../controller/cartController";
import { protect, optionalAuth } from "../middlewares/auth.middleware";

const router = express.Router();

// ==================== PUBLIC/GUEST ROUTES ====================
// These routes work for both authenticated users and guests

// Get cart (works with userId or guestId)
router.get("/", optionalAuth, getUserCart);

// Get cart item count
router.get("/count", optionalAuth, getCartCount);

// Check cart availability (before checkout)
router.get("/check-availability", optionalAuth, checkCartAvailability);

// Add to cart (works with userId or guestId)
router.post("/add", optionalAuth, addToCart);

// Remove from cart
router.delete("/:id", optionalAuth, removeFromCart);

// Clear cart
router.delete("/", optionalAuth, clearCart);

// ==================== AUTHENTICATED ROUTES ====================

// Merge guest cart to user cart (on login)
router.post("/merge", protect, mergeGuestCart);

export default router;
