const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();

const PORT = process.env.PORT || 3000;


/* =========================
   DATABASE
========================= */

const db = new Database("eralcy.db");


db.exec(`
    CREATE TABLE IF NOT EXISTS posts (

        id INTEGER PRIMARY KEY AUTOINCREMENT,

        title TEXT NOT NULL,

        category TEXT NOT NULL,

        image TEXT,

        video TEXT,

        content TEXT,

        source TEXT DEFAULT 'Website',

        source_url TEXT,

        expiry_hours TEXT DEFAULT '24',

        expires_at TEXT,

        created_at TEXT NOT NULL

    )
`);


/* =========================
   UPLOAD FOLDERS
========================= */

const uploadDir =
    path.join(__dirname, "uploads");

const imageDir =
    path.join(uploadDir, "images");

const videoDir =
    path.join(uploadDir, "videos");


fs.mkdirSync(
    imageDir,
    { recursive: true }
);

fs.mkdirSync(
    videoDir,
    { recursive: true }
);


/* =========================
   MULTER
========================= */

const storage =
    multer.diskStorage({

        destination: function(req, file, cb) {

            if (
                file.fieldname ===
                "imageFile"
            ) {

                cb(null, imageDir);

            } else {

                cb(null, videoDir);

            }

        },


        filename: function(req, file, cb) {

            const ext =
                path.extname(
                    file.originalname
                );


            const name =
                Date.now() +
                "-" +
                Math.random()
                    .toString(36)
                    .substring(2, 8);


            cb(
                null,
                name + ext
            );

        }

    });


const upload =
    multer({
        storage,
        limits: {
            fileSize:
                500 * 1024 * 1024
        }
    });


/* =========================
   MIDDLEWARE
========================= */

app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);


/* Serve website */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* Serve uploads */

app.use(
    "/uploads",
    express.static(uploadDir)
);


/* =========================
   REMOVE EXPIRED POSTS
========================= */

function removeExpiredPosts() {

    db.prepare(`
        DELETE FROM posts
        WHERE
        expires_at IS NOT NULL
        AND expires_at <= datetime('now')
    `).run();

}


/* =========================
   GET POSTS
========================= */

app.get(
    "/api/posts",
    (req, res) => {

        removeExpiredPosts();


        const category =
            req.query.category;


        const search =
            req.query.search;


        let posts;


        if (category &&
            category !== "all") {

            posts =
                db.prepare(`
                    SELECT *
                    FROM posts
                    WHERE category = ?
                    ORDER BY datetime(created_at) DESC
                `)
                .all(category);

        }

        else if (search) {

            const q =
                `%${search}%`;


            posts =
                db.prepare(`
                    SELECT *
                    FROM posts
                    WHERE
                        title LIKE ?
                        OR content LIKE ?
                    ORDER BY datetime(created_at) DESC
                `)
                .all(q, q);

        }

        else {

            posts =
                db.prepare(`
                    SELECT *
                    FROM posts
                    ORDER BY datetime(created_at) DESC
                `)
                .all();

        }


        res.json(posts);

    }
);


/* =========================
   CREATE POST
========================= */

app.post(
    "/api/posts",

    upload.fields([
        {
            name: "imageFile",
            maxCount: 1
        },
        {
            name: "videoFile",
            maxCount: 1
        }
    ]),

    (req, res) => {

        try {

            const body =
                req.body;


            let image =
                body.image || null;


            let video =
                body.video || null;


            if (
                req.files &&
                req.files.imageFile
            ) {

                image =
                    "/uploads/images/" +
                    req.files.imageFile[0]
                        .filename;

            }


            if (
                req.files &&
                req.files.videoFile
            ) {

                video =
                    "/uploads/videos/" +
                    req.files.videoFile[0]
                        .filename;

            }


            const now =
                new Date()
                .toISOString();


            let expiresAt =
                null;


            if (
                body.expiryHours &&
                body.expiryHours !==
                "never"
            ) {

                const hours =
                    Number(
                        body.expiryHours
                    );


                expiresAt =
                    new Date(
                        Date.now() +
                        hours *
                        60 *
                        60 *
                        1000
                    ).toISOString();

            }


            const result =
                db.prepare(`
                    INSERT INTO posts (
                        title,
                        category,
                        image,
                        video,
                        content,
                        source,
                        source_url,
                        expiry_hours,
                        expires_at,
                        created_at
                    )

                    VALUES (
                        @title,
                        @category,
                        @image,
                        @video,
                        @content,
                        @source,
                        @source_url,
                        @expiry_hours,
                        @expires_at,
                        @created_at
                    )
                `)
                .run({

                    title:
                        body.title,

                    category:
                        body.category,

                    image,

                    video,

                    content:
                        body.content || "",

                    source:
                        body.source ||
                        "Website",

                    source_url:
                        body.sourceUrl ||
                        "",

                    expiry_hours:
                        body.expiryHours ||
                        "24",

                    expires_at:
                        expiresAt,

                    created_at:
                        now

                });


            res.json({

                success: true,

                id:
                    result.lastInsertRowid

            });


        } catch(error) {

            console.error(error);

            res.status(500)
                .json({

                    success: false,

                    message:
                        "Imeshindikana kuhifadhi post."

                });

        }

    }
);


/* =========================
   UPDATE POST
========================= */

app.put(
    "/api/posts/:id",

    upload.fields([
        {
            name: "imageFile",
            maxCount: 1
        },
        {
            name: "videoFile",
            maxCount: 1
        }
    ]),

    (req, res) => {

        try {

            const id =
                req.params.id;


            const old =
                db.prepare(`
                    SELECT *
                    FROM posts
                    WHERE id = ?
                `)
                .get(id);


            if (!old) {

                return res
                    .status(404)
                    .json({
                        message:
                            "Post haipo."
                    });

            }


            let image =
                req.body.image ||
                old.image;


            let video =
                req.body.video ||
                old.video;


            if (
                req.files &&
                req.files.imageFile
            ) {

                image =
                    "/uploads/images/" +
                    req.files.imageFile[0]
                        .filename;

            }


            if (
                req.files &&
                req.files.videoFile
            ) {

                video =
                    "/uploads/videos/" +
                    req.files.videoFile[0]
                        .filename;

            }


            let expiresAt =
                old.expires_at;


            if (
                req.body.expiryHours ===
                "never"
            ) {

                expiresAt = null;

            }

            else if (
                req.body.expiryHours
            ) {

                const hours =
                    Number(
                        req.body.expiryHours
                    );


                expiresAt =
                    new Date(
                        Date.now() +
                        hours *
                        60 *
                        60 *
                        1000
                    ).toISOString();

            }


            db.prepare(`
                UPDATE posts

                SET

                    title = ?,

                    category = ?,

                    image = ?,

                    video = ?,

                    content = ?,

                    source = ?,

                    source_url = ?,

                    expiry_hours = ?,

                    expires_at = ?

                WHERE id = ?

            `).run(

                req.body.title,

                req.body.category,

                image,

                video,

                req.body.content || "",

                req.body.source ||
                    "Website",

                req.body.sourceUrl ||
                    "",

                req.body.expiryHours ||
                    "24",

                expiresAt,

                id

            );


            res.json({
                success: true
            });


        } catch(error) {

            console.error(error);

            res.status(500)
                .json({
                    message:
                        "Update imeshindikana."
                });

        }

    }
);


/* =========================
   DELETE
========================= */

app.delete(
    "/api/posts/:id",
    (req, res) => {

        db.prepare(`
            DELETE FROM posts
            WHERE id = ?
        `)
        .run(req.params.id);


        res.json({
            success: true
        });

    }
);


/* =========================
   SOCIAL STATUS
========================= */

app.get(
    "/api/social-status",
    (req, res) => {

        res.json({

            tiktok:
                Boolean(
                    process.env.TIKTOK_ACCESS_TOKEN
                ),

            instagram:
                Boolean(
                    process.env.INSTAGRAM_ACCESS_TOKEN
                ),

            facebook:
                Boolean(
                    process.env.FACEBOOK_ACCESS_TOKEN
                ),

            youtube:
                Boolean(
                    process.env.YOUTUBE_API_KEY
                )

        });

    }
);


/* =========================
   SOCIAL SYNC
========================= */

app.post(
    "/api/sync",
    async (req, res) => {

        /*
         * Hapa ndipo APIs za TikTok,
         * Instagram/Facebook na YouTube
         * zitaunganishwa.
         *
         * Kwa sasa hatu-import chochote
         * mpaka credentials ziwekwe.
         */

        res.json({

            success: true,

            message:
                "Social sync endpoint iko tayari. Weka API credentials ili kuanza automatic import."

        });

    }
);


/* =========================
   SERVER
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Eralcy TV running on port ${PORT}`
        );

    }
    {
  "name": "eralcy-tv",
  "version": "1.0.0",
  "description": "Eralcy TV News and Entertainment Platform",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "express": "^5.1.0",
    "multer": "^2.0.2"
  }
}
);