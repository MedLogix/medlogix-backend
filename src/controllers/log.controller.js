import { InstitutionUsageLog } from "../models/institutionUsageLog.model.js";
import { WarehouseReceiptLog } from "../models/warehouseReceiptLog.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Controller to get paginated institution usage logs
const getInstitutionUsageLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort, search, filters } = req.query;

  const _filters = filters ? JSON.parse(filters) : {};
  const { type } = _filters;

  const pipeline = [];

  if (type) {
    pipeline.push({ $match: { type: type } });
  }

  pipeline.push({
    $lookup: {
      from: "institutions",
      localField: "institutionId",
      foreignField: "_id",
      as: "institutionInfo",
    },
  });

  pipeline.push({
    $lookup: {
      from: "medicines",
      localField: "medicineId",
      foreignField: "_id",
      as: "medicineInfo",
    },
  });

  pipeline.push({
    $unwind: { path: "$institutionInfo", preserveNullAndEmptyArrays: true },
  });
  pipeline.push({
    $unwind: { path: "$medicineInfo", preserveNullAndEmptyArrays: true },
  });

  if (search) {
    const searchRegex = new RegExp(search, "i");
    pipeline.push({
      $match: {
        $or: [
          { "institutionInfo.name": { $regex: searchRegex } },
          { "medicineInfo.name": { $regex: searchRegex } },
        ],
      },
    });
  }

  pipeline.push({
    $project: {
      _id: 1,
      institutionId: {
        _id: "$institutionInfo._id",
        name: "$institutionInfo.name",
      },
      medicineId: { _id: "$medicineInfo._id", name: "$medicineInfo.name" },
      type: 1,
      quantity: 1,
      createdAt: 1,
      updatedAt: 1,
      batchName: 1,
    },
  });

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: sort || { createdAt: -1 },
    lean: true,
  };

  const aggregate = InstitutionUsageLog.aggregate(pipeline);
  const result = await InstitutionUsageLog.aggregatePaginate(
    aggregate,
    options
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result,
        "Institution usage logs fetched successfully"
      )
    );
});

// Controller to get paginated warehouse receipt logs
const getWarehouseReceiptLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort, search, filters } = req.query;

  const _filters = filters ? JSON.parse(filters) : {};
  const { type } = _filters;

  const pipeline = [];

  if (type) {
    pipeline.push({ $match: { type: type } });
  }

  pipeline.push({
    $lookup: {
      from: "warehouses",
      localField: "warehouseId",
      foreignField: "_id",
      as: "warehouseInfo",
    },
  });

  pipeline.push({
    $lookup: {
      from: "medicines",
      localField: "medicineId",
      foreignField: "_id",
      as: "medicineInfo",
    },
  });

  pipeline.push({
    $unwind: { path: "$warehouseInfo", preserveNullAndEmptyArrays: true },
  });
  pipeline.push({
    $unwind: { path: "$medicineInfo", preserveNullAndEmptyArrays: true },
  });

  if (search) {
    const searchRegex = new RegExp(search, "i");
    pipeline.push({
      $match: {
        $or: [
          { "warehouseInfo.name": { $regex: searchRegex } },
          { "medicineInfo.name": { $regex: searchRegex } },
        ],
      },
    });
  }

  pipeline.push({
    $project: {
      _id: 1,
      warehouseId: {
        _id: "$warehouseInfo._id",
        name: "$warehouseInfo.name",
      },
      medicineId: { _id: "$medicineInfo._id", name: "$medicineInfo.name" },
      type: 1,
      quantity: 1,
      createdAt: 1,
      updatedAt: 1,
      batchName: 1,
    },
  });

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: sort || { createdAt: -1 },
    lean: true,
  };

  const aggregate = WarehouseReceiptLog.aggregate(pipeline);
  const result = await WarehouseReceiptLog.aggregatePaginate(
    aggregate,
    options
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result,
        "Warehouse receipt logs fetched successfully"
      )
    );
});

export { getInstitutionUsageLogs, getWarehouseReceiptLogs };
