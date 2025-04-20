import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

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
  },
  {
    timestamps: true,
  }
);

WarehouseReceiptLogSchema.plugin(aggregatePaginate);

export const WarehouseReceiptLog = mongoose.model(
  "WarehouseReceiptLog",
  WarehouseReceiptLogSchema
);
