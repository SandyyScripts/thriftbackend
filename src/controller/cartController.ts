import { Request, Response } from "express";
import { PrismaClient, ProductStatus } from "../generated/prisma";
import { prisma } from "../config/database";

// ==================== CART ENDPOINTS ====================

// Add product to cart
export const addToCart = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.body.guestId || req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.status(400).json({
        message: "User must be logged in or provide a guest ID"
      });
    }

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "productId is required" });
    }

    // Check if product exists and is available
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: ProductStatus.ACTIVE,
      },
    });

    if (!product) {
      return res.status(404).json({
        message: "Product not found or not available"
      });
    }

    // Check if product is already in user's cart
    const existingCartItem = await prisma.cartItem.findFirst({
      where: {
        productId,
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
    });

    if (existingCartItem) {
      return res.status(400).json({
        message: "Product already in cart"
      });
    }

    // Check if product is in someone else's cart (optional reservation check)
    // For thrift, we might want to allow multiple people to have the same item in cart
    // But show a warning that it's a unique item

    // Create cart item
    const cartItem = await prisma.cartItem.create({
      data: {
        userId: userId || null,
        guestId: !userId ? guestId : null,
        productId,
      },
      include: {
        product: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Added to cart",
      cartItem: transformCartItem(cartItem),
    });
  } catch (err) {
    console.error("Add to cart error:", err);
    res.status(500).json({ message: "Error adding to cart" });
  }
};

// Get user's cart
export const getUserCart = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.json({
        cartItems: [],
        total: 0,
        itemCount: 0
      });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: {
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
      include: {
        product: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter out items where product is no longer available
    const availableItems = cartItems.filter(
      (item) => item.product.status === ProductStatus.ACTIVE
    );

    // Calculate cart total
    const total = availableItems.reduce((sum, item) => {
      const price = calculateItemPrice(item.product);
      return sum + price;
    }, 0);

    // Transform for response
    const transformedItems = cartItems.map((item) => ({
      ...transformCartItem(item),
      isAvailable: item.product.status === ProductStatus.ACTIVE,
    }));

    res.json({
      cartItems: transformedItems,
      total: Math.round(total * 100) / 100,
      itemCount: availableItems.length,
      hasUnavailableItems: cartItems.length !== availableItems.length,
    });
  } catch (err) {
    console.error("Get cart error:", err);
    res.status(500).json({ message: "Error fetching cart" });
  }
};

// Remove item from cart
export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;
    const { id } = req.params;

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id,
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
    });

    if (!cartItem) {
      return res.status(404).json({ message: "Cart item not found" });
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    res.json({ message: "Removed from cart" });
  } catch (err) {
    console.error("Remove from cart error:", err);
    res.status(500).json({ message: "Error removing from cart" });
  }
};

// Clear cart
export const clearCart = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.body.guestId || req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.json({ message: "Cart is already empty" });
    }

    const result = await prisma.cartItem.deleteMany({
      where: {
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
    });

    res.json({
      message: "Cart cleared",
      deletedCount: result.count,
    });
  } catch (err) {
    console.error("Clear cart error:", err);
    res.status(500).json({ message: "Error clearing cart" });
  }
};

// Get cart item count
export const getCartCount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.json({ count: 0 });
    }

    const count = await prisma.cartItem.count({
      where: {
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
        product: {
          status: ProductStatus.ACTIVE,
        },
      },
    });

    res.json({ count });
  } catch (err) {
    console.error("Get cart count error:", err);
    res.status(500).json({ message: "Error fetching cart count" });
  }
};

// Check product availability in cart
export const checkCartAvailability = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.id;
    const guestId = req.query.guestId as string || req.cookies?.guestId;

    if (!userId && !guestId) {
      return res.json({ unavailableProducts: [] });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: {
        OR: [
          { userId: userId || undefined },
          { guestId: guestId || undefined },
        ],
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    const unavailableProducts = cartItems
      .filter((item) => item.product.status !== ProductStatus.ACTIVE)
      .map((item) => ({
        cartItemId: item.id,
        productId: item.product.id,
        productName: item.product.name,
        status: item.product.status,
      }));

    res.json({
      unavailableProducts,
      hasUnavailable: unavailableProducts.length > 0,
    });
  } catch (err) {
    console.error("Check cart availability error:", err);
    res.status(500).json({ message: "Error checking cart availability" });
  }
};

// Merge guest cart to user cart (on login)
export const mergeGuestCart = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { guestId } = req.body;

    if (!user?.id || !guestId) {
      return res.status(400).json({
        message: "User ID and guest ID are required"
      });
    }

    // Get guest cart items
    const guestItems = await prisma.cartItem.findMany({
      where: { guestId },
    });

    // Get user's existing cart product IDs
    const userItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      select: { productId: true },
    });
    const userProductIds = new Set(userItems.map((item) => item.productId));

    // Merge non-duplicate items
    let mergedCount = 0;
    for (const guestItem of guestItems) {
      if (!userProductIds.has(guestItem.productId)) {
        await prisma.cartItem.update({
          where: { id: guestItem.id },
          data: {
            userId: user.id,
            guestId: null,
          },
        });
        mergedCount++;
      } else {
        // Delete duplicate
        await prisma.cartItem.delete({
          where: { id: guestItem.id },
        });
      }
    }

    res.json({
      message: `Merged ${mergedCount} items to your cart`,
      mergedCount,
    });
  } catch (err) {
    console.error("Merge cart error:", err);
    res.status(500).json({ message: "Error merging cart" });
  }
};

// ==================== HELPER FUNCTIONS ====================

// Calculate item price (including sale price)
const calculateItemPrice = (product: any): number => {
  if (product.isOnSale && product.salePercentage && product.saleEndsAt) {
    if (new Date(product.saleEndsAt) >= new Date()) {
      return product.price * (1 - product.salePercentage / 100);
    }
  }
  return product.price;
};

// Transform cart item for response
const transformCartItem = (item: any) => {
  const product = item.product;
  const salePrice = product.isOnSale && product.salePercentage && product.saleEndsAt
    ? (new Date(product.saleEndsAt) >= new Date()
      ? Math.round(product.price * (1 - product.salePercentage / 100) * 100) / 100
      : null)
    : null;

  return {
    id: item.id,
    productId: product.id,
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      salePrice,
      condition: product.condition,
      size: product.size,
      brand: product.brand,
      color: product.color,
      images: product.images,
      category: product.category ? {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      } : null,
      status: product.status,
      sku: product.sku,
    },
    effectivePrice: salePrice || product.price,
    createdAt: item.createdAt,
  };
};
