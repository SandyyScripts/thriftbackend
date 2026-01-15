import { Request, Response } from "express";
import { prisma } from "../config/database";
import { OrderStatus, PaymentStatus, ShippingStatus } from "../generated/prisma";

// Create order from cart or direct order items (checkout)
export const createOrder = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const guestId = (req as any).guestId;
    const isGuest = (req as any).isGuest;

    // For authenticated users, verify they exist in database
    let dbUser = null;
    if (!isGuest && user) {
      dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true, isVerified: true },
      });

      if (!dbUser) {
        return res.status(404).json({ message: "User not found" });
      }
    }

    const {
      shippingAddress,
      orderNotes,
      orderItems,
      total: requestTotal,
      guestEmail,
    } = req.body;

    // Define user identifier for cart operations
    const userIdentifier = isGuest ? { guestId } : { userId: dbUser?.id };

    // Validate shipping address if provided
    if (shippingAddress && typeof shippingAddress === "object") {
      const { street1, city, state, postalCode, country } = shippingAddress;
      if (street1 || city || state || postalCode || country) {
        if (!street1 || !city || !state || !postalCode || !country) {
          return res.status(400).json({
            message: "All shipping address fields are required: street1, city, state, postalCode, country",
          });
        }
      }
    }

    let orderItemsToCreate: any[] = [];
    let calculatedTotal = 0;

    // Check if frontend sent orderItems directly
    if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
      // Validate and process direct order items
      for (const item of orderItems) {
        if (!item.productId || !item.quantity || !item.price) {
          return res.status(400).json({
            message: "Invalid order item: productId, quantity, and price are required",
          });
        }

        // Check if it's a variant or regular product
        if (item.variantId) {
          // Validate variant exists and has stock
          const variant = await prisma.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });

          if (!variant || !variant.isActive) {
            return res.status(400).json({
              message: `Product variant not found: ${item.variantId}`,
            });
          }

          if (variant.stock < item.quantity) {
            return res.status(400).json({
              message: `Insufficient stock for ${variant.name}. Available: ${variant.stock}, Requested: ${item.quantity}`,
            });
          }
        } else {
          // Validate product exists and has stock
          const product = await prisma.product.findFirst({
            where: { id: item.productId, status: "ACTIVE" },
          });

          if (!product) {
            return res.status(400).json({
              message: `Product not found or not active: ${item.productId}`,
            });
          }

          if (product.stock < item.quantity) {
            return res.status(400).json({
              message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${item.quantity}`,
            });
          }
        }

        const itemTotal = item.price * item.quantity;
        orderItemsToCreate.push({
          productId: item.productId,
          variantId: item.variantId || null,
          quantity: item.quantity,
          price: item.price,
          total: itemTotal,
          // Snapshot data
          productName: item.productName,
          productSku: item.productSku,
          productSize: item.productSize,
          productBrand: item.productBrand,
          productImage: item.productImage,
          variantName: item.variantName,
        });

        calculatedTotal += itemTotal;
      }
    } else {
      // Get items from cart
      const cartItems = await prisma.cartItem.findMany({
        where: isGuest ? { guestId } : { userId: dbUser?.id },
        include: {
          product: true,
          variant: true,
        },
      });

      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Cart is empty and no order items provided" });
      }

      // Validate stock for all cart items
      for (const cartItem of cartItems) {
        if (cartItem.variant) {
          if (cartItem.variant.stock < cartItem.quantity) {
            return res.status(400).json({
              message: `Insufficient stock for ${cartItem.variant.name}. Available: ${cartItem.variant.stock}, Requested: ${cartItem.quantity}`,
            });
          }
        } else {
          if (cartItem.product.stock < cartItem.quantity) {
            return res.status(400).json({
              message: `Insufficient stock for ${cartItem.product.name}. Available: ${cartItem.product.stock}, Requested: ${cartItem.quantity}`,
            });
          }
        }
      }

      // Convert cart items to order items
      orderItemsToCreate = cartItems.map((cartItem) => {
        const price = cartItem.variant?.price || cartItem.product.price;
        const itemTotal = price * cartItem.quantity;
        calculatedTotal += itemTotal;

        return {
          productId: cartItem.productId,
          variantId: cartItem.variantId,
          quantity: cartItem.quantity,
          price: price,
          total: itemTotal,
          // Snapshot data
          productName: cartItem.product.name,
          productSku: cartItem.product.sku,
          productCondition: cartItem.product.condition,
          productSize: cartItem.variant?.size || cartItem.product.size,
          productBrand: cartItem.product.brand,
          productImage: cartItem.product.images?.[0] || null,
          variantName: cartItem.variant?.name,
        };
      });

      // Clear the cart after order creation
      await prisma.cartItem.deleteMany({
        where: isGuest ? { guestId } : { userId: dbUser?.id },
      });
    }

    const finalTotal = requestTotal || calculatedTotal;

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: dbUser?.id,
        guestId: isGuest ? guestId : null,
        guestEmail: isGuest ? (guestEmail || shippingAddress?.email) : null,
        subtotal: calculatedTotal,
        total: finalTotal,
        shippingAddressSnapshot: shippingAddress,
        orderNotes,
        orderItems: {
          create: orderItemsToCreate,
        },
      },
      include: {
        orderItems: true,
      },
    });

    // Update inventory for all order items
    for (const item of orderItemsToCreate) {
      try {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { decrement: item.quantity } },
          });
        } else {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      } catch (error) {
        console.warn(`Could not update inventory for product ${item.productId}:`, error);
      }
    }

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ message: "Error creating order" });
  }
};

// Get user's orders
export const getUserOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: any = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: "desc" },
        include: {
          orderItems: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
};

// Get order by ID
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        orderItems: {
          include: {
            product: true,
            variant: true,
          },
        },
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({ message: "Error fetching order" });
  }
};

// Update order status (Admin only)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    // Validate status
    const allowedStatuses = Object.values(OrderStatus);
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.json({
      message: "Order status updated successfully",
      order,
    });
  } catch (err) {
    console.error("Update order status error:", err);
    res.status(500).json({ message: "Error updating order status" });
  }
};

// Get all orders (Admin only)
export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const {
      status,
      paymentStatus,
      page = 1,
      limit = 50,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = Math.min(parseInt(limit as string), 200);

    const where: any = {};

    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    // Search functionality
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      where.OR = [
        { id: { contains: searchTerm, mode: "insensitive" } },
        { user: { email: { contains: searchTerm, mode: "insensitive" } } },
        { user: { name: { contains: searchTerm, mode: "insensitive" } } },
        { guestEmail: { contains: searchTerm, mode: "insensitive" } },
      ];
    }

    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === "asc" ? "asc" : "desc";

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          orderItems: {
            select: {
              id: true,
              productId: true,
              variantId: true,
              quantity: true,
              price: true,
              productName: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    console.error("Get all orders error:", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
};

// Bulk update orders (Admin only)
export const bulkUpdateOrders = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { orderIds, updates } = req.body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: "Order IDs array is required" });
    }

    if (orderIds.length > 1000) {
      return res.status(400).json({
        message: "Bulk operations are limited to 1000 orders at a time",
      });
    }

    const allowedFields = ["status"];
    const updateData: any = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid update fields provided",
      });
    }

    const result = await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: updateData,
    });

    res.json({
      message: "Bulk update completed successfully",
      updatedCount: result.count,
      requestedCount: orderIds.length,
    });
  } catch (err) {
    console.error("Bulk update orders error:", err);
    res.status(500).json({ message: "Error performing bulk update" });
  }
};

// Cancel order
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { orderItems: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check authorization - user can cancel their own order, admin can cancel any
    if (order.userId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }

    // Only allow cancellation of pending orders
    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      return res.status(400).json({
        message: "Only pending or confirmed orders can be cancelled",
      });
    }

    // Restore inventory
    for (const item of order.orderItems) {
      try {
        if (item.variantId) {
          await prisma.productVariant.update({
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
        } else if (item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      } catch (error) {
        console.warn(`Could not restore inventory for product ${item.productId}:`, error);
      }
    }

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    res.json({
      message: "Order cancelled successfully",
      order: updatedOrder,
    });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ message: "Error cancelling order" });
  }
};
