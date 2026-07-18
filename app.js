// =====================================================================
// GymTracker - C237 CA2 - Team 6 Guys
// SHARED FILE. Each member uncomments ONLY their own route lines below,
// in their own commit. Do not edit another member's section.
//
// 1 Fahmy  - Authentication
// 2 Kaijet - Workout CRUD
// 3 Sid    - Search / Filter / Sort
// 4 Alden  - Goal Tracking
// 5 Vince  - Dashboard & Statistics
// 6 Zarick - Admin
// =====================================================================

const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
require('dotenv').config();

const app = express();

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Core middleware ----------
app.use(express.urlencoded({ extended: false })); // reads form POST data
app.use(express.json());                          // reads AJAX JSON data (Sid)
app.use(express.static(path.join(__dirname, 'public'))); // serves style.css

// ---------- Sessions + flash ----------
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));
app.use(flash());

// Makes the logged-in user and flash messages available inside EVERY .ejs file
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

// ---------- Route files ----------
// const authRoutes = require('./routes/auth');           // Fahmy
// const workoutRoutes = require('./routes/workouts');    // Kaijet + Sid
// const goalRoutes = require('./routes/goals');          // Alden
// const dashboardRoutes = require('./routes/dashboard'); // Vince
// const adminRoutes = require('./routes/admin');         // Zarick

// app.use('/', authRoutes);                              // Fahmy
// app.use('/workouts', workoutRoutes);                   // Kaijet + Sid
// app.use('/goals', goalRoutes);                         // Alden
// app.use('/dashboard', dashboardRoutes);                // Vince
// app.use('/admin', adminRoutes);                        // Zarick

// =====================================================================
// TEMPORARY DEVELOPMENT SCAFFOLD - NOT A FEATURE
// This exists ONLY so the team can build and test their own routes
// before Fahmy's real login/register is merged.
// FAHMY: delete this entire block when routes/auth.js is ready.
// =====================================================================
const db = require('./dbConfig');

app.get('/dev-login/:username', (req, res) => {
    db.query('SELECT userId, username, role FROM users WHERE username = ?',
        [req.params.username], (err, results) => {
            if (err || results.length === 0) return res.send('No such test user.');
            req.session.user = results[0];
            res.redirect('/goals');
        });
});

app.get('/dev-logout', (req, res) => {
    req.session.destroy(() => res.send('Logged out. Use /dev-login/:username'));
});
// ===================== END TEMPORARY SCAFFOLD ========================

// ---------- Landing page ----------
app.get('/', (req, res) => {
    res.redirect('/goals');
});

// ---------- 404 ----------
app.use((req, res) => {
    res.status(404).send('404 - Page not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));