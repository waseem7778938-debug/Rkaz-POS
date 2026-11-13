const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// مسار تجريبي للتأكد من عمل الخادم
app.get('/', (req, res) => {
    res.send('Rkaz POS System is running successfully!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

