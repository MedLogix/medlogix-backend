// seedMainData.js
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
dotenv.config();
// Removed unused imports: fs, path, fileURLToPath

// --- Configuration ---
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

if (!MONGODB_URI || !DB_NAME) {
  console.error(
    "Error: MONGODB_URI and DB_NAME environment variables must be set."
  );
  process.exit(1);
}

// --- Helper Functions ---
// ... (Keep helper functions: randomDate, futureDate, pastDate, randomInt) ...
const futureDate = (days) =>
  new Date(new Date().setDate(new Date().getDate() + days));
const pastDate = (days) =>
  new Date(new Date().setDate(new Date().getDate() - days));
const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

// --- Provided Data ---
const specificInstitution = {
  _id: new ObjectId("68032a7c376a74cb1713018e"),
  institutionCode: "INST012",
  name: "Mumbai Mueller - Stehr Hospital",
  email: "humberto_hilll@hospital.org",
  // Password omitted
  registrationNumber: "UPHOSPI-2024-111",
  location: {
    address: "46749 Brett Motorway",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    gpsCoordinates: {
      lat: 33.121,
      lng: 96.5209,
    },
  },
  incharge: [
    {
      name: "Dr. Tracy Powlowski",
      contact: "9904694631",
      email: "christelle.bauch47@gmail.com",
      _id: new ObjectId("68032a7c376a74cb1713018f"),
    },
    {
      name: "Dr. Bonnie Greenholt",
      contact: "9609237971",
      email: "ari_shields58@gmail.com",
      _id: new ObjectId("68032a7c376a74cb17130190"),
    },
  ],
  verificationStatus: "verified",
  createdAt: new Date("2025-04-19T04:45:48.470Z"),
  updatedAt: new Date("2025-04-19T04:45:48.470Z"),
  __v: 0,
};

const specificWarehouse = {
  _id: new ObjectId("68032a7c376a74cb17130253"),
  warehouseCode: "WH009",
  name: "Mumbai Central Medical Warehouse",
  email: "mafalda79@medlogix.in",
  // Password omitted
  registrationNumber: "UPWH-2024-108",
  location: {
    address: "81734 Oxford Street",
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    gpsCoordinates: {
      lat: 13.0817,
      lng: 69.0638,
    },
  },
  managers: [
    {
      name: "Miss Kendra Wunsch",
      contact: "7242117950",
      email: "barbara23@hotmail.com",
      _id: new ObjectId("68032a7c376a74cb17130254"),
    },
  ],
  verificationStatus: "verified",
  createdAt: new Date("2025-04-19T04:45:48.762Z"),
  updatedAt: new Date("2025-04-19T04:45:48.762Z"),
  __v: 0,
};

// --- Embedded Medicine IDs (Extracted from test.medicines.json, excluding deleted ones) ---
const availableMedicineIds = [
  new ObjectId("6802327519615d4417c321d0"), // Crocin Advance
  new ObjectId("6802327519615d4417c321d1"), // Calpol 650
  new ObjectId("6802327519615d4417c321d2"), // Dolo 650
  new ObjectId("6802327519615d4417c321d3"), // Voveran SR 100
  new ObjectId("6802327519615d4417c321d4"), // Moxikind-CV 625
  new ObjectId("6802327519615d4417c321d5"), // Azee 500
  new ObjectId("6802327519615d4417c321d6"), // Glycomet SR 500
  new ObjectId("6802327519615d4417c321d7"), // Cetrizine Tablet (Cipla)
  new ObjectId("6802327519615d4417c321d8"), // Omez 20
  new ObjectId("6802327519615d4417c321d9"), // Pantocid DSR
  new ObjectId("6802327519615d4417c321da"), // Augmentin 625 Duo
  new ObjectId("6802327519615d4417c321db"), // Clavam 625
];

// --- Main Seeding Function ---
async function seedDatabase() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log("Connected to MongoDB!");
    const db = client.db(DB_NAME);

    // Get collections
    const medicines = db.collection("medicines"); // Still needed to verify IDs exist
    const warehouseStocks = db.collection("warehousestocks");
    const requirements = db.collection("requirements");
    const logistics = db.collection("logistics");
    const institutionStocks = db.collection("institutionstocks");

    // --- 1. Clear Existing Generated Data ---
    console.log(
      "Clearing previous seed data (stocks, requirements, logistics, institution stocks)..."
    );
    await warehouseStocks.deleteMany({});
    await requirements.deleteMany({});
    await logistics.deleteMany({});
    await institutionStocks.deleteMany({});

    // --- 3. Verify Embedded Medicine IDs Exist in DB ---
    console.log("Verifying embedded medicine IDs exist in the database...");
    // Ensure the medicines collection actually exists in the DB before counting
    const collections = await db
      .listCollections({ name: "medicines" })
      .toArray();
    if (collections.length === 0) {
      console.error(
        "Error: 'medicines' collection does not exist. Cannot verify IDs. Aborting seed."
      );
      return;
    }

    const existingMedicinesCount = await medicines.countDocuments({
      _id: { $in: availableMedicineIds },
    });

    if (existingMedicinesCount !== availableMedicineIds.length) {
      console.warn(
        `Warning: ${availableMedicineIds.length - existingMedicinesCount} embedded medicine ID(s) not found in the database. Seeding might use non-existent medicines.`
      );
      const actualExistingIds = (
        await medicines
          .find(
            { _id: { $in: availableMedicineIds } },
            { projection: { _id: 1 } }
          )
          .toArray()
      ).map((m) => m._id);
      if (actualExistingIds.length < 3) {
        console.error(
          "Error: Fewer than 3 required medicines exist in DB. Aborting seed."
        );
        return; // Stop if not enough verified medicines for key scenarios
      }
      console.log(
        `Proceeding with ${actualExistingIds.length} verified medicine IDs.`
      );
      // If you need to strictly use only existing ones later:
      // availableMedicineIds = actualExistingIds;
    } else {
      console.log(
        `All ${availableMedicineIds.length} embedded medicine IDs verified.`
      );
    }

    if (availableMedicineIds.length < 3) {
      // Check again after potential filtering, though the check inside the 'if' above might be sufficient
      console.warn(
        "Warning: Fewer than 3 available medicines for seeding complex scenarios."
      );
    }

    // --- 4. Create Warehouse Stock ---
    console.log("Creating Warehouse Stock...");
    const stocksToCreate = [];
    for (let i = 0; i < Math.min(5, availableMedicineIds.length); i++) {
      const medId = availableMedicineIds[i];
      const batches = [];
      const numBatches = randomInt(1, 3);
      for (let b = 0; b < numBatches; b++) {
        const price = randomInt(50, 500);
        const quantity = randomInt(50, 200);
        batches.push({
          batchName: `BATCH-${medId.toString().slice(-4)}-${b + 1}`,
          quantity: quantity,
          reservedQuantity: 0,
          mfgDate: pastDate(randomInt(180, 365)),
          expiryDate: futureDate(randomInt(365, 730)),
          packetSize: { strips: 10, tabletsPerStrip: 10 },
          purchasePrice: price * 0.8,
          sellingPrice: price * 1.1,
          mrp: price * 1.5,
          receivedDate: pastDate(randomInt(30, 90)),
          createdAt: pastDate(randomInt(30, 90)),
        });
      }
      stocksToCreate.push({
        warehouseId: specificWarehouse._id,
        medicineId: medId,
        stocks: batches,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    let insertedStocks = [];
    if (stocksToCreate.length > 0) {
      const stockResult = await warehouseStocks.insertMany(stocksToCreate);
      insertedStocks = await warehouseStocks
        .find({ _id: { $in: Object.values(stockResult.insertedIds) } })
        .toArray();
      console.log(
        `Created ${insertedStocks.length} Warehouse Stock documents.`
      );
    }

    // --- 5. Create Requirements ---
    console.log("Creating Requirements...");
    const requirementsToCreate = [];
    let req2ApprovedMed1 = null;
    let req2ApprovedMed2 = null;
    let req2ApprovedQty1 = 0;
    let req2ApprovedQty2 = 0;

    // Assign medicines for requirement 2 if available
    if (availableMedicineIds.length >= 1) {
      req2ApprovedMed1 = availableMedicineIds[0];
      req2ApprovedQty1 = 15;
    }
    if (availableMedicineIds.length >= 3) {
      req2ApprovedMed2 = availableMedicineIds[2];
      req2ApprovedQty2 = 25;
    } // Use index 2 if possible

    // Req 1: Pending (Needs at least 2 medicines)
    if (availableMedicineIds.length >= 2) {
      requirementsToCreate.push({
        institutionId: specificInstitution._id,
        warehouseId: specificWarehouse._id,
        medicines: [
          {
            medicineId: availableMedicineIds[0],
            requestedQuantity: 20,
            status: "Pending",
            approvedQuantity: 0,
          },
          {
            medicineId: availableMedicineIds[1],
            requestedQuantity: 30,
            status: "Pending",
            approvedQuantity: 0,
          },
        ],
        overallStatus: "Pending",
        logisticId: null,
        isDeleted: false,
        createdAt: pastDate(5),
        updatedAt: pastDate(5),
      });
      // Req 3: Rejected (Needs at least 2 medicines to use index 1)
      requirementsToCreate.push({
        institutionId: specificInstitution._id,
        warehouseId: specificWarehouse._id,
        medicines: [
          {
            medicineId: availableMedicineIds[1],
            requestedQuantity: 50,
            status: "Rejected",
            approvedQuantity: 0,
          },
        ],
        overallStatus: "Rejected",
        logisticId: null,
        isDeleted: false,
        createdAt: pastDate(3),
        updatedAt: pastDate(2),
      });
    } else {
      console.warn(
        "Skipping Pending/Rejected requirements creation due to insufficient distinct medicines (< 2)."
      );
    }

    // Req 2: Fully Approved (Needs the specific 2 medicines assigned above)
    if (req2ApprovedMed1 && req2ApprovedMed2) {
      requirementsToCreate.push({
        _id: new ObjectId(), // Pre-generate ID
        institutionId: specificInstitution._id,
        warehouseId: specificWarehouse._id,
        medicines: [
          {
            medicineId: req2ApprovedMed1,
            requestedQuantity: 20,
            status: "Approved",
            approvedQuantity: req2ApprovedQty1,
          },
          {
            medicineId: req2ApprovedMed2,
            requestedQuantity: 30,
            status: "Approved",
            approvedQuantity: req2ApprovedQty2,
          },
        ],
        overallStatus: "Fully Approved",
        logisticId: null,
        isDeleted: false,
        createdAt: pastDate(4),
        updatedAt: pastDate(3),
      });
    } else {
      console.warn(
        "Skipping Fully Approved requirement creation as < 3 distinct medicines available."
      );
    }

    let insertedRequirements = [];
    if (requirementsToCreate.length > 0) {
      const reqResult = await requirements.insertMany(requirementsToCreate);
      insertedRequirements = await requirements
        .find({ _id: { $in: Object.values(reqResult.insertedIds) } })
        .toArray();
      console.log(
        `Created ${insertedRequirements.length} Requirement documents.`
      );
    }
    const approvedRequirement = insertedRequirements.find(
      (r) => r.overallStatus === "Fully Approved"
    );

    // --- 6. Simulate Stock Reservation ---
    let qty1Reserved = 0;
    let qty2Reserved = 0; // Keep track if reservation happens
    if (
      approvedRequirement &&
      insertedStocks.length > 0 &&
      req2ApprovedMed1 &&
      req2ApprovedMed2
    ) {
      console.log("Simulating stock reservation for approved requirement...");
      // Reserve for first medicine
      const stockDoc1 = await warehouseStocks.findOne({
        warehouseId: specificWarehouse._id,
        medicineId: req2ApprovedMed1,
      });
      if (stockDoc1) {
        let remainingToReserve = req2ApprovedQty1;
        stockDoc1.stocks.sort((a, b) => a.createdAt - b.createdAt);
        for (const batch of stockDoc1.stocks) {
          if (remainingToReserve <= 0) break;
          const canReserve = Math.min(
            remainingToReserve,
            batch.quantity - batch.reservedQuantity
          );
          if (canReserve > 0) {
            batch.reservedQuantity += canReserve;
            remainingToReserve -= canReserve;
            qty1Reserved += canReserve;
          }
        }
        if (qty1Reserved > 0)
          await warehouseStocks.updateOne(
            { _id: stockDoc1._id },
            { $set: { stocks: stockDoc1.stocks } }
          );
      }
      // Reserve for second medicine
      const stockDoc2 = await warehouseStocks.findOne({
        warehouseId: specificWarehouse._id,
        medicineId: req2ApprovedMed2,
      });
      if (stockDoc2) {
        let remainingToReserve = req2ApprovedQty2;
        stockDoc2.stocks.sort((a, b) => a.createdAt - b.createdAt);
        for (const batch of stockDoc2.stocks) {
          if (remainingToReserve <= 0) break;
          const canReserve = Math.min(
            remainingToReserve,
            batch.quantity - batch.reservedQuantity
          );
          if (canReserve > 0) {
            batch.reservedQuantity += canReserve;
            remainingToReserve -= canReserve;
            qty2Reserved += canReserve;
          }
        }
        if (qty2Reserved > 0)
          await warehouseStocks.updateOne(
            { _id: stockDoc2._id },
            { $set: { stocks: stockDoc2.stocks } }
          );
      }
      console.log(
        `Reserved ${qty1Reserved}/${req2ApprovedQty1} for Med1, ${qty2Reserved}/${req2ApprovedQty2} for Med2.`
      );
    }

    // --- 7. Create Logistic & 8. Simulate Receiving ---
    // Combine into one block, only proceed if approvedRequirement exists and reservation was attempted
    if (approvedRequirement && (qty1Reserved > 0 || qty2Reserved > 0)) {
      // Proceed if *any* stock was successfully reserved
      console.log("Creating Logistic for approved requirement...");
      const logisticMedicines = [];
      let shipmentStatus = "Shipped";

      // Med 1 Shipment Prep
      let shippedQty1 = 0;
      const batches1 = [];
      if (qty1Reserved > 0) {
        // Check if reservation happened for this med
        const stockDoc1 = await warehouseStocks.findOne({
          warehouseId: specificWarehouse._id,
          medicineId: req2ApprovedMed1,
        }); // Re-fetch latest
        if (stockDoc1) {
          let remainingToShip = qty1Reserved;
          stockDoc1.stocks.sort((a, b) => a.createdAt - b.createdAt);
          for (const batch of stockDoc1.stocks) {
            if (remainingToShip <= 0) break;
            const canShip = Math.min(
              remainingToShip,
              batch.reservedQuantity,
              batch.quantity
            );
            if (canShip > 0) {
              batches1.push({
                batchNumber: batch.batchName,
                expiryDate: batch.expiryDate,
                quantity: canShip,
                packetSize: batch.packetSize,
                sellingPrice: batch.sellingPrice,
                mrp: batch.mrp,
              });
              batch.quantity -= canShip;
              batch.reservedQuantity -= canShip;
              remainingToShip -= canShip;
              shippedQty1 += canShip;
            }
          }
          if (shippedQty1 > 0) {
            logisticMedicines.push({
              medicine: req2ApprovedMed1,
              stocks: batches1,
            });
            await warehouseStocks.updateOne(
              { _id: stockDoc1._id },
              { $set: { stocks: stockDoc1.stocks } }
            );
          }
        }
      }
      if (shippedQty1 < req2ApprovedQty1) shipmentStatus = "Partially Shipped"; // Mark partial if not fully shipped

      // Med 2 Shipment Prep
      let shippedQty2 = 0;
      const batches2 = [];
      if (qty2Reserved > 0) {
        // Check if reservation happened for this med
        const stockDoc2 = await warehouseStocks.findOne({
          warehouseId: specificWarehouse._id,
          medicineId: req2ApprovedMed2,
        }); // Re-fetch latest
        if (stockDoc2) {
          let remainingToShip = qty2Reserved;
          stockDoc2.stocks.sort((a, b) => a.createdAt - b.createdAt);
          for (const batch of stockDoc2.stocks) {
            if (remainingToShip <= 0) break;
            const canShip = Math.min(
              remainingToShip,
              batch.reservedQuantity,
              batch.quantity
            );
            if (canShip > 0) {
              batches2.push({
                batchNumber: batch.batchName,
                expiryDate: batch.expiryDate,
                quantity: canShip,
                packetSize: batch.packetSize,
                sellingPrice: batch.sellingPrice,
                mrp: batch.mrp,
              });
              batch.quantity -= canShip;
              batch.reservedQuantity -= canShip;
              remainingToShip -= canShip;
              shippedQty2 += canShip;
            }
          }
          if (shippedQty2 > 0) {
            logisticMedicines.push({
              medicine: req2ApprovedMed2,
              stocks: batches2,
            });
            await warehouseStocks.updateOne(
              { _id: stockDoc2._id },
              { $set: { stocks: stockDoc2.stocks } }
            );
          }
        }
      }
      if (shippedQty2 < req2ApprovedQty2) shipmentStatus = "Partially Shipped"; // Mark partial if not fully shipped

      if (logisticMedicines.length > 0) {
        const newLogistic = {
          _id: new ObjectId(),
          shipmentId: `SHP${Date.now()}`,
          requirementId: approvedRequirement._id,
          warehouse: specificWarehouse._id,
          institution: specificInstitution._id,
          medicines: logisticMedicines,
          vehicles: [
            {
              vehicleNumber: `UP${randomInt(10, 99)} AB ${randomInt(1000, 9999)}`,
              driverName: "Rajesh Kumar",
              driverContact: "9876543210",
              timestamps: { loadedAt: pastDate(1), departedAt: pastDate(1) },
            },
          ],
          status: "In Transit",
          receivedStatus: "Pending",
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const logisticResult = await logistics.insertOne(newLogistic);
        console.log("Created Logistic document:", logisticResult.insertedId);
        await requirements.updateOne(
          { _id: approvedRequirement._id },
          {
            $set: {
              logisticId: logisticResult.insertedId,
              overallStatus: shipmentStatus,
            },
          }
        );
        console.log(
          "Updated Requirement with Logistic ID and status:",
          shipmentStatus
        );

        // --- Simulate Receiving ---
        const logisticToReceive = newLogistic; // Use the just created logistic
        console.log("Simulating receipt of shipment...");
        await logistics.updateOne(
          { _id: logisticToReceive._id },
          {
            $set: {
              status: "Delivered",
              receivedStatus: "Received",
              "vehicles.0.timestamps.arrivedAt": new Date(),
              updatedAt: new Date(),
            },
          }
        );
        await requirements.updateOne(
          { _id: logisticToReceive.requirementId },
          { $set: { overallStatus: "Received" } }
        );
        const receivedDate = new Date();
        for (const shippedMed of logisticToReceive.medicines) {
          const medId = shippedMed.medicine;
          let instStock = await institutionStocks.findOne({
            institutionId: specificInstitution._id,
            medicineId: medId,
          });
          const newStockBatches = shippedMed.stocks.map((batch) => ({
            warehouseId: logisticToReceive.warehouse,
            batchName: batch.batchNumber,
            expiryDate: batch.expiryDate,
            packetSize: batch.packetSize,
            quantityReceived: batch.quantity,
            quantity: {
              totalStrips: batch.quantity,
              boxes: 0,
              extra: 0,
              tablets: 0,
            },
            purchasePrice: batch.sellingPrice,
            mrp: batch.mrp,
            receivedDate: receivedDate,
            createdAt: new Date(),
          }));
          if (!instStock) {
            await institutionStocks.insertOne({
              institutionId: specificInstitution._id,
              medicineId: medId,
              stocks: newStockBatches,
              isDeleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } else {
            await institutionStocks.updateOne(
              { _id: instStock._id },
              {
                $push: { stocks: { $each: newStockBatches } },
                $set: { updatedAt: new Date() },
              }
            );
          }
        }
        console.log(
          "Updated Logistic, Requirement statuses to Received and updated Institution Stock."
        );
      } else {
        console.warn(
          "Could not create logistic as no stock could be shipped (check reservation simulation)."
        );
      }
    } else {
      console.log(
        "Skipping Logistic creation as reservation failed or no suitable approved requirement found."
      );
    }

    console.log("Database seeding completed successfully!");
  } catch (err) {
    console.error("Error during database seeding:", err);
  } finally {
    await client.close();
    console.log("MongoDB connection closed.");
  }
}

seedDatabase();
