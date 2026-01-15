import { Request, Response } from "express";
import { PrismaClient, ItemCondition, ProductStatus } from "@prisma/client";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { prisma } from "../config/database";

// ==================== HELPER FUNCTIONS ====================

// Helper function to delete images from Cloudinary
const deleteImages = async (cloudinaryIds: string[]) => {
  for (const publicId of cloudinaryIds) {
    if (publicId) {
      try {
        await deleteFromCloudinary(publicId);
      } catch (error) {
        console.error("Error deleting image from Cloudinary:", error);
      }
    }
  }
};

// Generate unique SKU for thrift items
const generateThriftSKU = (categorySlug: string, condition: string): string => {
  const conditionCode = condition.substring(0, 2).toUpperCase();
  const categoryCode = categorySlug.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TH-${categoryCode}-${conditionCode}-${timestamp}${random}`;
};

// Calculate sale price if product is on sale
const calculateSalePrice = (price: number, salePercentage: number | null, saleEndsAt: Date | null): number | null => {
  if (!salePercentage || salePercentage <= 0) return null;
  if (saleEndsAt && new Date(saleEndsAt) < new Date()) return null;
  return Math.round((price * (1 - salePercentage / 100)) * 100) / 100;
};

// Transform product for API response
const transformProduct = (product: any) => {
  const salePrice = calculateSalePrice(product.price, product.salePercentage, product.saleEndsAt);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    salePrice,
    originalRetailPrice: product.originalRetailPrice,
    compareAtPrice: product.compareAtPrice,
    condition: product.condition,
    size: product.size,
    measurements: product.measurements,
    brand: product.brand,
    color: product.color,
    material: product.material,
    category: product.category ? {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    } : null,
    subcategory: product.subcategory ? {
      id: product.subcategory.id,
      name: product.subcategory.name,
      slug: product.subcategory.slug,
    } : null,
    tags: product.tags,
    images: product.images,
    status: product.status,
    isFeatured: product.isFeatured,
    isOnSale: product.isOnSale,
    salePercentage: product.salePercentage,
    saleEndsAt: product.saleEndsAt,
    sku: product.sku,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    publishedAt: product.publishedAt,
    soldAt: product.soldAt,
  };
};

// ==================== PUBLIC ENDPOINTS ====================

// Get all active products (public)
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const {
      category,
      subcategory,
      condition,
      brand,
      size,
      minPrice,
      maxPrice,
      onSale,
      featured,
      search,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = page && page !== "undefined" ? parseInt(page as string) : 1;
    const limitNum = limit && limit !== "undefined" ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    // Build where clause for active products only
    const where: any = {
      status: ProductStatus.ACTIVE,
    };

    // Category filter
    if (category && category !== "undefined") {
      where.category = { slug: category };
    }

    // Subcategory filter
    if (subcategory && subcategory !== "undefined") {
      where.subcategory = { slug: subcategory };
    }

    // Condition filter
    if (condition && condition !== "undefined") {
      const conditions = (condition as string).split(",");
      where.condition = { in: conditions as ItemCondition[] };
    }

    // Brand filter
    if (brand && brand !== "undefined") {
      const brands = (brand as string).split(",");
      where.brand = { in: brands, mode: "insensitive" };
    }

    // Size filter
    if (size && size !== "undefined") {
      const sizes = (size as string).split(",");
      where.size = { in: sizes, mode: "insensitive" };
    }

    // Price range filter
    if ((minPrice && minPrice !== "undefined") || (maxPrice && maxPrice !== "undefined")) {
      where.price = {};
      if (minPrice && minPrice !== "undefined") where.price.gte = parseFloat(minPrice as string);
      if (maxPrice && maxPrice !== "undefined") where.price.lte = parseFloat(maxPrice as string);
    }

    // On sale filter
    if (onSale === "true") {
      where.isOnSale = true;
      where.saleEndsAt = { gte: new Date() };
    }

    // Featured filter
    if (featured === "true") {
      where.isFeatured = true;
    }

    // Search filter
    if (search && search !== "undefined") {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { brand: { contains: search as string, mode: "insensitive" } },
        { tags: { hasSome: [(search as string).toLowerCase()] } },
      ];
    }

    // Build orderBy clause
    let orderBy: any = { createdAt: "desc" };
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "price_low":
        orderBy = { price: "asc" };
        break;
      case "price_high":
        orderBy = { price: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: true,
          subcategory: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(transformProduct),
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("Get all products error:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
};

// Get single product by ID (public)
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        status: { in: [ProductStatus.ACTIVE, ProductStatus.RESERVED] },
      },
      include: {
        category: true,
        subcategory: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(transformProduct(product));
  } catch (err) {
    console.error("Get product by ID error:", err);
    res.status(500).json({ message: "Error fetching product" });
  }
};

// Get featured products (public)
export const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 8 } = req.query;

    const products = await prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        isFeatured: true,
      },
      take: parseInt(limit as string),
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        subcategory: true,
      },
    });

    res.json({ products: products.map(transformProduct) });
  } catch (err) {
    console.error("Get featured products error:", err);
    res.status(500).json({ message: "Error fetching featured products" });
  }
};

// Get products on sale (public)
export const getOnSaleProducts = async (req: Request, res: Response) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where = {
      status: ProductStatus.ACTIVE,
      isOnSale: true,
      saleEndsAt: { gte: new Date() },
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { salePercentage: "desc" },
        include: {
          category: true,
          subcategory: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(transformProduct),
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("Get on sale products error:", err);
    res.status(500).json({ message: "Error fetching sale products" });
  }
};

// Get categories with subcategories (public)
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: {
        subcategories: {
          where: { isActive: true },
          orderBy: { displayOrder: "asc" },
        },
        _count: {
          select: {
            products: {
              where: { status: ProductStatus.ACTIVE },
            },
          },
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
        productCount: cat._count.products,
        subcategories: cat.subcategories.map((sub) => ({
          id: sub.id,
          name: sub.name,
          slug: sub.slug,
        })),
      })),
    });
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

// ==================== ADMIN ENDPOINTS ====================

// Create new product (Admin only)
export const createProduct = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const {
      name,
      description,
      price,
      originalRetailPrice,
      condition = "GOOD",
      size,
      measurements,
      brand,
      color,
      material,
      categoryId,
      subcategoryId,
      tags,
      status = "DRAFT",
      isFeatured = false,
    } = req.body;

    // Validate required fields
    if (!name || !price || !categoryId) {
      return res.status(400).json({
        message: "Missing required fields: name, price, categoryId are required",
      });
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // Handle multiple image uploads
    let images: string[] = [];
    let cloudinaryIds: string[] = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, "products");
        images.push(uploadResult.url);
        cloudinaryIds.push(uploadResult.public_id);
      }
    } else if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "products");
      images.push(uploadResult.url);
      cloudinaryIds.push(uploadResult.public_id);
    }

    // Parse tags if string
    let parsedTags: string[] = [];
    if (tags) {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    }

    // Parse measurements if string
    let parsedMeasurements: any = null;
    if (measurements) {
      parsedMeasurements = typeof measurements === "string" ? JSON.parse(measurements) : measurements;
    }

    // Generate SKU
    const sku = generateThriftSKU(category.slug, condition);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        originalRetailPrice: originalRetailPrice ? parseFloat(originalRetailPrice) : null,
        condition: condition as ItemCondition,
        size,
        measurements: parsedMeasurements,
        brand,
        color,
        material,
        categoryId,
        subcategoryId: subcategoryId || null,
        tags: parsedTags,
        images,
        cloudinaryIds,
        status: status as ProductStatus,
        isFeatured: Boolean(isFeatured),
        sku,
        publishedAt: status === "ACTIVE" ? new Date() : null,
      },
      include: {
        category: true,
        subcategory: true,
      },
    });

    res.status(201).json({
      message: "Product created successfully",
      product: transformProduct(product),
    });
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Error creating product" });
  }
};

// Update product (Admin only)
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    const {
      name,
      description,
      price,
      originalRetailPrice,
      compareAtPrice,
      condition,
      size,
      measurements,
      brand,
      color,
      material,
      categoryId,
      subcategoryId,
      tags,
      status,
      isFeatured,
      isOnSale,
      salePercentage,
      saleEndsAt,
      removeImages, // Array of cloudinaryIds to remove
    } = req.body;

    // Handle image removal
    let updatedImages = [...existingProduct.images];
    let updatedCloudinaryIds = [...existingProduct.cloudinaryIds];

    if (removeImages && Array.isArray(removeImages)) {
      // Delete from Cloudinary
      await deleteImages(removeImages);

      // Remove from arrays
      removeImages.forEach((publicId: string) => {
        const index = updatedCloudinaryIds.indexOf(publicId);
        if (index > -1) {
          updatedCloudinaryIds.splice(index, 1);
          updatedImages.splice(index, 1);
        }
      });
    }

    // Handle new image uploads
    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const uploadResult = await uploadToCloudinary(file, "products");
        updatedImages.push(uploadResult.url);
        updatedCloudinaryIds.push(uploadResult.public_id);
      }
    } else if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "products");
      updatedImages.push(uploadResult.url);
      updatedCloudinaryIds.push(uploadResult.public_id);
    }

    // Parse tags if string
    let parsedTags: string[] | undefined;
    if (tags !== undefined) {
      parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
    }

    // Parse measurements if string
    let parsedMeasurements: any | undefined;
    if (measurements !== undefined) {
      parsedMeasurements = typeof measurements === "string" ? JSON.parse(measurements) : measurements;
    }

    // Track price change for history
    const oldPrice = existingProduct.price;
    const newPrice = price ? parseFloat(price) : oldPrice;
    const priceChanged = newPrice !== oldPrice;

    // Determine publishedAt
    let publishedAt = existingProduct.publishedAt;
    if (status === "ACTIVE" && existingProduct.status !== ProductStatus.ACTIVE) {
      publishedAt = new Date();
    }

    const product = await prisma.$transaction(async (tx) => {
      // Update product
      const updated = await tx.product.update({
        where: { id },
        data: {
          name,
          description,
          price: newPrice,
          originalRetailPrice: originalRetailPrice !== undefined ? parseFloat(originalRetailPrice) || null : undefined,
          compareAtPrice: compareAtPrice !== undefined ? parseFloat(compareAtPrice) || null : undefined,
          condition: condition as ItemCondition | undefined,
          size,
          measurements: parsedMeasurements,
          brand,
          color,
          material,
          categoryId,
          subcategoryId: subcategoryId || null,
          tags: parsedTags,
          images: updatedImages,
          cloudinaryIds: updatedCloudinaryIds,
          status: status as ProductStatus | undefined,
          isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : undefined,
          isOnSale: isOnSale !== undefined ? Boolean(isOnSale) : undefined,
          salePercentage: salePercentage !== undefined ? parseFloat(salePercentage) || null : undefined,
          saleEndsAt: saleEndsAt !== undefined ? (saleEndsAt ? new Date(saleEndsAt) : null) : undefined,
          publishedAt,
        },
        include: {
          category: true,
          subcategory: true,
        },
      });

      // Record price history if price changed
      if (priceChanged) {
        await tx.priceHistory.create({
          data: {
            productId: id,
            previousPrice: oldPrice,
            newPrice,
            changeReason: "manual",
            changedBy: user.id,
          },
        });
      }

      return updated;
    });

    res.json({
      message: "Product updated successfully",
      product: transformProduct(product),
    });
  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ message: "Error updating product" });
  }
};

// Delete/Archive product (Admin only)
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent = false } = req.query;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (permanent === "true") {
      // Permanent deletion
      await prisma.$transaction(async (tx) => {
        // Delete wishlists
        await tx.wishlist.deleteMany({ where: { productId: id } });

        // Delete cart items
        await tx.cartItem.deleteMany({ where: { productId: id } });

        // Delete price history
        await tx.priceHistory.deleteMany({ where: { productId: id } });

        // Delete product
        await tx.product.delete({ where: { id } });
      });

      // Delete images from Cloudinary
      await deleteImages(existingProduct.cloudinaryIds);

      res.json({ message: "Product permanently deleted" });
    } else {
      // Soft delete (archive)
      await prisma.product.update({
        where: { id },
        data: { status: ProductStatus.ARCHIVED },
      });

      res.json({ message: "Product archived successfully" });
    }
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ message: "Error deleting product" });
  }
};

// Get all products for admin (including drafts, archived, sold)
export const getAllProductsForAdmin = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const {
      category,
      status,
      condition,
      search,
      sort = "newest",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = page && page !== "undefined" ? parseInt(page as string) : 1;
    const limitNum = limit && limit !== "undefined" ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const where: any = {};

    // Status filter
    if (status && status !== "undefined") {
      const statuses = (status as string).split(",");
      where.status = { in: statuses as ProductStatus[] };
    }

    // Category filter
    if (category && category !== "undefined") {
      where.categoryId = category;
    }

    // Condition filter
    if (condition && condition !== "undefined") {
      const conditions = (condition as string).split(",");
      where.condition = { in: conditions as ItemCondition[] };
    }

    // Search filter
    if (search && search !== "undefined") {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { sku: { contains: search as string, mode: "insensitive" } },
        { brand: { contains: search as string, mode: "insensitive" } },
      ];
    }

    // Build orderBy
    let orderBy: any = { createdAt: "desc" };
    switch (sort) {
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "price_low":
        orderBy = { price: "asc" };
        break;
      case "price_high":
        orderBy = { price: "desc" };
        break;
      case "name":
        orderBy = { name: "asc" };
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          category: true,
          subcategory: true,
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map(transformProduct),
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("Get admin products error:", err);
    res.status(500).json({ message: "Error fetching products" });
  }
};

// Get single product for admin (any status)
export const getProductByIdForAdmin = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subcategory: true,
      },
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(transformProduct(product));
  } catch (err) {
    console.error("Get admin product by ID error:", err);
    res.status(500).json({ message: "Error fetching product" });
  }
};

// Publish product (change from DRAFT to ACTIVE)
export const publishProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
      },
      include: {
        category: true,
        subcategory: true,
      },
    });

    res.json({
      message: "Product published successfully",
      product: transformProduct(product),
    });
  } catch (err) {
    console.error("Publish product error:", err);
    res.status(500).json({ message: "Error publishing product" });
  }
};

// Mark product as sold (called after order completes)
export const markAsSold = async (productId: string): Promise<void> => {
  await prisma.product.update({
    where: { id: productId },
    data: {
      status: ProductStatus.SOLD,
      soldAt: new Date(),
    },
  });
};

// Bulk update sale on products (Admin only)
export const bulkUpdateSale = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { productIds, isOnSale, salePercentage, saleEndsAt } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array is required" });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: {
        isOnSale: Boolean(isOnSale),
        salePercentage: salePercentage ? parseFloat(salePercentage) : null,
        saleEndsAt: saleEndsAt ? new Date(saleEndsAt) : null,
        compareAtPrice: isOnSale ? undefined : null, // Reset compare price if sale removed
      },
    });

    res.json({
      message: `Sale updated on ${result.count} products`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Bulk update sale error:", err);
    res.status(500).json({ message: "Error updating sale" });
  }
};

// Bulk feature products (Admin only)
export const bulkFeatureProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { productIds, isFeatured } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array is required" });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { isFeatured: Boolean(isFeatured) },
    });

    res.json({
      message: `${result.count} products ${isFeatured ? "featured" : "unfeatured"}`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Bulk feature products error:", err);
    res.status(500).json({ message: "Error updating featured status" });
  }
};

// Bulk publish products (Admin only)
export const bulkPublishProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array is required" });
    }

    const result = await prisma.product.updateMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.DRAFT,
      },
      data: {
        status: ProductStatus.ACTIVE,
        publishedAt: new Date(),
      },
    });

    res.json({
      message: `${result.count} products published`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Bulk publish products error:", err);
    res.status(500).json({ message: "Error publishing products" });
  }
};

// Bulk archive products (Admin only)
export const bulkArchiveProducts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "productIds array is required" });
    }

    const result = await prisma.product.updateMany({
      where: { id: { in: productIds } },
      data: { status: ProductStatus.ARCHIVED },
    });

    res.json({
      message: `${result.count} products archived`,
      updatedCount: result.count,
    });
  } catch (err) {
    console.error("Bulk archive products error:", err);
    res.status(500).json({ message: "Error archiving products" });
  }
};
