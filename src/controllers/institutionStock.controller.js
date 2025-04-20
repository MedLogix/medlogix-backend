import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { InstitutionStock } from "../models/institutionStock.model.js";
import mongoose from "mongoose";
import { USER_TYPES } from "../utils/constants.js"; // Import USER_TYPES
import { InstitutionUsageLog } from "../models/institutionUsageLog.model.js"; // Import the new log model

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

/**
 * @description Log stock usage for an institution using FEFO (First-Expired, First-Out)
 * @route POST /api/v1/institution-stock/log-usage
 * @access Private (Institution)
 */
const logUsage = asyncHandler(async (req, res) => {
  // 1. Get stockId and quantityUsed from request body
  const { stockId, quantityUsed: quantityToDecrement } = req.body;
  const institutionId = req.user._id; // Assuming user ID is attached by auth middleware

  // 2. Validate input
  if (!stockId || !quantityToDecrement) {
    throw new ApiError(400, "Stock ID and quantity used are required.");
  }
  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format.");
  }
  if (quantityToDecrement <= 0) {
    throw new ApiError(400, "Quantity used must be a positive number.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Find the specific institution's stock document
    const stockDoc = await InstitutionStock.findOne({
      _id: stockId,
      institutionId, // Ensure the stock belongs to the requesting institution
      isDeleted: false,
    }).session(session);

    if (!stockDoc) {
      throw new ApiError(
        404,
        "Stock record not found for this institution or specified ID."
      );
    }

    // 4. Calculate total available quantity across all batches with stock
    const totalAvailable = stockDoc.stocks.reduce(
      (sum, batch) => sum + (batch.currentQuantityInStrips || 0),
      0
    );

    // 5. Check if sufficient total stock is available
    if (totalAvailable < quantityToDecrement) {
      throw new ApiError(
        400,
        `Insufficient total stock available. Requested: ${quantityToDecrement}, Available: ${totalAvailable}`
      );
    }

    // 6. Implement FEFO (First-Expired, First-Out) logic
    // Filter out batches with no stock and sort by expiryDate (ascending)
    const sortedBatches = stockDoc.stocks
      .filter((batch) => batch.currentQuantityInStrips > 0)
      .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    let remainingToDecrement = quantityToDecrement;
    const usageLogEntries = []; // To store log entries for each affected batch

    for (const batch of sortedBatches) {
      if (remainingToDecrement <= 0) break; // Stop if the required quantity has been decremented

      const quantityToDeductFromBatch = Math.min(
        remainingToDecrement,
        batch.currentQuantityInStrips
      );

      if (quantityToDeductFromBatch > 0) {
        // Find the original index in the stockDoc.stocks array to update
        const originalBatchIndex = stockDoc.stocks.findIndex((b) =>
          b._id.equals(batch._id)
        );

        if (originalBatchIndex !== -1) {
          stockDoc.stocks[originalBatchIndex].currentQuantityInStrips -=
            quantityToDeductFromBatch;

          // Prepare log entry for this batch
          usageLogEntries.push({
            institutionId,
            medicineId: stockDoc.medicineId, // Get medicineId from the parent doc
            batchName: batch.batchName,
            type: "usage",
            quantity: quantityToDeductFromBatch,
          });

          remainingToDecrement -= quantityToDeductFromBatch;
        }
      }
    }

    // This check should ideally not be needed if the initial total check passes,
    // but serves as a safeguard.
    if (remainingToDecrement > 0) {
      await session.abortTransaction(); // Abort if something went wrong
      console.error(
        "FEFO Logic Error: remainingToDecrement > 0 despite sufficient initial stock",
        { stockId, quantityToDecrement, remainingToDecrement }
      );
      throw new ApiError(500, "Internal error during stock deduction logic.");
    }

    // Mark the 'stocks' array as modified for Mongoose
    stockDoc.markModified("stocks");

    // 7. Save the updated stock document
    await stockDoc.save({ session });

    // 8. Create the usage log entries
    if (usageLogEntries.length > 0) {
      await InstitutionUsageLog.create(usageLogEntries, { session });
    }

    // 9. Commit transaction
    await session.commitTransaction();

    // Populate medicine details for the response
    await stockDoc.populate({
      path: "medicineId",
      select: "name manufacturer category unit",
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          stockDoc,
          "Stock usage logged successfully using FEFO."
        )
      );
  } catch (error) {
    await session.abortTransaction();
    // Log the detailed error for debugging
    console.error("Error logging stock usage:", error);
    // Rethrow a user-friendly error
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to log stock usage"
    );
  } finally {
    session.endSession();
  }
});

export {
  addManualStock,
  getOwnStock,
  getAllStockAdmin,
  getStockById,
  logUsage,
};
