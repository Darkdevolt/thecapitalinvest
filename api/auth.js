import express from "express";
import { findUser } from "../services/userService.js";
import { generateToken } from "../utils/token.js";

const router = express.Router();

// LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = findUser(email, password);

  if (!user) {
    return res.status(401).json({
      error: "Email ou mot de passe incorrect"
    });
  }

  const token = generateToken(user);

  return res.json({
    message: "Connexion réussie",
    token,
    user: {
      email: user.email,
      role: user.role,
      plan: user.plan
    }
  });
});

export default router;
