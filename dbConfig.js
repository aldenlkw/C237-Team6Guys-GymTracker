const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'c237-eaint-mysql.mysql.database.azure.com',
    user: 'c237_001',
    password: 'c237001@2026!',
    database: 'c237_001_team6guys',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // fail after 10 seconds instead of hanging forever
    ssl: {
        rejectUnauthorized: false
    }
});

module.exports = pool;