import { Router } from "express";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";
import {
  createSalt,
  deleteSalt,
  getAllSalts,
  getSaltById,
  updateSalt,
} from "../controllers/salt.controller.js";

const router = Router();

router.use(verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE]));

router.route("/").get(getAllSalts);

router.route("/").post(createSalt);

router.route("/:id").get(getSaltById);

router.route("/:id").put(updateSalt);

router.route("/:id").delete(deleteSalt);

export default router;
