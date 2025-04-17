import { Router } from "express";
import { verifyJWTAndAuthorize } from "../middlewares/auth.middleware.js";
import { USER_TYPES } from "../utils/constants.js";
import {
  createMedicine,
  deleteMedicine,
  getAllMedicines,
  getMedicineById,
  updateMedicine,
} from "../controllers/medicine.controller.js";

const router = Router();

router.use(verifyJWTAndAuthorize([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE]));

router.route("/").get(getAllMedicines);

router.route("/").post(createMedicine);

router.route("/:id").get(getMedicineById);

router.route("/:id").put(updateMedicine);

router.route("/:id").delete(deleteMedicine);

export default router;
