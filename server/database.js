const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'milk_delivery.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Settings Table
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT NOT NULL
        )`);

        // Customers Table
        db.run(`CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            mobile TEXT UNIQUE NOT NULL,
            area TEXT, -- Added for address/street
            default_quantity REAL NOT NULL,
            customer_code TEXT UNIQUE -- generated CUST001
        )`, (err) => {
            // Migration for existing tables
            if (!err) {
                db.run("ALTER TABLE customers ADD COLUMN area TEXT", (err) => {
                    // Ignore error if column exists
                });
            }
        });

        // Default Quantity Changes Log (for history tracking potentially)
        // Ideally we track when default quantity changes to bill correctly.
        // For simplicity, we'll store the *current* default in Customers.
        // But for accurate billing, we need effective_date.
        // Let's create a 'quantity_changes' table.
        // If no entry exists for a date, use the latest entry <= date.

        db.run(`CREATE TABLE IF NOT EXISTS quantity_changes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            new_quantity REAL NOT NULL,
            effective_date TEXT NOT NULL, -- YYYY-MM-DD
            FOREIGN KEY(customer_id) REFERENCES customers(id)
        )`);


        db.run(`CREATE TABLE IF NOT EXISTS overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            date TEXT NOT NULL, -- YYYY-MM-DD
            quantity REAL NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            UNIQUE(customer_id, date)
        )`);

        // Bills Table
        db.run(`CREATE TABLE IF NOT EXISTS bills (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER,
            month INTEGER,
            year INTEGER,
            total_quantity REAL,
            total_amount REAL,
            status TEXT DEFAULT 'Pending', -- Pending, Paid
            paid_date TEXT,
            UNIQUE(customer_id, month, year)
        )`);

        // Deliveries (Confirmed)
        db.run(`CREATE TABLE IF NOT EXISTS deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            quantity REAL NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'Delivered',
            timestamp TEXT NOT NULL,
            FOREIGN KEY(customer_id) REFERENCES customers(id),
            UNIQUE(customer_id, date)
        )`);

        // Initial Settings
        db.get("SELECT value FROM settings WHERE key = 'milk_price'", (err, row) => {
            if (!row) {
                db.run("INSERT INTO settings (key, value) VALUES ('milk_price', '60')"); // Default price
            }
        });
    });
}

module.exports = db;
