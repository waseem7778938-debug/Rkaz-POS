const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// إعداد تحليل البيانات القادمة من الواجهة
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// إنشاء وتوصيل قاعدة البيانات المحلية SQLite
const dbFile = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('تم الاتصال بقاعدة البيانات المحلية بنجاح.');
    }
});

// إنشاء جداول النظام المحاسبي وشامل المخزون والـ POS عند بدء التشغيل
db.serialize(() => {
    // جدول المنتجات والمخزون
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        barcode TEXT UNIQUE,
        price REAL NOT NULL,
        cost REAL NOT NULL,
        stock INTEGER NOT NULL
    )`);

    // جدول المبيعات (الفواتير)
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_amount REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول تفاصيل الفاتورة (الأصناف المباعة في كل فاتورة)
    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER,
        product_id INTEGER,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY(sale_id) REFERENCES sales(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )`);
});

// --- مسارات الـ API (العمليات البرمجية) ---

// 1. جلب كافة المنتجات والمخزون
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='products'", (err, row) => {
    // للتحقق السريع من الجداول
});

app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// 2. إضافة منتج جديد للمخزون
app.post('/api/products', (req, res) => {
    const { name, barcode, price, cost, stock } = req.body;
    const query = `INSERT INTO products (name, barcode, price, cost, stock) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [name, barcode, price, cost, stock], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, message: "تمت إضافة المنتج بنجاح" });
    });
});

// 3. إتمام عملية بيع جديدة (خصم المخزون وتجيل الفاتورة)
app.post('/api/sales', (req, res) => {
    const { items, total_amount } = req.body; // items: [{product_id, quantity, price}]

    db.run(`INSERT INTO sales (total_amount) VALUES (?)`, [total_amount], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const saleId = this.lastID;

        const stmt = db.prepare(`INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`);
        const updateStock = db.prepare(`UPDATE products SET stock = stock - ? WHERE id = ?`);

        items.forEach(item => {
            stmt.run(saleId, item.product_id, item.quantity, item.price);
            updateStock.run(item.quantity, item.product_id);
        });

        stmt.finalize();
        updateStock.finalize();

        res.json({ success: true, saleId: saleId, message: "تمت عملية البيع وتحديث المخزون بنجاح" });
    });
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(`السيرفر يعمل حالياً على المنفذ ${PORT}`);
});
