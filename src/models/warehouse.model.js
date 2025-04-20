import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { USER_TYPES } from "../utils/constants.js";
import mongoosePaginate from "mongoose-paginate-v2";

const WarehouseSchema = new mongoose.Schema(
  {
    warehouseCode: { type: String, required: true, unique: true }, // WH001
    name: { type: String, required: true, unique: true }, // Lucknow Central Warehouse
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/],
    },
    password: {
      type: String,
      trim: true,
      required: [true, "Password is required"],
    },
    registrationNumber: { type: String, required: true }, // UPHOSPI-2024-111
    location: {
      address: { type: String, required: true }, // XYZ road, Lucknow
      city: { type: String, required: true }, // Lucknow
      district: { type: String, required: true }, // Lucknow
      state: { type: String, required: true }, // UP
      pincode: { type: String, required: true }, // 226001
      gpsCoordinates: {
        lat: { type: Number, required: false }, // 26.8467
        lng: { type: Number, required: false }, // 80.9462
      },
    },
    managers: [
      {
        name: { type: String, required: true }, // Ravi Shukla
        contact: { type: String, required: true }, // 9876543210
        email: { type: String, required: false }, // manager@warehouse.in
      },
    ],
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationRejectedReason: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Add index for verificationStatus to optimize dashboard queries
WarehouseSchema.index({ verificationStatus: 1 });

WarehouseSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

WarehouseSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

WarehouseSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      warehouseCode: this.warehouseCode,
      userType: USER_TYPES.WAREHOUSE,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

WarehouseSchema.plugin(mongoosePaginate);

export const Warehouse = mongoose.model("Warehouse", WarehouseSchema);
