const express = require('express');
const router = express.Router();
const db = require('../dbConfig');

const checkAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

// GET /workouts - list + search + filter + sort
router.get('/', checkAuth, async (req, res) => {
    const userId = req.session.user.userId;
    const search = req.query.search || '';
    const muscle = req.query.muscle || '';
    const sort = req.query.sort || '';

    let sql = `
        SELECT w.workoutId, w.weight, w.reps, w.sets, w.workoutDate, w.notes,
               e.exerciseName, e.muscleGroup
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?`;
    const values = [userId];

    if (search !== '') {
        sql += ' AND e.exerciseName LIKE ?';
        values.push('%' + search + '%');
    }
    if (muscle !== '') {
        sql += ' AND e.muscleGroup = ?';
        values.push(muscle);
    }
    if (sort === 'newest') sql += ' ORDER BY w.workoutDate DESC';
    else if (sort === 'oldest') sql += ' ORDER BY w.workoutDate ASC';
    else if (sort === 'highest') sql += ' ORDER BY w.weight DESC';
    else if (sort === 'lowest') sql += ' ORDER BY w.weight ASC';
    else sql += ' ORDER BY w.workoutDate DESC';

    try {
        const [results] = await db.query(sql, values);
        res.render('workouts', { workouts: results, user: req.session.user, search });
    } catch (err) {
        console.error('Error fetching workouts:', err);
        res.status(500).send('Error fetching workouts');
    }
});

// GET /workouts/search - AJAX live search (returns JSON)
router.get('/search', checkAuth, async (req, res) => {
    const userId = req.session.user.userId;
    const search = req.query.search || '';
    const muscle = req.query.muscle || '';
    const sort = req.query.sort || '';

    let sql = `
        SELECT w.workoutId, w.weight, w.reps, w.sets, w.workoutDate, w.notes,
               e.exerciseName, e.muscleGroup
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?`;
    const values = [userId];

    if (search !== '') {
        sql += ' AND e.exerciseName LIKE ?';
        values.push('%' + search + '%');
    }
    if (muscle !== '') {
        sql += ' AND e.muscleGroup = ?';
        values.push(muscle);
    }
    if (sort === 'newest') sql += ' ORDER BY w.workoutDate DESC';
    else if (sort === 'oldest') sql += ' ORDER BY w.workoutDate ASC';
    else if (sort === 'highest') sql += ' ORDER BY w.weight DESC';
    else if (sort === 'lowest') sql += ' ORDER BY w.weight ASC';
    else sql += ' ORDER BY w.workoutDate DESC';

    try {
        const [results] = await db.query(sql, values);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// GET /workouts/add
router.get('/add', checkAuth, async (req, res) => {
    try {
        const [exercises] = await db.query('SELECT exerciseId, exerciseName, muscleGroup FROM exercises ORDER BY exerciseName');
        res.render('addWorkout', { user: req.session.user, exercises });
    } catch (err) {
        console.error('Error fetching exercises:', err);
        res.status(500).send('Error loading add workout form');
    }
});

// POST /workouts/add
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

// GET /workouts/edit/:id
router.get('/edit/:id', checkAuth, async (req, res) => {
    const workoutId = req.params.id;
    const userId = req.session.user.userId;
    try {
        const [results] = await db.query(
            'SELECT * FROM workouts WHERE workoutId = ? AND userId = ?',
            [workoutId, userId]
        );
        if (results.length === 0) return res.status(403).send('Unauthorized');
        const [exercises] = await db.query('SELECT exerciseId, exerciseName, muscleGroup FROM exercises ORDER BY exerciseName');
        res.render('editWorkout', { workout: results[0], user: req.session.user, exercises });
    } catch (err) {
        console.error('Error fetching workout:', err);
        res.status(500).send('Error fetching workout');
    }
});

// POST /workouts/edit/:id
router.post('/edit/:id', checkAuth, async (req, res) => {
    const workoutId = req.params.id;
    const userId = req.session.user.userId;
    const { exerciseId, weight, reps, sets, workoutDate, notes } = req.body;
    if (!exerciseId || !weight || !reps || !sets || !workoutDate) {
        return res.status(400).send('All fields are required');
    }
    try {
        const [verify] = await db.query('SELECT userId FROM workouts WHERE workoutId = ?', [workoutId]);
        if (verify.length === 0 || verify[0].userId !== userId) {
            return res.status(403).send('Unauthorized');
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

// GET /workouts/delete/:id
router.get('/delete/:id', checkAuth, async (req, res) => {
    const workoutId = req.params.id;
    const userId = req.session.user.userId;
    try {
        const [verify] = await db.query('SELECT userId FROM workouts WHERE workoutId = ?', [workoutId]);
        if (verify.length === 0 || verify[0].userId !== userId) {
            return res.status(403).send('Unauthorized');
        }
        await db.query('DELETE FROM workouts WHERE workoutId = ?', [workoutId]);
        res.redirect('/workouts');
    } catch (err) {
        console.error('Error deleting workout:', err);
        res.status(500).send('Error deleting workout');
    }
});

module.exports = router;