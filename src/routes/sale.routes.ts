import express from "express";
import {
    // Admin endpoints
    createSale,
    updateSale,
    deleteSale,
    getAllSales,
    activateSale,
    deactivateSale,
    // Public endpoints
    getActiveSales,
    getSaleCountdown,
} from "../controller/saleController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get active sales (for banners and countdown)
router.get("/active", getActiveSales);

// Get specific sale countdown
router.get("/countdown/:id", getSaleCountdown);

// ==================== ADMIN ROUTES ====================

router.use(protect);

// Get all sales (admin)
router.get("/", adminOnly, getAllSales);

// Create new sale
router.post("/", adminOnly, createSale);

// Update sale
router.put("/:id", adminOnly, updateSale);

// Delete sale
router.delete("/:id", adminOnly, deleteSale);

// Activate sale
router.post("/:id/activate", adminOnly, activateSale);

// Deactivate sale
router.post("/:id/deactivate", adminOnly, deactivateSale);

export default router;
