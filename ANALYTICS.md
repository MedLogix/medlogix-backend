Okay, let's map the specific API endpoints and data fetching strategies for each dashboard component. We'll assume a base API path like `/api/v1/`.

**I. Admin Dashboard (System-Wide Overview)**

- **Endpoint Group:** `/api/v1/admin/dashboard/`

- **KPI Cards (Large Numbers):**

  1.  **Verified Institutions:**
      - **Endpoint:** `GET /kpi/verified-institutions`
      - **Backend Logic:** `Institution.countDocuments({ verificationStatus: 'verified' })`
  2.  **Verified Warehouses:**
      - **Endpoint:** `GET /kpi/verified-warehouses`
      - **Backend Logic:** `Warehouse.countDocuments({ verificationStatus: 'verified' })`
  3.  **Pending Verifications:**
      - **Endpoint:** `GET /kpi/pending-verifications`
      - **Backend Logic:** Execute two counts concurrently: `Institution.countDocuments({ verificationStatus: 'pending' })` and `Warehouse.countDocuments({ verificationStatus: 'pending' })`. Return the sum.
  4.  **Active Medicines:**
      - **Endpoint:** `GET /kpi/active-medicines`
      - **Backend Logic:** `Medicine.countDocuments({ isDeleted: { $ne: true } })`

- **Charts:**
  1.  **Verification Status (Pie Charts):**
      - **Endpoint:** `GET /charts/verification-status`
      - **Backend Logic:**
        - Run two aggregation pipelines concurrently:
          - `Institution.aggregate([ { $group: { _id: '$verificationStatus', count: { $sum: 1 } } } ])`
          - `Warehouse.aggregate([ { $group: { _id: '$verificationStatus', count: { $sum: 1 } } } ])`
        - Return results structured, e.g., `{ institutions: [...], warehouses: [...] }`.
  2.  **System Requirement Status (Donut Chart):**
      - **Endpoint:** `GET /charts/requirement-status`
      - **Backend Logic:** `Requirement.aggregate([ { $match: { isDeleted: { $ne: true } } }, { $group: { _id: '$overallStatus', count: { $sum: 1 } } } ])`
  3.  **System Logistics Status (Bar Chart):**
      - **Endpoint:** `GET /charts/logistics-status`
      - **Backend Logic:** `Logistic.aggregate([ { $match: { isDeleted: { $ne: true }, status: { $in: ['In Transit', 'Delivered'] } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ])`
  4.  **Top 5 Stocked Medicines (System-Wide - Horizontal Bar Chart):**
      - **Endpoint:** `GET /charts/top-stocked-medicines`
      - **Backend Logic:**
        - `WarehouseStock.aggregate([ { $match: { isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $group: { _id: '$medicineId', totalQuantity: { $sum: '$stocks.quantity' } } }, { $sort: { totalQuantity: -1 } }, { $limit: 5 }, { $lookup: { from: 'medicines', localField: '_id', foreignField: '_id', as: 'medicineInfo' } }, { $unwind: '$medicineInfo' }, { $project: { _id: 0, medicineName: '$medicineInfo.name', totalQuantity: 1 } } ])`
  5.  **Stock Nearing Expiry (System-Wide - Bar Chart):**
      - **Endpoint:** `GET /charts/stock-near-expiry`
      - **Backend Logic:**
        - Define date ranges: `today`, `in30Days`, `in60Days`, `in90Days`.
        - `WarehouseStock.aggregate([ { $match: { isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $match: { 'stocks.expiryDate': { $lte: in90Days } } }, // Pre-filter for efficiency { $project: { quantity: '$stocks.quantity', expiryBucket: { $cond: [ { $lte: ['$stocks.expiryDate', in30Days] }, '<30d', { $cond: [ { $lte: ['$stocks.expiryDate', in60Days] }, '30-60d', '60-90d' ] } ] } } }, { $group: { _id: '$expiryBucket', totalQuantity: { $sum: '$quantity' } } }, { $project: { _id: 0, bucket: '$_id', totalQuantity: 1 } } ])`
  6.  **Monthly Activity (Dual-Axis Line Chart):**
      - **Endpoint:** `GET /charts/monthly-activity`
      - **Backend Logic:** Run two aggregations concurrently:
        - `Requirement.aggregate([ { $match: { createdAt: { $gte: /* Start Date, e.g., 1 year ago */ } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ])` -> `newRequirementsData`
        - `Logistic.aggregate([ { $match: { status: 'Delivered', updatedAt: { $gte: /* Start Date */ } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } } ])` -> `deliveredLogisticsData`
        - Combine results, ensuring all months in the range are present (even if count is 0).

**II. Institution Dashboard (User-Specific View)**

- **Endpoint Group:** `/api/v1/institution/dashboard/` (Requires authenticated Institution user context)

- **KPI Cards (Large Numbers):**

  1.  **My Pending Requirements:**
      - **Endpoint:** `GET /kpi/pending-requirements`
      - **Backend Logic:** `Requirement.countDocuments({ institutionId: req.user.institutionId, overallStatus: 'Pending' })` (Assuming `req.user.institutionId` holds the logged-in user's ID).
  2.  **Incoming Shipments:**
      - **Endpoint:** `GET /kpi/incoming-shipments`
      - **Backend Logic:** `Logistic.countDocuments({ institutionId: req.user.institutionId, receivedStatus: 'Pending' })`
  3.  **My Inventory Value:**
      - **Endpoint:** `GET /kpi/inventory-value`
      - **Backend Logic:**
        - `InstitutionStock.aggregate([ { $match: { institutionId: req.user.institutionId, isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $group: { _id: null, totalValue: { $sum: { $multiply: ['$stocks.currentQuantityInStrips', '$stocks.purchasePrice'] } } } } ])`
        - Return `totalValue` (or 0 if no results).
  4.  **Items Near Expiry:**
      - **Endpoint:** `GET /kpi/near-expiry-items`
      - **Backend Logic:**
        - Define `in30Days` date.
        - `InstitutionStock.aggregate([ { $match: { institutionId: req.user.institutionId, isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $match: { 'stocks.expiryDate': { $lte: in30Days } } }, { $group: { _id: '$medicineId' } }, // Group by medicine to count distinct items { $count: 'distinctMedicinesNearExpiry' } ])`
        - Return the count (or 0).

- **Charts:**
  1.  **My Requirement Status (Donut Chart):**
      - **Endpoint:** `GET /charts/requirement-status`
      - **Backend Logic:** `Requirement.aggregate([ { $match: { institutionId: req.user.institutionId, isDeleted: { $ne: true } } }, { $group: { _id: '$overallStatus', count: { $sum: 1 } } } ])`
  2.  **My Top 5 Inventory Items (Horizontal Bar Chart):**
      - **Endpoint:** `GET /charts/top-inventory-items`
      - **Backend Logic:** Similar to Admin's top stock, but filtered by `institutionId` and summing `stocks.currentQuantityInStrips` from `InstitutionStock`.
        - `InstitutionStock.aggregate([ { $match: { institutionId: req.user.institutionId, isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $group: { _id: '$medicineId', totalQuantity: { $sum: '$stocks.currentQuantityInStrips' } } }, { $sort: { totalQuantity: -1 } }, { $limit: 5 }, { $lookup: { from: 'medicines', localField: '_id', foreignField: '_id', as: 'medicineInfo' } }, { $unwind: '$medicineInfo' }, { $project: { _id: 0, medicineName: '$medicineInfo.name', totalQuantity: 1 } } ])`
  3.  **My Stock Expiry Profile (Bar Chart):**
      - **Endpoint:** `GET /charts/stock-expiry-profile`
      - **Backend Logic:** Similar to Admin's near expiry, but filtered by `institutionId` from `InstitutionStock` and summing `stocks.currentQuantityInStrips`. Include a '>90d' bucket.
  4.  **Monthly Usage Trend (Line Chart):**
      - **Endpoint:** `GET /charts/monthly-usage`
      - **Backend Logic:**
        - `InstitutionUsageLog.aggregate([ { $match: { institutionId: req.user.institutionId, type: 'usage', createdAt: { $gte: /* Start Date */ } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, totalQuantityUsed: { $sum: '$quantity' } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, month: '$_id', totalQuantityUsed: 1 } } ])`
        - Ensure all months in the range are present.

**III. Warehouse Dashboard (User-Specific View)**

- **Endpoint Group:** `/api/v1/warehouse/dashboard/` (Requires authenticated Warehouse user context)

- **KPI Cards (Large Numbers):**

  1.  **Incoming Pending Requirements:**
      - **Endpoint:** `GET /kpi/pending-requirements`
      - **Backend Logic:** `Requirement.countDocuments({ warehouseId: req.user.warehouseId, overallStatus: 'Pending' })` (Assuming `req.user.warehouseId`).
  2.  **My Inventory Value:**
      - **Endpoint:** `GET /kpi/inventory-value`
      - **Backend Logic:** Similar to Institution's, but using `WarehouseStock`, `warehouseId`, and summing `stocks.quantity * stocks.purchasePrice`.
  3.  **Items Near Expiry:**
      - **Endpoint:** `GET /kpi/near-expiry-items`
      - **Backend Logic:** Similar to Institution's, but using `WarehouseStock` and `warehouseId`.
  4.  **Active Outgoing Shipments:**
      - **Endpoint:** `GET /kpi/active-outgoing-shipments`
      - **Backend Logic:** `Logistic.countDocuments({ warehouseId: req.user.warehouseId, status: 'In Transit' })`

- **Charts:**
  1.  **Incoming Requirement Status (Donut Chart):**
      - **Endpoint:** `GET /charts/requirement-status`
      - **Backend Logic:** `Requirement.aggregate([ { $match: { warehouseId: req.user.warehouseId, isDeleted: { $ne: true } } }, { $group: { _id: '$overallStatus', count: { $sum: 1 } } } ])`
  2.  **Top 5 Inventory Items (Available vs. Reserved - Stacked Bar Chart):**
      - **Endpoint:** `GET /charts/top-inventory-items`
      - **Backend Logic:**
        - `WarehouseStock.aggregate([ { $match: { warehouseId: req.user.warehouseId, isDeleted: { $ne: true } } }, { $unwind: '$stocks' }, { $group: { _id: '$medicineId', totalQuantity: { $sum: '$stocks.quantity' }, totalReserved: { $sum: '$stocks.reservedQuantity' } } }, { $sort: { totalQuantity: -1 } }, { $limit: 5 }, { $lookup: { from: 'medicines', localField: '_id', foreignField: '_id', as: 'medicineInfo' } }, { $unwind: '$medicineInfo' }, { $project: { _id: 0, medicineName: '$medicineInfo.name', availableQuantity: { $subtract: ['$totalQuantity', '$totalReserved'] }, reservedQuantity: '$totalReserved' } } ])`
  3.  **My Stock Expiry Profile (Bar Chart):**
      - **Endpoint:** `GET /charts/stock-expiry-profile`
      - **Backend Logic:** Similar to Admin's near expiry, but filtered by `warehouseId` from `WarehouseStock` and summing `stocks.quantity`. Include '>90d' bucket.
  4.  **Outgoing Shipments Status (Pie Chart):**
      - **Endpoint:** `GET /charts/outgoing-shipments-status`
      - **Backend Logic:** `Logistic.aggregate([ { $match: { warehouseId: req.user.warehouseId, isDeleted: { $ne: true }, status: { $in: ['In Transit', 'Delivered'] } } }, { $group: { _id: '$status', count: { $sum: 1 } } } ])`
  5.  **Monthly Fulfillment Trend (Line Chart):**
      - **Endpoint:** `GET /charts/monthly-fulfillment`
      - **Backend Logic:** Needs careful implementation. Could potentially query `Requirement` updates using a change stream or query `Logistic` creation dates. A simpler approach might be:
        - `Logistic.aggregate([ { $match: { warehouseId: req.user.warehouseId, createdAt: { $gte: /* Start Date */ } } }, { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, month: '$_id', requirementsShipped: '$count' } } ])`
        - This counts _logistics created_ per month, which closely approximates requirements fulfilled/shipped. Ensure all months in the range are present.
