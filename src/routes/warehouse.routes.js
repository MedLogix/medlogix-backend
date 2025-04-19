import { Router } from "express";
import {
  approveWarehouse,
  getAllWarehouses,
  getWarehouseById,
  rejectWarehouse,
} from "../controllers/warehouse.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

router
  .route("/")
  .get(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), getAllWarehouses);
router
  .route("/:id")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE]),
    getWarehouseById
  );

router
  .route("/:id/approve")
  .post(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), approveWarehouse);

router
  .route("/:id/reject")
  .post(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), rejectWarehouse);

export default router;
