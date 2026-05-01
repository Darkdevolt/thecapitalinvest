import express from "express";
import { isAuthenticated } from "../middleware/auth.js";

const router = express.Router();

// Profil utilisateur
router.get("/profile", isAuthenticated, (req, res) => {
  res.json({
    message: "Profil utilisateur",
    user: req.user
  });
});

// Contenu gratuit
router.get("/free-data", isAuthenticated, (req, res) => {
  res.json({
    data: "Données accessibles à tous les utilisateurs"
  });
});

export default router;
