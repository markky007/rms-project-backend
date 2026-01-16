const { createClient } = require("@libsql/client");
require("dotenv").config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helper function to expand array parameters for IN clauses
// MySQL2 allows [array] for IN (?) but libsql doesn't
const expandArrayParams = (sql, params) => {
  let expandedSql = sql;
  const expandedParams = [];
  let paramIndex = 0;

  // Replace each ? with the appropriate number of placeholders
  expandedSql = sql.replace(/\?/g, () => {
    const param = params[paramIndex];
    paramIndex++;

    if (Array.isArray(param)) {
      // Expand array to multiple placeholders
      const placeholders = param.map(() => "?").join(", ");
      expandedParams.push(...param);
      return placeholders;
    } else {
      expandedParams.push(param);
      return "?";
    }
  });

  return { sql: expandedSql, params: expandedParams };
};

// Convert MySQL-specific SQL to SQLite-compatible SQL
const convertMySQLToSQLite = (sql) => {
  let convertedSql = sql;

  // Replace TRUE with 1 and FALSE with 0
  convertedSql = convertedSql.replace(/\bTRUE\b/gi, "1");
  convertedSql = convertedSql.replace(/\bFALSE\b/gi, "0");

  // Replace IFNULL with COALESCE (both work in SQLite, but just in case)
  // Actually SQLite supports IFNULL, so we don't need to change this

  return convertedSql;
};

// Helper function to make libsql compatible with mysql2 style queries
// Wraps the client to provide a similar interface
const query = async (sql, params = []) => {
  try {
    // Convert MySQL-specific syntax to SQLite
    let convertedSql = convertMySQLToSQLite(sql);

    // Expand array parameters for IN clauses
    const { sql: expandedSql, params: expandedParams } = expandArrayParams(
      convertedSql,
      params
    );

    const result = await db.execute({
      sql: expandedSql,
      args: expandedParams,
    });

    // Return in a format similar to mysql2
    // result.rows contains the data
    return [
      result.rows,
      { affectedRows: result.rowsAffected, insertId: result.lastInsertRowid },
    ];
  } catch (error) {
    console.error("Database query error:", error);
    console.error("SQL:", sql);
    console.error("Params:", params);
    throw error;
  }
};

// Export a mysql2-compatible interface
module.exports = {
  query,
  execute: query, // Alias for compatibility
};
