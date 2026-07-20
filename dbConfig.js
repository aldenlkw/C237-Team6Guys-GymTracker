const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'c237-eaint-mysql.mysql.database.azure.com',
    user: process.env.DB_USER || 'c237_001',
    password: process.env.DB_PASSWORD || 'c237001@2026!',
    database: process.env.DB_NAME || 'c237_001_team6guys',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false }
});

module.exports = pool.promise();