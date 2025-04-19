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
    quantity: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["purchase", "sale"],
      required: true,
    },
    mfgDate: { type: Date },
    expiryDate: { type: Date, required: true },
    purchasePrice: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    mrp: { type: Number, required: true },
    receivedDate: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

WarehouseReceiptLogSchema.plugin(mongoosePaginate);

export const WarehouseReceiptLog = mongoose.model(
  "WarehouseReceiptLog",
  WarehouseReceiptLogSchema
);
