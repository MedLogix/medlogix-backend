import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Logistic } from "../models/logistic.model.js";
import { Requirement } from "../models/requirement.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js";
import { InstitutionStock } from "../models/institutionStock.model.js";
import mongoose from "mongoose";
import { USER_TYPES } from "../utils/constants.js"; // Import USER_TYPES
import { InstitutionUsageLog } from "../models/institutionUsageLog.model.js";

// Helper function to generate a unique shipment ID (example)
const generateShipmentId = async () => {
  // Basic example: Prefixed timestamp + random part. Implement a robust unique ID generator.
  const prefix = "SHP";
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  // Ensure uniqueness check against Logistic collection if needed
  return `${prefix}${timestamp}${randomPart}`;
};

// @desc    Create a new shipment for an approved requirement
// @route   POST /api/logistics
// @access  Private (Warehouse)
const createShipment = asyncHandler(async (req, res) => {
  const { requirementId, vehicles, shipmentId: providedShipmentId } = req.body;
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(requirementId)) {
    throw new ApiError(400, "Invalid Requirement ID format");
  }
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    throw new ApiError(400, "Vehicle details are required");
  }
  // TODO: Add validation for vehicle object structure

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Find the Requirement and lock it
    const requirement = await Requirement.findById(requirementId)
      .populate("medicines.medicineId")
      .session(session);

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

    // 4. Validate Requirement Status
    const allowedStatuses = ["Approved"];
    if (!allowedStatuses.includes(requirement.overallStatus)) {
      throw new ApiError(
        400,
        `Cannot create shipment for requirement with status: ${requirement.overallStatus}`
      );
    }
    if (requirement.logisticId) {
      // If needed, allow creating multiple shipments for one requirement by removing this check
      // and adjusting logic to only ship remaining approved items.
      throw new ApiError(400, "A shipment already exists for this requirement");
    }

    const logisticMedicines = [];

    // 6. Prepare medicines array for Logistic model and update WarehouseStock
    for (const reqMed of requirement.medicines) {
      if (reqMed.status !== "Approved" || reqMed.approvedQuantity <= 0) {
        continue; // Skip non-approved or zero-quantity items
      }

      let quantityToShip = reqMed.approvedQuantity;
      const medicineId = reqMed.medicineId._id;
      const logisticMedicineBatches = [];

      const warehouseStock = await WarehouseStock.findOne({
        warehouseId: warehouseId,
        medicineId: medicineId,
      }).session(session);

      if (!warehouseStock) {
        throw new ApiError(
          404,
          `Warehouse stock not found for approved medicine: ${reqMed.medicineId.name || medicineId}`
        );
      }

      // Sort batches by FEFO (using expiryDate, ascending)
      warehouseStock.stocks.sort((a, b) => a.expiryDate - b.expiryDate);

      let reservedAvailable = 0;
      warehouseStock.stocks.forEach(
        (b) => (reservedAvailable += b.reservedQuantity)
      );
      if (reservedAvailable < quantityToShip) {
        throw new ApiError(
          400,
          `Mismatch: Approved quantity (${quantityToShip}) exceeds reserved quantity (${reservedAvailable}) for ${reqMed.medicineId.name || medicineId}`
        );
      }

      for (const batch of warehouseStock.stocks) {
        if (quantityToShip <= 0) break;

        // Ship only from reserved quantity in the batch first
        const canShipFromBatch = Math.min(
          quantityToShip,
          batch.reservedQuantity,
          batch.quantity
        );

        if (canShipFromBatch > 0) {
          logisticMedicineBatches.push({
            batchNumber: batch.batchName,
            expiryDate: batch.expiryDate,
            quantity: canShipFromBatch,
            packetSize: batch.packetSize,
            sellingPrice: batch.sellingPrice, // Price at time of shipment
            mrp: batch.mrp,
          });

          // Decrease both actual and reserved quantity
          batch.quantity -= canShipFromBatch;
          batch.reservedQuantity -= canShipFromBatch;
          quantityToShip -= canShipFromBatch;
        }
      }

      if (quantityToShip > 0) {
        // This indicates an issue - couldn't fulfill the approved quantity from reserved stock
        throw new ApiError(
          500,
          `Stock inconsistency: Could not fulfill approved quantity for ${reqMed.medicineId.name || medicineId} from reserved batches. Remaining: ${quantityToShip}`
        );
      }

      if (logisticMedicineBatches.length > 0) {
        logisticMedicines.push({
          medicine: medicineId,
          stocks: logisticMedicineBatches,
        });
      }
      // Mark stock as modified and save
      warehouseStock.markModified("stocks");
      await warehouseStock.save({ session });
    }

    if (logisticMedicines.length === 0) {
      throw new ApiError(
        400,
        "No approved medicines with quantity found in the requirement to ship."
      );
    }

    // Generate shipment ID if not provided
    const finalShipmentId = providedShipmentId || (await generateShipmentId());

    // 7. Create the Logistic document
    const newLogistic = new Logistic({
      shipmentId: finalShipmentId,
      requirementId: requirement._id,
      warehouse: warehouseId,
      institution: requirement.institutionId,
      medicines: logisticMedicines,
      vehicles: vehicles,
      status: "In Transit", // Initial status upon creation
      receivedStatus: "Pending",
    });

    await newLogistic.save({ session });

    // 8. Update the Requirement
    requirement.logisticId = newLogistic._id;
    // Directly set status to Shipped as per dataflow (no partial shipments)
    requirement.overallStatus = "Shipped";
    await requirement.save({ session });

    // 9. Commit Transaction
    await session.commitTransaction();

    // 10. Return the created Logistic document
    return res
      .status(201)
      .json(new ApiResponse(201, newLogistic, "Shipment created successfully"));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

// @desc    Get shipments originating from the warehouse
// @route   GET /api/logistics
// @access  Private (Warehouse)
const getOwnShipments = asyncHandler(async (req, res) => {
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
      { path: "institution", select: "name email location" },
      { path: "medicines.medicine", select: "name manufacturer" },
      { path: "requirementId", select: "_id overallStatus" }, // Link back to requirement
    ],
  };

  const query = { warehouse: warehouseId, isDeleted: false };

  const logistics = await Logistic.paginate(query, options);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        logistics,
        "Shipments originating from warehouse fetched successfully"
      )
    );
});

// @desc    Get shipments incoming to the institution
// @route   GET /api/logistics/institution
// @access  Private (Institution)
const getIncomingShipments = asyncHandler(async (req, res) => {
  const institutionId = req.user._id;
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
      { path: "warehouse", select: "name email" },
      { path: "medicines.medicine", select: "name manufacturer" },
      { path: "requirementId", select: "_id overallStatus" },
    ],
  };

  const query = { institution: institutionId, isDeleted: false };

  const logistics = await Logistic.paginate(query, options);

  return res
    .status(200)
    .json(
      new ApiResponse(200, logistics, "Incoming shipments fetched successfully")
    );
});

// @desc    Get all shipments (for Admin)
// @route   GET /api/logistics/admin
// @access  Private (Admin)
const getAllShipmentsAdmin = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    warehouseId, // Optional filter
    institutionId, // Optional filter
    status, // Optional filter
    receivedStatus, // Optional filter
  } = req.query;

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true,
    populate: [
      { path: "warehouse", select: "name email" },
      { path: "institution", select: "name email location" },
      { path: "medicines.medicine", select: "name manufacturer" },
      { path: "requirementId", select: "_id overallStatus" },
    ],
  };

  const query = { isDeleted: false };

  if (warehouseId) {
    if (!mongoose.isValidObjectId(warehouseId))
      throw new ApiError(400, "Invalid Warehouse ID");
    query.warehouse = warehouseId;
  }
  if (institutionId) {
    if (!mongoose.isValidObjectId(institutionId))
      throw new ApiError(400, "Invalid Institution ID");
    query.institution = institutionId;
  }
  if (status) query.status = status;
  if (receivedStatus) query.receivedStatus = receivedStatus;

  const logistics = await Logistic.paginate(query, options);

  return res
    .status(200)
    .json(
      new ApiResponse(200, logistics, "All shipments fetched successfully")
    );
});

// @desc    Get a specific shipment by ID
// @route   GET /api/logistics/:logisticId
// @access  Private (Warehouse - Own, Institution - Incoming, Admin)
const getShipmentById = asyncHandler(async (req, res) => {
  const { logisticId } = req.params;

  if (!mongoose.isValidObjectId(logisticId)) {
    throw new ApiError(400, "Invalid Logistic ID format");
  }

  const logistic = await Logistic.findOne({
    _id: logisticId,
    isDeleted: false,
  }).populate([
    { path: "warehouse", select: "name email contactPerson" },
    { path: "institution", select: "name email contactPerson location" },
    { path: "medicines.medicine", select: "name manufacturer category unit" }, // Populate more medicine details
    { path: "requirementId", select: "_id overallStatus createdAt" }, // Populate requirement details
  ]);

  if (!logistic) {
    throw new ApiError(404, "Shipment not found");
  }

  // Authorization check
  const user = req.user;
  const isAdmin = user.userType === USER_TYPES.ADMIN;
  const isOwnerWarehouse =
    user.userType === USER_TYPES.WAREHOUSE &&
    logistic.warehouse._id.equals(user._id);
  const isRecipientInstitution =
    user.userType === USER_TYPES.INSTITUTION &&
    logistic.institution._id.equals(user._id);

  if (!isAdmin && !isOwnerWarehouse && !isRecipientInstitution) {
    throw new ApiError(
      403,
      "Forbidden: You are not authorized to view this shipment"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, logistic, "Shipment details fetched successfully")
    );
});

// @desc    Update shipment status (by Warehouse)
// @route   PATCH /api/logistics/:logisticId/status
// @access  Private (Warehouse)
const updateShipmentStatus = asyncHandler(async (req, res) => {
  const { logisticId } = req.params;
  const { status } = req.body; // e.g., 'In Transit', 'Delivered'
  const warehouseId = req.user._id;

  if (!mongoose.isValidObjectId(logisticId)) {
    throw new ApiError(400, "Invalid Logistic ID format");
  }

  // Validate the provided status against the enum in the Logistic model
  const allowedStatuses = Logistic.schema.path("status").enumValues;
  if (!status || !allowedStatuses.includes(status)) {
    throw new ApiError(
      400,
      `Invalid status provided. Must be one of: ${allowedStatuses.join(", ")}`
    );
  }

  // Find the logistic and verify ownership
  const logistic = await Logistic.findById(logisticId);

  if (!logistic || logistic.isDeleted) {
    throw new ApiError(404, "Shipment not found");
  }

  if (!logistic.warehouse.equals(warehouseId)) {
    throw new ApiError(
      403,
      "Forbidden: You can only update status for shipments from your warehouse"
    );
  }

  // Prevent illogical status changes (e.g., back from Delivered)
  if (logistic.status === "Delivered" && status !== "Delivered") {
    throw new ApiError(400, "Cannot change status back from 'Delivered'");
  }
  if (logistic.receivedStatus === "Received") {
    throw new ApiError(
      400,
      "Cannot change status after the institution has marked it as received."
    );
  }

  // Update the status
  logistic.status = status;

  // Potentially update timestamps (e.g., if status is 'Delivered', update arrivedAt?)
  // This might be better handled by separate endpoints or based on events.
  if (status === "Delivered" && !logistic.vehicles[0]?.timestamps?.arrivedAt) {
    logistic.vehicles.forEach((vehicle) => {
      vehicle.timestamps.arrivedAt = new Date();
    });
  }

  await logistic.save();

  // Optionally, update the related Requirement status if the logistic status is 'Delivered'
  if (status === "Delivered") {
    await Requirement.findByIdAndUpdate(logistic.requirementId, {
      $set: { overallStatus: "Delivered" },
    });
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, logistic, "Shipment status updated successfully")
    );
});

// @desc    Mark a shipment as received (by Institution)
// @route   PATCH /api/logistics/:logisticId/receive
// @access  Private (Institution)
const receiveShipment = asyncHandler(async (req, res) => {
  const { logisticId } = req.params;
  const institutionId = req.user._id;

  if (!mongoose.isValidObjectId(logisticId)) {
    throw new ApiError(400, "Invalid Logistic ID format");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 3. Find Logistic by ID and lock it
    const logistic = await Logistic.findById(logisticId)
      .populate("medicines.medicine")
      .session(session);

    if (!logistic || logistic.isDeleted) {
      throw new ApiError(404, "Shipment not found");
    }

    // 4. Validate
    if (!logistic.institution.equals(institutionId)) {
      throw new ApiError(
        403,
        "Forbidden: This shipment is not destined for your institution"
      );
    }
    // Institution should ideally only receive after warehouse marks it Delivered
    if (logistic.status !== "Delivered") {
      console.warn(
        `Institution receiving shipment ${logisticId} which is still marked as ${logistic.status} by warehouse.`
      );
      // Allow receiving even if not 'Delivered'? Or throw error?
      // throw new ApiError(400, `Cannot receive shipment yet. Warehouse status is: ${logistic.status}`);
    }
    if (logistic.receivedStatus === "Received") {
      throw new ApiError(400, "Shipment has already been marked as received");
    }

    // 6. Update Logistic
    logistic.receivedStatus = "Received";
    // Update timestamps if provided (assuming single vehicle for simplicity)
    if (logistic.vehicles && logistic.vehicles.length > 0) {
      logistic.vehicles.forEach((vehicle) => {
        vehicle.timestamps.unloadedAt = new Date();
      });
      logistic.markModified("vehicles");
    }

    // 7. Update Requirement status
    // Use findByIdAndUpdate for atomicity outside the main logistic save, within transaction
    await Requirement.findByIdAndUpdate(logistic.requirementId, {
      $set: { overallStatus: "Received" },
    }).session(session);

    // 8. Update InstitutionStock
    const receivedDate = new Date(); // Use current date as received date
    for (const shippedMed of logistic.medicines) {
      const medicineId = shippedMed.medicine._id;

      // Find or create the InstitutionStock document for this medicine
      let instStock = await InstitutionStock.findOne({
        institutionId: institutionId,
        medicineId: medicineId,
      }).session(session);

      if (!instStock) {
        instStock = new InstitutionStock({
          institutionId: institutionId,
          medicineId: medicineId,
          stocks: [],
        });
      }

      const institutionUsageLogs = [];

      // Add received batches to the InstitutionStock stocks array
      for (const batch of shippedMed.stocks) {
        // Map logistic batch data to InstitutionStock batch schema
        instStock.stocks.push({
          warehouseId: logistic.warehouse, // Store origin warehouse ID
          batchName: batch.batchNumber,
          expiryDate: batch.expiryDate,
          packetSize: batch.packetSize,
          quantityReceived: batch.quantity, // This is the totalStrips equivalent
          // Calculate quantity breakdown (boxes, tablets, etc.) if possible/needed
          // These might need more info or calculation based on packetSize
          currentQuantityInStrips: batch.quantity,
          quantity: {
            boxes: 0, // Placeholder - calculate if needed
            extra: 0, // Placeholder
            tablets: 0, // Placeholder
            totalStrips: batch.quantity, // Assuming quantity is in strips
          },
          purchasePrice: batch.sellingPrice, // Institution's purchase price is Warehouse's selling price
          mrp: batch.mrp,
          receivedDate: receivedDate,
          createdAt: new Date(), // Explicitly set createdAt for the batch entry
        });

        institutionUsageLogs.push({
          medicineId: medicineId,
          batchName: batch.batchNumber,
          quantity: batch.quantity,
          type: "addition",
        });
      }
      instStock.markModified("stocks");
      await instStock.save({ session });
      await InstitutionUsageLog.insertMany(institutionUsageLogs, { session });
    }

    // Save the updated logistic document itself
    await logistic.save({ session });

    // 9. Commit Transaction
    await session.commitTransaction();

    // 10. Return updated logistic
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          logistic,
          "Shipment marked as received successfully"
        )
      );
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export {
  createShipment,
  getOwnShipments,
  getIncomingShipments,
  getAllShipmentsAdmin,
  getShipmentById,
  updateShipmentStatus,
  receiveShipment,
};
