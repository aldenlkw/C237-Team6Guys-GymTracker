const express = require('express');
const router = express.Router();
const db = require('../dbConfig');

// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// GET /workouts - List all workouts for logged-in user, ordered by date descending
router.get('/', checkAuth, (req, res) => {
  const userId = req.session.user.id;
  const query = 'SELECT * FROM workouts WHERE userId = ? ORDER BY date DESC';

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching workouts:', err);
      return res.status(500).send('Error fetching workouts');
    }
    res.render('workouts', { workouts: results, user: req.session.user });
  });
});

// GET /workouts/add - Render add workout form
router.get('/add', checkAuth, (req, res) => {
  res.render('addWorkout', { user: req.session.user });
});

// POST /workouts/add - Insert new workout
router.post('/add', checkAuth, (req, res) => {
  const { exercise, weight, reps, sets, date } = req.body;
  const userId = req.session.user.id;

  // Validate input
  if (!exercise || !weight || !reps || !sets || !date) {
    return res.status(400).send('All fields are required');
  }

  const query = 'INSERT INTO workouts (userId, exercise, weight, reps, sets, date) VALUES (?, ?, ?, ?, ?, ?)';
  db.query(query, [userId, exercise, weight, reps, sets, date], (err, results) => {
    if (err) {
      console.error('Error adding workout:', err);
      return res.status(500).send('Error adding workout');
    }
    res.redirect('/workouts');
  });
});

// GET /workouts/edit/:id - Render edit form with pre-filled data
router.get('/edit/:id', checkAuth, (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.id;

  const query = 'SELECT * FROM workouts WHERE workoutId = ? AND userId = ?';
  db.query(query, [workoutId, userId], (err, results) => {
    if (err) {
      console.error('Error fetching workout:', err);
      return res.status(500).send('Error fetching workout');
    }
    if (results.length === 0) {
      return res.status(403).send('Unauthorized: Workout not found or does not belong to you');
    }
    res.render('editWorkout', { workout: results[0], user: req.session.user });
  });
});

// POST /workouts/edit/:id - Update workout
router.post('/edit/:id', checkAuth, (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.id;
  const { exercise, weight, reps, sets, date } = req.body;

  // Validate input
  if (!exercise || !weight || !reps || !sets || !date) {
    return res.status(400).send('All fields are required');
  }

  // Verify ownership before updating
  const verifyQuery = 'SELECT userId FROM workouts WHERE workoutId = ?';
  db.query(verifyQuery, [workoutId], (err, results) => {
    if (err) {
      console.error('Error verifying workout:', err);
      return res.status(500).send('Error verifying workout');
    }
    if (results.length === 0 || results[0].userId !== userId) {
      return res.status(403).send('Unauthorized: Workout does not belong to you');
    }

    const updateQuery = 'UPDATE workouts SET exercise = ?, weight = ?, reps = ?, sets = ?, date = ? WHERE workoutId = ?';
    db.query(updateQuery, [exercise, weight, reps, sets, date, workoutId], (err) => {
      if (err) {
        console.error('Error updating workout:', err);
        return res.status(500).send('Error updating workout');
      }
      res.redirect('/workouts');
    });
  });
});

// GET /workouts/delete/:id - Delete workout
router.get('/delete/:id', checkAuth, (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.id;

  // Verify ownership before deleting
  const verifyQuery = 'SELECT userId FROM workouts WHERE workoutId = ?';
  db.query(verifyQuery, [workoutId], (err, results) => {
    if (err) {
      console.error('Error verifying workout:', err);
      return res.status(500).send('Error verifying workout');
    }
    if (results.length === 0 || results[0].userId !== userId) {
      return res.status(403).send('Unauthorized: Workout does not belong to you');
    }

    const deleteQuery = 'DELETE FROM workouts WHERE workoutId = ?';
    db.query(deleteQuery, [workoutId], (err) => {
      if (err) {
        console.error('Error deleting workout:', err);
        return res.status(500).send('Error deleting workout');
      }
      res.redirect('/workouts');
    });
  });
});

module.exports = router;
