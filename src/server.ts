import dotenv from "dotenv";
// Load environment variables first
dotenv.config();

import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Route imports
import authRoutes from "./routes/auth.routes";
import cartRoutes from "./routes/cart.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import inventoryRoutes from "./routes/inventory.routes";
// TODO: [PRODUCTION] Re-enable payments and shipping
// import paymentsRoutes from "./routes/payments.routes";
import analyticsRoutes from "./routes/analytics.routes";
import adminRoutes from "./routes/admin.routes";
// import shippoRoutes from "./routes/shippo.routes";
// New thrift-specific routes
import saleRoutes from "./routes/sale.routes";
import wishlistRoutes from "./routes/wishlist.routes";
import pricingRoutes from "./routes/pricing.routes";

import { logger } from "./utils/logger";
import { prisma } from "./config/database";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import {
  helmetConfig,
  securityHeaders,
  requestLogger,
} from "./middlewares/security.middleware";

const app = express();

// Trust proxy (for rate limiting and IP detection)
app.set("trust proxy", 1);

// Security middleware
app.use(helmetConfig);
app.use(securityHeaders);

// CORS configuration
const allowedOrigins = [
  "https://thriftclock.vercel.app",
  "https://licorice4good.com",
  "https://www.licorice4good.com",
  "https://api.licorice4good.com",
  "http://localhost:3000", // Next.js dev server
  "http://localhost:5000", // Backend dev server
  "http://localhost:8080", // Frontend dev server
  "http://localhost:5173", // Vite dev server
  "http://localhost:4200", // Angular dev server
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl requests, and Stripe webhooks)
      if (!origin) return callback(null, true);

      // Allow Stripe webhook requests (they don't have an origin header)
      if (origin === undefined || origin === null) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // ✅ needed for cookies/sessions
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "Stripe-Signature",
      "X-Requested-With",
      "Accept",
      "Cache-Control",
    ],
    exposedHeaders: ["Set-Cookie"],
  })
);

// Body parsing middleware
// Use raw body only for webhook routes; json for others
app.use((req, res, next) => {
  // TODO: [PRODUCTION] Re-enable webhook raw body handling
  // if (req.originalUrl === "/payments/webhook" || req.originalUrl === "/shippo/webhook") {
  //   express.raw({ type: "application/json" })(req, res, next);
  // } else {
  express.json({ limit: "500mb" })(req, res, next);
  // }
});

app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser());

// Serve static files (uploaded images) with CORS headers
app.use(
  "/uploads",
  (req, res, next) => {
    // Set comprehensive CORS headers for image requests
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Cross-Origin-Resource-Policy", "cross-origin");
    res.header("Cross-Origin-Embedder-Policy", "unsafe-none");
    res.header("Cross-Origin-Opener-Policy", "same-origin");

    // Set proper content type for images
    const imageRegex = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (imageRegex.exec(req.path)) {
      res.header("Content-Type", "image/*");
    }

    // Remove CSP for uploads to allow images
    res.removeHeader("Content-Security-Policy");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    next();
  },
  express.static("uploads", {
    // Add cache control for better performance
    maxAge: "1d",
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Ensure proper headers for image files
      const imageRegex = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
      if (imageRegex.exec(path)) {
        res.setHeader("Content-Type", "image/*");
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

// Request logging
app.use(requestLogger);

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    name: "Thrift E-commerce API",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// ==================== ROUTES ====================

// Authentication
app.use("/auth", authRoutes);

// Products (public + admin)
app.use("/products", productRoutes);

// Cart (guest + authenticated)
app.use("/cart", cartRoutes);

// Orders
app.use("/orders", orderRoutes);

// TODO: [PRODUCTION] Re-enable payments and shipping routes
// Payments (disabled for dev)
// app.use("/payments", paymentsRoutes);

// Shipping (disabled for dev)
// app.use("/shippo", shippoRoutes);

// Inventory (admin)
app.use("/inventory", inventoryRoutes);

// Analytics (admin)
app.use("/analytics", analyticsRoutes);

// Admin operations
app.use("/admin", adminRoutes);

// ============ NEW THRIFT-SPECIFIC ROUTES ============

// Sales & Promotions (public countdown + admin CRUD)
app.use("/sales", saleRoutes);

// User Wishlists (authenticated)
app.use("/wishlist", wishlistRoutes);

// Pricing Management (admin only)
app.use("/pricing", pricingRoutes);

// ==================== HEALTH CHECK ====================

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// 404 handler
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(
    `🚀 Thrift E-commerce API running on port ${PORT} in ${process.env.NODE_ENV} mode`
  );
});

// Test database connection
prisma
  .$connect()
  .then(() => {
    logger.info("✅ Database connected successfully");
  })
  .catch((err) => {
    logger.error("❌ Database connection failed:", err);
  });

server.on("error", (err) => {
  logger.error(`Server error: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Process terminated");
    process.exit(0);
  });
});
