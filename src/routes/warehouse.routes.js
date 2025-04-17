import { Router } from "express";
import {
  getAllWarehouses,
  getWarehouseById,
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

export default router;
