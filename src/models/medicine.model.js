import mongoose from "mongoose";
import { USER_TYPES } from "../utils/constants.js";
import mongoosePaginate from "mongoose-paginate-v2";

const MedicineSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true }, // Paracetamol
    salts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Salt",
        required: true,
      },
    ], // ref to salt
    manufacturer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manufacturer",
      required: true,
    }, // GSK Pharma
    isTablets: { type: Boolean, required: true }, // true/false
    medicineType: { type: String, required: false }, // Tablet, Syrup, etc.
    createdByRole: {
      type: String,
      enum: [USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE],
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
    },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Index for dashboard query performance
MedicineSchema.index({ isDeleted: 1 });

MedicineSchema.plugin(mongoosePaginate);

export const Medicine = mongoose.model("Medicine", MedicineSchema);
