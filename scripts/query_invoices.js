const db = require("../db");

async function checkDuplicates() {
  try {
    console.log("Checking for duplicate invoice IDs in query results...");

    // Query from getAllInvoices
    const query = `
      SELECT 
          i.invoice_id, 
          i.month_year, 
          i.total_amount, 
          i.status, 
          i.invoice_type,
          i.issue_date,
          r.house_number,
          t.full_name as tenant_name
      FROM invoices i
      JOIN contracts c ON i.contract_id = c.contract_id
      JOIN rooms r ON c.room_id = r.room_id
      JOIN tenants t ON c.tenant_id = t.tenant_id
      ORDER BY i.invoice_id ASC
    `;

    const [rows] = await db.query(query);
    console.log(`Total rows fetched by getAllInvoices: ${rows.length}`);

    const idCounts = {};
    rows.forEach(row => {
      idCounts[row.invoice_id] = (idCounts[row.invoice_id] || 0) + 1;
    });

    const duplicateInvoiceIds = Object.keys(idCounts).filter(id => idCounts[id] > 1);
    if (duplicateInvoiceIds.length > 0) {
      console.log("Found duplicate invoice IDs in getAllInvoices output:", duplicateInvoiceIds);
      duplicateInvoiceIds.forEach(id => {
        console.log(`Invoice ID ${id} appeared ${idCounts[id]} times. Details:`);
        console.log(rows.filter(r => String(r.invoice_id) === String(id)));
      });
    } else {
      console.log("No duplicate invoice IDs found in getAllInvoices output!");
    }

    // Check if there are duplicates directly in invoices table
    const [rawInvoices] = await db.query("SELECT invoice_id, COUNT(*) as cnt FROM invoices GROUP BY invoice_id HAVING cnt > 1");
    console.log("Duplicates directly in invoices table:", rawInvoices);

    // Check other tables
    const tables = ["rooms", "tenants", "contracts", "meter_readings", "invoice_items"];
    for (const table of tables) {
      // Find primary key column
      let pk = "";
      if (table === "rooms") pk = "room_id";
      if (table === "tenants") pk = "tenant_id";
      if (table === "contracts") pk = "contract_id";
      if (table === "meter_readings") pk = "reading_id";
      if (table === "invoice_items") pk = "item_id";
      
      const [dups] = await db.query(`SELECT ${pk}, COUNT(*) as cnt FROM ${table} GROUP BY ${pk} HAVING cnt > 1`);
      console.log(`Duplicates in ${table} table:`, dups);
    }

  } catch (error) {
    console.error("Error running checks:", error);
  }
}

checkDuplicates();
