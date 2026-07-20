const express = require('express');
const router = express.Router();
const db = require('../dbConfig');

const checkAuth = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

router.use(checkAuth);

// ==============================
// FORUM HOME - list posts (with search + category filter)
// ==============================
router.get('/', async (req, res) => {
    const search = req.query.search || '';
    const category = req.query.category || '';

    let sql = 'SELECT * FROM forum_posts WHERE title LIKE ?';
    const values = ['%' + search + '%'];

    if (category !== '') {
        sql += ' AND category = ?';
        values.push(category);
    }
    sql += ' ORDER BY created_at DESC';

    try {
        const [posts] = await db.query(sql, values);
        res.render('forumHome', { posts });
    } catch (err) {
        console.error('Forum home error:', err);
        res.status(500).send('Database Error');
    }
});

// ==============================
// SHOW CREATE POST FORM
// ==============================
router.get('/create', (req, res) => {
    res.render('createPost');
});

// ==============================
// CREATE NEW POST
// ==============================
router.post('/create', async (req, res) => {
    const { title, category, question } = req.body;
    const user_id = req.session.user.userId;
    const username = req.session.user.username;

    if (!title || !question) {
        return res.redirect('/forum/create');
    }

    try {
        await db.query(
            'INSERT INTO forum_posts (user_id, username, title, category, question) VALUES (?, ?, ?, ?, ?)',
            [user_id, username, title, category || null, question]
        );
        res.redirect('/forum');
    } catch (err) {
        console.error('Create post error:', err);
        res.status(500).send('Error creating forum post.');
    }
});

// ==============================
// VIEW A SINGLE POST + REPLIES
// ==============================
router.get('/post/:id', async (req, res) => {
    const postId = req.params.id;
    try {
        const [postResult] = await db.query('SELECT * FROM forum_posts WHERE id = ?', [postId]);
        if (postResult.length === 0) return res.send('Forum post not found.');

        const [replies] = await db.query(
            'SELECT * FROM forum_replies WHERE post_id = ? ORDER BY created_at ASC',
            [postId]
        );

        res.render('viewPost', {
            post: postResult[0],
            replies,
            currentUser: {
                id: req.session.user.userId,
                username: req.session.user.username
            }
        });
    } catch (err) {
        console.error('View post error:', err);
        res.status(500).send('Database Error');
    }
});

// ==============================
// ADD REPLY
// ==============================
router.post('/reply/:id', async (req, res) => {
    const postId = req.params.id;
    const { reply } = req.body;
    const user_id = req.session.user.userId;
    const username = req.session.user.username;

    if (!reply) return res.redirect('/forum/post/' + postId);

    try {
        await db.query(
            'INSERT INTO forum_replies (post_id, user_id, username, reply) VALUES (?, ?, ?, ?)',
            [postId, user_id, username, reply]
        );
        res.redirect('/forum/post/' + postId);
    } catch (err) {
        console.error('Reply error:', err);
        res.status(500).send('Error adding reply.');
    }
});

// ==============================
// SHOW EDIT FORM (owner only)
// ==============================
router.get('/edit/:id', async (req, res) => {
    const postId = req.params.id;
    try {
        const [results] = await db.query('SELECT * FROM forum_posts WHERE id = ?', [postId]);
        if (results.length === 0) return res.send('Forum post not found.');

        if (results[0].user_id !== req.session.user.userId) {
            return res.status(403).send('You can only edit your own posts.');
        }

        res.render('editPost', { post: results[0] });
    } catch (err) {
        console.error('Edit form error:', err);
        res.status(500).send('Database Error');
    }
});

// ==============================
// UPDATE POST (owner only)
// ==============================
router.post('/edit/:id', async (req, res) => {
    const postId = req.params.id;
    const { title, category, question } = req.body;

    try {
        const [check] = await db.query('SELECT user_id FROM forum_posts WHERE id = ?', [postId]);
        if (check.length === 0 || check[0].user_id !== req.session.user.userId) {
            return res.status(403).send('You can only edit your own posts.');
        }

        await db.query(
            'UPDATE forum_posts SET title = ?, category = ?, question = ? WHERE id = ?',
            [title, category || null, question, postId]
        );
        res.redirect('/forum/post/' + postId);
    } catch (err) {
        console.error('Update post error:', err);
        res.status(500).send('Error updating post.');
    }
});

// ==============================
// DELETE POST (owner only)
// ==============================
router.post('/delete/:id', async (req, res) => {
    const postId = req.params.id;
    try {
        const [check] = await db.query('SELECT user_id FROM forum_posts WHERE id = ?', [postId]);
        if (check.length === 0 || check[0].user_id !== req.session.user.userId) {
            return res.status(403).send('You can only delete your own posts.');
        }

        await db.query('DELETE FROM forum_posts WHERE id = ?', [postId]);
        res.redirect('/forum');
    } catch (err) {
        console.error('Delete post error:', err);
        res.status(500).send('Error deleting forum post.');
    }
});

module.exports = router;