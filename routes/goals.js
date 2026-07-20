const express = require('express');
const db = require('../dbConfig');
const { checkAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(checkAuthenticated);

// Flip active goals to "achieved" when the user's best lift reaches the target.
const refreshAchievedGoals = async (userId) => {
    const sql = `
        UPDATE goals g
        JOIN (
            SELECT exerciseId, MAX(weight) AS bestWeight
            FROM workouts
            WHERE userId = ?
            GROUP BY exerciseId
        ) AS best ON best.exerciseId = g.exerciseId
        SET g.status = 'achieved'
        WHERE g.userId = ?
          AND g.status = 'active'
          AND best.bestWeight >= g.targetWeight`;
    await db.query(sql, [userId, userId]);
};

// GET /goals - list this user's goals with progress
router.get('/', async (req, res) => {
    const userId = req.session.user.userId;
    try {
        await refreshAchievedGoals(userId);

        const sql = `
            SELECT g.goalId, g.targetWeight, g.targetDate, g.status,
                   e.exerciseName, e.muscleGroup,
                   best.bestWeight
            FROM goals g
            JOIN exercises e ON g.exerciseId = e.exerciseId
            LEFT JOIN (
                SELECT exerciseId, MAX(weight) AS bestWeight
                FROM workouts
                WHERE userId = ?
                GROUP BY exerciseId
            ) AS best ON best.exerciseId = g.exerciseId
            WHERE g.userId = ?
            ORDER BY g.status ASC, g.targetDate ASC`;

        const [goals] = await db.query(sql, [userId, userId]);

        const today = new Date();
        const goalsWithProgress = goals.map(goal => {
            const best = goal.bestWeight ? parseFloat(goal.bestWeight) : 0;
            const target = parseFloat(goal.targetWeight);
            const percent = Math.min(Math.round((best / target) * 100), 100);
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysLeft = Math.ceil((new Date(goal.targetDate) - today) / msPerDay);
            return {
                ...goal,
                bestWeight: best,
                percent: percent,
                remaining: Math.max(target - best, 0).toFixed(2),
                daysLeft: daysLeft,
                overdue: daysLeft < 0 && goal.status === 'active'
            };
        });

        res.render('goals', { goals: goalsWithProgress });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load your goals.');
        res.redirect('/');
    }
});

// GET /goals/add - show the create form
router.get('/add', async (req, res) => {
    try {
        const [exercises] = await db.query(
            'SELECT * FROM exercises ORDER BY muscleGroup, exerciseName'
        );
        res.render('addGoal', { exercises });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load the exercise list.');
        res.redirect('/goals');
    }
});

// POST /goals/add - create a goal
router.post('/add', async (req, res) => {
    const { exerciseId, targetWeight, targetDate } = req.body;
    const userId = req.session.user.userId;

    if (!exerciseId || !targetWeight || !targetDate) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/goals/add');
    }
    if (parseFloat(targetWeight) <= 0) {
        req.flash('error', 'Target weight must be greater than 0.');
        return res.redirect('/goals/add');
    }

    try {
        const dupSql = `SELECT goalId FROM goals
                        WHERE userId = ? AND exerciseId = ? AND status = 'active'`;
        const [existing] = await db.query(dupSql, [userId, exerciseId]);
        if (existing.length > 0) {
            req.flash('error', 'You already have an active goal for that exercise.');
            return res.redirect('/goals');
        }

        const sql = `INSERT INTO goals (userId, exerciseId, targetWeight, targetDate, status)
                     VALUES (?, ?, ?, ?, 'active')`;
        await db.query(sql, [userId, exerciseId, targetWeight, targetDate]);
        req.flash('success', 'Goal created.');
        res.redirect('/goals');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not create the goal.');
        res.redirect('/goals/add');
    }
});

// GET /goals/edit/:id - show the edit form
router.get('/edit/:id', async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const [results] = await db.query(
            'SELECT * FROM goals WHERE goalId = ? AND userId = ?',
            [req.params.id, userId]
        );
        if (results.length === 0) {
            req.flash('error', 'Goal not found.');
            return res.redirect('/goals');
        }

        const [exercises] = await db.query(
            'SELECT * FROM exercises ORDER BY muscleGroup, exerciseName'
        );

        const goal = results[0];
        goal.targetDateInput = new Date(goal.targetDate).toISOString().split('T')[0];
        res.render('editGoal', { goal, exercises });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Goal not found.');
        res.redirect('/goals');
    }
});

// POST /goals/edit/:id - update a goal
router.post('/edit/:id', async (req, res) => {
    const { exerciseId, targetWeight, targetDate } = req.body;
    const userId = req.session.user.userId;

    if (!exerciseId || !targetWeight || !targetDate) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/goals/edit/' + req.params.id);
    }
    if (parseFloat(targetWeight) <= 0) {
        req.flash('error', 'Target weight must be greater than 0.');
        return res.redirect('/goals/edit/' + req.params.id);
    }

    try {
        const sql = `UPDATE goals
                     SET exerciseId = ?, targetWeight = ?, targetDate = ?, status = 'active'
                     WHERE goalId = ? AND userId = ?`;
        const [result] = await db.query(
            sql, [exerciseId, targetWeight, targetDate, req.params.id, userId]
        );
        if (result.affectedRows === 0) {
            req.flash('error', 'Goal not found.');
            return res.redirect('/goals');
        }
        req.flash('success', 'Goal updated.');
        res.redirect('/goals');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not update the goal.');
        res.redirect('/goals');
    }
});

// POST /goals/delete/:id - delete a goal
router.post('/delete/:id', async (req, res) => {
    const userId = req.session.user.userId;
    try {
        const [result] = await db.query(
            'DELETE FROM goals WHERE goalId = ? AND userId = ?',
            [req.params.id, userId]
        );
        if (result.affectedRows === 0) {
            req.flash('error', 'Goal not found.');
            return res.redirect('/goals');
        }
        req.flash('success', 'Goal deleted.');
        res.redirect('/goals');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not delete the goal.');
        res.redirect('/goals');
    }
});

module.exports = router;