import { Router } from "express";
import {
  getAllInstitutions,
  getInstitutionById,
} from "../controllers/institution.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";
import { getAllInstitutionsValidator } from "../validators/instituition.validator.js";
import { validate } from "../validators/validate.js";

const router = Router();

router
  .route("/")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.ADMIN]),
    getAllInstitutionsValidator(),
    validate,
    getAllInstitutions
  );
router
  .route("/:id")
  .get(
    verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.INSTITUTION]),
    getInstitutionById
  );

export default router;
