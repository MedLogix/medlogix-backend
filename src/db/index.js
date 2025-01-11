import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const clientOptions = {
  serverApi: { version: "1", strict: true, deprecationErrors: true },
};

const connectDB = async () => {
  try {
    await mongoose.connect(uri, clientOptions);
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log(
      "🍀 Pinged your deployment. You successfully connected to MongoDB!"
    );
    return mongoose.connection.db;
  } catch (error) {
    console.error("Database connection error:", error);
    throw new Error("Database connection failed");
  }
};

export default connectDB;
