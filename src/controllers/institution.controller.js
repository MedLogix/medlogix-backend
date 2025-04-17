import { Institution } from "../models/institution.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllInstitutions = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { registrationNumber: { $regex: search, $options: "i" } },
    ];
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

export { getAllInstitutions, getInstitutionById };
