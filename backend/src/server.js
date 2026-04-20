import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { authRouter } from "./routes/auth.js";
import { productsRouter } from "./routes/products.js";
import { stockRouter } from "./routes/stock.js";
import { transactionsRouter } from "./routes/transactions.js";
import { usersRouter } from "./routes/users.js";
import { rackRouter } from "./routes/rack.js";
import { scanRouter } from "./routes/scan.js";
import { locationsRouter } from "./routes/locations.js";
import { boxesRouter } from "./routes/boxes.js";
import { suppliersRouter } from "./routes/suppliers.js";
import { purchaseOrdersRouter } from "./routes/purchase-orders.js";
import { categoriesRouter } from "./routes/categories.js";
import { opnameRouter } from "./routes/opname.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins in LAN (no origin = direct access, postman, etc.)
      callback(null, true);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: system-ui, sans-serif; text-align: center; margin-top: 50px; background: #0f1629; color: white;">
        <h2>🟢 Warehouse API Server is Running</h2>
        <p>Aplikasi Frontend Anda berada port 5173.</p>
        <p>Silakan buka: <a href="http://localhost:5173" style="color: #6366f1;">http://localhost:5173</a></p>
      </body>
    </html>
  `);
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Warehouse API is running",
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/products", productsRouter);
app.use("/api/stock", stockRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/users", usersRouter);
app.use("/api/rack", rackRouter);
app.use("/api/scan", scanRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/boxes", boxesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/purchase-orders", purchaseOrdersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/opname", opnameRouter);

// ── Error Handler ──────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────────────────────
// Bind to 0.0.0.0 for LAN access
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Warehouse API Server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://0.0.0.0:${PORT}`);
  console.log(`   Env:     ${process.env.NODE_ENV}\n`);
});

export default app;
