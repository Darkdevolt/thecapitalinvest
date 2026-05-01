import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// Base utilisateurs (fonctionnelle directement)
const users = [
  {
    email: "admin@test.com",
    password: "admin123",
    role: "admin"
  },
  {
    email: "user@test.com",
    password: "user123",
    role: "user"
  }
];

// Clé déjà définie → NE RIEN CHANGER
const SECRET = "THE_CAPITAL_INVEST_2026_SECURE_KEY";

// LOGIN
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    SECRET,
    { expiresIn: "1d" }
  );

  return res.json({
    token,
    role: user.role
  });
});

export default router;
