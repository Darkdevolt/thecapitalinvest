import jwt from "jsonwebtoken";

// EXACTEMENT la même clé → NE RIEN CHANGER
const SECRET = "THE_CAPITAL_INVEST_2026_SECURE_KEY";

// Vérifier utilisateur
export function isAuthenticated(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const decoded = jwt.verify(token.split(" ")[1], SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Vérifier admin
export function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}
