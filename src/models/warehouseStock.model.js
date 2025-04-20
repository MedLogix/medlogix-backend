import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const WarehouseStockSchema = new mongoose.Schema(
  {
    warehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      required: true,
    }, // ref to warehouse
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Medicine",
      required: true,
    }, // ref to medicine
    stocks: [
      {
        batchName: { type: String, required: true }, // BATCH12345
        quantity: { type: Number, required: true }, // Total Packets available
        reservedQuantity: { type: Number, default: 0 }, // Total Packets reserved for pending shipments
        mfgDate: {
          type: Date,
        }, // 2026-05-01
        expiryDate: {
          type: Date,
          required: true,
          default: () => {
            let date = new Date();
            date.setMonth(date.getMonth() - 6);
            return date;
          },
        }, // 2026-05-01
        packetSize: {
          strips: { type: Number },
          tabletsPerStrip: { type: Number },
        },
        purchasePrice: { type: Number, required: true },
        sellingPrice: { type: Number, required: true },
        mrp: { type: Number, required: true },
        receivedDate: { type: Date, required: true }, // 2025-02-10
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// --- Indexes for Dashboard Performance ---
// Base filter for warehouse-specific queries & aggregations
WarehouseStockSchema.index({ warehouseId: 1, isDeleted: 1 });
// Grouping/lookup by medicine within a warehouse
WarehouseStockSchema.index({ warehouseId: 1, medicineId: 1, isDeleted: 1 });
// Efficiently query/sort by expiry date within aggregations (after $unwind)
WarehouseStockSchema.index({ isDeleted: 1, "stocks.expiryDate": 1 });
// Supports system-wide grouping by medicine (Admin Top Stocked - less common)
// warehouseStockSchema.index({ medicineId: 1, isDeleted: 1 });

WarehouseStockSchema.plugin(mongoosePaginate);

export const WarehouseStock = mongoose.model(
  "WarehouseStock",
  WarehouseStockSchema
);
