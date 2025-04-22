import { InstitutionStock } from "../models/institutionStock.model.js";
import { WarehouseStock } from "../models/warehouseStock.model.js";
// Model imports below are not strictly needed for aggregation pipelines
// but might be useful if direct model methods were used elsewhere.
// import { Institution } from "../models/institution.model.js";
// import { Warehouse } from "../models/warehouse.model.js";
// import { Medicine } from "../models/medicine.model.js";
import { sendEmail, stockExpiryAlertMailgenContent } from "../utils/mail.js";
import logger from "../logger/winston.logger.js";
// Assuming DB connection is handled by the main app process
// import connectDB from "../db/index.js";

const getExpiryRange = () => {
  const now = new Date();
  // Start of the current month
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // End of next month
  const endOfNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 2,
    0,
    23,
    59,
    59,
    999
  ); // Day 0 of month+2 gives last day of month+1
  return { startOfCurrentMonth, endOfNextMonth };
};

const formatDate = (date) => {
  if (!date) return "N/A";
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD format
};

const sendExpiryAlerts = async () => {
  logger.info("Starting expiry alert task...");
  try {
    // await connectDB(); // Connect DB if script runs standalone

    const { startOfCurrentMonth, endOfNextMonth } = getExpiryRange();
    logger.info(
      `Checking for expiry dates between ${formatDate(startOfCurrentMonth)} and ${formatDate(endOfNextMonth)}`
    );

    // --- Process Institution Stock ---
    const institutionAlerts = await InstitutionStock.aggregate([
      // Match documents with potentially relevant stock items
      {
        $match: {
          isDeleted: false,
          "stocks.expiryDate": { $lte: endOfNextMonth }, // Filter early based on expiry date
          "stocks.currentQuantityInStrips": { $gt: 0 }, // Only include batches with stock
        },
      },
      // Unwind the stocks array
      { $unwind: "$stocks" },
      // Match again to filter specific expiring batches within the range and with positive quantity
      {
        $match: {
          "stocks.expiryDate": { $lte: endOfNextMonth }, // Ensure items are expiring by end of next month
          "stocks.currentQuantityInStrips": { $gt: 0 },
        },
      },
      // Populate medicine details
      {
        $lookup: {
          from: "medicines", // collection name for Medicine model
          localField: "medicineId",
          foreignField: "_id",
          as: "medicineDetails",
        },
      },
      { $unwind: "$medicineDetails" }, // Deconstruct the array
      // Group by institution
      {
        $group: {
          _id: "$institutionId",
          expiringItems: {
            $push: {
              medicineName: "$medicineDetails.name",
              batchName: "$stocks.batchName",
              expiryDate: "$stocks.expiryDate",
              quantity: "$stocks.currentQuantityInStrips",
              unit: "Strips", // Specific to InstitutionStock
            },
          },
        },
      },
      // Populate institution details (name and email)
      {
        $lookup: {
          from: "institutions", // collection name for Institution model
          localField: "_id",
          foreignField: "_id",
          as: "institutionInfo",
        },
      },
      { $unwind: "$institutionInfo" },
      // Project the final shape
      {
        $project: {
          _id: 0,
          recipientName: "$institutionInfo.name",
          entityName: "$institutionInfo.name",
          email: "$institutionInfo.email",
          expiringItems: 1,
        },
      },
    ]);

    logger.info(
      `Found ${institutionAlerts.length} institutions with expiring stock.`
    );

    // --- Process Warehouse Stock ---
    const warehouseAlerts = await WarehouseStock.aggregate([
      // Match documents that have *at least one* potentially relevant stock item by expiry date
      // Defer the quantity check until after $unwind
      {
        $match: {
          isDeleted: false,
          stocks: {
            $elemMatch: {
              expiryDate: { $lte: endOfNextMonth },
            },
          },
        },
      },
      // Unwind the stocks array
      { $unwind: "$stocks" },
      // Match *again* after unwind to filter *only* the relevant batches by expiry and quantity
      {
        $match: {
          "stocks.expiryDate": { $lte: endOfNextMonth },
          // Check quantity on the *unwound* document. Use $ifNull for safety.
          $expr: {
            $gt: [
              {
                $subtract: [
                  "$stocks.quantity",
                  { $ifNull: ["$stocks.reservedQuantity", 0] },
                ],
              },
              0,
            ],
          },
        },
      },
      // Populate medicine details
      {
        $lookup: {
          from: "medicines", // collection name for Medicine model
          localField: "medicineId",
          foreignField: "_id",
          as: "medicineDetails",
        },
      },
      { $unwind: "$medicineDetails" }, // Deconstruct the array
      // Group by warehouse
      {
        $group: {
          _id: "$warehouseId",
          expiringItems: {
            $push: {
              medicineName: "$medicineDetails.name",
              batchName: "$stocks.batchName",
              expiryDate: "$stocks.expiryDate",
              // Calculate available quantity using $ifNull for safety in $group as well
              quantity: {
                $subtract: [
                  "$stocks.quantity",
                  { $ifNull: ["$stocks.reservedQuantity", 0] },
                ],
              },
              unit: "Packets", // Specific to WarehouseStock
            },
          },
        },
      },
      // Populate warehouse details (name and email)
      {
        $lookup: {
          from: "warehouses", // collection name for Warehouse model
          localField: "_id",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },
      { $unwind: "$warehouseInfo" },
      // Project the final shape
      {
        $project: {
          _id: 0,
          recipientName: "$warehouseInfo.name", // Or use a manager's name if available/preferred
          entityName: "$warehouseInfo.name",
          email: "$warehouseInfo.email",
          expiringItems: 1,
        },
      },
    ]);

    logger.info(
      `Found ${warehouseAlerts.length} warehouses with expiring stock.`
    );

    // Combine alerts
    const allAlerts = [...institutionAlerts, ...warehouseAlerts];

    // --- Send Emails ---
    let emailsSent = 0;
    for (const alert of allAlerts) {
      if (!alert.email || alert.expiringItems.length === 0) {
        logger.warn(
          `Skipping alert for ${alert.entityName} due to missing email or no expiring items.`
        );
        continue;
      }

      // Format items for the email
      const formattedItems = alert.expiringItems.map((item) => ({
        ...item,
        expiryDate: formatDate(item.expiryDate),
      }));

      const mailgenContent = stockExpiryAlertMailgenContent({
        recipientName: alert.recipientName,
        entityName: alert.entityName,
        expiringItems: formattedItems,
        // viewStockUrl: `https://your-app.com/stock?entityId=${alert._id}` // TODO: Add actual URL if available
      });

      try {
        await sendEmail({
          email: alert.email,
          subject: `Stock Expiry Alert - ${alert.entityName}`,
          mailgenContent,
        });
        logger.info(
          `Expiry alert email sent to ${alert.email} for ${alert.entityName}`
        );
        emailsSent++;
      } catch (emailError) {
        logger.error(
          `Failed to send expiry alert to ${alert.email} for ${alert.entityName}: ${emailError}`
        );
      }
    }

    logger.info(`Expiry alert task finished. Sent ${emailsSent} emails.`);
  } catch (error) {
    logger.error(`Error running expiry alert task: ${error}`);
  } finally {
    // await mongoose.connection.close(); // Disconnect DB if script runs standalone
  }
};

// If running this script directly (e.g., via system cron)
// if (import.meta.url === `file://${process.argv[1]}`) {
//   sendExpiryAlerts();
// }

export { sendExpiryAlerts };
