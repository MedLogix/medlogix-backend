import { Router } from "express";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";
import {
  addStock,
  getOwnStock,
  getAvailableStockForInstitutions,
  getAllStockAdmin,
  getStockById,
  updateStockDetails,
  deleteStock,
} from "../controllers/warehouseStock.controller.js";

const router = Router();

// Warehouse Routes
router
  .route("/")
  .post(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), addStock)
  .get(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), getOwnStock);

router
  .route("/:stockId")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE, USER_TYPES.ADMIN]),
    getStockById
  )
  .put(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), updateStockDetails)
  .delete(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), deleteStock);

// Institution Routes
router
  .route("/available")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]),
    getAvailableStockForInstitutions
  );

// Admin Routes
router
  .route("/admin")
  .get(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), getAllStockAdmin);

export default router;
