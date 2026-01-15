import express from "express";
import {
    addToWishlist,
    removeFromWishlist,
    getUserWishlist,
    checkIfWishlisted,
    getWishlistCount,
    clearWishlist,
} from "../controller/wishlistController";
import { protect } from "../middlewares/auth.middleware";

const router = express.Router();

// All wishlist routes require authentication
router.use(protect);

// Get user's wishlist
router.get("/", getUserWishlist);

// Get wishlist count
router.get("/count", getWishlistCount);

// Clear entire wishlist
router.delete("/clear", clearWishlist);

// Check if product is in wishlist
router.get("/check/:productId", checkIfWishlisted);

// Add product to wishlist
router.post("/add/:productId", addToWishlist);

// Remove product from wishlist
router.delete("/:productId", removeFromWishlist);

export default router;
