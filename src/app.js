import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { healthcheck } from "./config/database.js";
import productRoutes from "./routes/product.routes.js";
import enquiryRoutes from "./routes/enquiry.routes.js";
import enquiryItemRoutes from "./routes/enquiry-item.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();
const origins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin || origins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS origin not allowed"));
    },
    credentials: String(process.env.CORS_CREDENTIALS || "true") === "true",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(
  rateLimit({
    windowMs: 60000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", async (req, res, next) => {
  try {
    await healthcheck();
    res.json({ status: "UP", database: "UP" });
  } catch (e) {
    next(e);
  }
});

app.use("/api/products", productRoutes);
app.use("/api/orders", enquiryRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/enquiry-items", enquiryItemRoutes);
app.use("/api/sales", salesRoutes);

app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use(errorHandler);
export default app;
