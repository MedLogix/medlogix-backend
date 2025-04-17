import { query } from "express-validator";

const paginationValidator = () => {
  return [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Limit must be a positive integer"),
    query("search")
      .optional()
      .isString()
      .withMessage("Search must be a string"),
    query("sortBy")
      .optional()
      .isString()
      .withMessage("Sort by must be a string"),
    query("sortOrder")
      .optional()
      .isString()
      .withMessage("Sort order must be a string"),
  ];
};

export { paginationValidator };
