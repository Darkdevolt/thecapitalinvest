import { verifyToken } from "../utils/token.js";

// Vérifie connexion
export function isAuthenticated(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = header.split(" ")[1];
    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Vérifie admin
export function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied (admin only)" });
  }
  next();
}

// Vérifie plan pro
export function isPro(req, res, next) {
  if (req.user.plan !== "pro") {
    return res.status(403).json({ error: "Pro subscription required" });
  }
  next();
}
