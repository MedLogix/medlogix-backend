import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { InstitutionStock } from "../models/institutionStock.model.js";
import mongoose from "mongoose";
import { USER_TYPES } from "../utils/constants.js"; // Import USER_TYPES

// @desc    Manually add stock batch(es) possessed by the institution
// @route   POST /api/institution-stock
// @access  Private (Institution)
const addManualStock = asyncHandler(async (req, res) => {
  const { medicineId, stocks: newBatches } = req.body;
  const institutionId = req.user._id;

  if (!mongoose.isValidObjectId(medicineId)) {
    throw new ApiError(400, "Invalid Medicine ID format");
  }
  if (!Array.isArray(newBatches) || newBatches.length === 0) {
    throw new ApiError(400, "Stocks array (new batches) is required");
  }

  // TODO: Add detailed validation for each batch object in newBatches array
  // based on InstitutionStock schema (batchName, expiryDate, quantityReceived, purchasePrice, mrp, receivedDate)

  let instStock = await InstitutionStock.findOne({
    institutionId,
    medicineId,
    isDeleted: false,
  });

  if (!instStock) {
    // Create new record if one doesn't exist for this medicine
    instStock = await InstitutionStock.create({
      institutionId,
      medicineId,
      stocks: newBatches, // Ensure newBatches structure matches InstitutionStock.stocks schema
    });
    if (!instStock) {
      throw new ApiError(500, "Failed to create new institution stock record");
    }
  } else {
    // Add new batches to existing record
    instStock.stocks.push(...newBatches);
    instStock.markModified("stocks");
    await instStock.save();
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        instStock,
        "Institution stock added/updated successfully"
      )
    );
});

// @desc    Get own institution stock
// @route   GET /api/institution-stock
// @access  Private (Institution)
const getOwnStock = asyncHandler(async (req, res) => {
  const institutionId = req.user._id;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    search,
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "medicineId", select: "name manufacturer category unit" },
      { path: "stocks.warehouseId", select: "name" }, // Populate origin warehouse if available
    ],
  };

  const query = { institutionId, isDeleted: false };

  // Similar to warehouse stock, search needs aggregation or post-filtering
  const institutionStocks = await InstitutionStock.paginate(query, options);

  // Post-filter search example
  if (search && institutionStocks.docs) {
    const regex = new RegExp(search, "i");
    institutionStocks.docs = institutionStocks.docs.filter(
      (stock) => stock.medicineId && regex.test(stock.medicineId.name)
      // Add search on batchName within stocks array if needed (more complex)
    );
    // Note: Adjust pagination metadata if post-filtering significantly changes results
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        institutionStocks,
        "Institution stock fetched successfully"
      )
    );
});

// @desc    Get all institution stock (for Admin)
// @route   GET /api/institution-stock/admin
// @access  Private (Admin)
const getAllStockAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    institutionId,
    medicineId,
    search,
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "institutionId", select: "name email location" },
      { path: "medicineId", select: "name manufacturer category" },
      { path: "stocks.warehouseId", select: "name" }, // Populate origin warehouse
    ],
  };

  const query = { isDeleted: false };

  if (institutionId) {
    if (!mongoose.isValidObjectId(institutionId))
      throw new ApiError(400, "Invalid Institution ID format");
    query.institutionId = institutionId;
  }

  if (medicineId) {
    if (!mongoose.isValidObjectId(medicineId))
      throw new ApiError(400, "Invalid Medicine ID format");
    query.medicineId = medicineId;
  }

  const result = await InstitutionStock.paginate(query, options);

  // Post-filter search example
  if (search && result.docs) {
    const regex = new RegExp(search, "i");
    result.docs = result.docs.filter(
      (stock) =>
        (stock.medicineId && regex.test(stock.medicineId.name)) ||
        (stock.institutionId && regex.test(stock.institutionId.name))
      // Add more searchable fields if needed
    );
    // Note: Adjust pagination metadata if post-filtering significantly changes results
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result,
        "All institution stocks fetched successfully"
      )
    );
});

// @desc    Get a specific institution stock item (document for one medicine)
// @route   GET /api/institution-stock/:stockId
// @access  Private (Institution - Own, Admin)
const getStockById = asyncHandler(async (req, res) => {
  const { stockId } = req.params; // ID of the InstitutionStock document
  const user = req.user;

  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format");
  }

  const institutionStock = await InstitutionStock.findOne({
    _id: stockId,
    isDeleted: false,
  }).populate([
    { path: "institutionId", select: "name email location" },
    { path: "medicineId", select: "name manufacturer category unit" },
    { path: "stocks.warehouseId", select: "name" }, // Populate origin warehouse
  ]);

  if (!institutionStock) {
    throw new ApiError(404, "Institution stock record not found");
  }

  // Authorization Check
  const isAdmin = user.userType === USER_TYPES.ADMIN;
  const isOwnerInstitution =
    user.userType === USER_TYPES.INSTITUTION &&
    institutionStock.institutionId._id.equals(user._id);

  if (!isAdmin && !isOwnerInstitution) {
    throw new ApiError(403, "Forbidden: You cannot access this stock record");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        institutionStock,
        "Institution stock details fetched successfully"
      )
    );
});

// @desc    Update stock details (non-quantity)
// @route   PUT /api/institution-stock/:stockId // Or batch specific?
// @access  Private (Institution)
const updateStockDetails = asyncHandler(async (req, res) => {
  // TODO: Implement logic
  // 1. Get stockId (and maybe batch identifier) from req.params
  // 2. Get updated fields from req.body
  // 3. Find InstitutionStock
  // 4. Authorize: Ensure stock belongs to req.user._id (institutionId)
  // 5. Update the specific batch details
  // 6. Save and return updated stock
  res.status(501).json({ message: "Not Implemented" });
});

// @desc    Delete an institution stock item (document) by marking as deleted
// @route   DELETE /api/institution-stock/:stockId
// @access  Private (Institution)
const deleteStock = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const institutionId = req.user._id;

  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format");
  }

  // Find and update, ensuring ownership and not already deleted
  const deletedStock = await InstitutionStock.findOneAndUpdate(
    {
      _id: stockId,
      institutionId: institutionId, // Ensure ownership
      isDeleted: false,
    },
    { $set: { isDeleted: true } },
    { new: false } // Don't need the document back, just confirmation
  );

  if (!deletedStock) {
    // Check if it existed at all but was not owned or already deleted
    const stockExists = await InstitutionStock.findById(stockId);
    if (!stockExists || stockExists.isDeleted) {
      throw new ApiError(
        404,
        "Institution stock record not found or already deleted."
      );
    } else {
      // Must not belong to the user
      throw new ApiError(
        403,
        "Forbidden: You cannot delete this stock record."
      );
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { _id: stockId },
        "Institution stock record deleted successfully"
      )
    );
});

export {
  addManualStock,
  getOwnStock,
  getAllStockAdmin,
  getStockById,
  updateStockDetails,
  deleteStock,
};
