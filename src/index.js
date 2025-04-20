import cors from "cors";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import connectDB from "./db/index.js";
import { errorHandler } from "./middlewares/error.middleware.js";

// routers
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.routes.js";
import heathcheckRouter from "./routes/healthcheck.routes.js";
import requirementRouter from "./routes/requirement.routes.js";
import logisticRouter from "./routes/logistic.routes.js";
import warehouseStockRouter from "./routes/warehouseStock.routes.js";
import institutionStockRouter from "./routes/institutionStock.routes.js";
import warehouseRouter from "./routes/warehouse.routes.js";
import medicineRouter from "./routes/medicine.routes.js";
import manufacturerRouter from "./routes/manufacturer.routes.js";
import saltRouter from "./routes/salt.routes.js";
import institutionRouter from "./routes/institution.routes.js";
import logRouter from "./routes/log.routes.js";
import analyticsRouter from "./routes/analytics.routes.js";
import { ApiError } from "./utils/ApiError.js";

// Swagger UI setup
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the OpenAPI specification file
// Adjust the path if openapi.yaml is not in the project root
const swaggerDocument = YAML.load(path.join(__dirname, "../openapi.yaml"));

const app = express();

// global middlewares
// app.use(
//   cors({
//     origin:
//       process.env.CORS_ORIGIN === "*"
//         ? "*" // This might give CORS error for some origins due to credentials set to true
//         : process.env.CORS_ORIGIN?.split(","), // For multiple cors origin for production. Refer https://github.com/hiteshchoudhary/apihub/blob/a846abd7a0795054f48c7eb3e71f3af36478fa96/.env.sample#L12C1-L12C12
//   })
// );
app.use(cors());
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${
        options.limit
      } requests per ${options.windowMs / 60000} minutes`
    );
  },
});
app.use(limiter);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

// routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/healthcheck", heathcheckRouter);
app.use("/api/v1/institution", institutionRouter);
app.use("/api/v1/institution-stock", institutionStockRouter);
app.use("/api/v1/logistics", logisticRouter);
app.use("/api/v1/manufacturer", manufacturerRouter);
app.use("/api/v1/medicine", medicineRouter);
app.use("/api/v1/requirements", requirementRouter);
app.use("/api/v1/salt", saltRouter);
app.use("/api/v1/warehouse", warehouseRouter);
app.use("/api/v1/warehouse-stock", warehouseStockRouter);
app.use("/api/v1/logs", logRouter);
app.use("/api/v1/analytics", analyticsRouter);
// Mount new application routes

// Serve Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(process.env.PORT, () => {
    console.log(`🚀 Server is listening on port ${process.env.PORT}...`);
  });
};

startServer();
