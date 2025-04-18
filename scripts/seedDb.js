import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine __dirname equivalent in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Adjust paths based on your project structure
import { Salt } from '../src/models/salt.model.js';
import { Manufacturer } from '../src/models/Manufacturer.model.js';
import { Medicine } from '../src/models/medicine.model.js';
import { USER_TYPES } from '../src/utils/constants.js'; // Adjust path if needed

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI not found in environment variables.');
  process.exit(1);
}

const ADMIN_USER_ID = '68022fae18b0aa4d0c190d40'; // Provided admin user ID

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connected successfully.');

    // --- Clear Existing Data ---
    console.log('Clearing existing data...');
    await Salt.deleteMany({});
    await Manufacturer.deleteMany({});
    await Medicine.deleteMany({});
    console.log('Existing data cleared.');

    // --- Seed Salts ---
    console.log('Seeding salts...');
    const saltData = [
      { name: 'Paracetamol', useCase: 'Pain relief, Fever reduction', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Diclofenac Sodium', useCase: 'Pain relief, Anti-inflammatory (NSAID)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Amoxicillin Trihydrate', useCase: 'Antibiotic (Penicillin)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Clavulanic Acid', useCase: 'Beta-lactamase inhibitor (combined with antibiotics)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Azithromycin Dihydrate', useCase: 'Antibiotic (Macrolide)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Metformin Hydrochloride', useCase: 'Antidiabetic (Type 2 Diabetes)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Cetirizine Hydrochloride', useCase: 'Antihistamine (Allergies)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Omeprazole', useCase: 'Proton pump inhibitor (Acid reflux, Ulcers)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Pantoprazole Sodium Sesquihydrate', useCase: 'Proton pump inhibitor (Acid reflux, Ulcers)', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Domperidone', useCase: 'Antiemetic (Nausea, Vomiting), Prokinetic', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
    ];
    const salts = await Salt.insertMany(saltData);
    console.log(`${salts.length} salts seeded.`);
    const saltMap = salts.reduce((map, salt) => {
        map[salt.name] = salt._id;
        return map;
    }, {});


    // --- Seed Manufacturers ---
    console.log('Seeding manufacturers...');
    const manufacturerData = [
      { name: 'Sun Pharmaceutical Industries Ltd.', medicalRepresentator: { name: 'Amit Sharma', contact: 9876543210 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Cipla Ltd.', medicalRepresentator: { name: 'Priya Singh', contact: 9876543211 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Dr. Reddy\'s Laboratories Ltd.', medicalRepresentator: { name: 'Rahul Verma', contact: 9876543212 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Lupin Ltd.', medicalRepresentator: { name: 'Sneha Patel', contact: 9876543213 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Zydus Cadila (Cadila Healthcare Ltd.)', medicalRepresentator: { name: 'Vikram Kumar', contact: 9876543214 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'GSK India (GlaxoSmithKline Pharmaceuticals Ltd.)', medicalRepresentator: { name: 'Anjali Desai', contact: 9876543215 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Mankind Pharma Ltd.', medicalRepresentator: { name: 'Arjun Reddy', contact: 9876543216 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Torrent Pharmaceuticals Ltd.', medicalRepresentator: { name: 'Meera Iyer', contact: 9876543217 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Alkem Laboratories Ltd.', medicalRepresentator: { name: 'Rajesh Gupta', contact: 9876543218 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Micro Labs Ltd.', medicalRepresentator: { name: 'Deepika Rao', contact: 9876543219 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'USV Pvt Ltd.', medicalRepresentator: { name: 'Suresh Menon', contact: 9876543220 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
       { name: 'Novartis India Ltd.', medicalRepresentator: { name: 'Neha Joshi', contact: 9876543221 }, createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
    ];
    const manufacturers = await Manufacturer.insertMany(manufacturerData);
    console.log(`${manufacturers.length} manufacturers seeded.`);
    const manufacturerMap = manufacturers.reduce((map, manu) => {
        map[manu.name] = manu._id;
        return map;
    }, {});

    // --- Seed Medicines ---
    console.log('Seeding medicines...');
    const medicineData = [
      { name: 'Crocin Advance', salts: [saltMap['Paracetamol']], manufacturer: manufacturerMap['GSK India (GlaxoSmithKline Pharmaceuticals Ltd.)'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Calpol 650', salts: [saltMap['Paracetamol']], manufacturer: manufacturerMap['GSK India (GlaxoSmithKline Pharmaceuticals Ltd.)'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Dolo 650', salts: [saltMap['Paracetamol']], manufacturer: manufacturerMap['Micro Labs Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Voveran SR 100', salts: [saltMap['Diclofenac Sodium']], manufacturer: manufacturerMap['Novartis India Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Moxikind-CV 625', salts: [saltMap['Amoxicillin Trihydrate'], saltMap['Clavulanic Acid']], manufacturer: manufacturerMap['Mankind Pharma Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Azee 500', salts: [saltMap['Azithromycin Dihydrate']], manufacturer: manufacturerMap['Cipla Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Glycomet SR 500', salts: [saltMap['Metformin Hydrochloride']], manufacturer: manufacturerMap['USV Pvt Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Cetrizine Tablet (Cipla)', salts: [saltMap['Cetirizine Hydrochloride']], manufacturer: manufacturerMap['Cipla Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Omez 20', salts: [saltMap['Omeprazole']], manufacturer: manufacturerMap['Dr. Reddy\'s Laboratories Ltd.'], isTablets: false, medicineType: 'Capsule', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Pantocid DSR', salts: [saltMap['Pantoprazole Sodium Sesquihydrate'], saltMap['Domperidone']], manufacturer: manufacturerMap['Sun Pharmaceutical Industries Ltd.'], isTablets: false, medicineType: 'Capsule', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
      { name: 'Augmentin 625 Duo', salts: [saltMap['Amoxicillin Trihydrate'], saltMap['Clavulanic Acid']], manufacturer: manufacturerMap['GSK India (GlaxoSmithKline Pharmaceuticals Ltd.)'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
       { name: 'Taxim-O 200', salts: [saltMap['Cefixime']], manufacturer: manufacturerMap['Alkem Laboratories Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID }, // Note: Requires Cefixime salt
       { name: 'Telma 40', salts: [saltMap['Telmisartan']], manufacturer: manufacturerMap['Glenmark Pharmaceuticals Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID }, // Note: Requires Telmisartan salt & Glenmark manufacturer
       { name: 'Montair LC', salts: [saltMap['Montelukast'], saltMap['Levocetirizine Dihydrochloride']], manufacturer: manufacturerMap['Cipla Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID }, // Note: Requires Montelukast & Levocetirizine salts
       { name: 'Clavam 625', salts: [saltMap['Amoxicillin Trihydrate'], saltMap['Clavulanic Acid']], manufacturer: manufacturerMap['Alkem Laboratories Ltd.'], isTablets: true, medicineType: 'Tablet', createdByRole: USER_TYPES.ADMIN, createdBy: ADMIN_USER_ID },
    ];

    // Filter out medicines where salts or manufacturer might be missing if added above notes are not resolved
    const validMedicineData = medicineData.filter(med =>
        med.salts.every(s => s) && med.manufacturer
    );

    if(validMedicineData.length < medicineData.length) {
        console.warn(`Warning: Some medicines were skipped due to missing salt or manufacturer references. Please add missing salts/manufacturers to the seed data.`);
    }


    const medicines = await Medicine.insertMany(validMedicineData);
    console.log(`${medicines.length} medicines seeded.`);

    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    process.exit();
  }
};

seedDatabase(); 