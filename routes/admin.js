const express = require('express');
const db = require('../dbConfig');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();
const allowedRoles = ['user', 'admin'];

// Every route declared below this line requires an authenticated administrator.
router.use(isAdmin);

const validId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;

router.get('/', async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT userId, username, email, role, createdAt FROM users ORDER BY userId ASC'
    );
    const [workouts] = await db.execute(`
      SELECT w.workoutId, w.userId, w.weight, w.reps, w.sets, w.workoutDate, w.notes,
             u.username, u.email, e.exerciseName, e.muscleGroup
      FROM workouts w
      JOIN users u ON w.userId = u.userId
      JOIN exercises e ON w.exerciseId = e.exerciseId
      ORDER BY w.workoutDate DESC, w.workoutId DESC
    `);

    return res.render('admin', {
      title: 'Admin Dashboard',
      users,
      workouts,
      roles: allowedRoles
    });
  } catch (error) {
    console.error('Admin dashboard failed:', { code: error.code, message: error.message });
    return res.status(500).render('error', {
      title: 'Admin Error',
      message: 'The admin dashboard could not be loaded. Please try again later.'
    });
  }
});

// Keep the previous navigation path working if it was bookmarked.
router.get('/users', (req, res) => res.redirect('/admin'));

router.post('/users/:id/role', async (req, res) => {
  const userId = req.params.id;
  const role = String(req.body.role || '').trim().toLowerCase();

  if (!validId(userId)) {
    req.flash('error', 'Invalid user ID.');
    return res.redirect('/admin');
  }
  if (!allowedRoles.includes(role)) {
    req.flash('error', 'Invalid role selected.');
    return res.redirect('/admin');
  }
  if (Number(userId) === Number(req.session.user.userId) && role !== 'admin') {
    req.flash('error', 'You cannot remove your own admin role.');
    return res.redirect('/admin');
  }

  try {
    const [result] = await db.execute('UPDATE users SET role = ? WHERE userId = ?', [role, userId]);
    if (result.affectedRows === 0) {
      req.flash('error', 'User not found.');
    } else {
      req.flash('success', 'User role updated successfully.');
    }
  } catch (error) {
    console.error('Admin role update failed:', { code: error.code, message: error.message });
    req.flash('error', 'The user role could not be updated.');
  }
  return res.redirect('/admin');
});

router.post('/users/:id/delete', async (req, res) => {
  const userId = req.params.id;
  if (!validId(userId)) {
    req.flash('error', 'Invalid user ID.');
    return res.redirect('/admin');
  }
  if (Number(userId) === Number(req.session.user.userId)) {
    req.flash('error', 'You cannot delete your own account.');
    return res.redirect('/admin');
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.execute('SELECT userId FROM users WHERE userId = ? FOR UPDATE', [userId]);
    if (existing.length === 0) {
      await connection.rollback();
      req.flash('error', 'User not found.');
      return res.redirect('/admin');
    }

    // The supplied SQL does not define the workout foreign key, so remove these safely first.
    await connection.execute('DELETE FROM workouts WHERE userId = ?', [userId]);
    const [result] = await connection.execute('DELETE FROM users WHERE userId = ?', [userId]);
    if (result.affectedRows !== 1) throw new Error('User deletion did not affect one row.');

    await connection.commit();
    req.flash('success', 'User and their workout records were deleted successfully.');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Admin user deletion failed:', { code: error.code, message: error.message });
    req.flash('error', error.code === 'ER_ROW_IS_REFERENCED_2'
      ? 'This user has other related records and cannot be deleted safely.'
      : 'The user could not be deleted.');
  } finally {
    if (connection) connection.release();
  }
  return res.redirect('/admin');
});

router.post('/workouts/:id/delete', async (req, res) => {
  const workoutId = req.params.id;
  if (!validId(workoutId)) {
    req.flash('error', 'Invalid workout ID.');
    return res.redirect('/admin');
  }

  try {
    const [result] = await db.execute('DELETE FROM workouts WHERE workoutId = ?', [workoutId]);
    if (result.affectedRows === 0) {
      req.flash('error', 'Workout not found.');
    } else {
      req.flash('success', 'Workout deleted successfully.');
    }
  } catch (error) {
    console.error('Admin workout deletion failed:', { code: error.code, message: error.message });
    req.flash('error', 'The workout could not be deleted.');
  }
  return res.redirect('/admin');
});

module.exports = router;
