import { Router } from "express";
import {
  getCurrentUser,
  loginUser,
  registerUser,
} from "../controllers/auth.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router
  .route("/me")
  .get(
    verifyJWTAndAuthorize([
      USER_TYPES.ADMIN,
      USER_TYPES.INSTITUTION,
      USER_TYPES.WAREHOUSE,
    ]),
    getCurrentUser
  );

export default router;
