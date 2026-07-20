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
router.get('/', checkAuth, async (req, res) => {
  const userId = req.session.user.userId;
  try {
    const [results] = await db.query(
      `SELECT w.workoutId, w.weight, w.reps, w.sets, w.workoutDate, w.notes,
              e.exerciseName, e.muscleGroup
       FROM workouts w
       JOIN exercises e ON w.exerciseId = e.exerciseId
       WHERE w.userId = ?
       ORDER BY w.workoutDate DESC`,
      [userId]
    );
    res.render('workouts', { workouts: results, user: req.session.user });
  } catch (err) {
    console.error('Error fetching workouts:', err);
    res.status(500).send('Error fetching workouts');
  }
});

// GET /workouts/add - Render add workout form
router.get('/add', checkAuth, async (req, res) => {
  try {
    const [exercises] = await db.query('SELECT exerciseId, exerciseName, muscleGroup FROM exercises ORDER BY exerciseName');
    res.render('addWorkout', { user: req.session.user, exercises });
  } catch (err) {
    console.error('Error fetching exercises:', err);
    res.status(500).send('Error loading add workout form');
  }
});

// POST /workouts/add - Insert new workout
router.post('/add', checkAuth, async (req, res) => {
  const { exerciseId, weight, reps, sets, workoutDate, notes } = req.body;
  const userId = req.session.user.userId;

  if (!exerciseId || !weight || !reps || !sets || !workoutDate) {
    return res.status(400).send('All fields are required');
  }

  try {
    await db.query(
      'INSERT INTO workouts (userId, exerciseId, weight, reps, sets, workoutDate, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, exerciseId, weight, reps, sets, workoutDate, notes || null]
    );
    res.redirect('/workouts');
  } catch (err) {
    console.error('Error adding workout:', err);
    res.status(500).send('Error adding workout');
  }
});

// GET /workouts/edit/:id - Render edit form with pre-filled data
router.get('/edit/:id', checkAuth, async (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.userId;

  try {
    const [results] = await db.query(
      'SELECT * FROM workouts WHERE workoutId = ? AND userId = ?',
      [workoutId, userId]
    );
    if (results.length === 0) {
      return res.status(403).send('Unauthorized: Workout not found or does not belong to you');
    }
    const [exercises] = await db.query('SELECT exerciseId, exerciseName, muscleGroup FROM exercises ORDER BY exerciseName');
    res.render('editWorkout', { workout: results[0], user: req.session.user, exercises });
  } catch (err) {
    console.error('Error fetching workout:', err);
    res.status(500).send('Error fetching workout');
  }
});

// POST /workouts/edit/:id - Update workout
router.post('/edit/:id', checkAuth, async (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.userId;
  const { exerciseId, weight, reps, sets, workoutDate, notes } = req.body;

  if (!exerciseId || !weight || !reps || !sets || !workoutDate) {
    return res.status(400).send('All fields are required');
  }

  try {
    const [verifyResults] = await db.query(
      'SELECT userId FROM workouts WHERE workoutId = ?',
      [workoutId]
    );
    if (verifyResults.length === 0 || verifyResults[0].userId !== userId) {
      return res.status(403).send('Unauthorized: Workout does not belong to you');
    }

    await db.query(
      'UPDATE workouts SET exerciseId = ?, weight = ?, reps = ?, sets = ?, workoutDate = ?, notes = ? WHERE workoutId = ?',
      [exerciseId, weight, reps, sets, workoutDate, notes || null, workoutId]
    );
    res.redirect('/workouts');
  } catch (err) {
    console.error('Error updating workout:', err);
    res.status(500).send('Error updating workout');
  }
});

// GET /workouts/delete/:id - Delete workout
router.get('/delete/:id', checkAuth, async (req, res) => {
  const workoutId = req.params.id;
  const userId = req.session.user.userId;

  try {
    const [verifyResults] = await db.query(
      'SELECT userId FROM workouts WHERE workoutId = ?',
      [workoutId]
    );
    if (verifyResults.length === 0 || verifyResults[0].userId !== userId) {
      return res.status(403).send('Unauthorized: Workout does not belong to you');
    }

    await db.query('DELETE FROM workouts WHERE workoutId = ?', [workoutId]);
    res.redirect('/workouts');
  } catch (err) {
    console.error('Error deleting workout:', err);
    res.status(500).send('Error deleting workout');
  }
});

module.exports = router;