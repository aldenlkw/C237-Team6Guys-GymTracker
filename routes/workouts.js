const express = require("express");
const router = express.Router();

// Change this to whatever your team calls the database connection
const db = require("../dbConfig");

router.get("/", (req, res) => {
    // ==========================================
// LIVE SEARCH API
// ==========================================

router.get("/search", (req, res) => {

    const search = req.query.search || "";
    const muscle = req.query.muscle || "";
    const sort = req.query.sort || "";

    let sql = "SELECT * FROM workouts WHERE 1=1";
    let values = [];

    if (search !== "") {
        sql += " AND exercise LIKE ?";
        values.push("%" + search + "%");
    }

    if (muscle !== "") {
        sql += " AND muscle_group = ?";
        values.push(muscle);
    }

    if (sort === "newest")
        sql += " ORDER BY date DESC";

    else if (sort === "oldest")
        sql += " ORDER BY date ASC";

    else if (sort === "highest")
        sql += " ORDER BY weight DESC";

    else if (sort === "lowest")
        sql += " ORDER BY weight ASC";

    db.query(sql, values, (err, results) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(results);

    });

});

    // ==========================
    // GET SEARCH VALUES
    // ==========================

    const search = req.query.search || "";
    const muscle = req.query.muscle || "";
    const sort = req.query.sort || "";

    // ==========================
    // BASE SQL QUERY
    // ==========================

    let sql = "SELECT * FROM workouts WHERE 1=1";

    let values = [];

    // ==========================
    // SEARCH
    // ==========================

    if (search !== "") {

        sql += " AND exercise LIKE ?";

        values.push("%" + search + "%");

    }

    // ==========================
    // FILTER
    // ==========================

    if (muscle !== "") {

        sql += " AND muscle_group = ?";

        values.push(muscle);

    }

    // ==========================
    // SORTING
    // ==========================

    if (sort === "newest") {

        sql += " ORDER BY date DESC";

    }

    else if (sort === "oldest") {

        sql += " ORDER BY date ASC";

    }

    else if (sort === "highest") {

        sql += " ORDER BY weight DESC";

    }

    else if (sort === "lowest") {

        sql += " ORDER BY weight ASC";

    }

    // ==========================
    // EXECUTE QUERY
    // ==========================

    db.query(sql, values, (err, results) => {

        if (err) {

            console.log(err);

            return res.send("Database Error");

        }

        res.render("workouts", {

            workouts: results,

            search: search

        });

    });

});

module.exports = router;