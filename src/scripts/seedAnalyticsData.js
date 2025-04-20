import { faker } from "@faker-js/faker";
// import bcrypt from "bcrypt"; // Removed unused import
import dotenv from "dotenv";
import mongoose from "mongoose";

// --- Model Imports ---
// Assuming models are in ../models/ and export correctly
import { Institution } from "../models/institution.model.js";
import { InstitutionStock } from "../models/institutionStock.model.js"; // Adjust filename if needed
import { Logistic } from "../models/logistic.model.js"; // Adjust filename if needed
import { Manufacturer } from "../models/Manufacturer.model.js";
import { Medicine } from "../models/medicine.model.js";
import { Requirement } from "../models/requirement.model.js"; // Adjust filename if needed
import { Salt } from "../models/salt.model.js";
import { Warehouse } from "../models/warehouse.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js"; // Adjust filename if needed
import { WarehouseReceiptLog } from "../models/warehouseReceiptLog.model.js"; // Added import
import { InstitutionUsageLog } from "../models/institutionUsageLog.model.js"; // Added import
import { USER_TYPES } from "../utils/constants.js";
// Load environment variables from .env file in the project root
dotenv.config();

// --- Configuration ---
const MONGODB_URI = process.env.MONGODB_URI;
// const DB_NAME = process.env.DB_NAME; // Removed unused constant
const DEFAULT_PASSWORD = "Password@123"; // Use a secure default or generate per user
const BATCH_SIZE = 50; // For inserting large amounts of data

// Number of documents to generate
const NUM_SALTS = 75;
const NUM_MANUFACTURERS = 25;
const NUM_MEDICINES = 100;
const NUM_INSTITUTIONS = 50;
const NUM_WAREHOUSES = 50;
const NUM_WAREHOUSE_STOCK_ENTRIES_PER_MED = 3; // Avg batches per medicine per warehouse
const NUM_REQUIREMENTS = 500;
const NUM_LOGISTICS_PERCENTAGE = 0.6; // % of 'Shipped'/'Delivered' requirements that have logistics

// A known Admin User ID (replace if necessary, or fetch/create one)
// Ensure this Admin user exists in your database beforehand.
const ADMIN_USER_ID = new mongoose.Types.ObjectId("6804e1815612845885af511c"); // From seedDb.js

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable must be set.");
  process.exit(1);
}

// --- Helper Functions ---
const indianLocations = [
  // Using the list from seedData.js
  {
    city: "Lucknow",
    district: "Lucknow",
    state: "Uttar Pradesh",
    pincode: "226001",
  },
  {
    city: "Kanpur",
    district: "Kanpur",
    state: "Uttar Pradesh",
    pincode: "208001",
  },
  {
    city: "Varanasi",
    district: "Varanasi",
    state: "Uttar Pradesh",
    pincode: "221001",
  },
  { city: "Agra", district: "Agra", state: "Uttar Pradesh", pincode: "282001" },
  {
    city: "Prayagraj",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    pincode: "211001",
  },
  { city: "Jaipur", district: "Jaipur", state: "Rajasthan", pincode: "302001" },
  {
    city: "Ahmedabad",
    district: "Ahmedabad",
    state: "Gujarat",
    pincode: "380001",
  },
  {
    city: "Mumbai",
    district: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
  },
  { city: "Delhi", district: "New Delhi", state: "Delhi", pincode: "110001" },
  {
    city: "Kolkata",
    district: "Kolkata",
    state: "West Bengal",
    pincode: "700001",
  },
  {
    city: "Bengaluru",
    district: "Bengaluru Urban",
    state: "Karnataka",
    pincode: "560001",
  },
  {
    city: "Chennai",
    district: "Chennai",
    state: "Tamil Nadu",
    pincode: "600001",
  },
  {
    city: "Hyderabad",
    district: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
  },
  { city: "Pune", district: "Pune", state: "Maharashtra", pincode: "411001" },
];

const generateIndianGPS = () => ({
  lat: faker.location.latitude({ min: 8.4, max: 37.6 }),
  lng: faker.location.longitude({ min: 68.7, max: 97.25 }),
});

const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomSubarray = (arr, min = 1, max = arr.length) => {
  const count = faker.number.int({ min, max: Math.min(max, arr.length) });
  return faker.helpers.shuffle(arr).slice(0, count);
};

const pastDate = (days) => faker.date.past({ years: days / 365 });
const futureDate = (days) => faker.date.future({ years: days / 365 });
const randomDateInRange = (start, end) =>
  faker.date.between({ from: start, to: end });

const insertInBatches = async (Model, data, batchSize = BATCH_SIZE) => {
  let insertedCount = 0;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    try {
      const result = await Model.insertMany(batch, { ordered: false }); // Continue on error
      insertedCount += result.length;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        console.warn(
          `Warning: Some duplicate entries were skipped during batch insert for ${Model.modelName}.`
        );
        // Attempt to insert one by one, skipping duplicates
        for (const item of batch) {
          try {
            await Model.create(item);
            insertedCount++;
          } catch (singleError) {
            if (singleError.code !== 11000) {
              console.error(
                `Error inserting single item for ${Model.modelName}:`,
                singleError.message
              );
              // Log validation errors specifically
              if (singleError.name === "ValidationError") {
                console.error(
                  "Validation Errors:",
                  JSON.stringify(singleError.errors, null, 2)
                );
              }
            }
          }
        }
      } else {
        console.error(
          `Error inserting batch for ${Model.modelName}:`,
          error.message
        );
        // Log validation errors specifically
        if (error.name === "ValidationError") {
          console.error(
            "Validation Errors:",
            JSON.stringify(error.errors, null, 2)
          );
        }
        // Also log bulk write errors if available
        if (error.name === "MongoBulkWriteError" && error.writeErrors) {
          console.error(
            "Bulk Write Errors:",
            JSON.stringify(error.writeErrors, null, 2)
          );
        }
      }
    }
  }
  return insertedCount;
};

// --- Data Generation Functions ---

const generateSalts = (count) => {
  const salts = [];
  const saltNames = new Set(); // Avoid duplicate names
  while (salts.length < count) {
    const name =
      faker.science.chemicalElement().name +
      (Math.random() > 0.5 ? " " + faker.science.chemicalElement().symbol : "");
    if (!saltNames.has(name)) {
      saltNames.add(name);
      salts.push({
        name: name,
        useCase: faker.lorem.sentence(5),
        createdByRole: USER_TYPES.ADMIN,
        createdBy: ADMIN_USER_ID,
      });
    }
  }
  return salts;
};

const generateManufacturers = (count) => {
  const manufacturers = [];
  const manuNames = new Set();
  while (manufacturers.length < count) {
    const name = faker.company.name() + " Ltd.";
    if (!manuNames.has(name)) {
      manuNames.add(name);
      manufacturers.push({
        name: name,
        medicalRepresentator: {
          name: faker.person.fullName(),
          contact: faker.number.int({ min: 9000000000, max: 9999999999 }),
        },
        createdByRole: USER_TYPES.ADMIN,
        createdBy: ADMIN_USER_ID,
      });
    }
  }
  return manufacturers;
};

const generateMedicines = (count, saltIds, manufacturerIds) => {
  const medicines = [];
  const medNames = new Set();
  const types = [
    "Tablet",
    "Capsule",
    "Syrup",
    "Injection",
    "Ointment",
    "Drops",
  ];

  while (medicines.length < count) {
    const name =
      faker.commerce.productName() +
      " " +
      faker.number.int({ min: 50, max: 1000 }) +
      (Math.random() > 0.5 ? "mg" : "ml");
    if (!medNames.has(name)) {
      medNames.add(name);
      const type = randomElement(types);
      medicines.push({
        name: name,
        salts: randomSubarray(saltIds, 1, 3).map((s) => s._id), // Link 1-3 salts
        manufacturer: randomElement(manufacturerIds)._id, // Link 1 manufacturer
        isTablets: type === "Tablet" || type === "Capsule",
        medicineType: type,
        createdByRole: USER_TYPES.ADMIN,
        createdBy: ADMIN_USER_ID,
        // Add other fields if necessary based on Medicine model
      });
    }
  }
  return medicines;
};

const generateInstitutions = async (count) => {
  const institutions = [];
  // const hashedPassword = await hashPassword(DEFAULT_PASSWORD); // Removed: Hashing handled by Mongoose pre-save hook

  for (let i = 0; i < count; i++) {
    const location = randomElement(indianLocations);
    const status = faker.helpers.arrayElement([
      "pending",
      "verified",
      "rejected",
    ]);
    institutions.push({
      institutionCode: `INST${String(i + 100).padStart(4, "0")}`, // Ensure unique codes
      name: `${location.city} ${faker.company.name()} ${faker.helpers.arrayElement(["Hospital", "Clinic", "Medical Center"])} ${i + 1}`, // Add index for uniqueness
      email: faker.internet.email({ provider: "hospital.org" }).toLowerCase(), // Use .org TLD (3 chars) to pass validation
      password: DEFAULT_PASSWORD, // Use plain password, hook will hash
      registrationNumber: `HOSPI/${location.state.substring(0, 2).toUpperCase()}/2024/${String(100 + i).padStart(4, "0")}`,
      location: {
        address: faker.location.streetAddress(),
        city: location.city,
        district: location.district,
        state: location.state,
        pincode: location.pincode,
        gpsCoordinates: generateIndianGPS(),
      },
      incharge: Array.from(
        { length: faker.number.int({ min: 1, max: 2 }) },
        () => ({
          name: `Dr. ${faker.person.fullName()}`,
          contact: faker.helpers.fromRegExp(/9[0-9]{9}/),
          email: faker.internet.email().toLowerCase(),
        })
      ),
      verificationStatus: status,
      verificationRejectedReason:
        status === "rejected" ? faker.lorem.sentence() : null,
      createdAt: pastDate(90),
      updatedAt: pastDate(10),
    });
  }
  return institutions;
};

const generateWarehouses = async (count) => {
  const warehouses = [];
  // const hashedPassword = await hashPassword(DEFAULT_PASSWORD); // Removed: Hashing handled by Mongoose pre-save hook

  for (let i = 0; i < count; i++) {
    const location = randomElement(indianLocations);
    const status = faker.helpers.arrayElement([
      "pending",
      "verified",
      "rejected",
    ]);
    warehouses.push({
      warehouseCode: `WH${String(i + 100).padStart(4, "0")}`, // Ensure unique codes
      name: `${location.city} Central Medical Warehouse ${i + 1}`,
      email: faker.internet
        .email({ firstName: `wh${i + 100}`, provider: "medlogix.org" })
        .toLowerCase(),
      password: DEFAULT_PASSWORD, // Use plain password, hook will hash
      registrationNumber: `WH/${location.state.substring(0, 2).toUpperCase()}/2024/${String(100 + i).padStart(4, "0")}`,
      location: {
        address: faker.location.streetAddress(),
        city: location.city,
        district: location.district,
        state: location.state,
        pincode: location.pincode,
        gpsCoordinates: generateIndianGPS(),
      },
      managers: Array.from(
        { length: faker.number.int({ min: 1, max: 2 }) },
        () => ({
          name: faker.person.fullName(),
          contact: faker.helpers.fromRegExp(/9[0-9]{9}/),
          email: faker.internet.email().toLowerCase(),
        })
      ),
      verificationStatus: status,
      verificationRejectedReason:
        status === "rejected" ? faker.lorem.sentence() : null,
      createdAt: pastDate(120),
      updatedAt: pastDate(15),
    });
  }
  return warehouses;
};

// Refactored: Generates an array of individual batch addition events
const generateWarehouseBatchEvents = (
  warehouseIds,
  medicineIds,
  numEntriesPerMed
) => {
  if (
    !warehouseIds ||
    warehouseIds.length === 0 ||
    !medicineIds ||
    medicineIds.length === 0
  ) {
    console.warn(
      "Skipping Warehouse Stock generation: No warehouses or medicines provided."
    );
    return [];
  }
  const batchEvents = [];
  warehouseIds.forEach((wh) => {
    medicineIds.forEach((med) => {
      if (Math.random() < 0.7) {
        // 70% chance warehouse stocks this medicine
        const numBatchesToGenerate = faker.number.int({
          min: 1,
          max: numEntriesPerMed,
        });
        for (let b = 0; b < numBatchesToGenerate; b++) {
          const mfg = pastDate(365 * 2);
          const expiry = futureDate(365 * 3);
          const purchasePrice = faker.number.float({
            min: 10,
            max: 500,
            precision: 0.01,
          });
          const quantity = faker.number.int({ min: 50, max: 5000 });

          // Generate details for ONE batch
          const batchData = {
            // Generate batchName here or potentially in the insertion logic if needed
            batchName: `B-${med.name.substring(0, 3).toUpperCase()}-${faker.string.alphanumeric(6).toUpperCase()}`,
            quantity: quantity,
            reservedQuantity: 0, // Initial reservation is 0
            mfgDate: mfg,
            expiryDate: expiry,
            packetSize: {
              strips: faker.number.int({ min: 1, max: 10 }),
              tabletsPerStrip: faker.number.int({ min: 5, max: 20 }),
            },
            purchasePrice: purchasePrice,
            sellingPrice:
              purchasePrice *
              faker.number.float({ min: 1.1, max: 1.5, precision: 0.01 }),
            mrp:
              purchasePrice *
              faker.number.float({ min: 1.5, max: 2.5, precision: 0.01 }),
            receivedDate: randomDateInRange(mfg, new Date()),
            createdAt: new Date(),
          };

          // Push an event object containing warehouse, medicine, and the single batch data
          batchEvents.push({
            warehouseId: wh._id,
            medicineId: med._id,
            batch: batchData,
          });
        }
      }
    });
  });
  return batchEvents;
};

const generateRequirements = (
  count,
  institutionIds,
  warehouseIds,
  medicineIds
) => {
  // Add check for empty inputs
  if (
    !institutionIds ||
    institutionIds.length === 0 ||
    !warehouseIds ||
    warehouseIds.length === 0 ||
    !medicineIds ||
    medicineIds.length === 0
  ) {
    console.warn(
      "Skipping Requirements generation: No institutions, warehouses, or medicines provided."
    );
    return [];
  }
  const requirements = [];
  const statuses = [
    "Pending",
    "Fully Approved",
    "Partially Approved",
    "Rejected",
    "Shipped",
    "Partially Shipped",
    "Received",
  ];

  for (let i = 0; i < count; i++) {
    const institution = randomElement(institutionIds);
    const warehouse = randomElement(warehouseIds);
    const numMedicines = faker.number.int({ min: 1, max: 5 });
    const reqMedicines = [];
    const selectedMeds = randomSubarray(
      medicineIds,
      numMedicines,
      numMedicines
    );

    const overallStatus = randomElement(statuses);
    let allApproved = true;
    let someApproved = false;

    selectedMeds.forEach((med) => {
      const requested = faker.number.int({ min: 10, max: 200 });
      let status = "Pending";
      let approved = 0;

      switch (overallStatus) {
        case "Pending":
          status = "Pending";
          approved = 0;
          allApproved = false;
          break;
        case "Rejected":
          status = "Rejected";
          approved = 0;
          allApproved = false;
          break;
        case "Fully Approved":
        case "Shipped":
        case "Received":
          status = "Approved";
          approved = requested;
          someApproved = true;
          break;
        case "Partially Approved":
        case "Partially Shipped": {
          // Randomly approve, reject or partially approve each item
          const itemOutcome = Math.random();
          if (itemOutcome < 0.6) {
            // Approved
            status = "Approved";
            approved = requested;
            someApproved = true;
          } else if (itemOutcome < 0.8) {
            // Partially Approved
            status = "Approved";
            approved = faker.number.int({ min: 1, max: requested - 1 });
            someApproved = true;
            allApproved = false;
          } else {
            // Rejected
            status = "Rejected";
            approved = 0;
            allApproved = false;
          }
          break;
        } // Added block scope here
      }

      reqMedicines.push({
        medicineId: med._id,
        requestedQuantity: requested,
        status: status,
        approvedQuantity: approved,
        // _id: new mongoose.Types.ObjectId() // Mongoose adds this by default
      });
    });

    // Adjust overallStatus based on individual items if it was Partial
    let finalOverallStatus = overallStatus;
    if (
      overallStatus === "Partially Approved" ||
      overallStatus === "Partially Shipped"
    ) {
      if (allApproved)
        finalOverallStatus =
          overallStatus === "Partially Approved" ? "Fully Approved" : "Shipped";
      else if (!someApproved) finalOverallStatus = "Rejected";
      // else keep it as Partial
    }

    requirements.push({
      // _id: new mongoose.Types.ObjectId(), // Mongoose adds this automatically
      institutionId: institution._id,
      warehouseId: warehouse._id,
      medicines: reqMedicines,
      overallStatus: finalOverallStatus,
      logisticId: null, // Will be updated later for relevant statuses
      isDeleted: false,
      createdAt: pastDate(60),
      updatedAt: pastDate(5),
    });
  }
  return requirements;
};

const generateLogistics = (
  requirements /* warehouseStocks - No longer needed directly here */
) => {
  // Add check for empty inputs
  if (!requirements || requirements.length === 0) {
    console.warn("Skipping Logistics generation: No requirements provided.");
    return [];
  }
  const logistics = [];
  const relevantRequirements = requirements.filter((r) =>
    ["Shipped", "Partially Shipped", "Received"].includes(r.overallStatus)
  );
  const numLogistics = Math.floor(
    relevantRequirements.length * NUM_LOGISTICS_PERCENTAGE
  );

  // We need warehouse stock info eventually, but maybe fetch it dynamically
  // For simplicity in seeding, we will generate placeholder batch details if needed.
  // A more accurate simulation would query actual warehouse stock state *before* generating logistics.

  faker.helpers
    .shuffle(relevantRequirements)
    .slice(0, numLogistics)
    .forEach((req) => {
      const logisticMedicines = [];
      let logisticStatus =
        req.overallStatus === "Received" ? "Delivered" : "In Transit"; // Match status
      let receivedStatus =
        req.overallStatus === "Received" ? "Received" : "Pending";

      req.medicines.forEach((medReq) => {
        if (medReq.status === "Approved" && medReq.approvedQuantity > 0) {
          // Simplified: Generate placeholder batch details for the logistic record.
          // In a real scenario, this data would come from the actual warehouse stock batches allocated.
          const placeholderBatch = {
            batchNumber: `SHIP-B-${faker.string.alphanumeric(6).toUpperCase()}`,
            expiryDate: futureDate(365 * 2), // Example future expiry
            quantity: medReq.approvedQuantity, // Assume approved qty is shipped in one logical batch for seeding
            packetSize: { strips: 10, tabletsPerStrip: 10 }, // Example
            sellingPrice: faker.number.float({
              min: 20,
              max: 600,
              precision: 0.01,
            }), // Example pricing
            mrp: faker.number.float({ min: 30, max: 800, precision: 0.01 }), // Example MRP
          };

          logisticMedicines.push({
            medicine: medReq.medicineId,
            stocks: [placeholderBatch], // Seeding simplified to one batch per med in logistic
          });
        }
      });

      if (logisticMedicines.length === 0) return; // Skip if no approved meds for this req

      const loadedAt = randomDateInRange(req.createdAt, new Date());
      const departedAt = randomDateInRange(loadedAt, new Date());
      const arrivedAt =
        req.overallStatus === "Received"
          ? randomDateInRange(departedAt, new Date())
          : null;

      const logistic = {
        _id: new mongoose.Types.ObjectId(), // Pre-generate ID to link in requirement
        shipmentId: `SHP-${faker.string.alphanumeric(8).toUpperCase()}`,
        requirementId: req._id,
        warehouse: req.warehouseId,
        institution: req.institutionId,
        medicines: logisticMedicines,
        vehicles: [
          {
            vehicleNumber: `${randomElement(["UP", "DL", "MH", "KA", "TN"])}${faker.number.int({ min: 10, max: 99 })} ${faker.string.alpha(2).toUpperCase()} ${faker.number.int({ min: 1000, max: 9999 })}`,
            driverName: faker.person.fullName(),
            driverContact: faker.helpers.fromRegExp(/9[0-9]{9}/),
            timestamps: { loadedAt, departedAt, arrivedAt },
          },
        ],
        status: logisticStatus,
        receivedStatus: receivedStatus,
        isDeleted: false,
        createdAt: req.createdAt, // Align creation roughly
        updatedAt: arrivedAt || departedAt,
      };
      logistics.push(logistic);

      // Link logistic ID back to requirement (prepare for update)
      req.logisticId = logistic._id;
    });

  return logistics;
};

// --- Main Seeding Function ---
async function seedDatabase() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB!");

  try {
    console.log("\n--- Clearing Existing Data ---");
    const modelsToClear = [
      Logistic,
      Requirement,
      InstitutionStock,
      WarehouseStock,
      Medicine,
      Manufacturer,
      Salt,
      Institution,
      Warehouse,
    ];
    for (const Model of modelsToClear) {
      console.log(`Clearing ${Model.modelName}...`);
      await Model.deleteMany({});
    }
    console.log("Existing analytics-related data cleared.");

    // --- Generate Base Data ---
    console.log("\n--- Generating Base Data ---");
    const saltsData = generateSalts(NUM_SALTS);
    const manufacturersData = generateManufacturers(NUM_MANUFACTURERS);
    console.log(
      `Generated ${saltsData.length} salts, ${manufacturersData.length} manufacturers.`
    );

    console.log("Inserting Salts...");
    const insertedSalts = await Salt.insertMany(saltsData);
    console.log(`Inserted ${insertedSalts.length} Salts.`);

    console.log("Inserting Manufacturers...");
    const insertedManufacturers =
      await Manufacturer.insertMany(manufacturersData);
    console.log(`Inserted ${insertedManufacturers.length} Manufacturers.`);

    const medicinesData = generateMedicines(
      NUM_MEDICINES,
      insertedSalts,
      insertedManufacturers
    );
    console.log(`Generated ${medicinesData.length} medicines.`);
    console.log("Inserting Medicines (in batches)...");
    const insertedMedicinesCount = await insertInBatches(
      Medicine,
      medicinesData
    ); // Use batch helper
    console.log(`Inserted ${insertedMedicinesCount} Medicines.`);
    if (insertedMedicinesCount === 0 && medicinesData.length > 0) {
      console.error(
        "\nCRITICAL: Failed to insert any Medicines. Check errors above. Aborting."
      );
      process.exit(1);
    }
    const insertedMedicines =
      insertedMedicinesCount > 0
        ? await Medicine.find().limit(NUM_MEDICINES).lean()
        : [];

    // --- Generate Institutions and Warehouses ---
    console.log("\n--- Generating Institutions & Warehouses ---");
    const institutionsData = await generateInstitutions(NUM_INSTITUTIONS);
    const warehousesData = await generateWarehouses(NUM_WAREHOUSES);
    console.log(
      `Generated ${institutionsData.length} institutions, ${warehousesData.length} warehouses.`
    );

    console.log("Inserting Institutions (in batches)...");
    const insertedInstitutionsCount = await insertInBatches(
      Institution,
      institutionsData
    );
    console.log(`Inserted ${insertedInstitutionsCount} Institutions.`);

    if (insertedInstitutionsCount === 0 && institutionsData.length > 0) {
      console.error(
        "\nCRITICAL: Failed to insert any Institutions. Check errors above. Aborting."
      );
      process.exit(1);
    }
    // Use the successfully inserted ones directly (convert to plain objects if needed later)
    const insertedInstitutions =
      insertedInstitutionsCount > 0
        ? await Institution.find().limit(NUM_INSTITUTIONS).lean()
        : [];

    console.log("Inserting Warehouses (in batches)...");
    const insertedWarehousesCount = await insertInBatches(
      Warehouse,
      warehousesData
    );
    console.log(`Inserted ${insertedWarehousesCount} Warehouses.`);
    if (insertedWarehousesCount === 0 && warehousesData.length > 0) {
      console.error(
        "\nCRITICAL: Failed to insert any Warehouses. Check errors above. Aborting."
      );
      process.exit(1);
    }
    const insertedWarehouses =
      insertedWarehousesCount > 0
        ? await Warehouse.find().limit(NUM_WAREHOUSES).lean()
        : [];

    // --- Generate and Process Warehouse Stock Events ---
    console.log("\n--- Generating Warehouse Stock Events ---");
    const warehouseBatchEvents = generateWarehouseBatchEvents(
      insertedWarehouses,
      insertedMedicines,
      NUM_WAREHOUSE_STOCK_ENTRIES_PER_MED
    );
    console.log(
      `Generated ${warehouseBatchEvents.length} warehouse batch addition events.`
    );

    console.log(
      "Processing Warehouse Stock Events (Upserting batches & creating logs)..."
    );
    let processedWHStockCount = 0;
    const warehouseStockPromises = warehouseBatchEvents.map(async (event) => {
      try {
        // Find existing stock doc or prepare for upsert
        const updateResult = await WarehouseStock.findOneAndUpdate(
          {
            warehouseId: event.warehouseId,
            medicineId: event.medicineId,
            isDeleted: false,
          },
          {
            $push: { stocks: event.batch }, // Push the single batch
            $setOnInsert: {
              // Fields to set only if creating (upserting)
              warehouseId: event.warehouseId,
              medicineId: event.medicineId,
              isDeleted: false,
              createdAt: new Date(),
            },
          },
          {
            upsert: true, // Create doc if it doesn't exist
            new: true, // Return the modified document (optional)
            // session: session // Add if you want to run this in a transaction
          }
        );

        if (updateResult) {
          // Create corresponding receipt log
          await WarehouseReceiptLog.create({
            warehouseId: event.warehouseId,
            medicineId: event.medicineId,
            batchName: event.batch.batchName,
            mfgDate: event.batch.mfgDate,
            expiryDate: event.batch.expiryDate,
            purchasePrice: event.batch.purchasePrice,
            sellingPrice: event.batch.sellingPrice,
            mrp: event.batch.mrp,
            receivedDate: event.batch.receivedDate,
            type: "purchase", // This simulates initial stock addition
            quantity: event.batch.quantity,
            // session: session // Add if using transactions
          });
          processedWHStockCount++;
        }
      } catch (error) {
        console.error(
          `Error processing warehouse stock event for Med: ${event.medicineId}, Wh: ${event.warehouseId}, Batch: ${event.batch.batchName}:`,
          error.message
        );
        // Log validation errors if needed
        if (error.name === "ValidationError") {
          console.error(
            "Validation Errors:",
            JSON.stringify(error.errors, null, 2)
          );
        }
      }
    });

    await Promise.all(warehouseStockPromises); // Wait for all updates/creations
    console.log(
      `Processed ${processedWHStockCount} Warehouse Stock batch events (created/updated docs & logs).`
    );

    // --- Generate Requirements ---
    console.log("\n--- Generating Requirements ---");
    // Fetch inserted stock info if needed by generateRequirements, otherwise pass IDs
    // const insertedWHStock = await WarehouseStock.find().limit(5000).lean(); // Example fetch if needed
    const requirementsData = generateRequirements(
      NUM_REQUIREMENTS,
      insertedInstitutions,
      insertedWarehouses,
      insertedMedicines
    );
    console.log(`Generated ${requirementsData.length} requirements.`);
    console.log("Inserting Requirements (in batches)...");
    const insertedReqsCount = await insertInBatches(
      Requirement,
      requirementsData
    );
    console.log(`Inserted ${insertedReqsCount} Requirement documents.`);
    const insertedReqs =
      insertedReqsCount > 0
        ? await Requirement.find().limit(NUM_REQUIREMENTS).lean()
        : [];

    // --- Generate Logistics ---
    console.log("\n--- Generating Logistics ---");
    // Pass insertedReqs, no longer need to pass warehouseStock directly
    const logisticsData = generateLogistics(insertedReqs);
    console.log(`Generated ${logisticsData.length} logistics records.`);

    if (logisticsData.length > 0) {
      console.log("Inserting Logistics (in batches)...");
      const insertedLogisticsCount = await insertInBatches(
        Logistic,
        logisticsData
      );
      console.log(`Inserted ${insertedLogisticsCount} Logistic documents.`);

      // --- Update Requirements with Logistic IDs ---
      console.log("Updating Requirements with Logistic IDs...");
      const bulkOps = logisticsData.map((log) => ({
        updateOne: {
          filter: { _id: log.requirementId },
          update: { $set: { logisticId: log._id } },
        },
      }));
      if (bulkOps.length > 0) {
        await Requirement.bulkWrite(bulkOps);
        console.log(
          `Updated ${bulkOps.length} requirements with their logistic IDs.`
        );
      }
    }

    // --- Process Received Shipments & Create Institution Stock/Logs ---
    console.log(
      "\n--- Processing Received Shipments (Updating InstStock & creating logs) ---"
    );
    // const institutionStockData = []; // Old logic removed
    const receivedReqs = insertedReqs.filter(
      (r) => r.overallStatus === "Received" && r.logisticId
    );
    console.log(
      `Found ${receivedReqs.length} requirements marked as 'Received' to process.`
    );

    let processedInstStockCount = 0;
    const institutionStockPromises = [];

    receivedReqs.forEach((req) => {
      const logistic = logisticsData.find((l) => l._id.equals(req.logisticId));
      if (!logistic) {
        console.warn(
          `Logistic record not found for received requirement ${req._id}, skipping InstStock update.`
        );
        return;
      }

      logistic.medicines.forEach((logMed) => {
        logMed.stocks.forEach((batch) => {
          // For each batch received, create an update promise
          const promise = (async () => {
            try {
              // Find existing stock doc or prepare for upsert
              const instStockUpdateResult =
                await InstitutionStock.findOneAndUpdate(
                  {
                    institutionId: req.institutionId,
                    medicineId: logMed.medicine,
                    isDeleted: false,
                  },
                  {
                    $push: {
                      stocks: {
                        // Push the single received batch details
                        warehouseId: logistic.warehouse,
                        batchName: batch.batchNumber,
                        expiryDate: batch.expiryDate,
                        packetSize: batch.packetSize,
                        quantityReceived: batch.quantity,
                        currentQuantityInStrips: batch.quantity, // Initial current quantity
                        purchasePrice: batch.sellingPrice,
                        mrp: batch.mrp,
                        receivedDate:
                          logistic.vehicles[0]?.timestamps?.arrivedAt ||
                          new Date(),
                        createdAt: new Date(),
                      },
                    },
                    $setOnInsert: {
                      // Fields to set only if creating (upserting)
                      institutionId: req.institutionId,
                      medicineId: logMed.medicine,
                      isDeleted: false,
                      createdAt: new Date(),
                    },
                  },
                  {
                    upsert: true, // Create doc if it doesn't exist
                    new: true, // Return the modified document (optional)
                    // session: session // Add if using transactions
                  }
                );

              if (instStockUpdateResult) {
                // Create Institution Usage Log (Addition)
                await InstitutionUsageLog.create({
                  institutionId: req.institutionId,
                  medicineId: logMed.medicine,
                  batchName: batch.batchNumber,
                  quantity: batch.quantity,
                  type: "addition",
                  // session: session
                });

                // Create Warehouse Receipt Log (Sale from Warehouse perspective)
                await WarehouseReceiptLog.create({
                  warehouseId: logistic.warehouse,
                  medicineId: logMed.medicine,
                  batchName: batch.batchNumber,
                  // mfgDate: null, // Not available in logistic batch data
                  expiryDate: batch.expiryDate,
                  // purchasePrice: null, // Not relevant for sale log
                  sellingPrice: batch.sellingPrice,
                  mrp: batch.mrp,
                  receivedDate:
                    logistic.vehicles[0]?.timestamps?.arrivedAt || new Date(), // Date it was sold/received by inst
                  type: "sale",
                  quantity: batch.quantity,
                  // session: session
                });
                processedInstStockCount++;
              }
            } catch (error) {
              console.error(
                `Error processing institution stock event for Req: ${req._id}, Med: ${logMed.medicine}, Batch: ${batch.batchNumber}:`,
                error.message
              );
              if (error.name === "ValidationError") {
                console.error(
                  "Validation Errors:",
                  JSON.stringify(error.errors, null, 2)
                );
              }
            }
          })();
          institutionStockPromises.push(promise);
        });
      });
    });

    await Promise.all(institutionStockPromises); // Wait for all updates/creations
    console.log(
      `Processed ${processedInstStockCount} Institution Stock batch events (created/updated docs & logs).`
    );

    // Old insertion logic removed
    // if (institutionStockData.length > 0) {
    //     console.log("Inserting Institution Stock (in batches)...");
    //     const insertedInstStockCount = await insertInBatches(InstitutionStock, institutionStockData);
    //     console.log(`Inserted ${insertedInstStockCount} Institution Stock documents.`);
    // }

    console.log("\n--- Database Seeding Completed Successfully! ---");
  } catch (error) {
    console.error("\n--- Error during database seeding: ---", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB connection closed.");
    process.exit();
  }
}

// Run the seed function
seedDatabase();
