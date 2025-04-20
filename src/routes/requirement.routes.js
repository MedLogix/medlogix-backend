import { Router } from "express";
import {
  approveRequirementItems,
  createRequirement,
  getAllRequirementsAdmin,
  getOwnRequirements,
  getRequirementById,
  getRequirementStockAvailability,
} from "../controllers/requirement.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js"; // Assuming constants are defined here

const router = Router();

router
  .route("/")
  .post(verifyJWTAndAuthorize([USER_TYPES.INSTITUTION]), createRequirement)
  .get(
    verifyJWTAndAuthorize([USER_TYPES.INSTITUTION, USER_TYPES.WAREHOUSE]),
    getOwnRequirements
  );

router
  .route("/:requirementId/approve")
  .patch(
    verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]),
    approveRequirementItems
  );

router
  .route("/:requirementId/stock-availability")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.WAREHOUSE]),
    getRequirementStockAvailability
  );

// Admin Routes
router
  .route("/admin")
  .get(verifyJWTAndAuthorize([USER_TYPES.ADMIN]), getAllRequirementsAdmin);

router
  .route("/:requirementId")
  .get(
    verifyJWTAndAuthorize([
      USER_TYPES.INSTITUTION,
      USER_TYPES.WAREHOUSE,
      USER_TYPES.ADMIN,
    ]),
    getRequirementById
  );

export default router;
