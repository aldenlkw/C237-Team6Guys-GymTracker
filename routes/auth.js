const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../dbConfig');
const { isGuest } = require('../middleware/authMiddleware');

const router = express.Router();
const SALT_ROUNDS = 12;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/register', isGuest, (req, res) => {
  res.render('register', { title: 'Create account' });
});

router.post('/register', isGuest, async (req, res) => {
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');
  const errors = [];

  if (!username || !email || !password || !confirmPassword) errors.push('All fields are required.');
  if (username && username.length < 3) errors.push('Username must be at least 3 characters.');
  if (username.length > 50) errors.push('Username must not exceed 50 characters.');
  if (email && !emailPattern.test(email)) errors.push('Enter a valid email address.');
  if (email.length > 100) errors.push('Email must not exceed 100 characters.');
  if (password && password.length < 8) errors.push('Password must be at least 8 characters.');
  if (password !== confirmPassword) errors.push('Passwords do not match.');

  if (errors.length > 0) {
    req.flash('error', errors);
    req.flash('oldInput', { username, email });
    return res.redirect('/register');
  }

  try {
    const [existingUsers] = await pool.execute(
      'SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, email]
    );

    if (existingUsers.length > 0) {
      const duplicateUsername = existingUsers.some((user) => user.username.toLowerCase() === username.toLowerCase());
      const duplicateEmail = existingUsers.some((user) => user.email.toLowerCase() === email);
      const duplicateMessage = duplicateUsername && duplicateEmail
        ? 'That username and email are already registered.'
        : duplicateUsername
          ? 'That username is already registered.'
          : 'That email is already registered.';
      req.flash('error', duplicateMessage);
      req.flash('oldInput', { username, email });
      return res.redirect('/register');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.execute(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, 'user']
    );

    req.flash('success', 'Account created successfully. You can now log in.');
    return res.redirect('/login');
  } catch (error) {
    console.error('Registration failed:', { code: error.code, message: error.message });
    req.flash(
      'error',
      error.code === 'ER_DUP_ENTRY'
        ? 'That username or email is already registered. Please choose different details.'
        : 'We could not create your account. Please try again later.'
    );
    req.flash('oldInput', { username, email });
    return res.redirect('/register');
  }
});

router.get('/login', isGuest, (req, res) => {
  res.render('login', { title: 'Log in' });
});

router.post('/login', isGuest, async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  const invalidMessage = 'Invalid username/email or password.';

  if (!identifier || !password) {
    req.flash('error', invalidMessage);
    req.flash('oldInput', { identifier });
    return res.redirect('/login');
  }

  try {
    const [users] = await pool.execute(
      'SELECT userId, username, email, password, role FROM users WHERE username = ? OR email = ? LIMIT 1',
      [identifier, identifier.toLowerCase()]
    );
    const user = users[0];
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

    if (!user || !passwordMatches) {
      req.flash('error', invalidMessage);
      req.flash('oldInput', { identifier });
      return res.redirect('/login');
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Session regeneration failed:', regenerateError);
        req.flash('error', 'Login could not be completed. Please try again.');
        return res.redirect('/login');
      }

      req.session.user = {
        id: user.userId,
        userId: user.userId,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      return req.session.save((saveError) => {
        if (saveError) {
          console.error('Session save failed:', saveError);
          return res.status(500).send('Login could not be completed. Please try again.');
        }
        return res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('Login failed:', { code: error.code, message: error.message });
    req.flash('error', 'Login is temporarily unavailable. Please try again later.');
    req.flash('oldInput', { identifier });
    return res.redirect('/login');
  }
});

router.post('/logout', (req, res) => {
  if (!req.session) return res.redirect('/login');

  req.session.destroy((error) => {
    if (error) {
      console.error('Logout failed:', error);
      return res.status(500).send('Logout could not be completed. Please try again.');
    }
    res.clearCookie('gymtrack.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.redirect('/login');
  });
});

module.exports = router;
