const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// --- Utilities ---

// Generate Customer ID
function generateCustomerID(id) {
    return `CUST${String(id).padStart(3, '0')}`;
}

// WhatsApp Mock Service
const sendWhatsAppMessage = (mobile, message) => {
    console.log(`[WhatsApp Mock] To: ${mobile} | Message: ${message}`);
    // In a real app, call Twilio or Meta API here.
    return true;
};

// --- Routes ---

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    // Simple hardcoded admin credentials
    if (username === 'admin' && password === 'admin123') {
        res.json({ token: 'mock-jwt-token' });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// 1. Settings
app.get('/api/settings', (req, res) => {
    db.all("SELECT key, value FROM settings", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(row => settings[row.key] = row.value);
        res.json(settings);
    });
});

app.post('/api/settings', (req, res) => {
    const { key, value } = req.body;
    db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?", [key, value, value], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Settings updated" });
    });
});

// 2. Customers
app.get('/api/customers', (req, res) => {
    db.all("SELECT * FROM customers", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/customers', (req, res) => {
    const { name, mobile, area, default_quantity } = req.body;
    // Basic validation
    if (!name || !mobile || default_quantity === undefined) {
        return res.status(400).json({ error: "Missing fields" });
    }

    // Mobile Validation: 10 digits
    if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
    }

    // Insert
    db.run("INSERT INTO customers (name, mobile, area, default_quantity) VALUES (?, ?, ?, ?)", [name, mobile, area || '', default_quantity], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const id = this.lastID;
        const code = generateCustomerID(id);

        // Update with generated code
        db.run("UPDATE customers SET customer_code = ? WHERE id = ?", [code, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Also log initial quantity change strictly effective from today (or allow backdating?)
            // Requirement says "Permanently update... effective from a selected date".
            // For creation, we assume effective from today.
            const today = new Date().toISOString().split('T')[0];
            db.run("INSERT INTO quantity_changes (customer_id, new_quantity, effective_date) VALUES (?, ?, ?)", [id, default_quantity, today]);

            res.json({ id, customer_code: code, name, mobile, area, default_quantity });
        });
    });
});

// Update Customer (Name, Mobile, Area)
app.post('/api/customers/:id/update-info', (req, res) => {
    const { id } = req.params;
    const { name, mobile, area } = req.body;

    if (!name || !mobile) return res.status(400).json({ error: "Missing data" });

    // Mobile Validation: 10 digits
    if (!/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
    }

    db.run("UPDATE customers SET name = ?, mobile = ?, area = ? WHERE id = ?", [name, mobile, area || '', id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Customer info updated" });
    });
});

// Delete Customer
app.delete('/api/customers/:id', (req, res) => {
    const { id } = req.params;

    // Ideally we should soft delete or check constraints, but for MVP we delete.
    // We should also delete dependencies or rely on CASCADE if set (we didn't set cascade).
    // Let's delete from related tables first manually for safety in SQLite without foreign keys enabled by default.

    db.serialize(() => {
        db.run("DELETE FROM overrides WHERE customer_id = ?", [id]);
        db.run("DELETE FROM quantity_changes WHERE customer_id = ?", [id]);
        db.run("DELETE FROM deliveries WHERE customer_id = ?", [id]);
        db.run("DELETE FROM customers WHERE id = ?", [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Customer deleted" });
        });
    });
});

// Update Default Quantity
app.post('/api/customers/:id/update-quantity', (req, res) => {
    const { id } = req.params;
    const { new_quantity, effective_date } = req.body;

    if (new_quantity === undefined || !effective_date) return res.status(400).json({ error: "Missing data" });

    // Update current default if effective date is today or past (simple approach) or just log it
    // The requirement says: "Permanently update... effective from a selected date."
    // We should update the 'default_quantity' column immediately IF the date is today?
    // Actually, to keep it simple, we update the main record AND log the change.

    db.run("UPDATE customers SET default_quantity = ? WHERE id = ?", [new_quantity, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.run("INSERT INTO quantity_changes (customer_id, new_quantity, effective_date) VALUES (?, ?, ?)", [id, new_quantity, effective_date], (err) => {
            if (err) console.error(err);
        });

        // WhatsApp Notification
        db.get("SELECT mobile, name FROM customers WHERE id = ?", [id], (err, row) => {
            if (row) {
                sendWhatsAppMessage(row.mobile, `Hello ${row.name}, your daily milk quantity has been updated to ${new_quantity}L effective from ${effective_date}.`);
            }
        });

        res.json({ message: "Quantity updated" });
    });
});

// 3. One-Day Override
app.post('/api/overrides', (req, res) => {
    const { customer_id, date, quantity } = req.body;

    db.run("INSERT INTO overrides (customer_id, date, quantity) VALUES (?, ?, ?) ON CONFLICT(customer_id, date) DO UPDATE SET quantity = ?", [customer_id, date, quantity, quantity], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // WhatsApp Notification
        db.get("SELECT mobile, name FROM customers WHERE id = ?", [customer_id], (err, row) => {
            if (row) {
                sendWhatsAppMessage(row.mobile, `Hello ${row.name}, your milk quantity for ${date} has been changed to ${quantity}L.`);
            }
        });

        res.json({ message: "Override set" });
    });
});

app.get('/api/overrides', (req, res) => {
    const { date } = req.query;
    let sql = "SELECT * FROM overrides";
    const params = [];
    if (date) {
        sql += " WHERE date = ?";
        params.push(date);
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});


// 4. Daily Delivery / Dashboard Logic
// Get deliveries for a specific date (or range)
app.get('/api/deliveries', (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date required" });

    // Fetch quantity changes for historical default logic
    db.all("SELECT * FROM quantity_changes ORDER BY effective_date ASC", [], (err, changes) => {
        if (err) return res.status(500).json({ error: err.message });

        const sql = `
            SELECT 
                c.id, c.name, c.customer_code, c.mobile, c.area, c.default_quantity,
                o.quantity as override_qty,
                d.quantity as delivered_qty,
                d.status as delivery_status,
                d.timestamp as delivered_at
            FROM customers c
            LEFT JOIN overrides o ON c.id = o.customer_id AND o.date = ?
            LEFT JOIN deliveries d ON c.id = d.customer_id AND d.date = ?
            ORDER BY c.area ASC, c.customer_code ASC -- Order by Area for delivery route
        `;

        db.all(sql, [date, date], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });

            const result = rows.map(r => {
                // Determine EXPECTED quantity
                // 1. Override
                // 2. Default History

                let expectedQty = 0;

                if (r.override_qty != null) {
                    expectedQty = r.override_qty;
                } else {
                    // Find applicable default from changes
                    const custChanges = changes.filter(ch => ch.customer_id === r.id);
                    const applicableChange = custChanges
                        .filter(ch => ch.effective_date <= date)
                        .pop();

                    expectedQty = applicableChange ? applicableChange.new_quantity : 0; // if no history, assume 0 for safety before creation? Or use c.default_quantity? 
                    // To be safe with new customers added today with explicit history entry: history is best.
                }

                // If already delivered, show that quantity. Else show expected.
                return {
                    ...r,
                    quantity: r.delivery_status === 'Delivered' ? r.delivered_qty : expectedQty,
                    is_delivered: r.delivery_status === 'Delivered',
                    is_override: r.override_qty != null
                };
            });

            res.json(result);
        });
    });
});

// --- Sales History Endpoint ---
app.get('/api/sales-history', (req, res) => {
    const { period } = req.query; // 'daily', 'weekly', 'monthly'

    let sql = "";
    const today = new Date();
    const labels = [];

    if (period === 'monthly') {
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }

        sql = `
            SELECT strftime('%Y-%m', date) as label, sum(quantity) as total_quantity, sum(amount) as total_amount 
            FROM deliveries 
            WHERE status = 'Delivered' 
            AND date >= date('now', 'localtime', 'start of month', '-11 months')
            GROUP BY label
            ORDER BY label ASC
        `;
    } else if (period === 'weekly') {
        // Last 12 weeks
        // Note: SQLite %W is week of year (00-53). Simple generation in JS might mismatch if strict.
        // Let's stick to simple SQL for weekly for now unless requested, or try to match.
        // But for consistency let's just run the query for weekly/daily and not fill gaps strictly if too complex, 
        // OR implement simple filling. 
        // Let's fix MONTHLY as requested first and foremost.

        // Actually, let's fill daily too as it's easy.

        sql = `
            SELECT strftime('%Y-W%W', date) as label, sum(quantity) as total_quantity, sum(amount) as total_amount 
            FROM deliveries 
            WHERE status = 'Delivered' 
            AND date >= date('now', 'localtime', '-84 days')
            GROUP BY label
            ORDER BY label ASC
        `;
    } else {
        // Default: Daily (Last 14 days)
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            labels.push(d.toISOString().split('T')[0]);
        }

        sql = `
            SELECT date as label, sum(quantity) as total_quantity, sum(amount) as total_amount 
            FROM deliveries 
            WHERE status = 'Delivered' 
            AND date >= date('now', 'localtime', '-14 days')
            GROUP BY label
            ORDER BY label ASC
        `;
    }

    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        if (period === 'monthly' || period === 'daily' || !period) {
            // Fill gaps
            const resultMap = {};
            rows.forEach(r => resultMap[r.label] = r);

            const filledData = labels.map(label => {
                const data = resultMap[label] || {};
                return {
                    label,
                    total_quantity: data.total_quantity || 0,
                    total_amount: data.total_amount || 0
                };
            });
            res.json(filledData);
        } else {
            // Return raw for weekly (complex label generation)
            res.json(rows);
        }
    });
});

// Mark as Delivered or Not Delivered
app.post('/api/deliveries/mark', (req, res) => {
    const { customer_id, date, quantity, status } = req.body; // Added status param

    if (!customer_id || !date || quantity === undefined) return res.status(400).json({ error: "Missing data" });

    // Get current price
    db.get("SELECT value FROM settings WHERE key = 'milk_price'", (err, priceRow) => {
        if (err || !priceRow) return res.status(500).json({ error: "Price not set" });

        const price = parseFloat(priceRow.value);
        const amount = quantity * price;
        const timestamp = new Date().toISOString();
        const deliveryStatus = status || 'Delivered'; // Default to Delivered if not provided

        db.run(`INSERT INTO deliveries (customer_id, date, quantity, amount, status, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(customer_id, date) DO UPDATE SET 
                quantity = ?, amount = ?, status = ?, timestamp = ?`,
            [customer_id, date, quantity, amount, deliveryStatus, timestamp, quantity, amount, deliveryStatus, timestamp],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // WhatsApp Notification
                db.get("SELECT mobile, name, customer_code FROM customers WHERE id = ?", [customer_id], (err, row) => {
                    if (row) {
                        let msg = '';
                        if (deliveryStatus === 'Not Delivered') {
                            msg = `Hi ${row.name}, we could not deliver milk today (${date}) as you were unavailable.`;
                        } else {
                            msg = `Delivery Update:
ID: ${row.customer_code}
Date: ${date}
Qty: ${quantity}L
Rate: ${price}/L
Total: ${amount}
Status: Delivered`;
                        }
                        sendWhatsAppMessage(row.mobile, msg);
                    }
                });

                res.json({ message: "Status Updated" });
            }
        );
    });
});


// 5. Monthly Bill
app.post('/api/bill/generate', (req, res) => {
    const { month, year } = req.body;

    if (!month || !year) return res.status(400).json({ error: "Month and Year required" });

    const formattingMonth = String(month).padStart(2, '0');
    const startStr = `${year}-${formattingMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${formattingMonth}-${lastDay}`;

    // Calculate from DELIVERIES table only
    const sql = `
        SELECT 
            d.customer_id, c.name, c.mobile,
            SUM(d.quantity) as total_quantity,
            SUM(d.amount) as total_amount
        FROM deliveries d
        JOIN customers c ON d.customer_id = c.id
        WHERE d.date BETWEEN ? AND ? AND d.status = 'Delivered'
        GROUP BY d.customer_id
    `;

    db.all(sql, [startStr, endStr], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        // Save generated bills to database
        const stmt = db.prepare(`
            INSERT INTO bills (customer_id, month, year, total_quantity, total_amount, status) 
            VALUES (?, ?, ?, ?, ?, 'Pending')
            ON CONFLICT(customer_id, month, year) DO UPDATE SET 
            total_quantity = excluded.total_quantity, 
            total_amount = excluded.total_amount
        `);

        rows.forEach(bill => {
            stmt.run([bill.customer_id, month, year, bill.total_quantity, bill.total_amount]);
        });
        stmt.finalize();

        // Return the saved bills with their status
        setTimeout(() => {
            const fetchSql = `
                SELECT 
                    b.*, c.name, c.mobile
                FROM bills b
                JOIN customers c ON b.customer_id = c.id
                WHERE b.month = ? AND b.year = ?
             `;
            db.all(fetchSql, [month, year], (err, savedBills) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(savedBills);
            });
        }, 500); // Small delay to ensure writes
    });
});

// Mark Bill as Paid
app.post('/api/bill/:id/pay', (req, res) => {
    const { id } = req.params;
    const paidDate = new Date().toISOString();

    db.run("UPDATE bills SET status = 'Paid', paid_date = ? WHERE id = ?", [paidDate, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Notify Customer
        db.get("SELECT b.*, c.mobile, c.name FROM bills b JOIN customers c ON b.customer_id = c.id WHERE b.id = ?", [id], (err, row) => {
            if (row) {
                sendWhatsAppMessage(row.mobile, `Payment Received!
Hi ${row.name}, we received your payment of ₹${row.total_amount} for ${row.month}/${row.year}.
Thank you!`);
            }
        });

        res.json({ message: "Bill marked as Paid" });
    });
});

// Send Payment Reminder
app.post('/api/bill/:id/notify', (req, res) => {
    const { id } = req.params;

    db.get("SELECT b.*, c.mobile, c.name FROM bills b JOIN customers c ON b.customer_id = c.id WHERE b.id = ?", [id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Bill not found" });

        sendWhatsAppMessage(row.mobile, `Payment Reminder:
Hi ${row.name}, your bill of ₹${row.total_amount} for ${row.month}/${row.year} is pending.
Please pay via UPI/Cash. Thank you!`);

        res.json({ message: "Notification Sent" });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
