import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Requirement } from "../models/requirement.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js";
import mongoose from "mongoose";
import { Warehouse } from "../models/warehouse.model.js";
import { USER_TYPES } from "../utils/constants.js";
import { Medicine } from "../models/medicine.model.js";
import {
  sendEmail,
  newRequirementSubmittedMailgenContent,
  requirementStatusUpdateMailgenContent,
} from "../utils/mail.js";
import { Institution } from "../models/institution.model.js";

// Helper function to calculate total available stock (non-reserved)
const calculateAvailableStock = (warehouseStock) => {
  if (!warehouseStock || !warehouseStock.stocks) {
    return 0;
  }
  return warehouseStock.stocks.reduce((total, batch) => {
    return total + (batch.quantity - batch.reservedQuantity);
  }, 0);
};

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
      approvedQuantity: 0, // Initialize approved quantity
      status: "Pending", // Initialize status
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

  const institutionExists = await Institution.findById(institutionId);
  if (!institutionExists || institutionExists.isDeleted) {
    throw new ApiError(404, "Institution not found");
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

  try {
    if (warehouseExists?.email) {
      const requirementUrl = `${process.env.FRONTEND_URL}/requirements/${newRequirement._id}`;

      const mailgenContent = newRequirementSubmittedMailgenContent({
        recipientName: warehouseExists.name || "Warehouse",
        institutionName: institutionExists.name || "Institution",
        requirementId: newRequirement._id.toString(),
        viewRequirementUrl: requirementUrl,
      });

      await sendEmail({
        email: warehouseExists.email,
        subject: `New Requirement Submitted: ${newRequirement._id}`,
        mailgenContent,
      });
    }
  } catch (error) {
    console.error("Failed to send requirement notification email:", error);
    // Continue with the API response even if email fails
  }

  // 5. Return success response
  return res
    .status(201)
    .json(
      new ApiResponse(201, newRequirement, "Requirement created successfully")
    );
});

// @desc    Get requirements created by the institution or assigned to warehouse
// @route   GET /api/requirements
// @access  Private (Institution, Warehouse)
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
      // Conditional population based on user type might be needed if fields differ
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
    const validStatuses = [
      "Pending",
      "Fully Approved",
      "Partially Approved", // Keep if partial logic exists elsewhere
      "Rejected",
      "Shipped",
      "Delivered",
      "Received",
    ];
    if (!validStatuses.includes(status)) {
      throw new ApiError(400, `Invalid status filter: ${status}`);
    }
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

// @desc    Check stock availability for a specific requirement
// @route   GET /api/requirements/:requirementId/stock-availability
// @access  Private (Warehouse)
const getRequirementStockAvailability = asyncHandler(async (req, res) => {
  const { requirementId } = req.params;
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(requirementId)) {
    throw new ApiError(400, "Invalid Requirement ID format");
  }

  const requirement = await Requirement.findOne({
    _id: requirementId,
    warehouseId: warehouseId, // Ensure it belongs to the requesting warehouse
    isDeleted: false,
  }).populate("medicines.medicineId", "name"); // Populate medicine names

  if (!requirement) {
    throw new ApiError(
      404,
      "Requirement not found or does not belong to this warehouse"
    );
  }

  let canFulfillEntireRequirement = true;
  const detailedStockInfo = [];

  for (const med of requirement.medicines) {
    const warehouseStock = await WarehouseStock.findOne({
      warehouseId: warehouseId,
      medicineId: med.medicineId._id,
    });

    const availableStock = calculateAvailableStock(warehouseStock);
    const isSufficient = availableStock >= med.requestedQuantity;

    if (!isSufficient) {
      canFulfillEntireRequirement = false;
    }

    detailedStockInfo.push({
      medicineId: med.medicineId._id,
      name: med.medicineId.name, // Get name from populated field
      requestedQuantity: med.requestedQuantity,
      availableStock: availableStock,
      isSufficient: isSufficient,
    });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        canFulfillEntireRequirement,
        detailedStockInfo,
      },
      "Stock availability checked successfully"
    )
  );
});

// @desc    Approve ALL items within a requirement (All or Nothing)
// @route   PATCH /api/requirements/:requirementId/approve
// @access  Private (Warehouse)
const approveRequirementItems = asyncHandler(async (req, res) => {
  const { requirementId } = req.params;
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(requirementId)) {
    throw new ApiError(400, "Invalid Requirement ID format");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Find the Requirement and lock it for the transaction
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

    // 2. Check if requirement status allows approval ('Pending' only for this logic)
    if (requirement.overallStatus !== "Pending") {
      throw new ApiError(
        400,
        `Requirement cannot be approved. Current status: ${requirement.overallStatus}`
      );
    }
    // This check might be redundant if status is strictly 'Pending', but good practice
    if (requirement.logisticId) {
      throw new ApiError(
        400,
        "Cannot approve requirement after shipment has been created"
      );
    }

    // 3. Upfront Stock Availability Check (All or Nothing)
    const stockChecks = []; // To store stock documents for later reservation
    for (const med of requirement.medicines) {
      const warehouseStock = await WarehouseStock.findOne({
        warehouseId: warehouseId,
        medicineId: med.medicineId,
      }).session(session); // Ensure read is part of the transaction

      const availableStock = calculateAvailableStock(warehouseStock);

      if (availableStock < med.requestedQuantity) {
        throw new ApiError(
          400,
          `Insufficient stock for medicine ID ${med.medicineId}. Required: ${med.requestedQuantity}, Available: ${availableStock}`
        );
      }
      // Store the fetched stock document to avoid fetching again
      stockChecks.push({
        medicineId: med.medicineId.toString(),
        requestedQuantity: med.requestedQuantity,
        stockDoc: warehouseStock,
      });
    }

    // 4. FEFO Reservation
    for (const check of stockChecks) {
      const { medicineId, requestedQuantity, stockDoc } = check;

      if (!stockDoc) {
        // This case should theoretically be caught by the availability check,
        // but handle defensively. It implies requestedQuantity > 0 but stockDoc is null.
        throw new ApiError(
          500,
          `Internal Error: Stock document not found for ${medicineId} during reservation phase.`
        );
      }

      // Sort batches by expiry date (ascending - oldest first)
      stockDoc.stocks.sort(
        (a, b) =>
          (a.expiryDate ? new Date(a.expiryDate) : new Date(0)) - // Handle potentially missing expiry dates
          (b.expiryDate ? new Date(b.expiryDate) : new Date(0))
      );

      let remainingToReserve = requestedQuantity;
      for (const batch of stockDoc.stocks) {
        if (remainingToReserve <= 0) break;

        const availableInBatch = batch.quantity - batch.reservedQuantity;
        if (availableInBatch > 0) {
          const reserveFromBatch = Math.min(
            remainingToReserve,
            availableInBatch
          );
          batch.reservedQuantity += reserveFromBatch;
          remainingToReserve -= reserveFromBatch;
        }
      }

      // Double-check if reservation was fully successful (should always be if initial check passed)
      if (remainingToReserve > 0) {
        throw new ApiError(
          500, // Internal Server Error because the upfront check should have prevented this
          `Internal Error: Could not reserve full quantity for ${medicineId} despite passing initial check.`
        );
      }

      // Mark stocks array as modified and save
      stockDoc.markModified("stocks");
      await stockDoc.save({ session });
    }

    // 5. Update Requirement Status
    requirement.overallStatus = "Approved";
    requirement.medicines.forEach((med) => {
      med.status = "Approved";
      med.approvedQuantity = med.requestedQuantity; // Approve the full requested amount
    });

    // 6. Save the updated Requirement
    const updatedRequirement = await requirement.save({ session });

    // 7. Commit transaction
    await session.commitTransaction();

    try {
      const [warehouse, institution] = await Promise.all([
        Warehouse.findById(updatedRequirement.warehouseId),
        Institution.findById(updatedRequirement.institutionId),
      ]);

      if (institution?.email) {
        const viewRequirementUrl = `${process.env.FRONTEND_URL}/requirements/${requirementId}`;
        // 8. Send email notification to warehouse
        const mailgenContent = requirementStatusUpdateMailgenContent({
          recipientName: institution.name || "Institution",
          requirementId,
          newStatus: "Approved",
          warehouseName: warehouse?.name || "Warehouse",
          viewRequirementUrl,
        });

        await sendEmail({
          email: institution.email,
          subject: `Requirement Approved: ${requirementId}`,
          mailgenContent,
        });
      }
    } catch (error) {
      console.error("Failed to send approval notification email:", error);
      // Continue with the API response even if email fails
    }

    // 8. Return updated requirement
    return res.status(200).json(
      new ApiResponse(
        200,
        updatedRequirement, // Return the saved requirement
        "Requirement fully approved successfully"
      )
    );
  } catch (error) {
    // Rollback transaction on any error
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
  getAllRequirementsAdmin,
  getRequirementById,
  getRequirementStockAvailability, // Export the new function
  approveRequirementItems,
};
