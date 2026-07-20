const express = require("express");
const router = express.Router();

const db = require("../dbConfig");

module.exports = router;

router.get("/", (req, res) => {

    const search = req.query.search || "";
    const category = req.query.category || "";

    let sql = `
        SELECT *
        FROM forum_posts
        WHERE title LIKE ?
    `;

    let values = [`%${search}%`];

    if (category !== "") {

        sql += " AND category = ?";
        values.push(category);

    }

    sql += " ORDER BY created_at DESC";

    db.query(sql, values, (err, results) => {

        if (err) {

            console.log(err);
            return res.send("Database Error");

        }

        res.render("forumHome", {

            posts: results

        });

    });

});

router.get("/create", (req, res) => {

    res.render("createPost");

});

// ==============================
// CREATE NEW FORUM POST
// ==============================

router.post("/create", (req, res) => {

    const { title, category, question } = req.body;

    // Temporary values for testing
    // Replace these with req.session.user during integration
    const user_id = 1;
    const username = "TestUser";

    const sql = `
        INSERT INTO forum_posts
        (user_id, username, title, category, question)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [user_id, username, title, category, question],
        (err, result) => {

            if (err) {
                console.log(err);
                return res.send("Error creating forum post.");
            }

            res.redirect("/forum");

        }
    );

});

// ==============================
// VIEW A SINGLE FORUM POST
// ==============================

router.get("/post/:id", (req, res) => {

    const postId = req.params.id;

    // Get the selected post
    const postSql = `
        SELECT *
        FROM forum_posts
        WHERE id = ?
    `;

    db.query(postSql, [postId], (err, postResult) => {

        if (err) {

            console.log(err);
            return res.send("Database Error");

        }

        if (postResult.length === 0) {

            return res.send("Forum post not found.");

        }

        // Get all replies for this post
        const replySql = `
            SELECT *
            FROM forum_replies
            WHERE post_id = ?
            ORDER BY created_at ASC
        `;

        db.query(replySql, [postId], (err, replyResults) => {

            if (err) {

                console.log(err);
                return res.send("Database Error");

            }

            res.render("viewPost", {

                post: postResult[0],
                replies: replyResults,

                // Temporary user for testing
                currentUser: {
                    id: 1,
                    username: "TestUser"
                }

            });

        });

    });

});

// ==============================
// ADD REPLY TO A POST
// ==============================

router.post("/reply/:id", (req, res) => {

    const postId = req.params.id;

    const { reply } = req.body;

    // Temporary user for testing
    // Replace with req.session.user during integration
    const user_id = 1;
    const username = "TestUser";

    const sql = `
        INSERT INTO forum_replies
        (post_id, user_id, username, reply)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [postId, user_id, username, reply],
        (err, result) => {

            if (err) {

                console.log(err);
                return res.send("Error adding reply.");

            }

            res.redirect("/forum/post/" + postId);

        }
    );

});

// ==============================
// SHOW EDIT POST PAGE
// ==============================

router.get("/edit/:id", (req, res) => {

    const postId = req.params.id;

    const sql = `
        SELECT *
        FROM forum_posts
        WHERE id = ?
    `;

    db.query(sql, [postId], (err, results) => {

        if (err) {

            console.log(err);
            return res.send("Database Error");

        }

        if (results.length === 0) {

            return res.send("Forum post not found.");

        }

        res.render("editPost", {

            post: results[0]

        });

    });

});


// ==============================
// UPDATE A FORUM POST
// ==============================

router.post("/edit/:id", (req, res) => {

    const postId = req.params.id;

    const { title, category, question } = req.body;

    const sql = `
        UPDATE forum_posts
        SET
            title = ?,
            category = ?,
            question = ?
        WHERE id = ?
    `;

    db.query(
        sql,
        [title, category, question, postId],
        (err, result) => {

            if (err) {

                console.log(err);
                return res.send("Error updating post.");

            }

            res.redirect("/forum/post/" + postId);

        }
    );

});

// ==============================
// DELETE A FORUM POST
// ==============================

router.post("/delete/:id", (req, res) => {

    const postId = req.params.id;

    const sql = `
        DELETE FROM forum_posts
        WHERE id = ?
    `;

    db.query(sql, [postId], (err, result) => {

        if (err) {

            console.log(err);
            return res.send("Error deleting forum post.");

        }

        res.redirect("/forum");

    });

});