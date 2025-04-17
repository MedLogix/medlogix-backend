import { Router } from "express";
import {
  createManufacturer,
  getAllManufacturers,
  getManufacturerById,
} from "../controllers/manufacturer.controller.js";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";
import {
  deleteManufacturer,
  updateManufacturer,
} from "../controllers/manufacturer.controller.js";

const router = Router();

router.use(verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE]));

router.route("/").get(getAllManufacturers);

router.route("/").post(createManufacturer);

router.route("/:id").get(getManufacturerById);

router.route("/:id").put(updateManufacturer);

router.route("/:id").delete(deleteManufacturer);

export default router;
