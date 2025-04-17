import mongoose from "mongoose";
import { USER_TYPES } from "../utils/constants.js";
import mongoosePaginate from "mongoose-paginate-v2";

const SaltSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    useCase: {
      type: String,
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

SaltSchema.plugin(mongoosePaginate);

export const Salt = mongoose.model("Salt", SaltSchema);
