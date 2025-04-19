import crypto from "crypto";

const getFormattedDateTime = () => {
  const now = new Date();

  // Extract date parts
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const year = String(now.getFullYear()).slice(-2); // Get last two digits of the year

  // Extract time parts
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  // Format date and time
  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${hours}:${minutes}:${seconds}`;

  return `${formattedDate} ${formattedTime}`;
};

const getHash = (content) => {
  return crypto.createHash("sha256").update(content).digest("hex");
};

const generateBatchNumber = () => {
  const now = new Date();

  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const timestampPart = `${year}${month}${day}${hours}${minutes}`;

  // Generate 6 random alphanumeric characters (A-Z, 0-9)
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let randomPart = "";
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    randomPart += characters[randomBytes[i] % characters.length];
  }

  return `B-${timestampPart}-${randomPart}`;
};

export { getFormattedDateTime, getHash, generateBatchNumber };
