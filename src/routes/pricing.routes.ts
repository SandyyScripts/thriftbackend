import express from "express";
import {
    // Pricing Rules
    createPricingRule,
    updatePricingRule,
    deletePricingRule,
    getAllPricingRules,
    previewPricingRule,
    applyPricingRule,
    // Pricing Config
    getPricingConfig,
    updatePricingConfig,
    // Bulk Operations
    bulkUpdatePrices,
    bulkSetCustomPrices,
    revertPriceChanges,
    // Price History
    getPriceHistory,
    getRecentPriceChanges,
} from "../controller/pricingController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = express.Router();

// All pricing routes require admin access
router.use(protect);
router.use(adminOnly);

// ==================== PRICING RULES ====================

// Get all pricing rules
router.get("/rules", getAllPricingRules);

// Create new pricing rule
router.post("/rules", createPricingRule);

// Update pricing rule
router.put("/rules/:id", updatePricingRule);

// Delete pricing rule
router.delete("/rules/:id", deletePricingRule);

// Preview pricing rule application
router.post("/rules/:id/preview", previewPricingRule);

// Apply pricing rule to products
router.post("/rules/:id/apply", applyPricingRule);

// ==================== GLOBAL PRICING CONFIG ====================

// Get pricing config
router.get("/config", getPricingConfig);

// Update pricing config
router.put("/config", updatePricingConfig);

// ==================== BULK OPERATIONS ====================

// Bulk update prices (percentage or fixed adjustment)
router.post("/bulk/update", bulkUpdatePrices);

// Set custom prices for specific products
router.post("/bulk/custom", bulkSetCustomPrices);

// Revert a bulk price update
router.post("/bulk/revert", revertPriceChanges);

// ==================== PRICE HISTORY ====================

// Get recent price changes
router.get("/history", getRecentPriceChanges);

// Get price history for specific product
router.get("/history/:productId", getPriceHistory);

export default router;
