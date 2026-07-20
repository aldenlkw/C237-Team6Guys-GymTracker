const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'c237-eaint-mysql.mysql.database.azure.com',
    user: 'c237_001',
    password: 'c237001@2026!',
    database: 'c237_001_team6guys',
    port: 3306,
    ssl: { rejectUnauthorized: true }
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database!');
});

module.exports = db;