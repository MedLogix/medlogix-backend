Okay, let's walk through the **refined** end-to-end flow, incorporating automated FEFO batch selection during shipment. We'll detail the frontend interactions and the backend data changes.

**Scenario Setup:**

- **Warehouse:** "Central Pharma Warehouse" (`_id: wh123`)
- **Institution:** "City General Hospital" (`_id: inst456`)
- **Medicine:** "Paracetamol 500mg Strip" (`_id: med789`)
- **Existing Batches in Warehouse Stock:**
  - Batch A: `BATCH_OLD_001` (Expires: 2025-06-30, Qty: 50, Reserved: 0)
  - Batch B: `BATCH_NEW_002` (Expires: 2025-12-31, Qty: 1000, Reserved: 0)
- **Requested Quantity:** 150 strips

**Initial DB State:**

- `warehouseStocks` Collection (Relevant Document):
  ```json
  {
    "_id": "ws_stock_1",
    "warehouseId": "wh123",
    "medicineId": "med789",
    "stocks": [
      {
        "batchName": "BATCH_OLD_001",
        "quantity": 50,
        "reservedQuantity": 0,
        "expiryDate": "2025-06-30T..." /* other fields */
      },
      {
        "batchName": "BATCH_NEW_002",
        "quantity": 1000,
        "reservedQuantity": 0,
        "expiryDate": "2025-12-31T..." /* other fields */
      }
    ]
    // ... other fields ...
  }
  ```
- `requirements`, `logistics`, `institutionStocks`, `institutionUsageLogs`, `warehouseReceiptLogs` collections are empty or don't contain entries relevant to this flow yet.

---

**Phase 1: Requirement Creation (Institution)**

1.  **Frontend (Institution User):**

    - Logs in, navigates to "Create Requirement".
    - Selects Warehouse: "Central Pharma Warehouse" (`wh123`).
    - Adds Medicine: Searches/selects "Paracetamol 500mg Strip" (`med789`).
    - Enters Quantity: `150` strips.
    - Clicks "Add Item". Medicine appears in the request list.
    - Reviews and clicks "Submit Requirement".
    - **API Call:** `POST /requirements`
      - Body: `{ warehouseId: "wh123", medicines: [{ medicineId: "med789", requestedQuantity: 150 }] }`
    - Sees success message ("Requirement ReqABC created"). Requirement appears in "My Requirements" list with status "Pending".

2.  **Backend (`createRequirement` controller):**
    - Receives request.
    - Validates data.
    - **DB Change:** Creates a new document in the `requirements` collection.
      ```json
      // New document in 'requirements'
      {
        "_id": "reqABC",
        "institutionId": "inst456",
        "warehouseId": "wh123",
        "medicines": [
          {
            "medicineId": "med789",
            "requestedQuantity": 150,
            "approvedQuantity": 0,
            "status": "Pending"
          }
        ],
        "overallStatus": "Pending",
        "logisticId": null /* timestamps */
      }
      ```
    - Sends 201 Created response.

---

**Phase 2: Requirement Approval (Warehouse)**

1.  **Frontend (Warehouse User):**

    - Logs in, navigates to "Incoming Requirements".
    - Sees `reqABC` from "City General Hospital", status "Pending".
    - Clicks `reqABC` to view details.
    - Sees "Paracetamol 500mg Strip", Requested: 150.
    - _(Optional Display)_: Might see "Total Available Stock: 1050 strips" (calculated as (50-0) + (1000-0)).
    - Enters Approved Quantity: `150`.
    - Selects Item Status: "Approved".
    - Clicks "Update Requirement Status".
    - **API Call:** `PATCH /requirements/reqABC/approve`
      - Body: `{ items: [{ medicineId: "med789", approvedQuantity: 150, status: "Approved" }] }`
    - Sees success message. Requirement status updates to "Approved".

2.  **Backend (`approveRequirementItems` controller):**
    - Receives request for `reqABC`.
    - Validates data.
    - Starts DB transaction/session.
    - Fetches `Requirement` `reqABC`.
    - Fetches `WarehouseStock` `ws_stock_1`.
    - **FEFO Logic for Reservation:**
      - Calculates total available: (50 - 0) + (1000 - 0) = 1050. Checks if 1050 >= 150 (Yes).
      - Sorts batches by expiry: `BATCH_OLD_001` (2025-06-30) then `BATCH_NEW_002` (2025-12-31).
      - Batch A (`BATCH_OLD_001`): Available = 50. Need 150. Reserve 50 from this batch. `reservedQuantity` becomes 50. Remaining needed = 150 - 50 = 100.
      - Batch B (`BATCH_NEW_002`): Available = 1000. Need 100. Reserve 100 from this batch. `reservedQuantity` becomes 100. Remaining needed = 100 - 100 = 0.
    - **DB Change 1:** Updates the `Requirement` document `reqABC`.
      ```json
      // Updated document in 'requirements'
      {
        "_id": "reqABC" /* ... */,
        "medicines": [
          {
            "medicineId": "med789",
            "requestedQuantity": 150,
            "approvedQuantity": 150,
            "status": "Approved"
          } // Updated
        ],
        "overallStatus": "Approved" // Updated
        /* timestamps updated */
      }
      ```
    - **DB Change 2:** Updates the `WarehouseStock` document `ws_stock_1`.
      ```json
      // Updated document in 'warehouseStocks'
      {
        "_id": "ws_stock_1" /* ... */,
        "stocks": [
          {
            "batchName": "BATCH_OLD_001",
            "quantity": 50,
            "reservedQuantity": 50,
            "expiryDate": "2025-06-30T..." /* ... */
          }, // reservedQuantity Updated
          {
            "batchName": "BATCH_NEW_002",
            "quantity": 1000,
            "reservedQuantity": 100,
            "expiryDate": "2025-12-31T..." /* ... */
          } // reservedQuantity Updated
        ]
        /* timestamps updated */
      }
      ```
    - Commits transaction.
    - Sends 200 OK response.

---

**Phase 3: Shipment Creation (Warehouse - _Refined with Auto-FEFO_)**

1.  **Frontend (Warehouse User):**

    - Navigates to "Approved Requirements" or finds `reqABC` (status "Approved").
    - Clicks "Create Shipment" for `reqABC`.
    - Sees "Create Shipment" form (pre-filled: Req ID `reqABC`, Institution `inst456`).
    - Sees a section like **"Items Allocated for Shipment (FEFO):"**
      - "Paracetamol 500mg Strip - 150 Strips"
        - " - 50 Strips from Batch: BATCH_OLD_001 (Expires: 2025-06-30)"
        - " - 100 Strips from Batch: BATCH_NEW_002 (Expires: 2025-12-31)"
      - _(User does NOT manually select batches)_
    - Enters Transport Details: Vehicle Number, Driver Name, Driver Contact.
    - Reviews allocated items and transport info.
    - Clicks "Confirm & Dispatch Shipment".
    - **API Call:** `POST /logistics`
      - Body: `{ requirementId: "reqABC", vehicles: [{ vehicleNumber: "...", driverName: "...", driverContact: "..." }] }` _(Note: No need to send allocated batches; backend calculates this)_
    - Sees success message ("Shipment SHP1001 created..."). Requirement `reqABC` status updates to "Shipped".

2.  **Backend (`createShipment` controller):**
    - Receives request for `reqABC`.
    - Validates data.
    - Starts DB transaction/session.
    - Fetches `Requirement` `reqABC` (confirms status is Approved, gets `approvedQuantity`).
    - Fetches `WarehouseStock` `ws_stock_1`.
    - **FEFO Logic for Shipment Allocation:**
      - Need to ship 150 strips of `med789`.
      - Sorts batches by expiry: `BATCH_OLD_001` then `BATCH_NEW_002`.
      - Batch A (`BATCH_OLD_001`): Has `quantity` 50, `reservedQuantity` 50. Use all 50. Remaining needed = 100.
      - Batch B (`BATCH_NEW_002`): Has `quantity` 1000, `reservedQuantity` 100. Need 100. Use 100 from this batch. Remaining needed = 0.
      - Determines shipped batches: `{ batchNumber: "BATCH_OLD_001", quantity: 50 }`, `{ batchNumber: "BATCH_NEW_002", quantity: 100 }`. Also retrieves expiry, prices, etc. for these batches.
    - **DB Change 1:** Creates a new `Logistic` document.
      ```json
      // New document in 'logistics'
      {
        "_id": "logXYZ",
        "shipmentId": "SHP1001",
        "requirementId": "reqABC",
        "warehouse": "wh123",
        "institution": "inst456",
        "medicines": [
          {
            "medicine": "med789",
            "stocks": [
              // Automatically determined via FEFO
              {
                "batchNumber": "BATCH_OLD_001",
                "expiryDate": "2025-06-30T...",
                "quantity": 50 /* sellingPrice, mrp */
              },
              {
                "batchNumber": "BATCH_NEW_002",
                "expiryDate": "2025-12-31T...",
                "quantity": 100 /* sellingPrice, mrp */
              }
            ]
          }
        ],
        "vehicles": [
          {
            /* user input */
          }
        ],
        "status": "In Transit",
        "receivedStatus": "Pending" /* timestamps */
      }
      ```
    - **DB Change 2:** Updates the `Requirement` document `reqABC`.
      ```json
      // Updated document in 'requirements'
      {
        "_id": "reqABC" /* ... */,
        "overallStatus": "Shipped", // Updated
        "logisticId": "logXYZ" // Updated
        /* timestamps updated */
      }
      ```
    - **DB Change 3:** Updates the `WarehouseStock` document `ws_stock_1`.
      ```json
      // Updated document in 'warehouseStocks'
      {
        "_id": "ws_stock_1" /* ... */,
        "stocks": [
          {
            "batchName": "BATCH_OLD_001",
            "quantity": 0,
            "reservedQuantity": 0,
            "expiryDate": "2025-06-30T..." /* ... */
          }, // quantity & reservedQuantity Updated (50-50, 50-50)
          {
            "batchName": "BATCH_NEW_002",
            "quantity": 900,
            "reservedQuantity": 0,
            "expiryDate": "2025-12-31T..." /* ... */
          } // quantity & reservedQuantity Updated (1000-100, 100-100)
        ]
        /* timestamps updated */
        // Note: Could potentially remove batches where quantity becomes 0 here or via a cleanup job.
      }
      ```
    - Commits transaction.
    - Sends 201 Created response.

---

**Phase 4: Mark Delivered (Warehouse)**

1.  **Frontend (Warehouse User):**

    - Navigates to "Shipments". Finds `SHP1001` (status "In Transit").
    - Clicks "Mark as Delivered".
    - **API Call:** `PATCH /logistics/logXYZ/status`
      - Body: `{ status: "Delivered" }`
    - Sees success message. Shipment status updates to "Delivered".

2.  **Backend (`updateShipmentStatus` controller):**
    - Receives request for `logXYZ`.
    - Starts transaction.
    - Updates `Logistic` document `logXYZ`.
      ```json
      // Updated document in 'logistics'
      {
        "_id": "logXYZ",
        /* ... */ "status": "Delivered" /* timestamps updated */
      }
      ```
    - Updates `Requirement` document `reqABC`.
      ```json
      // Updated document in 'requirements'
      {
        "_id": "reqABC",
        /* ... */ "overallStatus": "Delivered" /* timestamps updated */
      }
      ```
    - Commits transaction.
    - Sends 200 OK response.

---

**Phase 5: Receive Shipment (Institution)**

1.  **Frontend (Institution User):**

    - Navigates to "Incoming Shipments" or checks `reqABC` (status "Delivered").
    - Finds `SHP1001` (status "Delivered").
    - Clicks to view details (sees received batches: 50 of BATCH_OLD_001, 100 of BATCH_NEW_002).
    - Clicks "Confirm Receipt".
    - **API Call:** `PATCH /logistics/logXYZ/receive`
      - Body: _{}_ (No body needed, action is implicit)
    - Sees success message. Shipment status updates to "Received". Stock levels are updated.

2.  **Backend (`receiveShipment` controller):**
    - Receives request for `logXYZ`.
    - Starts transaction.
    - Fetches `Logistic` document `logXYZ` (gets institutionId, medicineId, batch details).
    - **DB Change 1:** Updates `Logistic` document `logXYZ`.
      ```json
      // Updated document in 'logistics'
      {
        "_id": "logXYZ",
        /* ... */ "receivedStatus": "Received" /* timestamps updated */
      }
      ```
    - **DB Change 2:** Updates `Requirement` document `reqABC`.
      ```json
      // Updated document in 'requirements'
      {
        "_id": "reqABC",
        /* ... */ "overallStatus": "Received" /* timestamps updated */
      }
      ```
    - **DB Change 3:** Finds or Creates `InstitutionStock` for `inst456` / `med789`. Adds received batches.
      ```json
      // Create or Update document in 'institutionStocks'
      // Assuming it didn't exist before:
      {
        "_id": "is_stock_xyz",
        "institutionId": "inst456",
        "medicineId": "med789",
        "stocks": [
          // Add received batches
          {
            "warehouseId": "wh123",
            "batchName": "BATCH_OLD_001",
            "expiryDate": "2025-06-30T...",
            "currentQuantityInStrips": 50,
            "quantityReceived": 50 /* purchasePrice, mrp, receivedDate */
          },
          {
            "warehouseId": "wh123",
            "batchName": "BATCH_NEW_002",
            "expiryDate": "2025-12-31T...",
            "currentQuantityInStrips": 100,
            "quantityReceived": 100 /* purchasePrice, mrp, receivedDate */
          }
        ]
        /* timestamps */
      }

      // If it existed, push the new batches into the stocks array.
      ```
    - Commits transaction.
    - Sends 200 OK response.

---

**Side Flow: Warehouse Adds New Stock**

1.  **Frontend (Warehouse User):** Fills "Add Stock" form (Medicine, Batch: `BATCH_XYZ_003`, Qty: 500, Dates, Prices). Submits.
2.  **API Call:** `POST /warehouse-stock` with batch details.
3.  **Backend (`addStock` controller):**
    - Starts transaction.
    - Updates `WarehouseStock` `ws_stock_1` (pushes `BATCH_XYZ_003` into `stocks` array with quantity 500).
    - Creates `WarehouseReceiptLog` entry detailing the addition of `BATCH_XYZ_003`.
    - Commits transaction.
4.  **Frontend:** Success message.

---

**Side Flow: Institution Logs Usage**

1.  **Frontend (Institution User):** Navigates to "Log Usage". Selects "Paracetamol 500mg Strip". Enters Quantity Used: `30` strips. _(Optionally specifies batch, but FEFO is preferred)_. Submits.
2.  **API Call:** `POST /institution-stock/log-usage` with `{ medicineId: "med789", quantityUsed: 30 }`.
3.  **Backend (`logUsage` controller):**
    - Starts transaction.
    - Fetches `InstitutionStock` `is_stock_xyz`.
    - **FEFO Logic for Usage:** Sorts batches by expiry: `BATCH_OLD_001` (expires 2025-06-30, Qty: 50), then `BATCH_NEW_002` (expires 2025-12-31, Qty: 100).
      - Batch A (`BATCH_OLD_001`): Available = 50. Need 30. Use 30 from this batch. `currentQuantityInStrips` becomes 20. Remaining needed = 0.
    - Updates `InstitutionStock` `is_stock_xyz`.
      ```json
      {
        /* ... */
        "stocks": [
          { /* BATCH_OLD_001 */ "currentQuantityInStrips": 20 /* ... */ }, // Updated
          { /* BATCH_NEW_002 */ "currentQuantityInStrips": 100 /* ... */ }
        ]
        /* ... */
      }
      ```
    - Creates `InstitutionUsageLog` entry (Medicine: `med789`, Qty: 30, Batch: `BATCH_OLD_001`).
    - Commits transaction.
4.  **Frontend:** Success message. Stock view shows updated quantity for Batch A.

This refined flow provides a robust, FEFO-driven process with clear steps for users and corresponding backend actions and data transformations.
