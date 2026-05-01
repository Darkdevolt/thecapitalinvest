import express from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// Dashboard admin
router.get("/dashboard", isAuthenticated, isAdmin, (req, res) => {
  res.json({
    message: "Dashboard Admin",
    stats: {
      users: 2,
      revenue: "Confidentiel"
    }
  });
});

// Action admin
router.get("/manage", isAuthenticated, isAdmin, (req, res) => {
  res.json({
    message: "Gestion plateforme activée"
  });
});

export default router;
