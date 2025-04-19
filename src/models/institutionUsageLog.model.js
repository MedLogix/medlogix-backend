import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

const InstitutionUsageLogSchema = new mongoose.Schema(
  {
    institutionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Institution",
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
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    type: {
      type: String,
      enum: ["usage", "addition"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

InstitutionUsageLogSchema.plugin(mongoosePaginate);

export const InstitutionUsageLog = mongoose.model(
  "InstitutionUsageLog",
  InstitutionUsageLogSchema
);
