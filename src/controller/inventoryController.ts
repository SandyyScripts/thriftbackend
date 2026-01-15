import { Request, Response } from "express";
import { prisma } from "../config/database";

// Get all product inventory
export const getAllInventory = async (req: Request, res: Response) => {
  try {
    const { lowStock, category } = req.query;
    const lowStockThreshold = parseInt((lowStock as string) || "10");

    const where: any = {};
    if (category) {
      where.categoryId = category;
    }

    // Get products with their variants
    const products = await prisma.product.findMany({
      where: {
        ...where,
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        lowStockThreshold: true,
        status: true,
        category: {
          select: { name: true },
        },
        variants: {
          select: {
            id: true,
            name: true,
            sku: true,
            stock: true,
            lowStockThreshold: true,
            isActive: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const inventory = products.map((product) => {
      // Calculate total stock including variants
      const variantStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      const totalStock = product.variants.length > 0 ? variantStock : product.stock;
      const isLowStock = totalStock <= (product.lowStockThreshold || lowStockThreshold);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        category: product.category?.name,
        stock: product.stock,
        lowStockThreshold: product.lowStockThreshold,
        status: product.status,
        isLowStock,
        variants: product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          stock: v.stock,
          lowStockThreshold: v.lowStockThreshold,
          isActive: v.isActive,
          isLowStock: v.stock <= (v.lowStockThreshold || lowStockThreshold),
        })),
        totalStock,
      };
    });

    res.json({
      total: inventory.length,
      lowStockCount: inventory.filter((i) => i.isLowStock).length,
      inventory,
    });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ message: "Error fetching inventory" });
  }
};

// Get inventory for a specific product
export const getProductInventory = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { name: true } },
        variants: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variantStock = product.variants.reduce((sum, v) => sum + v.stock, 0);
    const totalStock = product.variants.length > 0 ? variantStock : product.stock;

    res.json({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category?.name,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
      totalStock,
      variants: product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku,
        stock: v.stock,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
      })),
    });
  } catch (error) {
    console.error("Error fetching product inventory:", error);
    res.status(500).json({ message: "Error fetching product inventory" });
  }
};

// Update product stock (Admin only)
export const updateInventory = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { stock, lowStockThreshold, variantId } = req.body;

    if (stock !== undefined && (typeof stock !== "number" || stock < 0)) {
      return res.status(400).json({
        message: "stock must be a non-negative number",
      });
    }

    if (variantId) {
      // Update variant stock
      const variant = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          ...(stock !== undefined && { stock }),
          ...(lowStockThreshold !== undefined && { lowStockThreshold }),
        },
      });

      res.json({
        message: "Variant inventory updated successfully",
        variant,
      });
    } else {
      // Update product stock
      const product = await prisma.product.update({
        where: { id: productId },
        data: {
          ...(stock !== undefined && { stock }),
          ...(lowStockThreshold !== undefined && { lowStockThreshold }),
        },
      });

      res.json({
        message: "Product inventory updated successfully",
        product,
      });
    }
  } catch (error) {
    console.error("Error updating inventory:", error);
    res.status(500).json({ message: "Error updating inventory" });
  }
};

// Bulk update inventory (Admin only)
export const bulkUpdateInventory = async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        message: "updates must be an array",
      });
    }

    const results = [];

    for (const update of updates) {
      const { productId, variantId, stock, lowStockThreshold } = update;

      try {
        if (variantId) {
          const variant = await prisma.productVariant.update({
            where: { id: variantId },
            data: {
              ...(stock !== undefined && { stock }),
              ...(lowStockThreshold !== undefined && { lowStockThreshold }),
            },
          });
          results.push({ variantId, success: true, stock: variant.stock });
        } else if (productId) {
          const product = await prisma.product.update({
            where: { id: productId },
            data: {
              ...(stock !== undefined && { stock }),
              ...(lowStockThreshold !== undefined && { lowStockThreshold }),
            },
          });
          results.push({ productId, success: true, stock: product.stock });
        } else {
          results.push({ success: false, error: "productId or variantId required" });
        }
      } catch (error) {
        results.push({
          productId: productId || variantId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    res.json({
      message: `Bulk update completed: ${successCount} successful, ${failureCount} failed`,
      results,
    });
  } catch (error) {
    console.error("Error bulk updating inventory:", error);
    res.status(500).json({ message: "Error bulk updating inventory" });
  }
};

// Get low stock alerts
export const getLowStockAlerts = async (req: Request, res: Response) => {
  try {
    const { threshold = 10 } = req.query;
    const alertThreshold = parseInt(threshold as string);

    // Get products with low stock
    const lowStockProducts = await prisma.product.findMany({
      where: {
        status: { not: "ARCHIVED" },
        stock: { lte: alertThreshold },
      },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { stock: "asc" },
    });

    // Get variants with low stock
    const lowStockVariants = await prisma.productVariant.findMany({
      where: {
        isActive: true,
        stock: { lte: alertThreshold },
      },
      include: {
        product: {
          select: { name: true, sku: true },
        },
      },
      orderBy: { stock: "asc" },
    });

    const productAlerts = lowStockProducts.map((p) => ({
      type: "product",
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category?.name,
      stock: p.stock,
      severity: p.stock === 0 ? "critical" : p.stock <= 5 ? "warning" : "info",
    }));

    const variantAlerts = lowStockVariants.map((v) => ({
      type: "variant",
      id: v.id,
      name: `${v.product.name} - ${v.name}`,
      sku: v.sku,
      productSku: v.product.sku,
      stock: v.stock,
      severity: v.stock === 0 ? "critical" : v.stock <= 5 ? "warning" : "info",
    }));

    const allAlerts = [...productAlerts, ...variantAlerts].sort((a, b) => a.stock - b.stock);

    res.json({
      threshold: alertThreshold,
      totalAlerts: allAlerts.length,
      criticalCount: allAlerts.filter((a) => a.severity === "critical").length,
      warningCount: allAlerts.filter((a) => a.severity === "warning").length,
      alerts: allAlerts,
    });
  } catch (error) {
    console.error("Error fetching low stock alerts:", error);
    res.status(500).json({ message: "Error fetching low stock alerts" });
  }
};
