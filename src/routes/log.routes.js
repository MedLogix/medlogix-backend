import { Router } from "express";
import {
  getInstitutionUsageLogs,
  getWarehouseReceiptLogs,
} from "../controllers/log.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

router
  .route("/institution")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.INSTITUTION]),
    getInstitutionUsageLogs
  );

router
  .route("/warehouse")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE]),
    getWarehouseReceiptLogs
  );

export default router;
