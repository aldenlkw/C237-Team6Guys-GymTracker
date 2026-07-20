const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const authRoutes = require('./routes/auth');
const { isAuthenticated } = require('./middleware/authMiddleware');

const app = express();
const sessionSecret = 'gymtrack-session-secret-2026';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    name: 'gymtrack.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.errors = req.flash('error');
  res.locals.successes = req.flash('success');
  res.locals.oldInput = req.flash('oldInput')[0] || {};
  res.locals.user = req.session.user || null;
  next();
});

app.get('/', (req, res) => {
  res.redirect(req.session.user ? '/dashboard' : '/login');
});

app.use(authRoutes);

// Temporary protected page. Replace this route/view when the full dashboard is ready.
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.render('dashboard', { title: 'Dashboard' });
});

app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
  console.error('Unhandled application error:', err);
  if (res.headersSent) return next(err);
  res.status(500).send('Something went wrong. Please try again later.');
});

const PORT = 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GymTrack is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
