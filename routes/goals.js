const express = require('express');
const db = require('../dbConfig');
const { checkAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(checkAuthenticated);

// Flip active goals to "achieved" when the user's best lift reaches the target.
const refreshAchievedGoals = async (userId) => {
    // Promote to achieved when best lift reaches target
    await db.query(`
        UPDATE goals g
        JOIN (
            SELECT exerciseId, MAX(weight) AS bestWeight
            FROM workouts WHERE userId = ?
            GROUP BY exerciseId
        ) AS best ON best.exerciseId = g.exerciseId
        SET g.status = 'achieved'
        WHERE g.userId = ? AND g.status = 'active'
          AND best.bestWeight >= g.targetWeight`,
        [userId, userId]);

    // Demote back to active if best lift no longer meets target
    // (covers deleted workouts, or no workouts at all)
    await db.query(`
        UPDATE goals g
        LEFT JOIN (
            SELECT exerciseId, MAX(weight) AS bestWeight
            FROM workouts WHERE userId = ?
            GROUP BY exerciseId
        ) AS best ON best.exerciseId = g.exerciseId
        SET g.status = 'active'
        WHERE g.userId = ? AND g.status = 'achieved'
          AND (best.bestWeight IS NULL OR best.bestWeight < g.targetWeight)`,
        [userId, userId]);
};

// ENHANCEMENT: project whether the user will hit a goal by its deadline,
// based on their rate of improvement for that exercise.
const buildProjection = (history, target, targetDate) => {
    // Need at least 2 logged lifts to measure a rate of change.
    if (!history || history.length < 2) {
        return { status: 'insufficient', message: 'Log more workouts to see a projection.' };
    }

    const first = history[0];   // earliest lift
    const last = history[history.length - 1];  // latest lift
    const best = Math.max(...history.map(h => parseFloat(h.weight)));

    // Already there.
    if (best >= target) {
        return { status: 'achieved', message: 'Target already reached.' };
    }

    const startWeight = parseFloat(first.weight);
    const latestWeight = parseFloat(last.weight);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysBetween = (new Date(last.workoutDate) - new Date(first.workoutDate)) / msPerDay;

    // No time span or no gain = can't project forward.
    if (daysBetween <= 0 || latestWeight <= startWeight) {
        return { status: 'stalled', message: 'Not improving at your current pace. Lift heavier to stay on track.' };
    }

    const kgPerDay = (latestWeight - startWeight) / daysBetween;
    const kgRemaining = target - latestWeight;
    const daysNeeded = Math.ceil(kgRemaining / kgPerDay);

    const projectedDate = new Date(last.workoutDate);
    projectedDate.setDate(projectedDate.getDate() + daysNeeded);

    const deadline = new Date(targetDate);
    const onTrack = projectedDate <= deadline;
    const kgPerWeek = (kgPerDay * 7).toFixed(1);

    return {
        status: onTrack ? 'onTrack' : 'behind',
        kgPerWeek: kgPerWeek,
        projectedDate: projectedDate.toLocaleDateString('en-GB'),
        message: onTrack
            ? `At ${kgPerWeek} kg/week, you'll hit this around ${projectedDate.toLocaleDateString('en-GB')} — on track.`
            : `At ${kgPerWeek} kg/week, you'd reach it around ${projectedDate.toLocaleDateString('en-GB')} — after your deadline. Pick up the pace.`
    };
};

// GET /goals - list goals with progress AND projection
router.get('/', async (req, res) => {
    const userId = req.session.user.userId;
    try {
        await refreshAchievedGoals(userId);

        const sql = `
            SELECT g.goalId, g.exerciseId, g.targetWeight, g.targetDate, g.status,
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

        // For each goal, fetch that exercise's lift history and build a projection.
        const goalsWithProgress = await Promise.all(goals.map(async (goal) => {
            const best = goal.bestWeight ? parseFloat(goal.bestWeight) : 0;
            const target = parseFloat(goal.targetWeight);
            const percent = Math.min(Math.round((best / target) * 100), 100);
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysLeft = Math.ceil((new Date(goal.targetDate) - today) / msPerDay);

            // Pull this user's lift history for this exercise, oldest first.
            const [history] = await db.query(
                `SELECT weight, workoutDate FROM workouts
                 WHERE userId = ? AND exerciseId = ?
                 ORDER BY workoutDate ASC`,
                [userId, goal.exerciseId]
            );

            const projection = goal.status === 'achieved'
                ? { status: 'achieved', message: 'Goal achieved!' }
                : buildProjection(history, target, goal.targetDate);

            return {
                ...goal,
                bestWeight: best,
                percent: percent,
                remaining: Math.max(target - best, 0).toFixed(2),
                daysLeft: daysLeft,
                overdue: daysLeft < 0 && goal.status === 'active',
                projection: projection
            };
        }));

        res.render('goals', { goals: goalsWithProgress });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not load your goals.');
        res.redirect('/');
    }
});

// GET /goals/add
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

// POST /goals/add
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
        const [existing] = await db.query(
            `SELECT goalId FROM goals WHERE userId = ? AND exerciseId = ? AND status = 'active'`,
            [userId, exerciseId]
        );
        if (existing.length > 0) {
            req.flash('error', 'You already have an active goal for that exercise.');
            return res.redirect('/goals');
        }

        await db.query(
            `INSERT INTO goals (userId, exerciseId, targetWeight, targetDate, status)
             VALUES (?, ?, ?, ?, 'active')`,
            [userId, exerciseId, targetWeight, targetDate]
        );
        req.flash('success', 'Goal created.');
        res.redirect('/goals');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Could not create the goal.');
        res.redirect('/goals/add');
    }
});

// GET /goals/edit/:id
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

// POST /goals/edit/:id
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
        const [result] = await db.query(
            `UPDATE goals SET exerciseId = ?, targetWeight = ?, targetDate = ?, status = 'active'
             WHERE goalId = ? AND userId = ?`,
            [exerciseId, targetWeight, targetDate, req.params.id, userId]
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

// POST /goals/delete/:id
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