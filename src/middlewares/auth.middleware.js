import jwt from "jsonwebtoken";
import logger from "../logger/winston.logger.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/admin.model.js";
import { Institution } from "../models/institution.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { USER_TYPES } from "../utils/constants.js";

// Helper function to get the correct Mongoose model based on userType
const getUserModel = (userType) => {
  switch (userType?.toLowerCase()) {
    case USER_TYPES.ADMIN:
      return Admin;
    case USER_TYPES.INSTITUTION:
      return Institution;
    case USER_TYPES.WAREHOUSE:
      return Warehouse;
    default:
      return null;
  }
};

// Factory function for JWT verification and authorization
export const verifyJWTAndAuthorize = (allowedUserTypes = []) => {
  // Removed the explicit lowercasing of allowedUserTypes based on user feedback
  // User will provide constants in the correct case (expected: lowercase)

  return asyncHandler(async (req, _, next) => {
    try {
      const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

      if (!token) {
        throw new ApiError(401, "Unauthorized request: Token missing");
      }

      const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

      const { _id, userType } = decodedToken;

      if (!userType || !_id) {
        throw new ApiError(
          401,
          "Invalid token payload: Missing userType or _id"
        );
      }

      // Lowercase the userType from the token for consistent comparison
      const currentUserType = String(userType).toLowerCase();

      // Authorization check: Use allowedUserTypes directly as provided
      if (
        allowedUserTypes.length > 0 &&
        !allowedUserTypes.includes(currentUserType)
      ) {
        logger.warn(
          `Authorization denied for user _id: ${_id}, userType: '${currentUserType}'. Allowed types: [${allowedUserTypes.join(", ")}]`
        );
        // Use currentUserTypeLower in the error message for clarity
        throw new ApiError(
          403,
          `Forbidden: User type '${currentUserType}' is not authorized for this resource`
        );
      }

      const Model = getUserModel(currentUserType); // Use lowercased type for model lookup
      if (!Model) {
        logger.warn(
          `Authorization denied: Invalid user type ('${currentUserType}') found in token for _id: ${_id}`
        );
        throw new ApiError(401, "Invalid user type specified in token");
      }

      const user = await Model.findById(_id).select("-password");

      if (!user) {
        logger.warn(
          `Authorization denied: User not found for token validation: userType='${currentUserType}', _id='${_id}'`
        );
        throw new ApiError(401, "Invalid Access Token: User not found");
      }

      // Attach user and type to request
      req.user = user;
      // Store the consistently lowercased version on req.user
      req.user.userType = currentUserType;
      next();
    } catch (error) {
      logger.error("JWT Verification/Authorization Error:", error);
      if (error instanceof jwt.TokenExpiredError) {
        throw new ApiError(401, "Access Token expired");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, "Invalid Access Token");
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(401, error?.message || "Authentication failed");
    }
  });
};

/**
 * @description Middleware to check logged in users for unprotected routes...
 * This function is kept separate as it's designed to fail silently if no user/token is found.
 * It doesn't perform authorization checks, only identification.
 */
export const getLoggedInUserOrIgnore = asyncHandler(async (req, res, next) => {
  const token =
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return next();
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const { _id, userType } = decodedToken;

    if (!_id || !userType) {
      logger.warn("getLoggedInUserOrIgnore: Invalid token payload structure");
      return next();
    }

    const Model = getUserModel(userType); // userType from token should be lowercase
    if (!Model) {
      logger.warn(
        `getLoggedInUserOrIgnore: Invalid user type ('${userType}') in token`
      );
      return next();
    }

    const user = await Model.findById(decodedToken?._id).select("-password");

    if (user) {
      req.user = user;
      req.user.userType = userType.toLowerCase(); // Store lowercase version
    }
    next();
  } catch (error) {
    logger.error("getLoggedInUserOrIgnore Error (Ignoring):", error.message);
    next();
  }
});

export const avoidInProduction = asyncHandler(async (req, res, next) => {
  if (process.env.NODE_ENV === "development") {
    next();
  } else {
    throw new ApiError(
      403,
      "This service is only available in the local environment."
    );
  }
});
