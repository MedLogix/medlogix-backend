import { Institution } from "../models/institution.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registrationStatusMailgenContent, sendEmail } from "../utils/mail.js";

const getAllInstitutions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
    filters,
  } = req.query;

  const _filters = JSON.parse(filters);

  const { verificationStatus } = _filters;

  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { institutionCode: { $regex: search, $options: "i" } },
      { registrationNumber: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  if (
    verificationStatus &&
    ["pending", "verified", "rejected"].includes(verificationStatus)
  ) {
    query.verificationStatus = verificationStatus;
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 },
    lean: true, // Optional: improves performance
  };

  const result = await Institution.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(
      200,
      result, // The result object contains docs, totalDocs, limit, page, etc.
      "All institutions fetched successfully"
    )
  );
});

const getInstitutionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const institution = await Institution.findById(id);
  return res
    .status(200)
    .json(
      new ApiResponse(200, institution, "Institution fetched successfully")
    );
});

const approveInstitution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const institution = await Institution.findByIdAndUpdate(
    id,
    {
      verificationStatus: "verified",
    },
    { new: true }
  );

  try {
    if (institution?.email) {
      const mailgenContent = registrationStatusMailgenContent({
        recipientName: institution.name || "Institution",
        isApproved: true,
        rejectionReason: "",
        loginUrl: `${process.env.FRONTEND_URL}/login`,
      });

      await sendEmail({
        email: institution.email,
        subject: `Institution Registration Approved`,
        mailgenContent,
      });
    }
  } catch (error) {
    console.error("Failed to send approval email:", error);
    // Continue with the API response even if email fails
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, institution, "Institution approved successfully")
    );
});

const rejectInstitution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const institution = await Institution.findByIdAndUpdate(
    id,
    {
      verificationStatus: "rejected",
      verificationRejectedReason: reason,
    },
    { new: true }
  );

  try {
    if (institution?.email) {
      const mailgenContent = registrationStatusMailgenContent({
        recipientName: institution.name || "Institution",
        isApproved: false,
        rejectionReason: reason,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
      });

      await sendEmail({
        email: institution.email,
        subject: `Institution Registration Rejected`,
        mailgenContent,
      });
    }
  } catch (error) {
    console.error("Failed to send rejection email:", error);
    // Continue with the API response even if email fails
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, institution, "Institution rejected successfully")
    );
});

export {
  getAllInstitutions,
  getInstitutionById,
  approveInstitution,
  rejectInstitution,
};
