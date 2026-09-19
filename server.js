const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   PERSISTENT STORAGE (Render Disk)
========================= */
const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });

/* =========================
   DATABASE SETUP
========================= */
const db = new Database(path.join(DATA_DIR, "eralcy.db"));

// Database Schema
db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        video TEXT,
        content TEXT,
        expiry_hours TEXT DEFAULT '24',
        expires_at TEXT,
        created_at TEXT NOT NULL
    )
`);

// Migration: ongeza columns za source/source_url kama hazipo bado
const existingColumns = db.prepare(`PRAGMA table_info(posts)`).all().map(c => c.name);
if (!existingColumns.includes("source")) {
    db.exec(`ALTER TABLE posts ADD COLUMN source TEXT DEFAULT 'Website'`);
}
if (!existingColumns.includes("source_url")) {
    db.exec(`ALTER TABLE posts ADD COLUMN source_url TEXT`);
}

/* =========================
   UPLOAD FOLDERS MANAGEMENT
========================= */
const uploadDir = path.join(DATA_DIR, "uploads");
const imageDir = path.join(uploadDir, "images");
const videoDir = path.join(uploadDir, "videos");

fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(videoDir, { recursive: true });

/* =========================
   FILE UPLOAD CONFIG (MULTER)
========================= */
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === "imageFile") {
            cb(null, imageDir);
        } else {
            cb(null, videoDir);
        }
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = Date.now() + "-" + Math.random().toString(36).substring(2, 8);
        cb(null, uniqueName + ext);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // Limit ya 500MB
});

/* =========================
   MIDDLEWARES
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   HOME PAGE (REKEBISHO HAPA)
   Sasa inatuma index01.html badala ya tv.html
========================= */
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index01.html"));
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadDir));

/* =========================
   EXPIRED POSTS CLEANUP
========================= */
function removeExpiredPosts() {
    db.prepare(`
        DELETE FROM posts
        WHERE expires_at IS NOT NULL
        AND expires_at <= datetime('now')
    `).run();
}

/* =========================
   API ENDPOINTS
========================= */

// 1. GET ALL POSTS
app.get("/api/posts", (req, res) => {
    removeExpiredPosts();
    const category = req.query.category;
    const search = req.query.search;
    let posts;

    if (category && category !== "all") {
        posts = db.prepare(`SELECT * FROM posts WHERE category = ? ORDER BY datetime(created_at) DESC`).all(category);
    } else if (search) {
        const q = `%${search}%`;
        posts = db.prepare(`SELECT * FROM posts WHERE title LIKE ? OR content LIKE ? ORDER BY datetime(created_at) DESC`).all(q, q);
    } else {
        posts = db.prepare(`SELECT * FROM posts ORDER BY datetime(created_at) DESC`).all();
    }

    res.json(posts);
});

// 2. SOCIAL STATUS
app.get("/api/social-status", (req, res) => {
    res.json({ status: "ok", active: true });
});

// 3. WEBHOOK YA AUTOMATIC POSTS
app.post("/api/social-webhook", (req, res) => {
    try {
        const payload = req.body;
        const items = Array.isArray(payload) ? payload : [payload];

        const insertStmt = db.prepare(`
            INSERT INTO posts (title, category, image, video, content, expiry_hours, expires_at, source, source_url, created_at)
            VALUES (?, ?, ?, ?, ?, '24', NULL, ?, ?, ?)
        `);

        let insertedCount = 0;

        for (const item of items) {
            const content = item.content || item.caption || item.text || item.title || "";
            if (!content && !item.displayUrl && !item.imageUrl) continue;

            const title = item.title || (content.length > 50 ? content.substring(0, 50) + "..." : content) || "Instagram Update";
            const category = item.category || "Entertainment";
            const source = item.source || "Instagram";
            const sourceUrl = item.sourceUrl || item.postUrl || item.url || null;

            let image = item.image || item.displayUrl || item.imageUrl || item.url || null;
            let video = item.video || item.videoUrl || null;

            if (image && (image.includes(".mp4") || image.includes("video"))) {
                video = image;
                image = null;
            }

            const now = new Date().toISOString();
            insertStmt.run(title, category, image, video, content, source, sourceUrl, now);
            insertedCount++;
        }

        console.log(`[Make.com Webhook] Zimeingizwa post ${insertedCount} kwenye Database.`);
        res.status(200).json({ success: true, message: `${insertedCount} posts stored successfully!` });

    } catch (error) {
        console.error("Webhook Error:", error);
        res.status(500).json({ success: false, message: "Webhook error processing data." });
    }
});

// 4. CREATE NEW POST
app.post("/api/posts", upload.fields([{ name: "imageFile", maxCount: 1 }, { name: "videoFile", maxCount: 1 }]), (req, res) => {
    try {
        const body = req.body;
        let image = body.image || null;
        let video = body.video || null;

        if (req.files && req.files.imageFile) {
            image = "/uploads/images/" + req.files.imageFile[0].filename;
        }
        if (req.files && req.files.videoFile) {
            video = "/uploads/videos/" + req.files.videoFile[0].filename;
        }

        const now = new Date().toISOString();
        let expiresAt = null;

        if (body.expiryHours && body.expiryHours !== "never") {
            const hours = Number(body.expiryHours);
            expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }

        const result = db.prepare(`
            INSERT INTO posts (title, category, image, video, content, expiry_hours, expires_at, source, source_url, created_at)
            VALUES (@title, @category, @image, @video, @content, @expiry_hours, @expires_at, @source, @source_url, @created_at)
        `).run({
            title: body.title,
            category: body.category,
            image,
            video,
            content: body.content || "",
            expiry_hours: body.expiryHours || "24",
            expires_at: expiresAt,
            source: body.source || "Website",
            source_url: body.sourceUrl || null,
            created_at: now
        });

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Imeshindikana kuhifadhi post." });
    }
});

// 5. UPDATE POST
app.put("/api/posts/:id", upload.fields([{ name: "imageFile", maxCount: 1 }, { name: "videoFile", maxCount: 1 }]), (req, res) => {
    try {
        const id = req.params.id;
        const old = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(id);
        if (!old) return res.status(404).json({ message: "Post haipo." });

        let image = req.body.image || old.image;
        let video = req.body.video || old.video;

        if (req.files && req.files.imageFile) image = "/uploads/images/" + req.files.imageFile[0].filename;
        if (req.files && req.files.videoFile) video = "/uploads/videos/" + req.files.videoFile[0].filename;

        let expiryHours = req.body.expiryHours || old.expiry_hours || "24";
        let expiresAt = old.expires_at;
        if (expiryHours !== "never") {
            const hours = Number(expiryHours);
            if (!isNaN(hours)) {
                expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
            }
        } else {
            expiresAt = null;
        }

        db.prepare(`
            UPDATE posts
            SET title = ?, category = ?, image = ?, video = ?, content = ?,
                expiry_hours = ?, expires_at = ?, source = ?, source_url = ?
            WHERE id = ?
        `).run(
            req.body.title,
            req.body.category,
            image,
            video,
            req.body.content || "",
            expiryHours,
            expiresAt,
            req.body.source || old.source || "Website",
            req.body.sourceUrl || old.source_url || null,
            id
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: "Update imeshindikana." });
    }
});

// 6. DELETE POST
app.delete("/api/posts/:id", (req, res) => {
    db.prepare(`DELETE FROM posts WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
});

// 7. SOCIAL SYNC
app.post("/api/sync", (req, res) => {
    try {
        removeExpiredPosts();
        const count = db.prepare(`SELECT COUNT(*) AS total FROM posts`).get().total;
        res.json({ success: true, message: `Sync imekamilika. Posts zilizopo: ${count}.` });
    } catch (error) {
        console.error("Sync Error:", error);
        res.status(500).json({ success: false, message: "Sync imeshindikana." });
    }
});

/* =========================
   WASHA SERVER
========================= */
app.listen(PORT, () => {
    console.log(`Eralcy TV Server inarun kwenye http://localhost:${PORT}`);  
});