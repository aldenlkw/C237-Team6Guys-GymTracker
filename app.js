const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required. Copy .env.example to .env and configure it.');
}

const authRoutes = require('./routes/auth');
const goalRoutes = require('./routes/goals');
const workoutRoutes = require('./routes/workouts');
const forumRoutes = require('./routes/forum');
const adminRoutes = require('./routes/admin');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    name: 'gymtrack.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 8
    }
}));
app.use(flash());

app.use((req, res, next) => {
    const successes = req.flash('success');
    const errors = req.flash('error');
    res.locals.user = req.session.user || null;
    res.locals.success = successes;
    res.locals.error = errors;
    res.locals.errors = errors;
    res.locals.successes = successes;
    res.locals.oldInput = req.flash('oldInput')[0] || {};
    next();
});

// ---------- Route files ----------
const dashboardRoutes = require('./routes/dashboard');   // Vince

app.use('/', authRoutes);                                // Fahmy
app.use('/goals', goalRoutes);                           // Alden
app.use('/workouts', workoutRoutes);                     // Kaijet + Sid
app.use('/forum', forumRoutes);                          // Sid (forum)
app.use('/dashboard', dashboardRoutes);                  // Vince
app.use('/admin', adminRoutes);                          // Zarick

// ---------- Landing page ----------
app.get('/', (req, res) => {
    res.redirect(req.session.user ? '/dashboard' : '/login');
});

// ---------- 404 ----------
app.use((req, res) => {
    res.status(404).send('404 - Page not found');
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
    console.error('Unhandled application error:', err);
    if (res.headersSent) return next(err);
    res.status(500).send('Something went wrong. Please try again later.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`GymTracker running on http://localhost:${PORT}`));
