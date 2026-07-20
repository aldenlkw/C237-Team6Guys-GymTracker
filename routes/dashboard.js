const express = require('express');
const db = require('../dbConfig');
const { checkAuthenticated } = require('../middleware/auth');

const router = express.Router();

router.use(checkAuthenticated);

const buildDateFilter = (range, fieldName) => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    if (range === '7d') {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 6);
        return {
            sql: ` AND ${fieldName} BETWEEN ? AND ?`,
            params: [startDate.toISOString().split('T')[0], endDate]
        };
    }

    if (range === '30d') {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 29);
        return {
            sql: ` AND ${fieldName} BETWEEN ? AND ?`,
            params: [startDate.toISOString().split('T')[0], endDate]
        };
    }

    if (range === '90d') {
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 89);
        return {
            sql: ` AND ${fieldName} BETWEEN ? AND ?`,
            params: [startDate.toISOString().split('T')[0], endDate]
        };
    }

    if (range === '1y') {
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        return {
            sql: ` AND ${fieldName} BETWEEN ? AND ?`,
            params: [startDate.toISOString().split('T')[0], endDate]
        };
    }

    return { sql: '', params: [] };
};

const buildInsights = (stats) => {
    const insights = [];

    if (stats.mostTrainedMuscleGroup) {
        insights.push(`You trained ${stats.mostTrainedMuscleGroup} most this period.`);
    }

    if (stats.mostImprovedExercise && stats.mostImprovedExercise.exerciseName) {
        insights.push(`${stats.mostImprovedExercise.exerciseName} improved by ${stats.mostImprovedExercise.improvementAmount} ${stats.mostImprovedExercise.weightUnit || 'kg'}.`);
    }

    if (stats.currentStreak > 0) {
        insights.push(`You are on a ${stats.currentStreak}-day training streak.`);
    } else if (stats.totalWorkouts > 0) {
        insights.push('You have not trained on consecutive days in this window.');
    }

    if (stats.averageWorkoutDuration > 0) {
        insights.push(`Average workout duration is ${stats.averageWorkoutDuration} minutes.`);
    }

    if (stats.lastWorkoutDate) {
        insights.push(`Your last workout was on ${stats.lastWorkoutDate}.`);
    }

    return insights;
};

const renderDashboard = (req, res, extra = {}) => {
    const userId = req.session.user.userId;
    const range = req.query.range || 'all';
    const searchTerm = (req.query.search || '').trim().toLowerCase();
    const sortMode = req.query.sort || 'newest';
    const successMessage = res.locals.success && res.locals.success[0];
    const errorMessage = res.locals.error && res.locals.error[0];
    const workoutDateFilter = buildDateFilter(range, 'w.workoutDate');
    const personalRecordDateFilter = buildDateFilter(range, 'achievedDate');

    const totalWorkoutsSql = `
        SELECT COUNT(*) AS totalWorkouts
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}`;

    const totalVolumeSql = `
        SELECT SUM(weight * reps * sets) AS totalVolume
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}`;

    const favouriteExerciseSql = `
        SELECT e.exerciseName, COUNT(*) AS timesLogged
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?${workoutDateFilter.sql}
        GROUP BY e.exerciseName
        ORDER BY timesLogged DESC
        LIMIT 1`;

    const volumeTrendSql = `
        SELECT w.workoutDate,
               SUM(w.weight * w.reps * w.sets) AS sessionVolume
        FROM workouts w
        WHERE w.userId = ?${workoutDateFilter.sql}
        GROUP BY w.workoutDate
        ORDER BY w.workoutDate ASC`;

    const muscleBreakdownSql = `
        SELECT e.muscleGroup, COUNT(*) AS workoutCount
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?${workoutDateFilter.sql}
        GROUP BY e.muscleGroup`;

    const workoutBestsSql = `
        SELECT MAX(w.weight) AS maxWeight,
               MAX(w.weight * w.reps * w.sets) AS maxVolume,
               MAX(w.reps) AS maxReps
        FROM workouts w
        WHERE w.userId = ?${workoutDateFilter.sql}`;

    const trainingDaysSql = `
        SELECT COUNT(DISTINCT workoutDate) AS trainingDays
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}`;

    const averageDurationSql = `
        SELECT AVG(durationMinutes) AS averageDuration
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}
          AND durationMinutes IS NOT NULL`;

    const averageVolumeSql = `
        SELECT AVG(weight * reps * sets) AS averageVolume
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}`;

    const workoutDatesSql = `
        SELECT workoutDate
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}
        GROUP BY workoutDate
        ORDER BY workoutDate ASC`;

    const weeklyFrequencySql = `
        SELECT DATE_FORMAT(workoutDate, '%x-%v') AS label,
               COUNT(*) AS workoutCount
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}
        GROUP BY DATE_FORMAT(workoutDate, '%x-%v')
        ORDER BY MIN(workoutDate) ASC`;

    const monthlyVolumeSql = `
        SELECT DATE_FORMAT(workoutDate, '%Y-%m') AS label,
               SUM(weight * reps * sets) AS monthVolume
        FROM workouts
        WHERE userId = ?${workoutDateFilter.sql}
        GROUP BY DATE_FORMAT(workoutDate, '%Y-%m')
        ORDER BY MIN(workoutDate) ASC`;

    const personalRecordsSql = `
        SELECT * FROM personal_records
        WHERE userId = ?${personalRecordDateFilter.sql}
        ORDER BY achievedDate DESC`;

    const strongestLiftSql = `
        SELECT MAX(maxWeight) AS strongestLift
        FROM personal_records
        WHERE userId = ?${personalRecordDateFilter.sql}`;

    const mostImprovedExerciseSql = `
        SELECT exerciseName, improvementAmount, weightUnit
        FROM personal_records
        WHERE userId = ?${personalRecordDateFilter.sql}
        ORDER BY improvementAmount DESC
        LIMIT 1`;

    const mostTrainedMuscleGroupSql = `
        SELECT e.muscleGroup, COUNT(*) AS workoutCount
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?${workoutDateFilter.sql}
        GROUP BY e.muscleGroup
        ORDER BY workoutCount DESC
        LIMIT 1`;

    const mostFrequentExerciseSql = `
        SELECT e.exerciseName, COUNT(*) AS timesLogged
        FROM workouts w
        JOIN exercises e ON w.exerciseId = e.exerciseId
        WHERE w.userId = ?${workoutDateFilter.sql}
        GROUP BY e.exerciseName
        ORDER BY timesLogged DESC
        LIMIT 1`;

    const baseParams = [userId];
    const workoutParams = baseParams.concat(workoutDateFilter.params);
    const recordsParams = baseParams.concat(personalRecordDateFilter.params);

    db.query(totalWorkoutsSql, workoutParams, (err, totalWorkoutsResult) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not load the dashboard.');
            return res.redirect('/dashboard');
        }

        db.query(totalVolumeSql, workoutParams, (err, totalVolumeResult) => {
            if (err) {
                console.error(err);
                req.flash('error', 'Could not load the dashboard.');
                return res.redirect('/dashboard');
            }

            db.query(favouriteExerciseSql, workoutParams, (err, favouriteExerciseResult) => {
                if (err) {
                    console.error(err);
                    req.flash('error', 'Could not load the dashboard.');
                    return res.redirect('/dashboard');
                }

                db.query(volumeTrendSql, workoutParams, (err, volumeTrendResult) => {
                    if (err) {
                        console.error(err);
                        req.flash('error', 'Could not load the dashboard.');
                        return res.redirect('/dashboard');
                    }

                    db.query(muscleBreakdownSql, workoutParams, (err, muscleBreakdownResult) => {
                        if (err) {
                            console.error(err);
                            req.flash('error', 'Could not load the dashboard.');
                            return res.redirect('/dashboard');
                        }

                        db.query(workoutBestsSql, workoutParams, (err, workoutBestsResult) => {
                            if (err) {
                                console.error(err);
                                req.flash('error', 'Could not load the dashboard.');
                                return res.redirect('/dashboard');
                            }

                            db.query(trainingDaysSql, workoutParams, (err, trainingDaysResult) => {
                                if (err) {
                                    console.error(err);
                                    req.flash('error', 'Could not load the dashboard.');
                                    return res.redirect('/dashboard');
                                }

                                db.query(averageDurationSql, workoutParams, (err, averageDurationResult) => {
                                    if (err) {
                                        console.error(err);
                                        req.flash('error', 'Could not load the dashboard.');
                                        return res.redirect('/dashboard');
                                    }

                                    db.query(averageVolumeSql, workoutParams, (err, averageVolumeResult) => {
                                        if (err) {
                                            console.error(err);
                                            req.flash('error', 'Could not load the dashboard.');
                                            return res.redirect('/dashboard');
                                        }

                                        db.query(workoutDatesSql, workoutParams, (err, workoutDatesResult) => {
                                            if (err) {
                                                console.error(err);
                                                req.flash('error', 'Could not load the dashboard.');
                                                return res.redirect('/dashboard');
                                            }

                                            db.query(weeklyFrequencySql, workoutParams, (err, weeklyFrequencyResult) => {
                                                if (err) {
                                                    console.error(err);
                                                    req.flash('error', 'Could not load the dashboard.');
                                                    return res.redirect('/dashboard');
                                                }

                                                db.query(monthlyVolumeSql, workoutParams, (err, monthlyVolumeResult) => {
                                                    if (err) {
                                                        console.error(err);
                                                        req.flash('error', 'Could not load the dashboard.');
                                                        return res.redirect('/dashboard');
                                                    }

                                                    db.query(personalRecordsSql, recordsParams, (err, personalRecordsResult) => {
                                                        if (err) {
                                                            console.error(err);
                                                            req.flash('error', 'Could not load the dashboard.');
                                                            return res.redirect('/dashboard');
                                                        }

                                                        db.query(strongestLiftSql, recordsParams, (err, strongestLiftResult) => {
                                                            if (err) {
                                                                console.error(err);
                                                                req.flash('error', 'Could not load the dashboard.');
                                                                return res.redirect('/dashboard');
                                                            }

                                                            db.query(mostImprovedExerciseSql, recordsParams, (err, mostImprovedExerciseResult) => {
                                                                if (err) {
                                                                    console.error(err);
                                                                    req.flash('error', 'Could not load the dashboard.');
                                                                    return res.redirect('/dashboard');
                                                                }

                                                                db.query(mostTrainedMuscleGroupSql, workoutParams, (err, mostTrainedMuscleGroupResult) => {
                                                                    if (err) {
                                                                        console.error(err);
                                                                        req.flash('error', 'Could not load the dashboard.');
                                                                        return res.redirect('/dashboard');
                                                                    }

                                                                    db.query(mostFrequentExerciseSql, workoutParams, (err, mostFrequentExerciseResult) => {
                                                                        if (err) {
                                                                            console.error(err);
                                                                            req.flash('error', 'Could not load the dashboard.');
                                                                            return res.redirect('/dashboard');
                                                                        }

                                                                        const workoutBests = workoutBestsResult[0] || {};
                                                                        const personalRecords = personalRecordsResult || [];
                                                                        const dates = (workoutDatesResult || []).map(item => item.workoutDate);
                                                                        const currentStreak = (() => {
                                                                            if (dates.length === 0) {
                                                                                return 0;
                                                                            }
                                                                            const sortedDates = dates.slice().sort();
                                                                            let streak = 1;
                                                                            const today = new Date();
                                                                            const todayKey = today.toISOString().split('T')[0];
                                                                            const latest = sortedDates[sortedDates.length - 1];
                                                                            if (latest !== todayKey && latest !== new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0]) {
                                                                                return 0;
                                                                            }
                                                                            for (let i = sortedDates.length - 2; i >= 0; i -= 1) {
                                                                                const prev = new Date(sortedDates[i + 1]);
                                                                                const curr = new Date(sortedDates[i]);
                                                                                const diff = (prev - curr) / (1000 * 60 * 60 * 24);
                                                                                if (diff === 1) {
                                                                                    streak += 1;
                                                                                } else {
                                                                                    break;
                                                                                }
                                                                            }
                                                                            return streak;
                                                                        })();

                                                                        const filteredRecords = personalRecords.filter((record) => {
                                                                            if (!searchTerm) {
                                                                                return true;
                                                                            }
                                                                            return (record.exerciseName || '').toLowerCase().includes(searchTerm) || (record.muscleGroup || '').toLowerCase().includes(searchTerm);
                                                                        });

                                                                        const sortedRecords = filteredRecords.slice().sort((a, b) => {
                                                                            if (sortMode === 'oldest') {
                                                                                return new Date(a.achievedDate) - new Date(b.achievedDate);
                                                                            }
                                                                            if (sortMode === 'highestWeight') {
                                                                                return Number(b.maxWeight || 0) - Number(a.maxWeight || 0);
                                                                            }
                                                                            if (sortMode === 'highestVolume') {
                                                                                return Number((b.maxWeight || 0) * (b.totalReps || 0)) - Number((a.maxWeight || 0) * (a.totalReps || 0));
                                                                            }
                                                                            if (sortMode === 'mostReps') {
                                                                                return Number(b.totalReps || 0) - Number(a.totalReps || 0);
                                                                            }
                                                                            return new Date(b.achievedDate) - new Date(a.achievedDate);
                                                                        });

                                                                        const stats = {
                                                                            totalWorkouts: totalWorkoutsResult[0].totalWorkouts || 0,
                                                                            totalVolume: parseFloat(totalVolumeResult[0].totalVolume) || 0,
                                                                            favouriteExercise: favouriteExerciseResult[0] ? favouriteExerciseResult[0].exerciseName : 'No workouts logged yet',
                                                                            volumeTrend: volumeTrendResult || [],
                                                                            muscleBreakdown: muscleBreakdownResult || [],
                                                                            weeklyFrequency: weeklyFrequencyResult || [],
                                                                            monthlyVolume: monthlyVolumeResult || [],
                                                                            workoutBests: {
                                                                                maxWeight: workoutBests.maxWeight || 0,
                                                                                maxVolume: workoutBests.maxVolume || 0,
                                                                                maxReps: workoutBests.maxReps || 0
                                                                            },
                                                                            trainingDays: trainingDaysResult[0].trainingDays || 0,
                                                                            averageWorkoutDuration: Math.round(parseFloat(averageDurationResult[0].averageDuration) || 0),
                                                                            averageWorkoutVolume: Math.round(parseFloat(averageVolumeResult[0].averageVolume) || 0),
                                                                            currentStreak: currentStreak,
                                                                            lastWorkoutDate: dates.length > 0 ? dates[dates.length - 1] : 'No workouts yet',
                                                                            mostTrainedMuscleGroup: mostTrainedMuscleGroupResult[0] ? mostTrainedMuscleGroupResult[0].muscleGroup : 'No data',
                                                                            mostFrequentExercise: mostFrequentExerciseResult[0] ? mostFrequentExerciseResult[0].exerciseName : 'No data',
                                                                            totalPersonalRecords: personalRecords.length,
                                                                            strongestLift: strongestLiftResult[0] && strongestLiftResult[0].strongestLift ? strongestLiftResult[0].strongestLift : 0,
                                                                            mostImprovedExercise: mostImprovedExerciseResult[0] || null,
                                                                            insights: buildInsights({
                                                                                mostTrainedMuscleGroup: mostTrainedMuscleGroupResult[0] ? mostTrainedMuscleGroupResult[0].muscleGroup : null,
                                                                                mostImprovedExercise: mostImprovedExerciseResult[0] || null,
                                                                                currentStreak: currentStreak,
                                                                                averageWorkoutDuration: Math.round(parseFloat(averageDurationResult[0].averageDuration) || 0),
                                                                                lastWorkoutDate: dates.length > 0 ? dates[dates.length - 1] : null,
                                                                                totalWorkouts: totalWorkoutsResult[0].totalWorkouts || 0,
                                                                                totalVolume: parseFloat(totalVolumeResult[0].totalVolume) || 0
                                                                            })
                                                                        };

                                                                        res.render('dashboard', {
                                                                            ...stats,
                                                                            personalRecords: sortedRecords,
                                                                            successMessage: successMessage,
                                                                            errorMessage: errorMessage,
                                                                            range: range,
                                                                            searchTerm: searchTerm,
                                                                            sortMode: sortMode,
                                                                            formMode: extra.formMode || null,
                                                                            editRecord: extra.editRecord || null
                                                                        });
                                                                    });
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
};

router.get('/', (req, res) => {
    renderDashboard(req, res);
});

router.get('/records/add', (req, res) => {
    renderDashboard(req, res, { formMode: 'add' });
});

router.post('/records/add', (req, res) => {
    const { exerciseName, muscleGroup, maxWeight, totalReps, achievedDate, notes, weightUnit, prType, previousPr, timeMinutes } = req.body;
    const userId = req.session.user.userId;

    if (!exerciseName || !muscleGroup || !maxWeight || !totalReps || !achievedDate) {
        req.flash('error', 'All required fields must be filled in.');
        return res.redirect('/dashboard');
    }

    const parsedWeight = parseFloat(maxWeight);
    const parsedReps = parseInt(totalReps, 10);
    const parsedPreviousPr = previousPr ? parseFloat(previousPr) : 0;
    const parsedTimeMinutes = timeMinutes ? parseInt(timeMinutes, 10) : 0;
    const oneRepMax = parsedReps > 0 ? parsedWeight * (1 + (parsedReps / 30)) : parsedWeight;

    let currentValue = parsedWeight;
    if (prType === 'Volume') {
        currentValue = parsedWeight * parsedReps;
    } else if (prType === 'Reps') {
        currentValue = parsedReps;
    } else if (prType === 'Time') {
        currentValue = parsedTimeMinutes;
    }

    const improvementAmount = parsedPreviousPr > 0 ? currentValue - parsedPreviousPr : 0;
    const isNewPr = parsedPreviousPr === 0 || improvementAmount > 0 ? 1 : 0;

    const sql = `
        INSERT INTO personal_records
        (userId, exerciseName, muscleGroup, maxWeight, totalReps, achievedDate, notes, oneRepMax, weightUnit, prType, previousPr, improvementAmount, isNewPr, timeMinutes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.query(sql, [userId, exerciseName, muscleGroup, parsedWeight, parsedReps, achievedDate, notes, oneRepMax, weightUnit || 'kg', prType || 'Weight', parsedPreviousPr, improvementAmount, isNewPr, parsedTimeMinutes], (err) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not save the personal record.');
            return res.redirect('/dashboard');
        }
        req.flash('success', 'Personal record saved! 💪');
        res.redirect('/dashboard');
    });
});

router.get('/records/edit/:recordId', (req, res) => {
    const userId = req.session.user.userId;
    const recordId = req.params.recordId;
    const sql = 'SELECT * FROM personal_records WHERE recordId = ? AND userId = ?';
    db.query(sql, [recordId, userId], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'Record not found.');
            return res.redirect('/dashboard');
        }

        renderDashboard(req, res, { formMode: 'edit', editRecord: results[0] });
    });
});

router.post('/records/edit/:recordId', (req, res) => {
    const { exerciseName, muscleGroup, maxWeight, totalReps, achievedDate, notes, weightUnit, prType, previousPr, timeMinutes } = req.body;
    const userId = req.session.user.userId;
    const recordId = req.params.recordId;

    if (!exerciseName || !muscleGroup || !maxWeight || !totalReps || !achievedDate) {
        req.flash('error', 'All required fields must be filled in.');
        return res.redirect('/dashboard/records/edit/' + recordId);
    }

    const parsedWeight = parseFloat(maxWeight);
    const parsedReps = parseInt(totalReps, 10);
    const parsedPreviousPr = previousPr ? parseFloat(previousPr) : 0;
    const parsedTimeMinutes = timeMinutes ? parseInt(timeMinutes, 10) : 0;
    const oneRepMax = parsedReps > 0 ? parsedWeight * (1 + (parsedReps / 30)) : parsedWeight;

    let currentValue = parsedWeight;
    if (prType === 'Volume') {
        currentValue = parsedWeight * parsedReps;
    } else if (prType === 'Reps') {
        currentValue = parsedReps;
    } else if (prType === 'Time') {
        currentValue = parsedTimeMinutes;
    }

    const improvementAmount = parsedPreviousPr > 0 ? currentValue - parsedPreviousPr : 0;
    const isNewPr = parsedPreviousPr === 0 || improvementAmount > 0 ? 1 : 0;

    const sql = `
        UPDATE personal_records
        SET exerciseName = ?, muscleGroup = ?, maxWeight = ?, totalReps = ?, achievedDate = ?, notes = ?, oneRepMax = ?, weightUnit = ?, prType = ?, previousPr = ?, improvementAmount = ?, isNewPr = ?, timeMinutes = ?
        WHERE recordId = ? AND userId = ?`;

    db.query(sql, [exerciseName, muscleGroup, parsedWeight, parsedReps, achievedDate, notes, oneRepMax, weightUnit || 'kg', prType || 'Weight', parsedPreviousPr, improvementAmount, isNewPr, parsedTimeMinutes, recordId, userId], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not update the personal record.');
            return res.redirect('/dashboard');
        }
        if (result.affectedRows === 0) {
            req.flash('error', 'Record not found.');
            return res.redirect('/dashboard');
        }
        req.flash('success', 'Record updated!');
        res.redirect('/dashboard');
    });
});

router.post('/records/delete/:recordId', (req, res) => {
    const userId = req.session.user.userId;
    const recordId = req.params.recordId;

    const sql = 'DELETE FROM personal_records WHERE recordId = ? AND userId = ?';
    db.query(sql, [recordId, userId], (err, result) => {
        if (err) {
            console.error(err);
            req.flash('error', 'Could not delete the personal record.');
            return res.redirect('/dashboard');
        }
        if (result.affectedRows === 0) {
            req.flash('error', 'Record not found.');
            return res.redirect('/dashboard');
        }
        req.flash('success', 'Record deleted.');
        res.redirect('/dashboard');
    });
});

module.exports = router;
