const mysql = require('mysql2');
require('dotenv').config();

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
    throw new Error(`Missing database configuration: ${missingVariables.join(', ')}. Copy .env.example to .env and configure it.`);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    ssl: { rejectUnauthorized: false }
});

const promisePool = pool.promise();
module.exports = promisePool;   // default: promise (goals, workouts, forum, auth)
module.exports.cb = pool;        // callback pool for Vince's dashboard
