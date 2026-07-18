const mysql = require('mysql2');
require('dotenv').config();

// Local MySQL rejects SSL. Azure requires it.
// The DB_SSL flag in .env decides, so the SAME code runs in both places.
const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
};

if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: true };
}

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error('Database connection FAILED:', err.message);
        return;
    }
    console.log('Connected to MySQL database:', process.env.DB_NAME);
});

module.exports = connection;