import { Request, Response } from "express";
import { PrismaClient, ProductStatus } from "@prisma/client";
import { prisma } from "../config/database";

// ==================== WISHLIST ENDPOINTS ====================

// Add product to wishlist
export const addToWishlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { productId } = req.params;

        // Check if product exists and is active
        const product = await prisma.product.findFirst({
            where: {
                id: productId,
                status: ProductStatus.ACTIVE,
            },
        });

        if (!product) {
            return res.status(404).json({ message: "Product not found or not available" });
        }

        // Check if already in wishlist
        const existing = await prisma.wishlist.findUnique({
            where: {
                userId_productId: {
                    userId: user.id,
                    productId,
                },
            },
        });

        if (existing) {
            return res.status(400).json({ message: "Product already in wishlist" });
        }

        const wishlistItem = await prisma.wishlist.create({
            data: {
                userId: user.id,
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
            message: "Added to wishlist",
            wishlistItem: {
                id: wishlistItem.id,
                product: transformProduct(wishlistItem.product),
                createdAt: wishlistItem.createdAt,
            },
        });
    } catch (err) {
        console.error("Add to wishlist error:", err);
        res.status(500).json({ message: "Error adding to wishlist" });
    }
};

// Remove product from wishlist
export const removeFromWishlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { productId } = req.params;

        const wishlistItem = await prisma.wishlist.findUnique({
            where: {
                userId_productId: {
                    userId: user.id,
                    productId,
                },
            },
        });

        if (!wishlistItem) {
            return res.status(404).json({ message: "Product not in wishlist" });
        }

        await prisma.wishlist.delete({
            where: { id: wishlistItem.id },
        });

        res.json({ message: "Removed from wishlist" });
    } catch (err) {
        console.error("Remove from wishlist error:", err);
        res.status(500).json({ message: "Error removing from wishlist" });
    }
};

// Get user's wishlist
export const getUserWishlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const take = parseInt(limit as string);

        const [items, total] = await Promise.all([
            prisma.wishlist.findMany({
                where: { userId: user.id },
                skip,
                take,
                orderBy: { createdAt: "desc" },
                include: {
                    product: {
                        include: {
                            category: true,
                            subcategory: true,
                        },
                    },
                },
            }),
            prisma.wishlist.count({
                where: { userId: user.id },
            }),
        ]);

        // Filter out products that are no longer available
        const wishlistItems = items.map((item) => ({
            id: item.id,
            product: transformProduct(item.product),
            isAvailable: item.product.status === ProductStatus.ACTIVE,
            createdAt: item.createdAt,
        }));

        res.json({
            wishlist: wishlistItems,
            pagination: {
                page: parseInt(page as string),
                limit: take,
                total,
                pages: Math.ceil(total / take),
            },
        });
    } catch (err) {
        console.error("Get wishlist error:", err);
        res.status(500).json({ message: "Error fetching wishlist" });
    }
};

// Check if product is in wishlist
export const checkIfWishlisted = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { productId } = req.params;

        const wishlistItem = await prisma.wishlist.findUnique({
            where: {
                userId_productId: {
                    userId: user.id,
                    productId,
                },
            },
        });

        res.json({ isWishlisted: !!wishlistItem });
    } catch (err) {
        console.error("Check wishlist error:", err);
        res.status(500).json({ message: "Error checking wishlist" });
    }
};

// Get wishlist count
export const getWishlistCount = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        const count = await prisma.wishlist.count({
            where: { userId: user.id },
        });

        res.json({ count });
    } catch (err) {
        console.error("Get wishlist count error:", err);
        res.status(500).json({ message: "Error fetching wishlist count" });
    }
};

// Clear wishlist
export const clearWishlist = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;

        const result = await prisma.wishlist.deleteMany({
            where: { userId: user.id },
        });

        res.json({
            message: "Wishlist cleared",
            deletedCount: result.count,
        });
    } catch (err) {
        console.error("Clear wishlist error:", err);
        res.status(500).json({ message: "Error clearing wishlist" });
    }
};

// ==================== HELPER FUNCTIONS ====================

// Calculate sale price
const calculateSalePrice = (price: number, salePercentage: number | null, saleEndsAt: Date | null): number | null => {
    if (!salePercentage || salePercentage <= 0) return null;
    if (saleEndsAt && new Date(saleEndsAt) < new Date()) return null;
    return Math.round((price * (1 - salePercentage / 100)) * 100) / 100;
};

// Transform product for response
const transformProduct = (product: any) => {
    const salePrice = calculateSalePrice(product.price, product.salePercentage, product.saleEndsAt);

    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice,
        condition: product.condition,
        size: product.size,
        brand: product.brand,
        color: product.color,
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
        images: product.images,
        status: product.status,
        isOnSale: product.isOnSale,
        salePercentage: product.salePercentage,
        saleEndsAt: product.saleEndsAt,
        sku: product.sku,
    };
};
