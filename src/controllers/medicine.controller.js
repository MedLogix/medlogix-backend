import { Medicine } from "../models/medicine.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllMedicines = asyncHandler(async (req, res) => {
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
    populate: ["salts", "manufacturer"],
  };

  const result = await Medicine.paginate(query, options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Medicines fetched successfully"));
});

const getMedicineById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const medicine = await Medicine.findById(id)
    .populate("salts")
    .populate("manufacturer");

  if (!medicine) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Medicine not found"));
  }

  if (medicine.isDeleted) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Medicine not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, medicine, "Medicine fetched successfully"));
});

const createMedicine = asyncHandler(async (req, res) => {
  const { name, salts, manufacturer, isTablets, medicineType } = req.body;
  const createdByRole = req.user.userType;
  const createdBy = req.user._id;

  const medicine = await Medicine.create({
    name,
    salts,
    manufacturer,
    isTablets,
    medicineType,
    createdByRole,
    createdBy,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, medicine, "Medicine created successfully"));
});

const updateMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, salts, manufacturer, isTablets, medicineType } = req.body;
  const medicine = await Medicine.findByIdAndUpdate(id, {
    name,
    salts,
    manufacturer,
    isTablets,
    medicineType,
  });

  if (!medicine) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Medicine not found"));
  }

  if (medicine.isDeleted) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Medicine not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, medicine, "Medicine updated successfully"));
});

const deleteMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const medicine = await Medicine.findByIdAndUpdate(id, {
    isDeleted: true,
  });

  if (!medicine) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "Medicine not found"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, medicine, "Medicine deleted successfully"));
});

export {
  createMedicine,
  deleteMedicine,
  getAllMedicines,
  getMedicineById,
  updateMedicine,
};
