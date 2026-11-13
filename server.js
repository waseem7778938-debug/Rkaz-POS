const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات المحلية بنجاح.');
    }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        stock INTEGER NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL,
        total_profit REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        FOREIGN KEY(sale_id) REFERENCES sales(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);
});

// جلب المنتجات
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// إضافة منتج جديد
app.post('/api/products', (req, res) => {
    const { name, barcode, price, cost, stock } = req.body;
    const query = `INSERT INTO products (name, barcode, price, cost, stock) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [name, barcode, price, cost, stock], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "تمت إضافة المنتج بنجاح" });
    });
});

// إتمام عملية بيع وحساب الربح (سعر البيع - التكلفة)
app.post('/api/sales', (req, res) => {
    const { items, total_amount, total_profit } = req.body; 

    db.run(`INSERT INTO sales (total_amount, total_profit) VALUES (?, ?)`, [total_amount, total_profit], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const saleId = this.lastID;

        const stmt = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, price, cost) VALUES (?, ?, ?, ?, ?)`);
        const updateStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

        items.forEach(item => {
            stmt.run(saleId, item.product_id, item.quantity, item.price, item.cost);
            updateStock.run(item.quantity, item.product_id);
        });

        stmt.finalize();
        updateStock.finalize();

        res.json({ success: true, saleId: saleId, message: "تمت عملية البيع وتحديث المخزون بنجاح" });
    });
});

// جلب التقارير المالية (إجمالي المبيعات والأرباح)
app.get('/api/reports', (req, res) => {
    db.get(`SELECT SUM(total_amount) as total_sales, SUM(total_profit) as total_profits, COUNT(id) as total_invoices FROM sales`, (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row || { total_sales: 0, total_profits: 0, total_invoices: 0 });
    });
});

app.listen(PORT, () => {
    console.log(`السيرفر يعمل حالياً على المنفذ ${PORT}`);
});
