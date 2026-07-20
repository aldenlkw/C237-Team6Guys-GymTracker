const mysql = require('mysql2');

// Hardcoded database configuration
const config = {
    host: 'localhost',
    user: 'root',
    password: 'RP738964$',
    database: 'c237_001_team6guys',
    port: 3306
};

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error('Database connection FAILED:', err.message);
        return;
    }
    console.log('Connected to MySQL database:', config.database);
});

module.exports = connection;
