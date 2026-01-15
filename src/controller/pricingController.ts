import { Request, Response } from "express";
import { ProductStatus, ItemCondition } from "@prisma/client";
import { prisma } from "../config/database";

// ==================== PRICING RULES ====================

// Create a new pricing rule
export const createPricingRule = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const {
            name,
            description,
            ruleType,
            adjustmentType,
            adjustmentValue,
            applyTo = "all",
            categoryIds = [],
            subcategoryIds = [],
            conditions = [],
            brands = [],
            minPrice,
            maxPrice,
            priority = 0,
            isActive = true,
        } = req.body;

        // Validate required fields
        if (!name || !ruleType || !adjustmentType || adjustmentValue === undefined) {
            return res.status(400).json({
                message: "Missing required fields: name, ruleType, adjustmentType, adjustmentValue",
            });
        }

        // Validate rule type
        const validRuleTypes = ["markup", "markdown", "fixed_adjustment", "price_floor", "price_ceiling"];
        if (!validRuleTypes.includes(ruleType)) {
            return res.status(400).json({
                message: `ruleType must be one of: ${validRuleTypes.join(", ")}`,
            });
        }

        // Validate adjustment type
        if (!["percentage", "fixed"].includes(adjustmentType)) {
            return res.status(400).json({
                message: "adjustmentType must be 'percentage' or 'fixed'",
            });
        }

        const rule = await prisma.pricingRule.create({
            data: {
                name,
                description,
                ruleType,
                adjustmentType,
                adjustmentValue: parseFloat(adjustmentValue),
                applyTo,
                categoryIds: Array.isArray(categoryIds) ? categoryIds : [],
                subcategoryIds: Array.isArray(subcategoryIds) ? subcategoryIds : [],
                conditions: Array.isArray(conditions) ? conditions : [],
                brands: Array.isArray(brands) ? brands : [],
                minPrice: minPrice ? parseFloat(minPrice) : null,
                maxPrice: maxPrice ? parseFloat(maxPrice) : null,
                priority: parseInt(priority),
                isActive: Boolean(isActive),
            },
        });

        res.status(201).json({
            message: "Pricing rule created successfully",
            rule,
        });
    } catch (err) {
        console.error("Create pricing rule error:", err);
        res.status(500).json({ message: "Error creating pricing rule" });
    }
};

// Update a pricing rule
export const updatePricingRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const existingRule = await prisma.pricingRule.findUnique({ where: { id } });
        if (!existingRule) {
            return res.status(404).json({ message: "Pricing rule not found" });
        }

        const rule = await prisma.pricingRule.update({
            where: { id },
            data: req.body,
        });

        res.json({
            message: "Pricing rule updated successfully",
            rule,
        });
    } catch (err) {
        console.error("Update pricing rule error:", err);
        res.status(500).json({ message: "Error updating pricing rule" });
    }
};

// Delete a pricing rule
export const deletePricingRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        await prisma.pricingRule.delete({ where: { id } });

        res.json({ message: "Pricing rule deleted successfully" });
    } catch (err) {
        console.error("Delete pricing rule error:", err);
        res.status(500).json({ message: "Error deleting pricing rule" });
    }
};

// Get all pricing rules
export const getAllPricingRules = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { isActive } = req.query;

        const where: any = {};
        if (isActive !== undefined) {
            where.isActive = isActive === "true";
        }

        const rules = await prisma.pricingRule.findMany({
            where,
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        });

        res.json({ rules });
    } catch (err) {
        console.error("Get pricing rules error:", err);
        res.status(500).json({ message: "Error fetching pricing rules" });
    }
};

// Preview pricing rule application (without applying)
export const previewPricingRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const rule = await prisma.pricingRule.findUnique({ where: { id } });
        if (!rule) {
            return res.status(404).json({ message: "Pricing rule not found" });
        }

        // Get matching products
        const products = await getMatchingProducts(rule);

        // Calculate new prices
        const preview = products.map((product) => {
            const newPrice = calculateNewPrice(product.price, rule);
            return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                currentPrice: product.price,
                newPrice,
                change: newPrice - product.price,
                changePercent: ((newPrice - product.price) / product.price) * 100,
            };
        });

        const totalCurrentValue = products.reduce((sum, p) => sum + p.price, 0);
        const totalNewValue = preview.reduce((sum, p) => sum + p.newPrice, 0);

        res.json({
            affectedProducts: products.length,
            totalCurrentValue,
            totalNewValue,
            averageChange: products.length > 0
                ? ((totalNewValue - totalCurrentValue) / totalCurrentValue) * 100
                : 0,
            products: preview.slice(0, 50), // Limit preview to 50 products
        });
    } catch (err) {
        console.error("Preview pricing rule error:", err);
        res.status(500).json({ message: "Error previewing pricing rule" });
    }
};

// Apply pricing rule to products
export const applyPricingRule = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const rule = await prisma.pricingRule.findUnique({ where: { id } });
        if (!rule) {
            return res.status(404).json({ message: "Pricing rule not found" });
        }

        // Get matching products
        const products = await getMatchingProducts(rule);

        // Apply price changes in transaction
        const result = await prisma.$transaction(async (tx: any) => {
            let updatedCount = 0;

            for (const product of products) {
                const newPrice = calculateNewPrice(product.price, rule);

                // Skip if price is the same
                if (newPrice === product.price) continue;

                // Update product price
                await tx.product.update({
                    where: { id: product.id },
                    data: {
                        price: newPrice,
                        compareAtPrice: product.price, // Store original price for display
                    },
                });

                // Record price history
                await tx.priceHistory.create({
                    data: {
                        productId: product.id,
                        previousPrice: product.price,
                        newPrice,
                        changeReason: "pricing_rule",
                        ruleId: rule.id,
                        changedBy: user.id,
                    },
                });

                updatedCount++;
            }

            return updatedCount;
        });

        res.json({
            message: `Pricing rule applied to ${result} products`,
            updatedCount: result,
        });
    } catch (err) {
        console.error("Apply pricing rule error:", err);
        res.status(500).json({ message: "Error applying pricing rule" });
    }
};

// ==================== GLOBAL PRICING CONFIG ====================

// Get pricing config
export const getPricingConfig = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        let config = await prisma.pricingConfig.findFirst();

        // Create default config if doesn't exist
        if (!config) {
            config = await prisma.pricingConfig.create({
                data: {},
            });
        }

        res.json({ config });
    } catch (err) {
        console.error("Get pricing config error:", err);
        res.status(500).json({ message: "Error fetching pricing config" });
    }
};

// Update pricing config
export const updatePricingConfig = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        let config = await prisma.pricingConfig.findFirst();
        const id = config?.id;

        if (!id) {
            config = await prisma.pricingConfig.create({
                data: {
                    ...req.body,
                    updatedBy: user.id,
                },
            });
        } else {
            config = await prisma.pricingConfig.update({
                where: { id },
                data: {
                    ...req.body,
                    updatedBy: user.id,
                },
            });
        }

        res.json({
            message: "Pricing config updated successfully",
            config,
        });
    } catch (err) {
        console.error("Update pricing config error:", err);
        res.status(500).json({ message: "Error updating pricing config" });
    }
};

// ==================== BULK PRICE OPERATIONS ====================

// Bulk update prices
export const bulkUpdatePrices = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const {
            adjustmentType,
            adjustmentValue,
            applyTo = "all",
            categoryIds = [],
            conditions = [],
            brands = [],
            minPrice,
            maxPrice,
        } = req.body;

        if (!adjustmentType || adjustmentValue === undefined) {
            return res.status(400).json({
                message: "adjustmentType and adjustmentValue are required",
            });
        }

        // Build where clause
        const where: any = {
            status: ProductStatus.ACTIVE,
        };

        if (applyTo === "category" && categoryIds.length > 0) {
            where.categoryId = { in: categoryIds };
        }
        if (conditions.length > 0) {
            where.condition = { in: conditions };
        }
        if (brands.length > 0) {
            where.brand = { in: brands, mode: "insensitive" };
        }
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        // Get matching products
        const products = await prisma.product.findMany({ where });

        // Apply price changes
        const result = await prisma.$transaction(async (tx: any) => {
            let updatedCount = 0;

            for (const product of products) {
                let newPrice = product.price;

                if (adjustmentType === "percentage") {
                    newPrice = product.price * (1 + parseFloat(adjustmentValue) / 100);
                } else {
                    newPrice = product.price + parseFloat(adjustmentValue);
                }

                // Ensure price is not negative
                newPrice = Math.max(0.01, Math.round(newPrice * 100) / 100);

                if (newPrice === product.price) continue;

                await tx.product.update({
                    where: { id: product.id },
                    data: { price: newPrice },
                });

                await tx.priceHistory.create({
                    data: {
                        productId: product.id,
                        previousPrice: product.price,
                        newPrice,
                        changeReason: "bulk_update",
                        changedBy: user.id,
                    },
                });

                updatedCount++;
            }

            // Record bulk update
            await tx.bulkPriceUpdate.create({
                data: {
                    adjustmentType,
                    adjustmentValue: parseFloat(adjustmentValue),
                    applyTo,
                    targetIds: categoryIds,
                    affectedCount: updatedCount,
                    createdBy: user.id,
                },
            });

            return updatedCount;
        });

        res.json({
            message: `Prices updated on ${result} products`,
            updatedCount: result,
        });
    } catch (err) {
        console.error("Bulk update prices error:", err);
        res.status(500).json({ message: "Error updating prices" });
    }
};

// Set custom prices for specific products
export const bulkSetCustomPrices = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { prices } = req.body;

        if (!prices || !Array.isArray(prices) || prices.length === 0) {
            return res.status(400).json({
                message: "prices array is required: [{ productId, newPrice }, ...]",
            });
        }

        const result = await prisma.$transaction(async (tx: any) => {
            let updatedCount = 0;

            for (const { productId, newPrice } of prices) {
                const product = await tx.product.findUnique({
                    where: { id: productId },
                });

                if (!product) continue;

                const parsedPrice = parseFloat(newPrice);
                if (isNaN(parsedPrice) || parsedPrice <= 0) continue;

                await tx.product.update({
                    where: { id: productId },
                    data: { price: parsedPrice },
                });

                await tx.priceHistory.create({
                    data: {
                        productId,
                        previousPrice: product.price,
                        newPrice: parsedPrice,
                        changeReason: "manual",
                        changedBy: user.id,
                    },
                });

                updatedCount++;
            }

            return updatedCount;
        });

        res.json({
            message: `Custom prices set on ${result} products`,
            updatedCount: result,
        });
    } catch (err) {
        console.error("Bulk set custom prices error:", err);
        res.status(500).json({ message: "Error setting custom prices" });
    }
};

// Revert price changes
export const revertPriceChanges = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { bulkUpdateId } = req.body;

        if (!bulkUpdateId) {
            return res.status(400).json({ message: "bulkUpdateId is required" });
        }

        // Get the bulk update record
        const bulkUpdate = await prisma.bulkPriceUpdate.findUnique({
            where: { id: bulkUpdateId },
        });

        if (!bulkUpdate) {
            return res.status(404).json({ message: "Bulk update not found" });
        }

        if (bulkUpdate.isReverted) {
            return res.status(400).json({ message: "This bulk update has already been reverted" });
        }

        // Get price history entries for this bulk update (by timestamp proximity)
        const priceHistoryEntries = await prisma.priceHistory.findMany({
            where: {
                changeReason: "bulk_update",
                createdAt: {
                    gte: new Date(bulkUpdate.createdAt.getTime() - 1000),
                    lte: new Date(bulkUpdate.createdAt.getTime() + 1000),
                },
            },
        });

        // Revert prices
        const result = await prisma.$transaction(async (tx: any) => {
            let revertedCount = 0;

            for (const entry of priceHistoryEntries) {
                await tx.product.update({
                    where: { id: entry.productId },
                    data: { price: entry.previousPrice },
                });

                await tx.priceHistory.create({
                    data: {
                        productId: entry.productId,
                        previousPrice: entry.newPrice,
                        newPrice: entry.previousPrice,
                        changeReason: "bulk_update",
                        changedBy: user.id,
                    },
                });

                revertedCount++;
            }

            // Mark bulk update as reverted
            await tx.bulkPriceUpdate.update({
                where: { id: bulkUpdateId },
                data: {
                    isReverted: true,
                    revertedAt: new Date(),
                    revertedBy: user.id,
                },
            });

            return revertedCount;
        });

        res.json({
            message: `Reverted prices on ${result} products`,
            revertedCount: result,
        });
    } catch (err) {
        console.error("Revert price changes error:", err);
        res.status(500).json({ message: "Error reverting prices" });
    }
};

// ==================== PRICE HISTORY ====================

// Get price history for a product
export const getPriceHistory = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const user = (req as any).user;

        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const history = await prisma.priceHistory.findMany({
            where: { productId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        res.json({ history });
    } catch (err) {
        console.error("Get price history error:", err);
        res.status(500).json({ message: "Error fetching price history" });
    }
};

// Get recent price changes
export const getRecentPriceChanges = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const { limit = 50 } = req.query;

        const [recentChanges, bulkUpdates] = await Promise.all([
            prisma.priceHistory.findMany({
                orderBy: { createdAt: "desc" },
                take: parseInt(limit as string),
                include: {
                    product: {
                        select: { id: true, name: true, sku: true },
                    },
                },
            }),
            prisma.bulkPriceUpdate.findMany({
                orderBy: { createdAt: "desc" },
                take: 10,
            }),
        ]);

        res.json({
            recentChanges,
            bulkUpdates,
        });
    } catch (err) {
        console.error("Get recent price changes error:", err);
        res.status(500).json({ message: "Error fetching recent price changes" });
    }
};

// ==================== HELPER FUNCTIONS ====================

// Get products matching a pricing rule
const getMatchingProducts = async (rule: any) => {
    const where: any = {
        status: ProductStatus.ACTIVE,
    };

    switch (rule.applyTo) {
        case "category":
            if (rule.categoryIds.length > 0) {
                where.categoryId = { in: rule.categoryIds };
            }
            break;
        case "subcategory":
            if (rule.subcategoryIds.length > 0) {
                where.subcategoryId = { in: rule.subcategoryIds };
            }
            break;
        case "condition":
            if (rule.conditions.length > 0) {
                where.condition = { in: rule.conditions };
            }
            break;
        case "brand":
            if (rule.brands.length > 0) {
                where.brand = { in: rule.brands, mode: "insensitive" };
            }
            break;
        case "price_range":
            where.price = {};
            if (rule.minPrice) where.price.gte = rule.minPrice;
            if (rule.maxPrice) where.price.lte = rule.maxPrice;
            break;
    }

    return prisma.product.findMany({ where });
};

// Calculate new price based on rule
const calculateNewPrice = (currentPrice: number, rule: any): number => {
    let newPrice = currentPrice;

    if (rule.adjustmentType === "percentage") {
        switch (rule.ruleType) {
            case "markup":
                newPrice = currentPrice * (1 + rule.adjustmentValue / 100);
                break;
            case "markdown":
                newPrice = currentPrice * (1 - rule.adjustmentValue / 100);
                break;
        }
    } else {
        // Fixed adjustment
        switch (rule.ruleType) {
            case "markup":
            case "fixed_adjustment":
                newPrice = currentPrice + rule.adjustmentValue;
                break;
            case "markdown":
                newPrice = currentPrice - rule.adjustmentValue;
                break;
            case "price_floor":
                newPrice = Math.max(currentPrice, rule.adjustmentValue);
                break;
            case "price_ceiling":
                newPrice = Math.min(currentPrice, rule.adjustmentValue);
                break;
        }
    }

    // Ensure price is not negative and round to 2 decimal places
    return Math.max(0.01, Math.round(newPrice * 100) / 100);
};
