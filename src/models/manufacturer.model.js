import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";
import { USER_TYPES } from "../utils/constants.js";

const ManufacturerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    medicalRepresentator: {
      name: {
        type: String,
      },
      contact: {
        type: Number,
      },
    },
    createdByRole: {
      type: String,
      enum: [USER_TYPES.ADMIN, USER_TYPES.WAREHOUSE],
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
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

ManufacturerSchema.plugin(mongoosePaginate);

export const Manufacturer = mongoose.model("Manufacturer", ManufacturerSchema);
