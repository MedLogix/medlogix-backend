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
      // Optional: If usage is logged against a specific batch
      type: String,
    },
    quantityUsed: {
      // Quantity in strips
      type: Number,
      required: true,
      min: 1,
    },
    loggedByUserId: {
      // Optional: Link to the user who logged the usage
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Assuming a general User model or Admin model exists
    },
    notes: {
      // Optional field for any specific notes about the usage
      type: String,
    },
    logTimestamp: {
      // When the usage was logged in the system
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

InstitutionUsageLogSchema.plugin(mongoosePaginate);

export const InstitutionUsageLog = mongoose.model(
  "InstitutionUsageLog",
  InstitutionUsageLogSchema
);
