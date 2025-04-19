import { Warehouse } from "../models/warehouse.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllWarehouses = asyncHandler(async (req, res) => {
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
      { registrationNumber: { $regex: search, $options: "i" } },
      { warehouseCode: { $regex: search, $options: "i" } },
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

  const result = await Warehouse.paginate(query, options);

  return res.status(200).json(
    new ApiResponse(
      200,
      result, // The result object contains docs, totalDocs, limit, page, etc.
      "All warehouses fetched successfully"
    )
  );
});

const getWarehouseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const warehouse = await Warehouse.findById(id);
  return res
    .status(200)
    .json(new ApiResponse(200, warehouse, "Warehouse fetched successfully"));
});

const approveWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const warehouse = await Warehouse.findByIdAndUpdate(
    id,
    {
      verificationStatus: "verified",
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, warehouse, "Warehouse approved successfully"));
});

const rejectWarehouse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const warehouse = await Warehouse.findByIdAndUpdate(
    id,
    {
      verificationStatus: "rejected",
      verificationRejectedReason: reason,
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, warehouse, "Warehouse rejected successfully"));
});

export {
  getAllWarehouses,
  getWarehouseById,
  approveWarehouse,
  rejectWarehouse,
};
