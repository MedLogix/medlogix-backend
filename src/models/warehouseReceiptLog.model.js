import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const WarehouseReceiptLogSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
      index: true,
    },
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
      index: true,
    },
    batchName: {
      type: String,
      required: true,
    },
    quantityAdded: {
      // Quantity in strips
      type: Number,
      required: true,
    },
    mfgDate: { type: Date },
    expiryDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    mrp: { type: Number, required: true },
    receivedDate: { type: Date, required: true }, // Date the stock was physically received
    addedByUserId: {
      // Optional: Link to the user who added the stock
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming a general User model or Admin model exists
    },
    logTimestamp: {
      // When the addition was logged in the system
      type: Date,
      default: Date.now,
    },
    // Optional: Reference to the specific stock entry created/updated
    // warehouseStockEntryId: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: 'WarehouseStock'
    // }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

WarehouseReceiptLogSchema.plugin(mongoosePaginate);

export const WarehouseReceiptLog = mongoose.model(
  "WarehouseReceiptLog",
  WarehouseReceiptLogSchema
);
