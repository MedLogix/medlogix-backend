import { Router } from "express";
import {
  addManualStock,
  getAllStockAdmin,
  getOwnStock,
  getStockById,
  logUsage,
} from "../controllers/institutionStock.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

router
  .route("/")
  .post(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), addManualStock)
  .get(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), getOwnStock);

router
  .route("/log-usage")
  .post(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), logUsage);

router
  .route("/:stockId")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.INSTITUTION, USER_TYPES.ADMIN]),
    getStockById
  );

// Admin Routes
router
  .route("/admin")
  .get(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), getAllStockAdmin);

export default router;
