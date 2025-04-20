import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const requirementMedicineSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    approvedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
  },
  { _id: false }
); // Prevent creating separate _id for subdocuments

const requirementSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    }, // Institution requesting the stock
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    }, // Warehouse the request is directed to
    medicines: [requirementMedicineSchema], // Array of requested medicines
    overallStatus: {
      type: String,
      enum: [
        "Pending", // Initial state
        "Approved", // Some items approved, some pending/rejected
        "Rejected", // All items rejected
        "Shipped", //  Shipped
        "Delivered", // Shipment marked delivered by warehouse
        "Received", // Shipment marked received by institution
      ],
      default: "Pending",
      index: true,
    }, // Overall status of the requirement
    logisticId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Logistic",
      default: null, // Populated when a shipment is created
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// --- Indexes for Dashboard Performance ---
// Admin: System Requirement Status
requirementSchema.index({ isDeleted: 1, overallStatus: 1 });
// Admin: Monthly Activity
requirementSchema.index({ createdAt: 1 });
// Institution: My Requirement Status & KPIs
requirementSchema.index({ institutionId: 1, overallStatus: 1 });
// Warehouse: Incoming Requirement Status & KPIs
requirementSchema.index({ warehouseId: 1, overallStatus: 1 });
// Warehouse: Monthly Fulfillment (Alternative: based on Requirement status change)
// requirementSchema.index({ warehouseId: 1, overallStatus: 1, updatedAt: 1 });

requirementSchema.plugin(mongoosePaginate);

export const Requirement = mongoose.model("Requirement", requirementSchema);
