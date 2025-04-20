import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const LogisticsSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, unique: true }, // SHP12345
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Requirement",
      required: true,
    }, // Reference to the Requirement this shipment fulfills
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    }, // Warehouse from which medicines are sent
    institution: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    }, // Hospital or institution receiving the medicines

    medicines: [
      {
        medicine: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Medicine",
          required: true,
        }, // Medicine ID
        stocks: [
          {
            batchNumber: { type: String, required: true }, // BATCH12345
            expiryDate: { type: Date, required: true }, // 2026-05-01
            quantity: { type: Number, required: true }, // Quantity in Strips shipped from this batch
            packetSize: {
              strips: { type: Number },
              tabletsPerStrip: { type: Number },
            },
            sellingPrice: { type: Number, required: true },
            mrp: { type: Number, required: true },
          },
        ],
      },
    ],

    vehicles: [
      {
        vehicleNumber: { type: String, required: true }, // UP32 AB 1234
        driverName: { type: String, required: true }, // Rajesh Kumar
        driverContact: { type: String, required: true }, // 9876543210
        timestamps: {
          loadedAt: { type: Date, required: true }, // When medicines were loaded in vehicle
          departedAt: { type: Date, required: true }, // When vehicle left warehouse
          arrivedAt: { type: Date }, // When vehicle reached hospital (optional, update when received)
          unloadedAt: { type: Date }, // When medicines were unloaded at institution
        },
      },
    ],

    status: {
      type: String,
      enum: ["Pending", "In Transit", "Delivered"],
      default: "Pending",
    }, // Track status of shipment
    receivedStatus: {
      type: String,
      enum: ["Pending", "Received"],
      default: "Pending",
    }, // Track status of shipment
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// --- Indexes for Dashboard Performance ---
// Admin: System Logistics Status
LogisticsSchema.index({ isDeleted: 1, status: 1 });
// Admin: Monthly Activity (using updatedAt)
LogisticsSchema.index({ status: 1, updatedAt: 1 });
// Institution: Incoming Shipments KPI
LogisticsSchema.index({ institutionId: 1, receivedStatus: 1 });
// Warehouse: Outgoing Shipments Status & KPIs
LogisticsSchema.index({ warehouseId: 1, status: 1 });
// Warehouse: Monthly Fulfillment (based on Logistic creation)
LogisticsSchema.index({ warehouseId: 1, createdAt: 1 });

LogisticsSchema.plugin(mongoosePaginate);

export const Logistic = mongoose.model("Logistic", LogisticsSchema);
