import mongoose from "mongoose";
import dotenv from "dotenv";
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { Institution } from "../models/institution.model.js";
import { Warehouse } from "../models/warehouse.model.js";

dotenv.config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB for seeding"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Configuration
const NUM_INSTITUTIONS = 70;
const NUM_WAREHOUSES = 60;
const DEFAULT_PASSWORD = "Password123!";

// Generate Indian cities, states and districts
const indianLocations = [
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
];

// Hash password function
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

// Generate random GPS coordinates for India
const generateIndianGPS = () => {
  // Approximate coordinates for India
  return {
    lat: faker.location.latitude({ min: 8.4, max: 37.6 }),
    lng: faker.location.longitude({ min: 68.7, max: 97.25 }),
  };
};

// Generate institution data
const generateInstitutions = async (count) => {
  const institutions = [];
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  for (let i = 0; i < count; i++) {
    const locationIndex = Math.floor(Math.random() * indianLocations.length);
    const location = indianLocations[locationIndex];

    institutions.push({
      institutionCode: `INST${String(i + 1).padStart(3, "0")}`,
      name: `${location.city} ${faker.company.name()} Hospital`,
      email: faker.internet.email({ provider: "hospital.org" }).toLowerCase(),
      password: hashedPassword,
      registrationNumber: `UPHOSPI-2024-${String(100 + i).padStart(3, "0")}`,
      location: {
        address: faker.location.streetAddress(),
        city: location.city,
        district: location.district,
        state: location.state,
        pincode: location.pincode,
        gpsCoordinates: generateIndianGPS(),
      },
      incharge: [
        {
          name: `Dr. ${faker.person.fullName()}`,
          contact: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
          email: faker.internet.email().toLowerCase(),
        },
        {
          name: `Dr. ${faker.person.fullName()}`,
          contact: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
          email: faker.internet.email().toLowerCase(),
        },
      ],
      verificationStatus: faker.helpers.arrayElement([
        "pending",
        "verified",
        "rejected",
      ]),
      verificationRejectedReason: faker.helpers.maybe(
        () => faker.lorem.sentence(),
        { probability: 0.3 }
      ),
    });
  }

  return institutions;
};

// Generate warehouse data
const generateWarehouses = async (count) => {
  const warehouses = [];
  const hashedPassword = await hashPassword(DEFAULT_PASSWORD);

  for (let i = 0; i < count; i++) {
    const locationIndex = Math.floor(Math.random() * indianLocations.length);
    const location = indianLocations[locationIndex];

    warehouses.push({
      warehouseCode: `WH${String(i + 1).padStart(3, "0")}`,
      name: `${location.city} Central Medical Warehouse`,
      email: faker.internet.email({ provider: "medlogix.in" }).toLowerCase(),
      password: hashedPassword,
      registrationNumber: `UPWH-2024-${String(100 + i).padStart(3, "0")}`,
      location: {
        address: faker.location.streetAddress(),
        city: location.city,
        district: location.district,
        state: location.state,
        pincode: location.pincode,
        gpsCoordinates: generateIndianGPS(),
      },
      managers: [
        {
          name: faker.person.fullName(),
          contact: `${Math.floor(6000000000 + Math.random() * 3999999999)}`,
          email: faker.internet.email().toLowerCase(),
        },
      ],
      verificationStatus: faker.helpers.arrayElement([
        "pending",
        "verified",
        "rejected",
      ]),
      verificationRejectedReason: faker.helpers.maybe(
        () => faker.lorem.sentence(),
        { probability: 0.3 }
      ),
    });
  }

  return warehouses;
};

// Seed data function
const seedData = async () => {
  try {
    // Clear existing data
    await Institution.deleteMany({});
    await Warehouse.deleteMany({});

    console.log("Existing data cleared");

    // Generate and insert new data
    const institutions = await generateInstitutions(NUM_INSTITUTIONS);
    const warehouses = await generateWarehouses(NUM_WAREHOUSES);

    await Institution.insertMany(institutions);
    await Warehouse.insertMany(warehouses);

    console.log(
      `Successfully seeded ${institutions.length} institutions and ${warehouses.length} warehouses`
    );

    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error seeding data:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seed function
seedData();
