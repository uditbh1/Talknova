import * as dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

let db;

connect();

async function connect() {
  if (db) return db;

  if (process.env.NODE_ENV === "production") {
    db = await mongoose.connect(process.env.MONGODB_URI);
  } else {
    if (!global.__db) {
      global.__db = await mongoose.connect(process.env.MONGODB_URI);
    }
    db = global.__db;
  }
  return db;
}

export { mongoose, connect };
