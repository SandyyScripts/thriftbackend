import express from "express";
import {
  // Public endpoints
  getAllProducts,
  getProductById,
  getFeaturedProducts,
  getOnSaleProducts,
  getCategories,
  // Admin endpoints
  createProduct,
  updateProduct,
  deleteProduct,
  getAllProductsForAdmin,
  getProductByIdForAdmin,
  publishProduct,
  bulkUpdateSale,
  bulkFeatureProducts,
  bulkPublishProducts,
  bulkArchiveProducts,
} from "../controller/productController";
import { protect } from "../middlewares/auth.middleware";
import { adminOnly } from "../middlewares/admin.middleware";
import {
  uploadProductImages,
  handleUploadError,
} from "../middlewares/upload.middleware";

const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all active products (with filtering)
router.get("/", getAllProducts);

// Get categories with subcategories
router.get("/categories", getCategories);

// Get featured products
router.get("/featured", getFeaturedProducts);

// Get products on sale
router.get("/on-sale", getOnSaleProducts);

// Get single product by ID
router.get("/:id", getProductById);

// ==================== ADMIN ROUTES ====================

router.use(protect);

// Get all products for admin (including drafts, archived, sold)
router.get("/admin/all", adminOnly, getAllProductsForAdmin);

// Get single product for admin (any status)
router.get("/admin/:id", adminOnly, getProductByIdForAdmin);

// Create new product (with multiple image upload)
router.post(
  "/admin/products",
  adminOnly,
  uploadProductImages,
  handleUploadError,
  createProduct
);

// Update product
router.put(
  "/admin/:id",
  adminOnly,
  uploadProductImages,
  handleUploadError,
  updateProduct
);

// Delete/Archive product
router.delete("/admin/:id", adminOnly, deleteProduct);

// Publish product (DRAFT -> ACTIVE)
router.post("/admin/:id/publish", adminOnly, publishProduct);

// Bulk operations
router.post("/admin/bulk/publish", adminOnly, bulkPublishProducts);
router.post("/admin/bulk/archive", adminOnly, bulkArchiveProducts);
router.post("/admin/bulk/feature", adminOnly, bulkFeatureProducts);
router.post("/admin/bulk/sale", adminOnly, bulkUpdateSale);

export default router;
