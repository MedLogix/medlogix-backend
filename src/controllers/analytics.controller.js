import { Institution } from "../models/institution.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { Medicine } from "../models/medicine.model.js";
import { Requirement } from "../models/requirement.model.js";
import { Logistic } from "../models/logistic.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js";
import { InstitutionStock } from "../models/institutionStock.model.js";
import { InstitutionUsageLog } from "../models/institutionUsageLog.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// --- Admin Analytics ---

/**
 * Get KPI data for admin dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} KPI data for admin dashboard
 */
export const adminKPI = asyncHandler(async (req, res) => {
  // Using Promise.all to concurrently execute all database queries
  const [
    verifiedInstitutions,
    verifiedWarehouses,
    pendingInstitutions,
    pendingWarehouses,
    activeMedicines,
  ] = await Promise.all([
    Institution.countDocuments({ verificationStatus: "verified" }),
    Warehouse.countDocuments({ verificationStatus: "verified" }),
    Institution.countDocuments({ verificationStatus: "pending" }),
    Warehouse.countDocuments({ verificationStatus: "pending" }),
    Medicine.countDocuments({ isDeleted: { $ne: true } }),
  ]);

  const pendingVerifications = pendingInstitutions + pendingWarehouses;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        verifiedInstitutions,
        verifiedWarehouses,
        pendingVerifications,
        activeMedicines,
      },
      "Admin KPI data fetched successfully"
    )
  );
});

/**
 * Get chart data for admin dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Chart data for admin dashboard
 */
export const adminCharts = asyncHandler(async (req, res) => {
  // Create date range for expiry and monthly analytics
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const in60Days = new Date(today);
  in60Days.setDate(today.getDate() + 60);
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);

  // Get one year ago date for monthly activity
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  // Using Promise.all to run multiple aggregations concurrently
  const [
    institutionVerification,
    warehouseVerification,
    requirementStatus,
    logisticsStatus,
    topStockedMedicines,
    stockNearExpiry,
    newRequirementsData,
    deliveredLogisticsData,
  ] = await Promise.all([
    // Verification Status (Pie Charts)
    Institution.aggregate([
      { $group: { _id: "$verificationStatus", count: { $sum: 1 } } },
    ]),
    Warehouse.aggregate([
      { $group: { _id: "$verificationStatus", count: { $sum: 1 } } },
    ]),

    // System Requirement Status (Donut Chart)
    Requirement.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
    ]),

    // System Logistics Status (Bar Chart)
    Logistic.aggregate([
      {
        $match: {
          isDeleted: { $ne: true },
          status: { $in: ["In Transit", "Delivered"] },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // Top 5 Stocked Medicines (System-Wide - Horizontal Bar Chart)
    WarehouseStock.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $group: {
          _id: "$medicineId",
          totalQuantity: { $sum: "$stocks.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "medicineInfo",
        },
      },
      { $unwind: "$medicineInfo" },
      {
        $project: {
          _id: 0,
          medicineName: "$medicineInfo.name",
          totalQuantity: 1,
        },
      },
    ]),

    // Stock Nearing Expiry (System-Wide - Bar Chart)
    WarehouseStock.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      { $match: { "stocks.expiryDate": { $lte: in90Days } } },
      {
        $project: {
          quantity: "$stocks.quantity",
          expiryBucket: {
            $cond: [
              { $lte: ["$stocks.expiryDate", in30Days] },
              "<30d",
              {
                $cond: [
                  { $lte: ["$stocks.expiryDate", in60Days] },
                  "30-60d",
                  "60-90d",
                ],
              },
            ],
          },
        },
      },
      {
        $group: { _id: "$expiryBucket", totalQuantity: { $sum: "$quantity" } },
      },
      { $project: { _id: 0, bucket: "$_id", totalQuantity: 1 } },
    ]),

    // Monthly Activity - New Requirements (12 Months)
    Requirement.aggregate([
      { $match: { createdAt: { $gte: oneYearAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Monthly Activity - Delivered Logistics (12 Months)
    Logistic.aggregate([
      { $match: { status: "Delivered", updatedAt: { $gte: oneYearAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Process monthly data to ensure all months are represented
  const monthlyActivity = processAdminMonthlyData(
    newRequirementsData,
    deliveredLogisticsData,
    oneYearAgo
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        verificationStatus: {
          institutions: institutionVerification,
          warehouses: warehouseVerification,
        },
        requirementStatus,
        logisticsStatus,
        topStockedMedicines,
        stockNearExpiry,
        monthlyActivity,
      },
      "Admin charts data fetched successfully"
    )
  );
});

/**
 * Process admin monthly data to ensure all months are represented
 * @param {Array} requirementsData - Requirements data by month
 * @param {Array} logisticsData - Logistics data by month
 * @param {Date} startDate - Start date for the monthly data
 * @returns {Array} Processed monthly data with all months represented
 */
function processAdminMonthlyData(requirementsData, logisticsData, startDate) {
  const result = [];
  const reqMap = new Map();
  const logMap = new Map();

  // Convert to Maps for easy access
  requirementsData.forEach((item) => reqMap.set(item._id, item.count));
  logisticsData.forEach((item) => logMap.set(item._id, item.count));

  // Generate all months in the range
  const currentDate = new Date();
  // Adjust end date to be the *start* of the current month for accurate range
  const endDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  // Iterate from start date month by month until endDate is reached
  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setMonth(d.getMonth() + 1)
  ) {
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({
      month: monthKey,
      newRequirements: reqMap.get(monthKey) || 0,
      deliveredLogistics: logMap.get(monthKey) || 0,
    });
  }

  return result;
}

// --- Institution Analytics ---

/**
 * Get KPI data for institution dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} KPI data for institution dashboard
 */
export const institutionKPI = asyncHandler(async (req, res) => {
  const institutionId = req.user._id; // Assuming _id on req.user is the institution's ID

  // Date for near expiry check
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  const [
    pendingRequirements,
    incomingShipments,
    inventoryValueResult, // Result is an array, need to extract value
    nearExpiryItemsResult, // Result is an array, need to extract count
  ] = await Promise.all([
    // My Pending Requirements
    Requirement.countDocuments({
      institutionId: institutionId,
      overallStatus: "Pending",
    }),
    // Incoming Shipments
    Logistic.countDocuments({
      institutionId: institutionId,
      receivedStatus: "Pending",
    }),
    // My Inventory Value
    InstitutionStock.aggregate([
      { $match: { institutionId: institutionId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: {
              $multiply: [
                "$stocks.currentQuantityInStrips",
                "$stocks.purchasePrice",
              ],
            },
          },
        },
      },
    ]),
    // Items Near Expiry
    InstitutionStock.aggregate([
      { $match: { institutionId: institutionId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      { $match: { "stocks.expiryDate": { $lte: in30Days } } },
      { $group: { _id: "$medicineId" } }, // Group by medicine to count distinct items
      { $count: "distinctMedicinesNearExpiry" },
    ]),
  ]);

  const inventoryValue = inventoryValueResult[0]?.totalValue || 0;
  const nearExpiryItems =
    nearExpiryItemsResult[0]?.distinctMedicinesNearExpiry || 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        pendingRequirements,
        incomingShipments,
        inventoryValue,
        nearExpiryItems,
      },
      "Institution KPI data fetched successfully"
    )
  );
});

/**
 * Get chart data for institution dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Chart data for institution dashboard
 */
export const institutionCharts = asyncHandler(async (req, res) => {
  const institutionId = req.user._id;

  // Dates for expiry profile
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const in60Days = new Date(today);
  in60Days.setDate(today.getDate() + 60);
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);

  // Date for monthly usage
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const [
    myRequirementStatus,
    topInventoryItems,
    stockExpiryProfile,
    monthlyUsageData,
  ] = await Promise.all([
    // My Requirement Status (Donut Chart)
    Requirement.aggregate([
      { $match: { institutionId: institutionId, isDeleted: { $ne: true } } },
      { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
    ]),
    // My Top 5 Inventory Items (Horizontal Bar Chart)
    InstitutionStock.aggregate([
      { $match: { institutionId: institutionId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $group: {
          _id: "$medicineId",
          totalQuantity: { $sum: "$stocks.currentQuantityInStrips" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "medicineInfo",
        },
      },
      { $unwind: "$medicineInfo" },
      {
        $project: {
          _id: 0,
          medicineName: "$medicineInfo.name",
          totalQuantity: 1,
        },
      },
    ]),
    // My Stock Expiry Profile (Bar Chart)
    InstitutionStock.aggregate([
      { $match: { institutionId: institutionId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $project: {
          quantity: "$stocks.currentQuantityInStrips",
          expiryBucket: {
            $cond: [
              { $lte: ["$stocks.expiryDate", in30Days] },
              "<30d",
              {
                $cond: [
                  { $lte: ["$stocks.expiryDate", in60Days] },
                  "30-60d",
                  {
                    $cond: [
                      { $lte: ["$stocks.expiryDate", in90Days] },
                      "60-90d",
                      ">90d", // Bucket for items expiring after 90 days
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $group: { _id: "$expiryBucket", totalQuantity: { $sum: "$quantity" } },
      },
      { $project: { _id: 0, bucket: "$_id", totalQuantity: 1 } },
    ]),
    // Monthly Usage Trend (Line Chart)
    InstitutionUsageLog.aggregate([
      {
        $match: {
          institutionId: institutionId,
          type: "usage",
          createdAt: { $gte: oneYearAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          totalQuantityUsed: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", totalQuantityUsed: 1 } },
    ]),
  ]);

  // Process monthly usage data
  const monthlyUsage = processMonthlyUsageData(monthlyUsageData, oneYearAgo);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        myRequirementStatus,
        topInventoryItems,
        stockExpiryProfile,
        monthlyUsage,
      },
      "Institution charts data fetched successfully"
    )
  );
});

/**
 * Helper function to process monthly usage data
 * @param {Array} usageData - Usage data grouped by month
 * @param {Date} startDate - Start date for the range
 * @returns {Array} Processed monthly usage data
 */
function processMonthlyUsageData(usageData, startDate) {
  const result = [];
  const usageMap = new Map();
  usageData.forEach((item) => usageMap.set(item.month, item.totalQuantityUsed));

  const currentDate = new Date();
  const endDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setMonth(d.getMonth() + 1)
  ) {
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({
      month: monthKey,
      totalQuantityUsed: usageMap.get(monthKey) || 0,
    });
  }
  return result;
}

// --- Warehouse Analytics ---

/**
 * Get KPI data for warehouse dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} KPI data for warehouse dashboard
 */
export const warehouseKPI = asyncHandler(async (req, res) => {
  const warehouseId = req.user._id; // Assuming _id on req.user is the warehouse's ID

  // Date for near expiry check
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  const [
    pendingRequirements,
    inventoryValueResult,
    nearExpiryItemsResult,
    activeOutgoingShipments,
  ] = await Promise.all([
    // Incoming Pending Requirements
    Requirement.countDocuments({
      warehouseId: warehouseId,
      overallStatus: "Pending",
    }),
    // My Inventory Value
    WarehouseStock.aggregate([
      { $match: { warehouseId: warehouseId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ["$stocks.quantity", "$stocks.purchasePrice"] },
          },
        },
      },
    ]),
    // Items Near Expiry
    WarehouseStock.aggregate([
      { $match: { warehouseId: warehouseId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      { $match: { "stocks.expiryDate": { $lte: in30Days } } },
      { $group: { _id: "$medicineId" } },
      { $count: "distinctMedicinesNearExpiry" },
    ]),
    // Active Outgoing Shipments
    Logistic.countDocuments({
      warehouseId: warehouseId,
      status: "In Transit",
    }),
  ]);

  const inventoryValue = inventoryValueResult[0]?.totalValue || 0;
  const nearExpiryItems =
    nearExpiryItemsResult[0]?.distinctMedicinesNearExpiry || 0;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        pendingRequirements,
        inventoryValue,
        nearExpiryItems,
        activeOutgoingShipments,
      },
      "Warehouse KPI data fetched successfully"
    )
  );
});

/**
 * Get chart data for warehouse dashboard
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} Chart data for warehouse dashboard
 */
export const warehouseCharts = asyncHandler(async (req, res) => {
  const warehouseId = req.user._id;

  // Dates for expiry profile
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);
  const in60Days = new Date(today);
  in60Days.setDate(today.getDate() + 60);
  const in90Days = new Date(today);
  in90Days.setDate(today.getDate() + 90);

  // Date for monthly fulfillment
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);

  const [
    incomingRequirementStatus,
    topInventoryItemsReserved,
    stockExpiryProfile,
    outgoingShipmentsStatus,
    monthlyFulfillmentData,
  ] = await Promise.all([
    // Incoming Requirement Status (Donut Chart)
    Requirement.aggregate([
      { $match: { warehouseId: warehouseId, isDeleted: { $ne: true } } },
      { $group: { _id: "$overallStatus", count: { $sum: 1 } } },
    ]),
    // Top 5 Inventory Items (Available vs. Reserved - Stacked Bar Chart)
    WarehouseStock.aggregate([
      { $match: { warehouseId: warehouseId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $group: {
          _id: "$medicineId",
          totalQuantity: { $sum: "$stocks.quantity" },
          totalReserved: { $sum: "$stocks.reservedQuantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "medicines",
          localField: "_id",
          foreignField: "_id",
          as: "medicineInfo",
        },
      },
      { $unwind: "$medicineInfo" },
      {
        $project: {
          _id: 0,
          medicineName: "$medicineInfo.name",
          availableQuantity: {
            $subtract: ["$totalQuantity", "$totalReserved"],
          },
          reservedQuantity: "$totalReserved",
        },
      },
    ]),
    // My Stock Expiry Profile (Bar Chart)
    WarehouseStock.aggregate([
      { $match: { warehouseId: warehouseId, isDeleted: { $ne: true } } },
      { $unwind: "$stocks" },
      {
        $project: {
          quantity: "$stocks.quantity",
          expiryBucket: {
            $cond: [
              { $lte: ["$stocks.expiryDate", in30Days] },
              "<30d",
              {
                $cond: [
                  { $lte: ["$stocks.expiryDate", in60Days] },
                  "30-60d",
                  {
                    $cond: [
                      { $lte: ["$stocks.expiryDate", in90Days] },
                      "60-90d",
                      ">90d",
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $group: { _id: "$expiryBucket", totalQuantity: { $sum: "$quantity" } },
      },
      { $project: { _id: 0, bucket: "$_id", totalQuantity: 1 } },
    ]),
    // Outgoing Shipments Status (Pie Chart)
    Logistic.aggregate([
      {
        $match: {
          warehouseId: warehouseId,
          isDeleted: { $ne: true },
          status: { $in: ["In Transit", "Delivered"] },
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    // Monthly Fulfillment Trend (Line Chart - Based on Logistics Created)
    Logistic.aggregate([
      { $match: { warehouseId: warehouseId, createdAt: { $gte: oneYearAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", requirementsShipped: "$count" } },
    ]),
  ]);

  // Process monthly fulfillment data
  const monthlyFulfillment = processMonthlyFulfillmentData(
    monthlyFulfillmentData,
    oneYearAgo
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        incomingRequirementStatus,
        topInventoryItemsReserved,
        stockExpiryProfile,
        outgoingShipmentsStatus,
        monthlyFulfillment,
      },
      "Warehouse charts data fetched successfully"
    )
  );
});

/**
 * Helper function to process monthly fulfillment data
 * @param {Array} fulfillmentData - Logistics data grouped by month
 * @param {Date} startDate - Start date for the range
 * @returns {Array} Processed monthly fulfillment data
 */
function processMonthlyFulfillmentData(fulfillmentData, startDate) {
  const result = [];
  const fulfillmentMap = new Map();
  fulfillmentData.forEach((item) =>
    fulfillmentMap.set(item.month, item.requirementsShipped)
  );

  const currentDate = new Date();
  const endDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  for (
    let d = new Date(startDate);
    d <= endDate;
    d.setMonth(d.getMonth() + 1)
  ) {
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    result.push({
      month: monthKey,
      requirementsShipped: fulfillmentMap.get(monthKey) || 0,
    });
  }
  return result;
}
