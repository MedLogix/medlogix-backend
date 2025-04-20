# MedLogix Application Documentation (Detailed)

**Version:** 1.1 (Generated based on code analysis and seeding scripts)

**1. Overview**

MedLogix is a comprehensive backend system designed to orchestrate the pharmaceutical supply chain connecting central Warehouses with requesting Institutions (hospitals, clinics, etc.). Its primary functions include managing inventory across locations, processing stock requests, facilitating logistics, and ensuring traceability through detailed logging, with a core focus on efficient stock rotation using the First-Expired, First-Out (FEFO) principle.

**2. Core Concepts**

*   **FEFO (First-Expired, First-Out):** This is a fundamental inventory management principle used throughout the system. When reserving stock, allocating for shipment, or deducting for usage, the system prioritizes consuming batches with the earliest expiry dates first to minimize waste.
*   **Stock Reservation:** When a Warehouse approves a Requirement, the system reserves the necessary quantity from available stock batches (using FEFO). This `reservedQuantity` prevents the same physical stock from being promised or shipped elsewhere while the approved requirement awaits dispatch.
*   **Transactional Integrity:** Operations involving multiple database updates (e.g., approving a requirement and reserving stock, creating a shipment and updating stock levels) are likely handled within database transactions to ensure atomicity – either all related changes succeed, or none do, maintaining data consistency.
*   **Logging & Audit Trail:** The `WarehouseReceiptLog` and `InstitutionUsageLog` collections are critical for traceability. They record every significant stock movement: initial warehouse purchases, transfers between warehouse and institution (sales/additions), and final usage within the institution.
*   **Verification:** Institutions and Warehouses undergo a verification process (likely managed by Admins) reflected by the `verificationStatus` ("pending", "verified", "rejected"). Only verified entities can fully participate in the core workflows.

**3. Data Models (Detailed)**

*   **`User` (Implicit/Combined Model):**
    *   Authentication likely uses email/password (`bcrypt` for hashing).
    *   Authorization managed via JWT (`jsonwebtoken`), containing user ID, email, and `userType` (`Admin`, `Institution`, `Warehouse`).
    *   Each user type likely has associated specific data (see Institution, Warehouse models).

*   **`Institution` (`institutions` collection):**
    *   `institutionCode`: Unique identifier (e.g., "INST101").
    *   `name`: Unique name of the institution.
    *   `email`, `password`: Login credentials.
    *   `registrationNumber`: Official registration identifier.
    *   `location`: Embedded object with `address`, `city`, `district`, `state`, `pincode`, `gpsCoordinates`.
    *   `incharge`: Array of contact person objects (`name`, `contact` [String], `email`?).
    *   `verificationStatus`: "pending", "verified", or "rejected".
    *   `verificationRejectedReason`: String explaining rejection (if applicable).
    *   `timestamps`: `createdAt`, `updatedAt`.

*   **`Warehouse` (`warehouses` collection):**
    *   `warehouseCode`: Unique identifier (e.g., "WH001").
    *   `name`: Unique name of the warehouse.
    *   `email`, `password`: Login credentials.
    *   `registrationNumber`: Official registration identifier.
    *   `location`: Embedded object (similar to Institution).
    *   `managers`: Array of contact person objects (`name`, `contact` [String], `email`?).
    *   `verificationStatus`, `verificationRejectedReason`.
    *   `timestamps`.

*   **`Salt` (`salts` collection):**
    *   `name`: Unique name of the chemical salt (e.g., "Paracetamol").
    *   `useCase`: Description of its use.
    *   `createdByRole`, `createdBy`: Tracks who added the salt (likely Admin).
    *   `isDeleted`.
    *   `timestamps`.

*   **`Manufacturer` (`manufacturers` collection):**
    *   `name`: Unique name of the manufacturer.
    *   `medicalRepresentator`: Embedded object (`name`, `contact` [Number]).
    *   `createdByRole`, `createdBy`.
    *   `isDeleted`.
    *   `timestamps`.

*   **`Medicine` (`medicines` collection):**
    *   `name`: Unique name of the medicine product (e.g., "Calpol 500mg").
    *   `salts`: Array of `ObjectId` references to `Salts`.
    *   `manufacturer`: `ObjectId` reference to `Manufacturers`.
    *   `isTablets`, `medicineType`: Categorization fields.
    *   `createdByRole`, `createdBy`.
    *   `isDeleted`.
    *   `timestamps`.

*   **`WarehouseStock` (`warehouseStocks` collection):**
    *   `warehouseId`: `ObjectId` reference to `Warehouses`.
    *   `medicineId`: `ObjectId` reference to `Medicines`.
    *   `stocks`: **Array of Batches**. Each batch object contains:
        *   `batchName`: Unique identifier for the batch (e.g., "B-PAR-XYZ123").
        *   `quantity`: Current physical quantity (e.g., strips) of this batch in the warehouse.
        *   `reservedQuantity`: Quantity from this batch reserved for approved requirements but not yet shipped.
        *   `mfgDate`, `expiryDate` (Required): Manufacturing and Expiry dates.
        *   `packetSize`: Optional details (`strips`, `tabletsPerStrip`).
        *   `purchasePrice`, `sellingPrice`, `mrp`: Pricing information.
        *   `receivedDate`: When this batch was received by the warehouse.
        *   `createdAt`: Timestamp for the batch entry creation.
    *   `isDeleted`.
    *   `timestamps`.
    *   *Index Likely:* Compound index on `warehouseId` and `medicineId`.

*   **`Requirement` (`requirements` collection):**
    *   `institutionId`: `ObjectId` ref to requesting `Institution`.
    *   `warehouseId`: `ObjectId` ref to target `Warehouse`.
    *   `medicines`: **Array of Requested Items**. Each object contains:
        *   `medicineId`: `ObjectId` ref to `Medicines`.
        *   `requestedQuantity`: How many units the institution asked for.
        *   `approvedQuantity`: How many units the warehouse approved (defaults to 0).
        *   `status`: Status of this specific line item ("Pending", "Approved", "Rejected").
    *   `overallStatus`: Overall status of the entire requirement ("Pending", "Approved", "Partially Approved", "Rejected", "Shipped", "Delivered", "Received"). Reflects the aggregate state of line items and logistics.
    *   `logisticId`: `ObjectId` ref to the `Logistic` document once shipped (defaults to `null`).
    *   `isDeleted`.
    *   `timestamps`.
    *   *Indexes Likely:* `institutionId`, `warehouseId`, `overallStatus`.

*   **`Logistic` (`logistics` collection):**
    *   `shipmentId`: Unique identifier for the shipment (e.g., "SHP12345").
    *   `requirementId`: `ObjectId` ref to the fulfilled `Requirement`.
    *   `warehouse`: `ObjectId` ref to the sending `Warehouse`.
    *   `institution`: `ObjectId` ref to the receiving `Institution`.
    *   `medicines`: **Array of Shipped Items**. Each object contains:
        *   `medicine`: `ObjectId` ref to `Medicines`.
        *   `stocks`: **Array of Shipped Batches** for this medicine. Each object contains:
            *   `batchNumber`: The `batchName` from `WarehouseStock`.
            *   `expiryDate`: Copied from the source batch.
            *   `quantity`: Quantity shipped *from this specific batch*.
            *   `packetSize`: Copied.
            *   `sellingPrice`, `mrp`: Copied (price at time of shipment).
    *   `vehicles`: Array of vehicle/driver details (`vehicleNumber`, `driverName`, `driverContact`, `timestamps` { `loadedAt`, `departedAt`, `arrivedAt`?, `unloadedAt`? }).
    *   `status`: Warehouse-updated status ("Pending", "In Transit", "Delivered").
    *   `receivedStatus`: Institution-updated status ("Pending", "Received").
    *   `isDeleted`.
    *   `timestamps`.

*   **`InstitutionStock` (`institutionStocks` collection):**
    *   `institutionId`: `ObjectId` ref to `Institutions`.
    *   `medicineId`: `ObjectId` ref to `Medicines`.
    *   `stocks`: **Array of Received Batches**. Each batch object contains:
        *   `warehouseId`: `ObjectId` ref to the originating `Warehouse`.
        *   `batchName`: Identifier of the batch received.
        *   `expiryDate`.
        *   `packetSize`.
        *   `currentQuantityInStrips` (Required): Remaining quantity of this batch *within the institution*.
        *   `quantityReceived` (Required): Quantity initially received in this batch delivery.
        *   `purchasePrice` (Required): Price the institution paid (Warehouse's selling price).
        *   `mrp` (Required).
        *   `receivedDate` (Required): Date this batch was received by the institution.
        *   `createdAt`: Timestamp for batch entry creation.
    *   `isDeleted`.
    *   `timestamps`.
    *   *Index Likely:* Compound index on `institutionId` and `medicineId`.

*   **`WarehouseReceiptLog` (`warehouseReceiptLogs` collection):**
    *   `warehouseId`, `medicineId`, `batchName`.
    *   `quantity`: Amount added or removed.
    *   `type`: "purchase" (stock added) or "sale" (stock shipped).
    *   Includes other relevant batch details (`mfgDate`, `expiryDate`, prices, `receivedDate`).
    *   `timestamps`.

*   **`InstitutionUsageLog` (`institutionUsageLogs` collection):**
    *   `institutionId`, `medicineId`, `batchName`.
    *   `quantity`: Amount used or received.
    *   `type`: "usage" (stock consumed) or "addition" (stock received from shipment).
    *   `timestamps`.

**4. User Roles & Permissions (Inferred)**

*   **Admin:**
    *   Manages Users (potentially CRUD, password resets).
    *   Verifies/Rejects Institutions and Warehouses.
    *   Manages base data: Salts, Manufacturers, Medicines.
    *   Views system-wide data: All requirements, logistics, stocks, logs.
*   **Institution User:**
    *   Manages own Institution profile.
    *   Creates/Views own Requirements.
    *   Views incoming Shipments (`Logistics` destined for them).
    *   Confirms receipt of shipments (`PATCH /logistics/:id/receive`).
    *   Manages own Institution Stock (`GET /institution-stock`, `POST /institution-stock/log-usage`, potentially manual additions via `POST /institution-stock`).
    *   Views available Warehouse stock (`GET /warehouse-stock/available`).
*   **Warehouse User:**
    *   Manages own Warehouse profile.
    *   Manages own Warehouse Stock (`GET /warehouse-stock`, `POST /warehouse-stock`, `PUT /warehouse-stock/:id` (update batch details), `DELETE /warehouse-stock/:id`).
    *   Views/Processes incoming Requirements (`GET /requirements/warehouse`, `PATCH /requirements/:id/approve`, `PATCH /requirements/:id/reject`, `GET /requirements/:id/stock-availability`).
    *   Creates/Manages outgoing Shipments (`POST /logistics`, `GET /logistics/warehouse`, `PATCH /logistics/:id/status`).

**5. Key Workflows (Detailed Steps)**

**A. Requirement Fulfillment Flow:**

1.  **Requirement Creation:**
    *   **UI (Inst):** Selects Warehouse, adds Medicines (Medicine ID, Quantity), submits.
    *   **API (Inst):** `POST /requirements`
        *   Body: `{ warehouseId: "...", medicines: [{ medicineId: "...", requestedQuantity: ... }] }`
    *   **Backend (Inst):**
        *   Validates inputs (IDs, quantities).
        *   Checks if warehouse and medicines exist and are active.
        *   Creates `Requirement` doc (`overallStatus: "Pending"`, medicine `status: "Pending"`).
        *   Returns 201 response.

2.  **Requirement Approval:**
    *   **UI (WH):** Views pending requirement, checks availability (maybe via `GET /requirements/:id/stock-availability`), enters approved quantities/status per item, updates.
    *   **API (WH):** `PATCH /requirements/:requirementId/approve`
        *   Body: `{ items: [{ medicineId: "...", approvedQuantity: ..., status: "Approved/Rejected" }] }`
    *   **Backend (WH):**
        *   Validates inputs. Starts Transaction.
        *   Fetches `Requirement` and relevant `WarehouseStock` docs.
        *   For each "Approved" item:
            *   Checks sufficient *available* (`quantity - reservedQuantity`) stock.
            *   **FEFO Reservation:** Sorts batches by `expiryDate`. Iterates through batches, calculates quantity to reserve from each, increments `batch.reservedQuantity`.
        *   Updates `WarehouseStock` doc(s) with new `reservedQuantity` values.
        *   Updates `Requirement` doc: medicine statuses, `approvedQuantity`, and `overallStatus` (to "Approved", "Partially Approved", or remains "Pending" if changes only resulted in rejections).
        *   Commits Transaction. Returns 200 response.

3.  **Shipment Creation:**
    *   **UI (WH):** Selects "Approved" requirement, clicks "Create Shipment", enters vehicle details, confirms dispatch. Backend performs FEFO allocation display.
    *   **API (WH):** `POST /logistics`
        *   Body: `{ requirementId: "...", vehicles: [{...}] }`
    *   **Backend (WH):**
        *   Validates inputs. Starts Transaction.
        *   Fetches `Requirement` (status must be "Approved"). Fetches relevant `WarehouseStock` docs.
        *   For each approved medicine in Requirement:
            *   **FEFO Allocation:** Sorts batches by `expiryDate`. Iterates through batches, determines quantity to ship from each batch based on `approvedQuantity` and available `reservedQuantity`.
            *   Builds `medicines.stocks` array for the Logistic document using data from allocated batches (batchNumber, expiry, quantity shipped, prices).
            *   Updates `WarehouseStock`: Decrements `batch.quantity` and `batch.reservedQuantity` for shipped amounts.
            *   Creates `WarehouseReceiptLog` (type: "sale") for each batch decremented.
        *   Creates `Logistic` doc (status: "In Transit", receivedStatus: "Pending", details from above steps).
        *   Updates `Requirement` doc: `overallStatus` to "Shipped", set `logisticId`.
        *   Commits Transaction. Returns 201 response.

4.  **Shipment Delivery:**
    *   **UI (WH):** Finds "In Transit" shipment, clicks "Mark Delivered".
    *   **API (WH):** `PATCH /logistics/:logisticId/status`
        *   Body: `{ status: "Delivered" }`
    *   **Backend (WH):**
        *   Starts Transaction.
        *   Updates `Logistic` doc: `status` to "Delivered".
        *   Updates related `Requirement` doc: `overallStatus` to "Delivered".
        *   Commits Transaction. Returns 200 response.

5.  **Shipment Receipt:**
    *   **UI (Inst):** Views "Delivered" shipment, confirms receipt.
    *   **API (Inst):** `PATCH /logistics/:logisticId/receive`
        *   Body: `{}` (or optional timestamps)
    *   **Backend (Inst):**
        *   Validates request. Starts Transaction.
        *   Fetches `Logistic` doc. Checks it belongs to the user and status allows receipt.
        *   Updates `Logistic` doc: `receivedStatus` to "Received", potentially updates `vehicles.timestamps.arrivedAt`/`unloadedAt`.
        *   Updates related `Requirement` doc: `overallStatus` to "Received".
        *   For each *batch* within the `Logistic.medicines.stocks`:
            *   Finds/Creates `InstitutionStock` doc for the `institutionId`/`medicineId`.
            *   Uses `findOneAndUpdate` with `$push` to add the received batch details to the `stocks` array. Sets `currentQuantityInStrips` = `quantityReceived` initially.
            *   Creates `InstitutionUsageLog` (type: "addition") for the received batch.
        *   Commits Transaction. Returns 200 response.

**B. Stock Management Workflows:**

1.  **Add Warehouse Stock:**
    *   **UI (WH):** Fills form with new batch details (Medicine, Qty, Expiry, Prices, etc.).
    *   **API (WH):** `POST /warehouse-stock`
        *   Body: `{ medicineId: "...", batch: { quantity: ..., expiryDate: ..., ...} }`
    *   **Backend (WH):**
        *   Validates input. Starts Transaction.
        *   Uses `findOneAndUpdate` with `upsert: true` and `$push` to find the `WarehouseStock` doc for the `warehouseId`/`medicineId` and add the new batch to the `stocks` array. Generates `batchName`.
        *   Creates `WarehouseReceiptLog` (type: "purchase").
        *   Commits Transaction. Returns 201 response.

2.  **Log Institution Usage:**
    *   **UI (Inst):** Selects Medicine, enters quantity used.
    *   **API (Inst):** `POST /institution-stock/log-usage`
        *   Body: `{ stockId: "...", quantityUsed: ... }` (*Note: API might take `medicineId` instead of `stockId` and find the stock doc internally*)
    *   **Backend (Inst):**
        *   Validates input. Starts Transaction.
        *   Finds `InstitutionStock` doc.
        *   **FEFO Deduction:** Sorts `stocks` array by `expiryDate`. Iterates through batches, decrementing `batch.currentQuantityInStrips` until `quantityUsed` is fulfilled.
        *   Creates `InstitutionUsageLog` (type: "usage") for each batch quantity was deducted from.
        *   Saves updated `InstitutionStock` doc.
        *   Commits Transaction. Returns 200 response.

**6. Seeding**

*   The `seedAnalyticsData.js` script is designed to populate the database with realistic test data reflecting these interconnected workflows.
*   It generates base data (Salts, Manufacturers, Medicines, Institutions, Warehouses) first.
*   It then simulates the addition of warehouse stock batches and requirement/logistic flows, creating corresponding stock records and logs using logic that mimics the application's controllers (`findOneAndUpdate`, `$push`, log creation) to ensure data consistency and relevance for analytics development.

---

This enhanced documentation should provide a clearer picture of the application's functionality and data handling. 