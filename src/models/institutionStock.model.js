import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const InstitutionStockSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
    }, // ref to institution

    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    }, // ref to medicine

    stocks: [
      {
        warehouseId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Warehouse",
          required: true,
        }, // ref to warehouse
        batchName: { type: String, default: "N/A", required: true }, // BATCH12345
        expiryDate: { type: Date, required: true },
        packetSize: {
          strips: { type: Number },
          tabletsPerStrip: { type: Number },
        },
        currentQuantityInStrips: { type: Number, required: true }, // Current remaining strips from this batch
        quantityReceived: { type: Number, required: true }, // totalStrips received initially in this batch

        purchasePrice: { type: Number, required: true },
        mrp: { type: Number, required: true },
        receivedDate: { type: Date, required: true }, // 2025-02-15
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

InstitutionStockSchema.plugin(mongoosePaginate);

export const InstitutionStock = mongoose.model(
  "InstitutionStock",
  InstitutionStockSchema
);
