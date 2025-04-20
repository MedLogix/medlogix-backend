import { Admin } from "../models/admin.model.js";
import { Institution } from "../models/institution.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USER_TYPES } from "../utils/constants.js";

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

const registerUser = asyncHandler(async (req, res) => {
  const { userType, email, password, ...otherDetails } = req.body;

  if (!userType) {
    throw new ApiError(
      400,
      "User type is required (admin, institution, or warehouse)"
    );
  }

  const Model = getUserModel(userType);
  if (!Model) {
    throw new ApiError(400, "Invalid user type specified");
  }

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const existedUser = await Model.findOne({ email });
  if (existedUser) {
    if (existedUser?.isVerified === "pending") {
      throw new ApiError(
        409,
        `${userType.charAt(0).toUpperCase() + userType.slice(1)} is pending verification. Please wait for approval.`
      );
    } else {
      throw new ApiError(
        409,
        `${userType.charAt(0).toUpperCase() + userType.slice(1)} with email already exists. Please login to continue.`
      );
    }
  }

  // Include userType in the data being saved if the model schema needs it
  // For Admin, only email/password are needed from the base model.
  // For Institution/Warehouse, other details are required.
  const userData = { email, password, ...otherDetails };

  // Specific validation/data handling based on type might be needed here
  // Example: Ensure required fields for institution/warehouse are present
  if (
    (userType === "institution" || userType === "warehouse") &&
    (!otherDetails.name ||
      !otherDetails.registrationNumber ||
      !otherDetails.location)
  ) {
    throw new ApiError(
      400,
      `Missing required fields for ${userType} registration`
    );
  }
  if (userType === "institution" && !otherDetails.institutionCode) {
    throw new ApiError(
      400,
      `Missing institutionCode for institution registration`
    );
  }
  if (userType === "warehouse" && !otherDetails.warehouseCode) {
    throw new ApiError(400, `Missing warehouseCode for warehouse registration`);
  }

  const user = await Model.create(userData);

  const createdUser = await Model.findById(user._id).select("-password");
  if (!createdUser) {
    throw new ApiError(
      500,
      `Something went wrong while registering the ${userType}`
    );
  }

  // Optionally, generate token immediately upon registration
  // const accessToken = user.generateAccessToken();

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        createdUser,
        `${userType.charAt(0).toUpperCase() + userType.slice(1)} registered successfully`
      )
    );
});

const loginUser = asyncHandler(async (req, res) => {
  const { userType, email, password } = req.body;

  if (!userType) {
    throw new ApiError(
      400,
      "User type is required (admin, institution, or warehouse)"
    );
  }

  const Model = getUserModel(userType);
  if (!Model) {
    throw new ApiError(400, "Invalid user type specified");
  }

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await Model.findOne({ email });
  if (!user) {
    throw new ApiError(
      404,
      `${userType.charAt(0).toUpperCase() + userType.slice(1)} does not exist`
    );
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, `Invalid ${userType} credentials`);
  }

  // Pass userType to generateAccessToken
  const accessToken = user.generateAccessToken(userType);
  const loggedInUser = await Model.findById(user._id).select("-password"); // Fetch again to exclude password

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInUser,
        userRole: userType,
        accessToken,
      }, // Send user object without password
      `${userType.charAt(0).toUpperCase() + userType.slice(1)} logged in successfully`
    )
  );
});

// This relies on an auth middleware setting req.user correctly
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  const userRole = req.user.userType;
  const user = req.user.toObject();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user, userRole },
        "Current user fetched successfully"
      )
    );
});

export { getCurrentUser, loginUser, registerUser };
