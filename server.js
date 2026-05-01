import express from "express";

import authRoutes from "./api/auth.js";
import adminRoutes from "./api/admin.js";
import userRoutes from "./api/user.js";

const app = express();

// Middleware global
app.use(express.json());

// Routes principales
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("THE CAPITAL INVEST API RUNNING");
});

// Lancement serveur
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
