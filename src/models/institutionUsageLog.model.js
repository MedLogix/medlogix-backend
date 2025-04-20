import mongoose from "mongoose";
import aggregatePaginate from "mongoose-aggregate-paginate-v2";

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

// Index for Institution dashboard: Monthly Usage Trend
InstitutionUsageLogSchema.index({ institutionId: 1, type: 1, createdAt: 1 });

InstitutionUsageLogSchema.plugin(aggregatePaginate);

export const InstitutionUsageLog = mongoose.model(
  "InstitutionUsageLog",
  InstitutionUsageLogSchema
);
