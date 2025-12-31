const fs = require("fs");
const path = require("path");
const db = require("../db");

async function run() {
  try {
    const sqlPath = path.join(__dirname, "../init.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Split by semicolon to get individual statements (rough split)
    // mysql2 doesn't support multiple statements by default unless configured.
    // But we can enable it or just split.
    // Let's try splitting.
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`Found ${statements.length} SQL statements.`);

    const connection = await db.getConnection();

    for (const statement of statements) {
      console.log("Executing:", statement.substring(0, 50) + "...");
      await connection.query(statement);
    }

    console.log("Database initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Failed to init DB:", err);
    process.exit(1);
  }
}

run();
