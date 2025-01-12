import { Router } from "express";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateUserAvatar,
} from "../controllers/admin.controller.js";
import {
  avoidInProduction,
  verifyAdminJWT,
} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import {
  adminLoginValidator,
  adminRegisterValidator,
} from "../validators/admin.validator.js";
import { validate } from "../validators/validate.js";

const router = Router();

// Unsecured route
router
  .route("/register")
  .post(avoidInProduction, adminRegisterValidator(), validate, registerUser);
router.route("/login").post(adminLoginValidator(), validate, loginUser);

// Secured routes
router.route("/logout").post(verifyAdminJWT, logoutUser);
router
  .route("/avatar")
  .post(verifyAdminJWT, upload.single("avatar"), updateUserAvatar);
router.route("/current-user").get(verifyAdminJWT, getCurrentUser);

export default router;
