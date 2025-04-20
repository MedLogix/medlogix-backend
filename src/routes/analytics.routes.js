import { Router } from "express";
import {
  adminKPI,
  adminCharts,
  institutionKPI,
  institutionCharts,
  warehouseKPI,
  warehouseCharts,
} from "../controllers/analytics.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

// Admin Analytics Routes - Base endpoints
router
  .route("/admin/kpi")
  .get(verifyJWTAndAuthorize(USER_TYPES.ADMIN), adminKPI);

router
  .route("/admin/charts")
  .get(verifyJWTAndAuthorize(USER_TYPES.ADMIN), adminCharts);

// Admin Analytics Routes - Individual chart endpoints
// These will be implemented in the future if needed
// router.route("/admin/charts/verification-status").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminVerificationChart
// );

// router.route("/admin/charts/requirement-status").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminRequirementChart
// );

// router.route("/admin/charts/logistics-status").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminLogisticsChart
// );

// router.route("/admin/charts/top-stocked-medicines").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminTopMedicinesChart
// );

// router.route("/admin/charts/stock-near-expiry").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminExpiryChart
// );

// router.route("/admin/charts/monthly-activity").get(
//   verifyJWTAndAuthorize(USER_TYPES.ADMIN),
//   adminMonthlyActivityChart
// );

// Institution Analytics Routes
router
  .route("/institution/kpi")
  .get(verifyJWTAndAuthorize(USER_TYPES.INSTITUTION), institutionKPI);

router
  .route("/institution/charts")
  .get(verifyJWTAndAuthorize(USER_TYPES.INSTITUTION), institutionCharts);

// Institution Analytics Routes - Individual chart endpoints (Future)
// router.route("/institution/charts/requirement-status").get(
//   verifyJWTAndAuthorize(USER_TYPES.INSTITUTION),
//   institutionRequirementChart
// );
// ... other individual chart routes

// Warehouse Analytics Routes
router
  .route("/warehouse/kpi")
  .get(verifyJWTAndAuthorize(USER_TYPES.WAREHOUSE), warehouseKPI);

router
  .route("/warehouse/charts")
  .get(verifyJWTAndAuthorize(USER_TYPES.WAREHOUSE), warehouseCharts);

export default router;
