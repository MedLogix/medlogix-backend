import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoosePaginate from "mongoose-paginate-v2";
import { USER_TYPES } from "../utils/constants.js";

const InstitutionSchema = new mongoose.Schema(
  {
    institutionCode: { type: String, unique: true }, // INST001
    name: { type: String, required: true }, // Lucknow District Hospital
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
      address: { type: String, required: true }, // Near XYZ Chowk
      city: { type: String, required: true }, // Lucknow
      district: { type: String, required: true }, // Lucknow
      state: { type: String, required: true }, // UP
      pincode: { type: String, required: true }, // 226003
      gpsCoordinates: {
        lat: { type: Number, required: false }, // 26.8500
        lng: { type: Number, required: false }, // 80.9500
      },
    },
    incharge: [
      {
        name: { type: String, required: true }, // Dr. Alok Verma
        contact: { type: String, required: true }, // 9876543211
        email: { type: String, required: false }, // alok.verma@uphospital.in
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

InstitutionSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

InstitutionSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

InstitutionSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      institutionCode: this.institutionCode,
      userType: USER_TYPES.INSTITUTION,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

InstitutionSchema.plugin(mongoosePaginate);

export const Institution = mongoose.model("Institution", InstitutionSchema);
