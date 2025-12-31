const express = require('express');
const app = express();
const db = require('./db');
require('dotenv').config();

const port = process.env.PORT || 3000;

app.use(express.json());

// Test Route
app.get('/', (req, res) => {
    res.send('Server is running!');
});

// ดึงข้อมูล Users
app.get('/users', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM users');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});