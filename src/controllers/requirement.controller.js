import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Requirement } from "../models/requirement.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js";
import mongoose from "mongoose";
import { Warehouse } from "../models/warehouse.model.js";
import { USER_TYPES } from "../utils/constants.js";
import { Medicine } from "../models/medicine.model.js";

// @desc    Create a new stock requirement
// @route   POST /api/requirements
// @access  Private (Institution)
const createRequirement = asyncHandler(async (req, res) => {
  const { warehouseId, medicines } = req.body;
  const institutionId = req.user._id;

  // 1. Validate input
  if (!mongoose.isValidObjectId(warehouseId)) {
    throw new ApiError(400, "Invalid Warehouse ID format");
  }
  if (!Array.isArray(medicines) || medicines.length === 0) {
    throw new ApiError(400, "Medicines array is required and cannot be empty");
  }

  const processedMedicines = [];
  const medicineIds = [];

  for (const med of medicines) {
    if (
      !med.medicineId ||
      !mongoose.isValidObjectId(med.medicineId) ||
      !med.requestedQuantity ||
      isNaN(parseInt(med.requestedQuantity)) ||
      parseInt(med.requestedQuantity) <= 0
    ) {
      throw new ApiError(
        400,
        "Each medicine must have a valid medicineId and a positive requestedQuantity"
      );
    }
    medicineIds.push(med.medicineId);
    // Store temporarily, process after validation
    processedMedicines.push({
      medicineId: med.medicineId,
      requestedQuantity: parseInt(med.requestedQuantity),
    });
  }

  // Check if all requested medicines exist in the database
  const existingMedicines = await Medicine.find({
    _id: { $in: medicineIds },
    isDeleted: { $ne: true }, // Ensure medicine is not deleted
  }).select("_id");

  if (existingMedicines.length !== medicineIds.length) {
    const foundIds = new Set(existingMedicines.map((m) => m._id.toString()));
    const notFoundIds = medicineIds.filter((id) => !foundIds.has(id));
    throw new ApiError(
      404,
      `The following medicine IDs were not found: ${notFoundIds.join(", ")}`
    );
  }

  // 2. Check if warehouse exists (optional but recommended)
  const warehouseExists = await Warehouse.findById(warehouseId);
  if (!warehouseExists || warehouseExists.isDeleted) {
    throw new ApiError(404, "Target warehouse not found");
  }

  // 3. Create new Requirement document
  const newRequirement = await Requirement.create({
    institutionId,
    warehouseId,
    medicines: processedMedicines, // Use the validated & processed list
    overallStatus: "Pending", // Initial status
  });

  if (!newRequirement) {
    throw new ApiError(500, "Failed to create requirement");
  }

  // 4. Return success response
  return res
    .status(201)
    .json(
      new ApiResponse(201, newRequirement, "Requirement created successfully")
    );
});

// @desc    Get requirements created by the institution
// @route   GET /api/requirements
// @access  Private (Institution)
const getOwnRequirements = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "warehouseId", select: "name email contactPerson" }, // Populate warehouse details
      { path: "medicines.medicineId", select: "name manufacturer category" }, // Populate medicine details within the array
      { path: "logisticId", select: "shipmentId status receivedStatus" }, // Populate basic logistic info if available
      { path: "institutionId", select: "name email contactPerson location" }, // Populate institution details
    ],
  };

  const query = { isDeleted: false };

  const userType = req.user.userType;

  if (userType === USER_TYPES.WAREHOUSE) {
    query.warehouseId = req.user._id;
  } else if (userType === USER_TYPES.INSTITUTION) {
    query.institutionId = req.user._id;
  }

  const requirements = await Requirement.paginate(query, options);

  if (!requirements) {
    // Should not happen with paginate, but good practice
    throw new ApiError(404, "Error fetching requirements");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, requirements, "Requirements fetched successfully")
    );
});

// @desc    Get requirements directed to the warehouse
// @route   GET /api/requirements/warehouse
// @access  Private (Warehouse)
const getRequirementsForWarehouse = asyncHandler(async (req, res) => {
  const warehouseId = req.user._id;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "institutionId", select: "name email contactPerson location" }, // Populate institution details
      { path: "medicines.medicineId", select: "name manufacturer category" }, // Populate medicine details within the array
      { path: "logisticId", select: "shipmentId status receivedStatus" }, // Populate basic logistic info if available
    ],
  };

  const query = { warehouseId, isDeleted: false };

  const requirements = await Requirement.paginate(query, options);

  if (!requirements) {
    throw new ApiError(404, "Error fetching requirements for warehouse");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        requirements,
        "Requirements for warehouse fetched successfully"
      )
    );
});

// @desc    Get all requirements (for Admin)
// @route   GET /api/requirements/admin
// @access  Private (Admin)
const getAllRequirementsAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    warehouseId, // Optional filter
    institutionId, // Optional filter
    status, // Optional filter (overallStatus)
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "warehouseId", select: "name email" },
      { path: "institutionId", select: "name email location" },
      { path: "medicines.medicineId", select: "name manufacturer" },
      { path: "logisticId", select: "shipmentId status" },
    ],
  };

  const query = { isDeleted: false };

  if (warehouseId) {
    if (!mongoose.isValidObjectId(warehouseId)) {
      throw new ApiError(400, "Invalid Warehouse ID filter format");
    }
    query.warehouseId = warehouseId;
  }

  if (institutionId) {
    if (!mongoose.isValidObjectId(institutionId)) {
      throw new ApiError(400, "Invalid Institution ID filter format");
    }
    query.institutionId = institutionId;
  }

  if (status) {
    // Validate status against the enum values if necessary
    query.overallStatus = status;
  }

  const requirements = await Requirement.paginate(query, options);

  if (!requirements) {
    throw new ApiError(404, "Error fetching all requirements");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        requirements,
        "All requirements fetched successfully"
      )
    );
});

// @desc    Get a specific requirement by ID
// @route   GET /api/requirements/:requirementId
// @access  Private (Institution - Own, Warehouse - Associated, Admin)
const getRequirementById = asyncHandler(async (req, res) => {
  const { requirementId } = req.params;

  // 1. Validate ID
  if (!mongoose.isValidObjectId(requirementId)) {
    throw new ApiError(400, "Invalid Requirement ID format");
  }

  // 3. Find Requirement by ID and populate details
  const requirement = await Requirement.findOne({
    _id: requirementId,
    isDeleted: false,
  }).populate([
    { path: "warehouseId", select: "name email contactPerson" },
    { path: "institutionId", select: "name email contactPerson location" },
    { path: "medicines.medicineId", select: "name manufacturer category" },
    { path: "logisticId", select: "shipmentId status receivedStatus vehicles" }, // Populate more logistic details
  ]);

  if (!requirement) {
    throw new ApiError(404, "Requirement not found");
  }

  // 4. Authorization check based on user role
  const user = req.user;
  const isAdmin = user.userType === USER_TYPES.ADMIN;
  const isOwnerInstitution =
    user.userType === USER_TYPES.INSTITUTION &&
    requirement.institutionId._id.equals(user._id);
  const isAssociatedWarehouse =
    user.userType === USER_TYPES.WAREHOUSE &&
    requirement.warehouseId._id.equals(user._id);

  if (!isAdmin && !isOwnerInstitution && !isAssociatedWarehouse) {
    throw new ApiError(
      403,
      "Forbidden: You are not authorized to view this requirement"
    );
  }

  // 6. Return requirement
  return res
    .status(200)
    .json(
      new ApiResponse(200, requirement, "Requirement fetched successfully")
    );
});

// Helper function to calculate overall status
const calculateOverallStatus = (medicines) => {
  const totalItems = medicines.length;
  let approvedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  medicines.forEach((med) => {
    if (med.status === "Approved") {
      approvedCount++;
    } else if (med.status === "Rejected") {
      rejectedCount++;
    } else {
      pendingCount++;
    }
  });

  if (pendingCount > 0) {
    return approvedCount > 0 ? "Partially Approved" : "Pending";
  }
  if (approvedCount === 0 && rejectedCount > 0) {
    return "Rejected";
  }
  if (approvedCount > 0 && rejectedCount > 0) {
    return "Partially Approved";
  }
  if (approvedCount === totalItems) {
    return "Fully Approved";
  }
  // This case might be unreachable if logic is correct, but default to pending
  return "Pending";
};

// @desc    Approve or reject items within a requirement
// @route   PATCH /api/requirements/:requirementId/approve
// @access  Private (Warehouse)
const approveRequirementItems = asyncHandler(async (req, res) => {
  const { requirementId } = req.params;
  const { medicines: approvalUpdates } = req.body; // [{ medicineId, approvedQuantity, status ('Approved'/'Rejected') }]
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(requirementId)) {
    throw new ApiError(400, "Invalid Requirement ID format");
  }
  if (!Array.isArray(approvalUpdates) || approvalUpdates.length === 0) {
    throw new ApiError(400, "Approval updates array is required");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4. Find the Requirement and lock it for the transaction
    const requirement =
      await Requirement.findById(requirementId).session(session);

    if (!requirement) {
      throw new ApiError(404, "Requirement not found");
    }
    if (requirement.isDeleted) {
      throw new ApiError(404, "Requirement has been deleted");
    }
    if (!requirement.warehouseId.equals(warehouseId)) {
      throw new ApiError(
        403,
        "Forbidden: Requirement does not belong to this warehouse"
      );
    }

    // 5. Check if requirement status allows approval
    const allowedStatuses = ["Pending", "Partially Approved"];
    if (!allowedStatuses.includes(requirement.overallStatus)) {
      throw new ApiError(
        400,
        `Cannot modify requirement with status: ${requirement.overallStatus}`
      );
    }
    if (requirement.logisticId) {
      throw new ApiError(
        400,
        "Cannot modify requirement items after shipment has been created"
      );
    }

    // Map for efficient lookup of original requested quantities and current status
    const originalMedicineMap = new Map();
    requirement.medicines.forEach((med) => {
      originalMedicineMap.set(med.medicineId.toString(), {
        requestedQuantity: med.requestedQuantity,
        currentApprovedQuantity: med.approvedQuantity,
        currentStatus: med.status,
      });
    });

    // Process each update
    for (const update of approvalUpdates) {
      if (
        !update.medicineId ||
        !mongoose.isValidObjectId(update.medicineId) ||
        !update.status ||
        !["Approved", "Rejected"].includes(update.status) ||
        (update.status === "Approved" &&
          (isNaN(parseInt(update.approvedQuantity)) ||
            parseInt(update.approvedQuantity) < 0)) ||
        (update.status === "Rejected" &&
          update.approvedQuantity !== undefined &&
          parseInt(update.approvedQuantity) !== 0)
      ) {
        throw new ApiError(
          400,
          `Invalid update format for medicine ${update.medicineId || "unknown"}`
        );
      }

      const medIdString = update.medicineId.toString();
      const originalMed = originalMedicineMap.get(medIdString);

      if (!originalMed) {
        throw new ApiError(
          400,
          `Medicine ${medIdString} not found in the original requirement`
        );
      }

      const approvedQuantity =
        update.status === "Approved" ? parseInt(update.approvedQuantity) : 0;

      // b. Validate approvedQuantity <= requestedQuantity
      if (approvedQuantity > originalMed.requestedQuantity) {
        throw new ApiError(
          400,
          `Approved quantity (${approvedQuantity}) cannot exceed requested quantity (${originalMed.requestedQuantity}) for medicine ${medIdString}`
        );
      }

      // Find the medicine subdocument within the requirement
      const reqMed = requirement.medicines.find(
        (m) => m.medicineId.toString() === medIdString
      );
      if (!reqMed) continue; // Should exist based on map check, but safety first

      const quantityChange =
        approvedQuantity -
        (reqMed.status === "Approved" ? reqMed.approvedQuantity : 0);

      // Update requirement medicine status
      reqMed.status = update.status;
      reqMed.approvedQuantity = approvedQuantity;

      // d/e. Adjust reserved stock in WarehouseStock
      const warehouseStock = await WarehouseStock.findOne({
        warehouseId: warehouseId,
        medicineId: update.medicineId,
      }).session(session);

      if (!warehouseStock && quantityChange > 0) {
        throw new ApiError(
          404,
          `Warehouse stock not found for medicine ${medIdString} to reserve quantity.`
        );
      }
      if (!warehouseStock) continue; // No stock to adjust if rejecting/reducing

      if (quantityChange > 0) {
        // Need to reserve more stock
        let remainingToReserve = quantityChange;
        let actuallyReserved = 0;
        // Sort batches by expiry or received date (FIFO)
        warehouseStock.stocks.sort((a, b) => a.createdAt - b.createdAt);

        for (const batch of warehouseStock.stocks) {
          const availableInBatch = batch.quantity - batch.reservedQuantity;
          if (availableInBatch > 0 && remainingToReserve > 0) {
            const reserveFromBatch = Math.min(
              remainingToReserve,
              availableInBatch
            );
            batch.reservedQuantity += reserveFromBatch;
            remainingToReserve -= reserveFromBatch;
            actuallyReserved += reserveFromBatch;
          }
          if (remainingToReserve <= 0) break;
        }
        if (remainingToReserve > 0) {
          throw new ApiError(
            400,
            `Insufficient available stock for medicine ${medIdString}. Required: ${quantityChange}, Available: ${actuallyReserved}`
          );
        }
      } else if (quantityChange < 0) {
        // Need to release reserved stock
        let remainingToRelease = Math.abs(quantityChange);
        // Release from batches, potentially reverse order of reservation (LIFO for release? Or same FIFO?)
        // Using FIFO for simplicity here
        warehouseStock.stocks.sort((a, b) => a.createdAt - b.createdAt);

        for (const batch of warehouseStock.stocks) {
          if (batch.reservedQuantity > 0 && remainingToRelease > 0) {
            const releaseFromBatch = Math.min(
              remainingToRelease,
              batch.reservedQuantity
            );
            batch.reservedQuantity -= releaseFromBatch;
            remainingToRelease -= releaseFromBatch;
          }
          if (remainingToRelease <= 0) break;
        }
        // Log warning if couldn't release expected amount (data inconsistency?)
        if (remainingToRelease > 0) {
          console.warn(
            `Could not release full reserved quantity for medicine ${medIdString}. Discrepancy: ${remainingToRelease}`
          );
        }
      }
      // Mark stocks array as modified if changes were made
      if (quantityChange !== 0) {
        warehouseStock.markModified("stocks");
        await warehouseStock.save({ session });
      }
    }

    // 8. Recalculate overallStatus
    requirement.overallStatus = calculateOverallStatus(requirement.medicines);

    // 9. Save the updated Requirement
    await requirement.save({ session });

    // 10. Commit transaction
    await session.commitTransaction();

    // 11. Return updated requirement
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          requirement,
          "Requirement items updated successfully"
        )
      );
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    throw error; // Re-throw the error to be handled by global error handler
  } finally {
    // End session
    session.endSession();
  }
});

export {
  createRequirement,
  getOwnRequirements,
  getRequirementsForWarehouse,
  getAllRequirementsAdmin,
  getRequirementById,
  approveRequirementItems,
};
