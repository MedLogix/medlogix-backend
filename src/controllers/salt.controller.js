import { Salt } from "../models/salt.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllSalts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  query.isDeleted = false;

  if (search) {
    query.$or = [{ name: { $regex: search, $options: "i" } }];
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
  };

  const result = await Salt.paginate(query, options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Salts fetched successfully"));
});

const getSaltById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const salt = await Salt.findById(id);

  if (!salt) {
    return res.status(404).json(new ApiResponse(404, null, "Salt not found"));
  }

  if (salt.isDeleted) {
    return res.status(404).json(new ApiResponse(404, null, "Salt not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, salt, "Salt fetched successfully"));
});

const createSalt = asyncHandler(async (req, res) => {
  const { name, useCase } = req.body;
  const createdByRole = req.user.userType;
  const createdBy = req.user._id;

  const salt = await Salt.create({
    name,
    useCase,
    createdByRole,
    createdBy,
  });
  return res
    .status(201)
    .json(new ApiResponse(201, salt, "Salt created successfully"));
});

const updateSalt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, useCase } = req.body;
  const salt = await Salt.findByIdAndUpdate(id, {
    name,
    useCase,
  });

  if (!salt) {
    return res.status(404).json(new ApiResponse(404, null, "Salt not found"));
  }

  if (salt.isDeleted) {
    return res.status(404).json(new ApiResponse(404, null, "Salt not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, salt, "Salt updated successfully"));
});

const deleteSalt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const salt = await Salt.findByIdAndUpdate(id, {
    isDeleted: true,
  });

  if (!salt) {
    return res.status(404).json(new ApiResponse(404, null, "Salt not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, salt, "Salt deleted successfully"));
});

export { createSalt, deleteSalt, getAllSalts, getSaltById, updateSalt };
