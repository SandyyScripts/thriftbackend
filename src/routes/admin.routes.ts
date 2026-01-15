import express from "express";
import {
  // Dashboard
  getDashboardStats,
  getSalesOverview,
  // Categories
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  // Subcategories
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  // Inventory/Status
  getInventoryStatus,
  // System
  getSystemConfig,
} from "../controller/adminController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";
import {
  uploadCategoryImage,
  handleUploadError,
} from "../middlewares/upload.middleware";

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// ==================== DASHBOARD ====================
router.get("/dashboard", getDashboardStats);
router.get("/dashboard/sales", getSalesOverview);

// ==================== CATEGORY MANAGEMENT ====================
router.get("/categories", getAllCategories);
router.post("/categories", uploadCategoryImage, handleUploadError, createCategory);
router.put("/categories/:id", uploadCategoryImage, handleUploadError, updateCategory);
router.delete("/categories/:id", deleteCategory);

// ==================== SUBCATEGORY MANAGEMENT ====================
router.post("/categories/:categoryId/subcategories", createSubcategory);
router.put("/subcategories/:id", updateSubcategory);
router.delete("/subcategories/:id", deleteSubcategory);

// ==================== INVENTORY STATUS ====================
router.get("/inventory/status", getInventoryStatus);

// ==================== SYSTEM CONFIGURATION ====================
router.get("/config", getSystemConfig);

export default router;
