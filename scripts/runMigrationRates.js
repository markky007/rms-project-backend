const fs = require("fs");
const path = require("path");
const db = require("../db");

async function runMigration() {
  const migrationPath = path.join(__dirname, "../migration_rates.sql");
  const migrationSql = fs.readFileSync(migrationPath, "utf8");

  // Split by semicolon to get individual statements
  const statements = migrationSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Found ${statements.length} statements to execute.`);

  const connection = await db.getConnection();

  try {
    for (const sql of statements) {
      console.log(`Executing: ${sql.substring(0, 50)}...`);
      try {
        await connection.query(sql);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log("Column already exists, skipping.");
        } else {
          console.warn(`Error executing statement: ${err.message}`);
        }
      }
    }
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    connection.release();
    process.exit();
  }
}

runMigration();
