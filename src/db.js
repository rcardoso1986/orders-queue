import { MongoClient } from 'mongodb';
import 'dotenv/config';

let client;
let db;

export async function connect() {
  if (db) return db;
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();

  db = client.db();
  return db;
}
