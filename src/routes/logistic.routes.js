import { Router } from "express";
import {
  createShipment,
  getOwnShipments,
  getIncomingShipments,
  getAllShipmentsAdmin,
  getShipmentById,
  updateShipmentStatus,
  receiveShipment,
} from "../controllers/logistic.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

// Warehouse Routes
router
  .route("/")
  .post(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), createShipment)
  .get(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), getOwnShipments);

router
  .route("/:logisticId/status")
  .patch(verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]), updateShipmentStatus);

// Institution Routes
router
  .route("/institution")
  .get(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), getIncomingShipments);

router
  .route("/:logisticId/receive")
  .patch(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), receiveShipment);

// Admin Routes
router
  .route("/admin")
  .get(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), getAllShipmentsAdmin);

// Common/Shared Routes
router
  .route("/:logisticId")
  .get(
    verifyJWTAndAuthorize([
      USER_TYPES.WAREHOUSE,
      USER_TYPES.INSTITUTION,
      USER_TYPES.ADMIN,
    ]),
    getShipmentById
  );

export default router;
