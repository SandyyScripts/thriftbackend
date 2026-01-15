import express from "express";

const router = express.Router();

// ============================================================
// PAYMENTS ROUTES - DISABLED FOR MVP
// ============================================================
// This file contains Stripe payment integration that has been
// temporarily disabled for MVP deployment.
// 
// To enable:
// 1. Configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env
// 2. Uncomment the payments routes in server.ts
// 3. Restore the full implementation from git history
// ============================================================

router.get("/status", (req, res) => {
  res.json({
    enabled: false,
    message: "Payment processing is disabled for MVP. Contact admin to enable.",
  });
});

router.post("/create-checkout-session", (req, res) => {
  res.status(503).json({
    message: "Payment processing is not enabled",
    hint: "Configure Stripe keys in environment variables",
  });
});

router.post("/webhook", (req, res) => {
  res.status(503).json({ message: "Webhook endpoint disabled" });
});

export default router;
