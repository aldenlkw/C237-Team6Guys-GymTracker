const express = require('express');
const db = require('../dbConfig');
const { checkAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Every route in this file requires a logged-in user.
router.use(checkAuthenticated);

// ---------------------------------------------------------------
// Helper: a goal is "achieved" once the user's best ever lift for
// that exercise reaches the target weight. This UPDATE compares each
// active goal against the user's heaviest logged workout for the same
// exercise, and flips the status automatically. Runs before we list
// goals, so the page never shows a stale "active" badge.
// ---------------------------------------------------------------
const refreshAchievedGoals = (userId, callback) => {
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
    db.query(sql, [userId, userId], callback);
};

// ---------------------------------------------------------------
// GET /goals - list this user's goals with progress
// ---------------------------------------------------------------
router.get('/', (req, res) => {
    const userId = req.session.user.userId;

    refreshAchievedGoals(userId, (err) => {
        if (err) console.error(err);

        // LEFT JOIN on a subquery of the user's best lift per exercise.
        // LEFT (not INNER) so a goal still appears when the user has
        // never logged that exercise - bestWeight is simply NULL.
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

        db.query(sql, [userId, userId], (err, goals) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not load your goals.');
                return res.redirect('/');
            }

            const today = new Date();

            // Turn raw rows into what the view needs.
            const goalsWithProgress = goals.map(goal => {
                const best = goal.bestWeight ? parseFloat(goal.bestWeight) : 0;
                const target = parseFloat(goal.targetWeight);

                // Cap at 100 so an over-achieved goal cannot render a
                // progress bar wider than its container.
                const percent = Math.min(Math.round((best / target) * 100), 100);

                // Days between today and the target date.
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
        });
    });
});

// ---------------------------------------------------------------
// GET /goals/add - show the create form
// ---------------------------------------------------------------
router.get('/add', (req, res) => {
    db.query('SELECT * FROM exercises ORDER BY muscleGroup, exerciseName',
        (err, exercises) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not load the exercise list.');
                return res.redirect('/goals');
            }
            res.render('addGoal', { exercises });
        });
});

// ---------------------------------------------------------------
// POST /goals/add - create a goal
// ---------------------------------------------------------------
router.post('/add', (req, res) => {
    const { exerciseId, targetWeight, targetDate } = req.body;
    const userId = req.session.user.userId;

    // Server-side validation. The browser's "required" can be bypassed.
    if (!exerciseId || !targetWeight || !targetDate) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/goals/add');
    }
    if (parseFloat(targetWeight) <= 0) {
        req.flash('error', 'Target weight must be greater than 0.');
        return res.redirect('/goals/add');
    }

    // Block one user setting two goals for the same exercise -
    // otherwise the progress bars would compete over the same lift.
    const dupSql = `SELECT goalId FROM goals
                    WHERE userId = ? AND exerciseId = ? AND status = 'active'`;
    db.query(dupSql, [userId, exerciseId], (err, existing) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Database error.');
            return res.redirect('/goals/add');
        }
        if (existing.length > 0) {
            req.flash('error', 'You already have an active goal for that exercise.');
            return res.redirect('/goals');
        }

        const sql = `INSERT INTO goals (userId, exerciseId, targetWeight, targetDate, status)
                     VALUES (?, ?, ?, ?, 'active')`;
        db.query(sql, [userId, exerciseId, targetWeight, targetDate], (err) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not create the goal.');
                return res.redirect('/goals/add');
            }
            req.flash('success', 'Goal created.');
            res.redirect('/goals');
        });
    });
});

// ---------------------------------------------------------------
// GET /goals/edit/:id - show the edit form
// ---------------------------------------------------------------
router.get('/edit/:id', (req, res) => {
    const userId = req.session.user.userId;

    // "AND userId = ?" is the ownership check. Without it, changing the
    // id in the URL would let any user edit anyone else's goal.
    const sql = 'SELECT * FROM goals WHERE goalId = ? AND userId = ?';
    db.query(sql, [req.params.id, userId], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Goal not found.');
            return res.redirect('/goals');
        }

        db.query('SELECT * FROM exercises ORDER BY muscleGroup, exerciseName',
            (err, exercises) => {
                if (err) {
                    console.error(err);
                    return res.redirect('/goals');
                }
                const goal = results[0];
                // <input type="date"> only accepts YYYY-MM-DD.
                goal.targetDateInput = new Date(goal.targetDate)
                    .toISOString().split('T')[0];
                res.render('editGoal', { goal, exercises });
            });
    });
});

// ---------------------------------------------------------------
// POST /goals/edit/:id - update a goal
// ---------------------------------------------------------------
router.post('/edit/:id', (req, res) => {
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

    // Reset to 'active' - if the target was raised, the goal is no
    // longer achieved. refreshAchievedGoals() re-flips it if it still is.
    const sql = `UPDATE goals
                 SET exerciseId = ?, targetWeight = ?, targetDate = ?, status = 'active'
                 WHERE goalId = ? AND userId = ?`;
    db.query(sql, [exerciseId, targetWeight, targetDate, req.params.id, userId],
        (err, result) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not update the goal.');
                return res.redirect('/goals');
            }
            if (result.affectedRows === 0) {
                req.flash('error', 'Goal not found.');
                return res.redirect('/goals');
            }
            req.flash('success', 'Goal updated.');
            res.redirect('/goals');
        });
});

// ---------------------------------------------------------------
// POST /goals/delete/:id - delete a goal
// POST, not GET: a link could be triggered by a crawler or a prefetch.
// ---------------------------------------------------------------
router.post('/delete/:id', (req, res) => {
    const userId = req.session.user.userId;

    const sql = 'DELETE FROM goals WHERE goalId = ? AND userId = ?';
    db.query(sql, [req.params.id, userId], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not delete the goal.');
            return res.redirect('/goals');
        }
        if (result.affectedRows === 0) {
            req.flash('error', 'Goal not found.');
            return res.redirect('/goals');
        }
        req.flash('success', 'Goal deleted.');
        res.redirect('/goals');
    });
});

module.exports = router;