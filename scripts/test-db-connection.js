const db = require("../db");

async function testConnection() {
  try {
    console.log("Testing database connection...");
    const startTime = Date.now();
    const [rows] = await db.query("SELECT 1 as val");
    const duration = Date.now() - startTime;

    if (rows && rows.length > 0 && rows[0].val === 1) {
      console.log(`Connection successful! (took ${duration}ms)`);
      console.log("Result:", rows);
    } else {
      console.error("Connection failed: Unexpected result", rows);
    }
  } catch (error) {
    console.error("Connection failed:", error);
  }
}

testConnection();
