import { body } from "express-validator";
import { USER_TYPES } from "../utils/constants.js";

const createManufacturerValidator = () => {
  return [
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Name is required")
      .isString()
      .withMessage("Name must be a string"),
    body("email")
      .trim()
      .notEmpty()
      .withMessage("Email is required")
      .isEmail()
      .withMessage("Email is invalid"),
    body("phone")
      .trim()
      .notEmpty()
      .withMessage("Phone is required")
      .isString()
      .withMessage("Phone must be a string"),
    body("address")
      .trim()
      .notEmpty()
      .withMessage("Address is required")
      .isString()
      .withMessage("Address must be a string"),
    body("createdByRole")
      .trim()
      .notEmpty()
      .isIn([USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE])
      .withMessage("Created by role must be a valid role"),
    body("createdBy")
      .trim()
      .notEmpty()
      .withMessage("Created by is required")
      .isString()
      .withMessage("Created by must be a string"),
  ];
};

export { createManufacturerValidator };
