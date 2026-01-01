const fs = require("fs");
const path = require("path");
const db = require("../db");

async function run() {
  try {
    const sqlPath = path.join(__dirname, "../migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Remove comment lines and USE statements
    const lines = sql.split("\n");
    const cleanedLines = lines.filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !trimmed.startsWith("--") &&
        !trimmed.toUpperCase().startsWith("USE")
      );
    });

    const cleanedSql = cleanedLines.join("\n");

    // Split by semicolon to get individual statements
    const statements = cleanedSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} SQL migration statements.`);

    const connection = await db.getConnection();

    for (const statement of statements) {
      const preview = statement.substring(0, 60).replace(/\n/g, " ");
      console.log("Executing:", preview + "...");
      try {
        await connection.query(statement);
        console.log("✓ Success");
      } catch (err) {
        // Ignore errors for ALTER TABLE ADD COLUMN if column already exists
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log("⚠ Column already exists, skipping...");
        } else if (err.code === "ER_DUP_KEYNAME") {
          console.log("⚠ Constraint already exists, skipping...");
        } else {
          throw err;
        }
      }
    }

    console.log("\n✅ Database migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to run migration:", err);
    process.exit(1);
  }
}

run();
