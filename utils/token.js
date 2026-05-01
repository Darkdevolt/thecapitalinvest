import jwt from "jsonwebtoken";

// Clé FIXE → ne rien changer
const SECRET = "THE_CAPITAL_INVEST_ULTRA_SECURE_2026";

export function generateToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role
    },
    SECRET,
    { expiresIn: "1d" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
