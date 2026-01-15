import { Request, Response } from "express";
import { ProductStatus, ItemCondition } from "../generated/prisma";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { prisma } from "../config/database";

// ==================== DASHBOARD STATISTICS ====================

// Get dashboard overview stats (Admin)
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get date ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Product stats
    const [
      totalProducts,
      activeProducts,
      soldProducts,
      draftProducts,
      featuredProducts,
      onSaleProducts,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      prisma.product.count({ where: { status: ProductStatus.SOLD } }),
      prisma.product.count({ where: { status: ProductStatus.DRAFT } }),
      prisma.product.count({ where: { isFeatured: true, status: ProductStatus.ACTIVE } }),
      prisma.product.count({ where: { isOnSale: true, status: ProductStatus.ACTIVE } }),
    ]);

    // Order stats
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      completedOrders,
      todayOrders,
      weekOrders,
      monthOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({ where: { status: "PROCESSING" } }),
      prisma.order.count({ where: { status: { in: ["DELIVERED", "SHIPPED"] } } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
    ]);

    // Revenue stats
    const [todayRevenue, weekRevenue, monthRevenue, totalRevenue] = await Promise.all([
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, paymentStatus: "COMPLETED" },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: weekStart }, paymentStatus: "COMPLETED" },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { createdAt: { gte: monthStart }, paymentStatus: "COMPLETED" },
        _sum: { total: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: "COMPLETED" },
        _sum: { total: true },
      }),
    ]);

    // User stats
    const [totalUsers, verifiedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isVerified: true } }),
    ]);

    // Category stats
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: { where: { status: ProductStatus.ACTIVE } } },
        },
      },
    });

    // Active sales count
    const activeSales = await prisma.sale.count({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    });

    res.json({
      products: {
        total: totalProducts,
        active: activeProducts,
        sold: soldProducts,
        draft: draftProducts,
        featured: featuredProducts,
        onSale: onSaleProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        processing: processingOrders,
        completed: completedOrders,
        today: todayOrders,
        thisWeek: weekOrders,
        thisMonth: monthOrders,
      },
      revenue: {
        today: todayRevenue._sum.total || 0,
        thisWeek: weekRevenue._sum.total || 0,
        thisMonth: monthRevenue._sum.total || 0,
        total: totalRevenue._sum.total || 0,
      },
      users: {
        total: totalUsers,
        verified: verifiedUsers,
      },
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        productCount: cat._count.products,
      })),
      activeSales,
    });
  } catch (err) {
    console.error("Get dashboard stats error:", err);
    res.status(500).json({ message: "Error fetching dashboard stats" });
  }
};

// Get sales overview (Admin)
export const getSalesOverview = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));

    // Get daily sales for the period
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: startDate },
        paymentStatus: "COMPLETED",
      },
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Group by date
    const dailySales: Record<string, { date: string; orders: number; revenue: number }> = {};

    orders.forEach((order) => {
      const dateKey = order.createdAt.toISOString().split("T")[0];
      if (!dailySales[dateKey]) {
        dailySales[dateKey] = { date: dateKey, orders: 0, revenue: 0 };
      }
      dailySales[dateKey].orders++;
      dailySales[dateKey].revenue += order.total;
    });

    // Get top selling categories
    const soldProducts = await prisma.product.findMany({
      where: { status: ProductStatus.SOLD, soldAt: { gte: startDate } },
      include: { category: true },
    });

    const categoryStats: Record<string, { name: string; count: number; revenue: number }> = {};
    soldProducts.forEach((product) => {
      const catName = product.category?.name || "Uncategorized";
      if (!categoryStats[catName]) {
        categoryStats[catName] = { name: catName, count: 0, revenue: 0 };
      }
      categoryStats[catName].count++;
      categoryStats[catName].revenue += product.price;
    });

    // Get top brands
    const brandStats: Record<string, number> = {};
    soldProducts.forEach((product) => {
      if (product.brand) {
        brandStats[product.brand] = (brandStats[product.brand] || 0) + 1;
      }
    });

    const topBrands = Object.entries(brandStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([brand, count]) => ({ brand, count }));

    res.json({
      dailySales: Object.values(dailySales),
      topCategories: Object.values(categoryStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topBrands,
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    });
  } catch (err) {
    console.error("Get sales overview error:", err);
    res.status(500).json({ message: "Error fetching sales overview" });
  }
};

// ==================== CATEGORY MANAGEMENT ====================

// Get all categories (Admin)
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        subcategories: {
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    res.json({
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        imageUrl: cat.imageUrl,
        displayOrder: cat.displayOrder,
        isActive: cat.isActive,
        productCount: cat._count.products,
        subcategories: cat.subcategories,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      })),
    });
  } catch (err) {
    console.error("Get all categories error:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

// Create new category (Admin)
export const createCategory = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, description, displayOrder = 0, subcategories = [] } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Generate slug from name
    const slug = generateSlug(name);

    // Check if slug already exists
    const existingCategory = await prisma.category.findFirst({
      where: { slug },
    });

    if (existingCategory) {
      return res.status(400).json({ message: "Category with this name already exists" });
    }

    // Handle image upload
    let imageUrl: string | null = null;
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "categories");
      imageUrl = uploadResult.url;
    }

    // Create category with subcategories
    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        slug,
        description,
        imageUrl,
        displayOrder: parseInt(displayOrder),
        subcategories: {
          create: subcategories.map((sub: { name: string }, index: number) => ({
            name: sub.name.trim(),
            slug: generateSlug(sub.name),
            displayOrder: index,
          })),
        },
      },
      include: {
        subcategories: true,
      },
    });

    res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (err) {
    console.error("Create category error:", err);
    res.status(500).json({ message: "Error creating category" });
  }
};

// Update category (Admin)
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { name, description, displayOrder, isActive } = req.body;

    const updateData: any = {
      description,
      displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    };

    if (name) {
      updateData.name = name.trim();
      updateData.slug = generateSlug(name);
    }

    // Handle image upload
    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "categories");
      updateData.imageUrl = uploadResult.url;
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: {
        subcategories: true,
      },
    });

    res.json({
      message: "Category updated successfully",
      category,
    });
  } catch (err) {
    console.error("Update category error:", err);
    res.status(500).json({ message: "Error updating category" });
  }
};

// Delete category (Admin)
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if category has products
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category. It has ${productCount} product(s). Please reassign or delete them first.`,
      });
    }

    await prisma.$transaction(async (tx: any) => {
      // Delete subcategories first
      await tx.subCategory.deleteMany({
        where: { categoryId: id },
      });

      // Delete category
      await tx.category.delete({
        where: { id },
      });
    });

    res.json({ message: "Category deleted successfully" });
  } catch (err) {
    console.error("Delete category error:", err);
    res.status(500).json({ message: "Error deleting category" });
  }
};

// ==================== SUBCATEGORY MANAGEMENT ====================

// Add subcategory to category (Admin)
export const createSubcategory = async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const { name, displayOrder = 0 } = req.body;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: "Subcategory name is required" });
    }

    const slug = generateSlug(name);

    const subcategory = await prisma.subCategory.create({
      data: {
        name: name.trim(),
        slug,
        categoryId,
        displayOrder: parseInt(displayOrder),
      },
    });

    res.status(201).json({
      message: "Subcategory created successfully",
      subcategory,
    });
  } catch (err) {
    console.error("Create subcategory error:", err);
    res.status(500).json({ message: "Error creating subcategory" });
  }
};

// Update subcategory (Admin)
export const updateSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, displayOrder, isActive } = req.body;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const updateData: any = {
      displayOrder: displayOrder !== undefined ? parseInt(displayOrder) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
    };

    if (name) {
      updateData.name = name.trim();
      updateData.slug = generateSlug(name);
    }

    const subcategory = await prisma.subCategory.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: "Subcategory updated successfully",
      subcategory,
    });
  } catch (err) {
    console.error("Update subcategory error:", err);
    res.status(500).json({ message: "Error updating subcategory" });
  }
};

// Delete subcategory (Admin)
export const deleteSubcategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if subcategory has products
    const productCount = await prisma.product.count({
      where: { subcategoryId: id },
    });

    if (productCount > 0) {
      return res.status(400).json({
        message: `Cannot delete subcategory. It has ${productCount} product(s).`,
      });
    }

    await prisma.subCategory.delete({
      where: { id },
    });

    res.json({ message: "Subcategory deleted successfully" });
  } catch (err) {
    console.error("Delete subcategory error:", err);
    res.status(500).json({ message: "Error deleting subcategory" });
  }
};

// ==================== INVENTORY STATUS ====================

// Get inventory status (Admin) - for thrift, this shows product statuses
export const getInventoryStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Get counts by status
    const statusCounts = await prisma.product.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get counts by condition
    const conditionCounts = await prisma.product.groupBy({
      by: ["condition"],
      where: { status: ProductStatus.ACTIVE },
      _count: true,
    });

    // Get recent activity
    const recentSales = await prisma.product.findMany({
      where: { status: ProductStatus.SOLD },
      orderBy: { soldAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        price: true,
        soldAt: true,
        category: { select: { name: true } },
      },
    });

    const recentListings = await prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        price: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });

    res.json({
      statusCounts: statusCounts.reduce((acc: any, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
      conditionCounts: conditionCounts.reduce((acc: any, item) => {
        const condition = item.condition || 'UNKNOWN';
        acc[condition] = item._count;
        return acc;
      }, {}),
      recentSales,
      recentListings,
    });
  } catch (err) {
    console.error("Get inventory status error:", err);
    res.status(500).json({ message: "Error fetching inventory status" });
  }
};

// ==================== SYSTEM CONFIGURATION ====================

// Get system configuration (Admin)
export const getSystemConfig = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const [
      totalProducts,
      totalCategories,
      totalSubcategories,
      totalOrders,
      totalUsers,
      pricingConfig,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.subCategory.count(),
      prisma.order.count(),
      prisma.user.count(),
      prisma.pricingConfig.findFirst(),
    ]);

    const conditions = Object.values(ItemCondition);

    res.json({
      config: {
        conditions,
        statuses: Object.values(ProductStatus),
        stats: {
          totalProducts,
          totalCategories,
          totalSubcategories,
          totalOrders,
          totalUsers,
        },
        pricing: pricingConfig,
      },
    });
  } catch (err) {
    console.error("Get system config error:", err);
    res.status(500).json({ message: "Error fetching system configuration" });
  }
};

// ==================== HELPER FUNCTIONS ====================

// Generate URL-friendly slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};
