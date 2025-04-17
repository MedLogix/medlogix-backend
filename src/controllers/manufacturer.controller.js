import { Manufacturer } from "../models/Manufacturer.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllManufacturers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [{ name: { $regex: search, $options: "i" } }];
  }

  query.isDeleted = false;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
  };

  const result = await Manufacturer.paginate(query, options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Manufacturers fetched successfully"));
});

const getManufacturerById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const manufacturer = await Manufacturer.findById(id);

  if (!manufacturer) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  if (manufacturer.isDeleted) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, manufacturer, "Manufacturer fetched successfully")
    );
});

const createManufacturer = asyncHandler(async (req, res) => {
  const { name, email, phone, address } = req.body;
  const manufacturer = await Manufacturer.create({
    name,
    email,
    phone,
    address,
  });
  return res
    .status(201)
    .json(
      new ApiResponse(201, manufacturer, "Manufacturer created successfully")
    );
});

const updateManufacturer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address } = req.body;
  const manufacturer = await Manufacturer.findByIdAndUpdate(id, {
    name,
    email,
    phone,
    address,
  });

  if (!manufacturer) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  if (manufacturer.isDeleted) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, manufacturer, "Manufacturer updated successfully")
    );
});

const deleteManufacturer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const manufacturer = await Manufacturer.findByIdAndUpdate(id, {
    isDeleted: true,
  });

  if (!manufacturer) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  if (manufacturer.isDeleted) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Manufacturer not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, manufacturer, "Manufacturer deleted successfully")
    );
});

export {
  getAllManufacturers,
  getManufacturerById,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
};
