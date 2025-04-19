import { WarehouseStock } from "../models/warehouseStock.model.js";
import { WarehouseReceiptLog } from "../models/warehouseReceiptLog.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { USER_TYPES } from "../utils/constants.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose from "mongoose";

// @desc    Add new stock batch(es) to warehouse for a specific medicine
// @route   POST /api/warehouse-stock
// @access  Private (Warehouse)
const addStock = asyncHandler(async (req, res) => {
  const {
    medicineId,
    batchName,
    quantity,
    mfgDate,
    expiryDate,
    packetSize,
    purchasePrice,
    sellingPrice,
    mrp,
    receivedDate,
  } = req.body;

  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(medicineId)) {
    throw new ApiError(400, "Invalid Medicine ID format");
  }
  if (
    !batchName ||
    !quantity ||
    !expiryDate ||
    !purchasePrice ||
    !sellingPrice ||
    !mrp ||
    !receivedDate
  ) {
    throw new ApiError(400, "Missing required stock fields.");
  }
  if (quantity <= 0) {
    throw new ApiError(400, "Quantity must be positive.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let warehouseStock = await WarehouseStock.findOne({
      warehouseId,
      medicineId,
      isDeleted: false,
    }).session(session);

    const newStockEntry = {
      batchName,
      quantity,
      reservedQuantity: 0,
      mfgDate,
      expiryDate,
      packetSize,
      purchasePrice,
      sellingPrice,
      mrp,
      receivedDate,
      createdAt: new Date(),
    };

    if (!warehouseStock) {
      warehouseStock = await WarehouseStock.create(
        [
          {
            warehouseId,
            medicineId,
            stocks: [newStockEntry],
          },
        ],
        { session }
      );
      warehouseStock = warehouseStock[0];
    } else {
      const existingBatchIndex = warehouseStock.stocks.findIndex(
        (s) => s.batchName === batchName
      );
      if (existingBatchIndex !== -1) {
        warehouseStock.stocks[existingBatchIndex].quantity += quantity;
      } else {
        warehouseStock.stocks.push(newStockEntry);
      }
      await warehouseStock.save({ session });
    }

    await WarehouseReceiptLog.create(
      [
        {
          warehouseId,
          medicineId,
          batchName,
          quantityAdded: quantity,
          mfgDate,
          expiryDate,
          purchasePrice,
          sellingPrice,
          mrp,
          receivedDate,
          addedByUserId: req.user._id,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    return res
      .status(201)
      .json(new ApiResponse(201, warehouseStock, "Stock added successfully."));
  } catch (error) {
    await session.abortTransaction();
    throw new ApiError(
      error.statusCode || 500,
      error.message || "Failed to add warehouse stock"
    );
  } finally {
    session.endSession();
  }
});

// @desc    Get own warehouse stock
// @route   GET /api/warehouse-stock
// @access  Private (Warehouse)
const getOwnStock = asyncHandler(async (req, res) => {
  const warehouseId = req.user._id;
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
    lean: true, // Use lean for performance if not modifying directly
    populate: {
      path: "medicineId",
      select: "name manufacturer category unit", // Fields to populate from Medicine model
    },
  };

  const query = { warehouseId, isDeleted: false };

  // Basic search on medicine name (requires populate to work effectively)
  // For more complex search on populated fields, consider aggregation pipeline
  // if (search) {
  //   query['medicineId.name'] = { $regex: search, $options: "i" }; // This won't work directly with paginate + populate
  // }

  const warehouseStocks = await WarehouseStock.paginate(query, options);

  // If search is needed on populated fields, perform it after pagination or use aggregation:
  if (search && warehouseStocks.docs) {
    const regex = new RegExp(search, "i");
    warehouseStocks.docs = warehouseStocks.docs.filter(
      (stock) => stock.medicineId && regex.test(stock.medicineId.name)
    );
    // Note: This filtering happens after pagination, affecting total counts.
    // A proper solution uses $lookup and $match in an aggregation pipeline before $skip/$limit.
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        warehouseStocks,
        "Warehouse stock fetched successfully"
      )
    );
});

// @desc    Get available stock for Institutions (Aggregated view)
// @route   GET /api/warehouse-stock/available
// @access  Private (Institution)
const getAvailableStockForInstitutions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", category = "" } = req.query;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const pipeline = [
    // Stage 1: Match non-deleted stock records
    { $match: { isDeleted: false } },

    // Stage 2: Unwind the stocks array to process each batch
    { $unwind: "$stocks" },

    // Stage 3: Calculate available quantity per batch
    {
      $addFields: {
        "stocks.availableQuantity": {
          $subtract: ["$stocks.quantity", "$stocks.reservedQuantity"],
        },
      },
    },

    // Stage 4: Filter out batches with no available quantity or expired
    {
      $match: {
        "stocks.availableQuantity": { $gt: 0 },
        "stocks.expiryDate": { $gt: new Date() }, // Only show non-expired stock
      },
    },

    // Stage 5: Group by medicineId to sum available quantities
    {
      $group: {
        _id: "$medicineId",
        totalAvailableQuantity: { $sum: "$stocks.availableQuantity" },
        // Keep first warehouseId encountered for potential display (or aggregate warehouse info)
        // warehouseInfo: { $first: "$warehouseId" } // Optional: Get one warehouse example
      },
    },

    // Stage 6: Lookup Medicine details
    {
      $lookup: {
        from: "medicines", // Collection name for Medicine model
        localField: "_id",
        foreignField: "_id",
        as: "medicineDetails",
      },
    },

    // Stage 7: Unwind medicineDetails (should be only one match)
    {
      $unwind: {
        path: "$medicineDetails",
        preserveNullAndEmptyArrays: false, // Exclude if medicine somehow doesn't exist
      },
    },

    // Stage 8: Apply search filters (on medicine name, manufacturer, etc.)
    {
      $match: {
        $or: [
          { "medicineDetails.name": { $regex: search, $options: "i" } },
          { "medicineDetails.manufacturer": { $regex: search, $options: "i" } },
          // Add other searchable fields from Medicine model if needed
        ],
        // Apply category filter if provided
        ...(category && { "medicineDetails.category": category }),
      },
    },

    // Stage 9: Project the final desired shape
    {
      $project: {
        _id: 0, // Exclude the default _id (which is medicineId)
        medicineId: "$_id",
        name: "$medicineDetails.name",
        manufacturer: "$medicineDetails.manufacturer",
        category: "$medicineDetails.category",
        unit: "$medicineDetails.unit",
        totalAvailableQuantity: 1,
        // Add any other relevant medicine details here
      },
    },

    // Stage 10: Pagination - Count total matching documents *before* skipping/limiting
    {
      $facet: {
        metadata: [{ $count: "totalDocs" }],
        data: [{ $skip: skip }, { $limit: limitNum }],
      },
    },
  ];

  const result = await WarehouseStock.aggregate(pipeline);

  const data = result[0].data;
  const totalDocs =
    result[0].metadata.length > 0 ? result[0].metadata[0].totalDocs : 0;
  const totalPages = Math.ceil(totalDocs / limitNum);

  const response = {
    docs: data,
    totalDocs: totalDocs,
    limit: limitNum,
    page: pageNum,
    totalPages: totalPages,
    hasNextPage: pageNum < totalPages,
    hasPrevPage: pageNum > 1,
    nextPage: pageNum < totalPages ? pageNum + 1 : null,
    prevPage: pageNum > 1 ? pageNum - 1 : null,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        response,
        "Available warehouse stock fetched successfully for institutions"
      )
    );
});

// @desc    Get all warehouse stock (for Admin)
// @route   GET /api/warehouse-stock/admin
// @access  Private (Admin)
const getAllStockAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    warehouseId,
    medicineId,
    search,
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "warehouseId", select: "name email" }, // Populate warehouse details
      { path: "medicineId", select: "name manufacturer category" }, // Populate medicine details
    ],
  };

  const query = { isDeleted: false };

  if (warehouseId) {
    if (!mongoose.isValidObjectId(warehouseId))
      throw new ApiError(400, "Invalid Warehouse ID format");
    query.warehouseId = warehouseId;
  }

  if (medicineId) {
    if (!mongoose.isValidObjectId(medicineId))
      throw new ApiError(400, "Invalid Medicine ID format");
    query.medicineId = medicineId;
  }

  // Basic search requires aggregation or post-filtering (like in getOwnStock)
  // if (search) {
  //    // Add search logic here - potentially filter on populated fields after query
  // }

  const result = await WarehouseStock.paginate(query, options);

  // Post-filter search example (adjust total counts accordingly or use aggregation)
  if (search && result.docs) {
    const regex = new RegExp(search, "i");
    result.docs = result.docs.filter(
      (stock) =>
        (stock.medicineId && regex.test(stock.medicineId.name)) ||
        (stock.warehouseId && regex.test(stock.warehouseId.name))
      // Add more searchable fields if needed
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "All warehouse stocks fetched successfully")
    );
});

// @desc    Get a specific stock item (document containing batches for one medicine)
// @route   GET /api/warehouse-stock/:stockId
// @access  Private (Warehouse - Own, Admin)
const getStockById = asyncHandler(async (req, res) => {
  const { stockId } = req.params; // This ID refers to the WarehouseStock document _id
  const user = req.user;

  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format");
  }

  const warehouseStock = await WarehouseStock.findOne({
    _id: stockId,
    isDeleted: false,
  }).populate([
    { path: "warehouseId", select: "name email" },
    { path: "medicineId", select: "name manufacturer category unit" },
  ]);

  if (!warehouseStock) {
    throw new ApiError(404, "Warehouse stock record not found");
  }

  // Authorization Check
  const isAdmin = user.userType === USER_TYPES.ADMIN;
  const isOwnerWarehouse =
    user.userType === USER_TYPES.WAREHOUSE &&
    warehouseStock.warehouseId._id.equals(user._id);

  if (!isAdmin && !isOwnerWarehouse) {
    throw new ApiError(403, "Forbidden: You cannot access this stock record");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        warehouseStock,
        "Warehouse stock details fetched successfully"
      )
    );
});

// @desc    Update details of a specific batch within a stock item
// @route   PUT /api/warehouse-stock/:stockId
// @access  Private (Warehouse)
const updateStockDetails = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const { batchName, ...updateData } = req.body; // Expect batchName and fields to update
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format");
  }
  if (!batchName) {
    throw new ApiError(
      400,
      "batchName is required in the request body to identify the batch"
    );
  }

  // Define allowed fields for update to prevent changing quantity, etc.
  const allowedUpdates = [
    "mfgDate",
    "expiryDate",
    "purchasePrice",
    "sellingPrice",
    "mrp",
    "packetSize",
  ];
  const updates = {};
  let hasValidUpdate = false;
  for (const key of Object.keys(updateData)) {
    if (allowedUpdates.includes(key)) {
      // Add nested update path for subdocument array element
      updates[`stocks.$.${key}`] = updateData[key];
      hasValidUpdate = true;
    }
  }

  if (!hasValidUpdate) {
    throw new ApiError(400, "No valid fields provided for update.");
  }
  // TODO: Add validation for the data types of updateData fields

  // Find the document and the specific batch, and update atomically
  const updatedStock = await WarehouseStock.findOneAndUpdate(
    {
      _id: stockId,
      warehouseId: warehouseId, // Ensure ownership
      isDeleted: false,
      "stocks.batchName": batchName, // Match the specific batch within the array
    },
    { $set: updates },
    { new: true } // Return the updated document
  );

  if (!updatedStock) {
    // Could be not found, not owned, or batchName doesn't exist
    // Check if the main document exists to give a more specific error
    const stockExists = await WarehouseStock.findOne({
      _id: stockId,
      warehouseId: warehouseId,
      isDeleted: false,
    });
    if (!stockExists) {
      throw new ApiError(
        404,
        "Warehouse stock record not found or does not belong to this warehouse."
      );
    } else {
      throw new ApiError(
        404,
        `Batch with name '${batchName}' not found within this stock record.`
      );
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedStock,
        `Batch '${batchName}' details updated successfully`
      )
    );
});

// @desc    Delete a stock item (document) by marking as deleted
// @route   DELETE /api/warehouse-stock/:stockId
// @access  Private (Warehouse)
const deleteStock = asyncHandler(async (req, res) => {
  const { stockId } = req.params;
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(stockId)) {
    throw new ApiError(400, "Invalid Stock ID format");
  }

  // Find and update, ensuring ownership
  const deletedStock = await WarehouseStock.findOneAndUpdate(
    {
      _id: stockId,
      warehouseId: warehouseId, // Ensure ownership
      isDeleted: false, // Only delete if not already deleted
    },
    { $set: { isDeleted: true } },
    { new: true } // Although we don't necessarily need the updated doc back
  );

  if (!deletedStock) {
    // Check if it existed at all (and wasn't owned or already deleted)
    const stockExists = await WarehouseStock.findById(stockId);
    if (!stockExists || stockExists.isDeleted) {
      throw new ApiError(
        404,
        "Warehouse stock record not found or already deleted."
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
        "Warehouse stock record deleted successfully"
      )
    );
});

export {
  addStock,
  getOwnStock,
  getAvailableStockForInstitutions,
  getAllStockAdmin,
  getStockById,
  updateStockDetails,
  deleteStock,
};
