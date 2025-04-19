Okay, let's trace the described workflow with example data, showing how the database documents in MongoDB would change at each step.

**Scenario:**

- **Warehouse:** "Central Pharma Warehouse" (`_id: wh123`)
- **Institution:** "City General Hospital" (`_id: inst456`)
- **Medicine:** "Paracetamol 500mg Strip" (`_id: med789`, `packetSize: { strips: 10, tabletsPerStrip: 10 }`)
- **Existing Batch:** "BATCH_XYZ_001" (Expires: 2025-12-31)
- **Requested Quantity:** 150 strips

**Initial State:**

1.  **`WarehouseStock`:** Central Pharma has stock of Paracetamol.
    ```json
    // Document in 'warehousestocks' collection
    {
      "_id": "ws_stock_1",
      "warehouseId": "wh123",
      "medicineId": "med789",
      "stocks": [
        {
          "batchName": "BATCH_XYZ_001",
          "quantity": 1000, // 1000 strips available physically
          "reservedQuantity": 0, // 0 strips reserved
          "mfgDate": "2023-12-31T00:00:00.000Z",
          "expiryDate": "2025-12-31T00:00:00.000Z",
          "packetSize": { "strips": 10, "tabletsPerStrip": 10 },
          "purchasePrice": 15.0,
          "sellingPrice": 18.0,
          "mrp": 20.0,
          "receivedDate": "2024-01-15T00:00:00.000Z",
          "createdAt": "..."
        }
      ],
      "isDeleted": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
    ```
2.  **`InstitutionStock`:** City General might have other medicines, but let's assume no Paracetamol stock from this warehouse/batch yet.
3.  **`Requirement` / `Logistic`:** No relevant documents exist yet.

---

**Step 1: Institution Creates Requirement Request**

City General Hospital requests 150 strips of Paracetamol 500mg from Central Pharma Warehouse.

- **DB Change:** A new `Requirement` document is **created**.

  ```json
  // New document in 'requirements' collection
  {
    "_id": "reqABC", // Generated Requirement ID
    "institutionId": "inst456",
    "warehouseId": "wh123",
    "medicines": [
      {
        "medicineId": "med789",
        "requestedQuantity": 150, // strips
        "approvedQuantity": 0,
        "status": "Pending"
      }
    ],
    "overallStatus": "Pending",
    "logisticId": null,
    "isDeleted": false,
    "createdAt": "...", // Now
    "updatedAt": "..." // Now
  }
  ```

---

**Step 2: Warehouse Approves Request**

Central Pharma Warehouse reviews `reqABC` and approves the request for 150 strips.

- **DB Changes:**

  1.  The existing `Requirement` document (`reqABC`) is **updated**.
  2.  The existing `WarehouseStock` document (`ws_stock_1`) is **updated** to reserve the stock.

  ```json
  // Updated 'requirements' document (reqABC)
  {
    "_id": "reqABC",
    // ... other fields ...
    "medicines": [
      {
        "medicineId": "med789",
        "requestedQuantity": 150,
        "approvedQuantity": 150, // Updated
        "status": "Approved" // Updated
      }
    ],
    "overallStatus": "Approved", // Updated
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Updated 'warehousestocks' document (ws_stock_1)
  {
    "_id": "ws_stock_1",
    // ... other fields ...
    "stocks": [
      {
        "batchName": "BATCH_XYZ_001",
        "quantity": 1000, // Still 1000 physically present
        "reservedQuantity": 150 // Updated - 150 strips are now reserved
        // ... other batch fields ...
      }
    ],
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  _Note: Available quantity for new requests from this batch is now 1000 - 150 = 850 strips._

---

**Step 3: Warehouse Creates Shipment**

Warehouse packs the 150 strips from BATCH_XYZ_001, assigns transport, and creates a shipment record.

- **DB Changes:**

  1.  A new `Logistic` document is **created**.
  2.  The existing `Requirement` document (`reqABC`) is **updated** with the `logisticId` and status.
  3.  The existing `WarehouseStock` document (`ws_stock_1`) is **updated** to reflect the dispatched stock.

  ```json
  // New document in 'logistics' collection
  {
    "_id": "logXYZ", // Generated Logistic ID
    "shipmentId": "SHP1001", // Generated Shipment ID
    "requirementId": "reqABC",
    "warehouse": "wh123",
    "institution": "inst456",
    "medicines": [
      {
        "medicine": "med789",
        "stocks": [
          // Details of exact batches/quantities shipped
          {
            "batchNumber": "BATCH_XYZ_001",
            "expiryDate": "2025-12-31T00:00:00.000Z",
            "quantity": 150, // 150 strips shipped
            "packetSize": { "strips": 10, "tabletsPerStrip": 10 },
            "sellingPrice": 18.0, // Price for institution
            "mrp": 20.0
          }
        ]
      }
    ],
    "vehicles": [
      {
        "vehicleNumber": "MH01 AB 1234",
        "driverName": "Sunil",
        "driverContact": "9988776655",
        "timestamps": {
          "loadedAt": "...", // Now
          "departedAt": "..." // Now
        }
      }
    ],
    "status": "In Transit", // Updated
    "receivedStatus": "Pending",
    "isDeleted": false,
    "createdAt": "...", // Now
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Updated 'requirements' document (reqABC)
  {
    "_id": "reqABC",
    // ... other fields ...
    "overallStatus": "Shipped", // Updated
    "logisticId": "logXYZ", // Updated - Linked to the new logistic doc
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Updated 'warehousestocks' document (ws_stock_1)
  {
    "_id": "ws_stock_1",
    // ... other fields ...
    "stocks": [
      {
        "batchName": "BATCH_XYZ_001",
        "quantity": 850, // Updated: 1000 - 150 = 850 strips left physically
        "reservedQuantity": 0 // Updated: 150 - 150 = 0 strips reserved (as they are shipped)
        // ... other batch fields ...
      }
    ],
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

---

**Step 4: Warehouse Marks Delivered**

The transport vehicle reaches the hospital. The warehouse updates the shipment status.

- **DB Changes:**

  1.  The existing `Logistic` document (`logXYZ`) is **updated**.
  2.  The existing `Requirement` document (`reqABC`) is **updated**.

  ```json
  // Updated 'logistics' document (logXYZ)
  {
    "_id": "logXYZ",
    // ... other fields ...
    "vehicles": [
      {
        // ... vehicle details ...
        "timestamps": {
          "loadedAt": "...",
          "departedAt": "...",
          "arrivedAt": "..." // Updated - Now
        }
      }
    ],
    "status": "Delivered", // Updated
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Updated 'requirements' document (reqABC)
  {
    "_id": "reqABC",
    // ... other fields ...
    "overallStatus": "Delivered", // Updated
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

---

**Step 5: Institution Marks Received**

City General Hospital verifies the delivery and marks it as received in their system.

- **DB Changes:**

  1.  The existing `Logistic` document (`logXYZ`) is **updated**.
  2.  The existing `Requirement` document (`reqABC`) is **updated**.
  3.  An `InstitutionStock` document for `inst456` and `med789` is **created or updated**.

  ```json
  // Updated 'logistics' document (logXYZ)
  {
    "_id": "logXYZ",
    // ... other fields ...
    "vehicles": [
      {
        // ... vehicle details ...
        "timestamps": {
          "loadedAt": "...",
          "departedAt": "...",
          "arrivedAt": "...",
          "unloadedAt": "..." // Updated - Now
        }
      }
    ],
    "receivedStatus": "Received", // Updated
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Updated 'requirements' document (reqABC)
  {
    "_id": "reqABC",
    // ... other fields ...
    "overallStatus": "Received", // Updated
    // ... other fields ...
    "updatedAt": "..." // Now
  }
  ```

  ```json
  // Create or Update 'institutionstocks' collection
  // Assuming no prior stock for this med/inst combo, we CREATE:
  {
    "_id": "is_stock_1", // Generated Institution Stock ID
    "institutionId": "inst456",
    "medicineId": "med789",
    "stocks": [
      {
        // New stock batch added from the received shipment
        "warehouseId": "wh123", // Source warehouse
        "batchName": "BATCH_XYZ_001",
        "expiryDate": "2025-12-31T00:00:00.000Z",
        "packetSize": { "strips": 10, "tabletsPerStrip": 10 },
        "currentQuantityInStrips": 150, // The quantity received and currently available
        "quantityReceived": 150, // How many strips came in this specific delivery
        "purchasePrice": 18.0, // Price paid by institution (sellingPrice from warehouse)
        "mrp": 20.0,
        "receivedDate": "...", // Now
        "createdAt": "..." // Now
      }
    ],
    "isDeleted": false,
    "createdAt": "...", // Now
    "updatedAt": "..." // Now
  }
  // If a document for med789/inst456 already existed,

  // we would push the new batch object into the existing 'stocks' array.
  ```

---

**End of Flow:** The requirement is fulfilled, stock is transferred, and reflected correctly in both warehouse and institution inventories.

**Optional Follow-ups:**

- **Institution Logs Usage:** If the hospital uses 20 strips:
  - Update `InstitutionStock` (`is_stock_1`): Find the `BATCH_XYZ_001` entry in `stocks` and set `currentQuantityInStrips` to `130`.
- **Warehouse Adds New Stock:** If the warehouse receives 500 strips of `med789` in `BATCH_ABC_002`:
  - Update `WarehouseStock` (`ws_stock_1`): Add a new object to the `stocks` array for `BATCH_ABC_002` with `quantity: 500`, `reservedQuantity: 0`, and other details.

This detailed flow shows how the different models interact and how data changes state throughout the process.
