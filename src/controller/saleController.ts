import { Request, Response } from "express";
import { PrismaClient, ProductStatus } from "../generated/prisma";
import { prisma } from "../config/database";

// ==================== ADMIN ENDPOINTS ====================

// Create a new sale/promotion
export const createSale = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const {
            name,
            description,
            discountType,
            discountValue,
            applyTo = "all",
            categoryIds = [],
            productIds = [],
            tags = [],
            startsAt,
            endsAt,
            isActive = true,
            showCountdown = false,
            bannerText,
            bannerColor = "#FF5733",
        } = req.body;

        // Validate required fields
        if (!name || !discountType || !discountValue || !startsAt || !endsAt) {
            return res.status(400).json({
                message: "Missing required fields: name, discountType, discountValue, startsAt, endsAt",
            });
        }

        // Validate discount type
        if (!["percentage", "fixed"].includes(discountType)) {
            return res.status(400).json({
                message: "discountType must be 'percentage' or 'fixed'",
            });
        }

        // Validate apply to
        if (!["all", "category", "products", "tags"].includes(applyTo)) {
            return res.status(400).json({
                message: "applyTo must be 'all', 'category', 'products', or 'tags'",
            });
        }

        const sale = await prisma.sale.create({
            data: {
                name,
                description,
                discountType,
                discountValue: parseFloat(discountValue),
                applyTo,
                categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
                productIds: Array.isArray(productIds) ? productIds : [],
                tags: Array.isArray(tags) ? tags : [],
                startsAt: new Date(startsAt),
                endsAt: new Date(endsAt),
                isActive: Boolean(isActive),
                showCountdown: Boolean(showCountdown),
                bannerText,
                bannerColor,
            },
        });

        // If sale is active and starts now, apply to matching products
        if (isActive && new Date(startsAt) <= new Date()) {
            await applySaleToProducts(sale);
        }

        res.status(201).json({
            message: "Sale created successfully",
            sale,
        });
    } catch (err) {
        console.error("Create sale error:", err);
        res.status(500).json({ message: "Error creating sale" });
    }
};

// Update an existing sale
export const updateSale = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const existingSale = await prisma.sale.findUnique({ where: { id } });
        if (!existingSale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        const {
            name,
            description,
            discountType,
            discountValue,
            applyTo,
            categoryIds,
            productIds,
            tags,
            startsAt,
            endsAt,
            isActive,
            showCountdown,
            bannerText,
            bannerColor,
        } = req.body;

        const sale = await prisma.sale.update({
            where: { id },
            data: {
                name,
                description,
                discountType,
                discountValue: discountValue ? parseFloat(discountValue) : undefined,
                applyTo,
                categoryIds: categoryIds !== undefined ? categoryIds : undefined,
                productIds: productIds !== undefined ? productIds : undefined,
                tags: tags !== undefined ? tags : undefined,
                startsAt: startsAt ? new Date(startsAt) : undefined,
                endsAt: endsAt ? new Date(endsAt) : undefined,
                isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                showCountdown: showCountdown !== undefined ? Boolean(showCountdown) : undefined,
                bannerText,
                bannerColor,
            },
        });

        res.json({
            message: "Sale updated successfully",
            sale,
        });
    } catch (err) {
        console.error("Update sale error:", err);
        res.status(500).json({ message: "Error updating sale" });
    }
};

// Delete a sale
export const deleteSale = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const existingSale = await prisma.sale.findUnique({ where: { id } });
        if (!existingSale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Remove sale from products before deleting
        await removeSaleFromProducts(existingSale);

        await prisma.sale.delete({ where: { id } });

        res.json({ message: "Sale deleted successfully" });
    } catch (err) {
        console.error("Delete sale error:", err);
        res.status(500).json({ message: "Error deleting sale" });
    }
};

// Get all sales (admin)
export const getAllSales = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { status, page = 1, limit = 20 } = req.query;
        const now = new Date();

        const where: any = {};

        if (status === "active") {
            where.isActive = true;
            where.startsAt = { lte: now };
            where.endsAt = { gte: now };
        } else if (status === "upcoming") {
            where.startsAt = { gt: now };
        } else if (status === "expired") {
            where.endsAt = { lt: now };
        } else if (status === "inactive") {
            where.isActive = false;
        }

        const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
        const take = parseInt(limit as string);

        const [sales, total] = await Promise.all([
            prisma.sale.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: "desc" },
            }),
            prisma.sale.count({ where }),
        ]);

        // Add computed status to each sale
        const salesWithStatus = sales.map((sale) => ({
            ...sale,
            computedStatus: getSaleStatus(sale),
        }));

        res.json({
            sales: salesWithStatus,
            pagination: {
                page: parseInt(page as string),
                limit: take,
                total,
                pages: Math.ceil(total / take),
            },
        });
    } catch (err) {
        console.error("Get all sales error:", err);
        res.status(500).json({ message: "Error fetching sales" });
    }
};

// Manually activate a sale
export const activateSale = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const sale = await prisma.sale.update({
            where: { id },
            data: { isActive: true },
        });

        // Apply sale to products
        await applySaleToProducts(sale);

        res.json({
            message: "Sale activated successfully",
            sale,
        });
    } catch (err) {
        console.error("Activate sale error:", err);
        res.status(500).json({ message: "Error activating sale" });
    }
};

// Manually deactivate a sale
export const deactivateSale = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const existingSale = await prisma.sale.findUnique({ where: { id } });
        if (!existingSale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        // Remove sale from products
        await removeSaleFromProducts(existingSale);

        const sale = await prisma.sale.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({
            message: "Sale deactivated successfully",
            sale,
        });
    } catch (err) {
        console.error("Deactivate sale error:", err);
        res.status(500).json({ message: "Error deactivating sale" });
    }
};

// ==================== PUBLIC ENDPOINTS ====================

// Get active sales (public)
export const getActiveSales = async (req: Request, res: Response) => {
    try {
        const now = new Date();

        const sales = await prisma.sale.findMany({
            where: {
                isActive: true,
                startsAt: { lte: now },
                endsAt: { gte: now },
            },
            orderBy: { endsAt: "asc" }, // Show ending soonest first
        });

        // Add countdown info
        const salesWithCountdown = sales.map((sale) => ({
            id: sale.id,
            name: sale.name,
            description: sale.description,
            discountType: sale.discountType,
            discountValue: sale.discountValue,
            showCountdown: sale.showCountdown,
            bannerText: sale.bannerText,
            bannerColor: sale.bannerColor,
            endsAt: sale.endsAt,
            countdown: getCountdown(sale.endsAt),
        }));

        res.json({ sales: salesWithCountdown });
    } catch (err) {
        console.error("Get active sales error:", err);
        res.status(500).json({ message: "Error fetching active sales" });
    }
};

// Get specific sale countdown (public)
export const getSaleCountdown = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const sale = await prisma.sale.findUnique({ where: { id } });

        if (!sale) {
            return res.status(404).json({ message: "Sale not found" });
        }

        const now = new Date();
        const isActive = sale.isActive && sale.startsAt <= now && sale.endsAt >= now;

        res.json({
            id: sale.id,
            name: sale.name,
            isActive,
            showCountdown: sale.showCountdown,
            bannerText: sale.bannerText,
            bannerColor: sale.bannerColor,
            startsAt: sale.startsAt,
            endsAt: sale.endsAt,
            countdown: isActive ? getCountdown(sale.endsAt) : null,
        });
    } catch (err) {
        console.error("Get sale countdown error:", err);
        res.status(500).json({ message: "Error fetching sale countdown" });
    }
};

// ==================== HELPER FUNCTIONS ====================

// Get computed status for a sale
const getSaleStatus = (sale: any): string => {
    const now = new Date();
    if (!sale.isActive) return "inactive";
    if (sale.startsAt > now) return "upcoming";
    if (sale.endsAt < now) return "expired";
    return "active";
};

// Get countdown object
const getCountdown = (endsAt: Date) => {
    const now = new Date();
    const diff = new Date(endsAt).getTime() - now.getTime();

    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, expired: false };
};

// Apply sale discount to matching products
const applySaleToProducts = async (sale: any) => {
    const where: any = {
        status: ProductStatus.ACTIVE,
    };

    switch (sale.applyTo) {
        case "category":
            if (sale.categoryIds.length > 0) {
                where.categoryId = { in: sale.categoryIds };
            }
            break;
        case "products":
            if (sale.productIds.length > 0) {
                where.id = { in: sale.productIds };
            }
            break;
        case "tags":
            if (sale.tags.length > 0) {
                where.tags = { hasSome: sale.tags };
            }
            break;
        case "all":
        default:
            // No additional filter
            break;
    }

    await prisma.product.updateMany({
        where,
        data: {
            isOnSale: true,
            salePercentage: sale.discountType === "percentage" ? sale.discountValue : null,
            saleEndsAt: sale.endsAt,
        },
    });
};

// Remove sale discount from products
const removeSaleFromProducts = async (sale: any) => {
    const where: any = {
        isOnSale: true,
        saleEndsAt: sale.endsAt,
    };

    switch (sale.applyTo) {
        case "category":
            if (sale.categoryIds.length > 0) {
                where.categoryId = { in: sale.categoryIds };
            }
            break;
        case "products":
            if (sale.productIds.length > 0) {
                where.id = { in: sale.productIds };
            }
            break;
        case "tags":
            if (sale.tags.length > 0) {
                where.tags = { hasSome: sale.tags };
            }
            break;
    }

    await prisma.product.updateMany({
        where,
        data: {
            isOnSale: false,
            salePercentage: null,
            saleEndsAt: null,
        },
    });
};
