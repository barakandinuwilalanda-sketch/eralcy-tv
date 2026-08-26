const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const cron = require("node-cron");
const axios = require("axios");

const app = express();

// Set up Multer kwa ajili ya upload ya picha
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use("/uploads", express.static(uploadDir));

// HTML Routes
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index01.html"));
});

app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
});

/* ==========================================
   DATABASE SETUP
========================================== */
const db = new Database("eralcy.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT,
        image TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

/* ==========================================
   API ENDPOINTS FOR ADMIN & FRONTEND
========================================== */

// Endpoint ya kukagua status ya backend (inafanya kitufe kiwe cha kijani)
app.get("/api/status", (req, res) => {
    res.json({ status: "online", message: "Server iko online" });
});

// Chukua posts zote
app.get("/api/posts", (req, res) => {
    try {
        const posts = db.prepare("SELECT * FROM posts ORDER BY id DESC").all();
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Tuma habari mpya kutoka Admin CMS Form
app.post("/api/posts", upload.single("image"), (req, res) => {
    const { title, category, content } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : "";

    try {
        const stmt = db.prepare(`
            INSERT INTO posts (title, category, image, content)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(title, category, imagePath, content);
        res.status(200).json({ success: true, message: "Habari imechapishwa kikamilifu!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ==========================================
   SOCIAL MEDIA WEBHOOK & YOUTUBE CRON
========================================== */
app.post("/api/social-webhook", (req, res) => {
    if (req.query["hub.challenge"]) {
        return res.send(req.query["hub.challenge"]);
    }

    const { title, category, media_url, platform } = req.body;

    if (title) {
        try {
            const stmt = db.prepare(`
                INSERT INTO posts (title, category, image, content)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(
                title,
                category || "Burudani",
                media_url || "",
                `Post kutoka ${platform || "Social Media"}`
            );
        } catch (err) {
            console.error("Database Insert Error:", err.message);
        }
    }

    res.status(200).json({ status: "success" });
});

const YT_API_KEY = "WEKA_KEY_YAKO_HAPA";
const YT_CHANNEL_ID = "WEKA_CHANNEL_ID_HAPA";
let ytLastVideoId = "";

cron.schedule("*/15 * * * *", async () => {
    if (YT_API_KEY === "WEKA_KEY_YAKO_HAPA") return;

    try {
        const url = `https://www.googleapis.com/youtube/v3/search?key=${YT_API_KEY}&channelId=${YT_CHANNEL_ID}&part=snippet,id&order=date&maxResults=1`;
        const response = await axios.get(url);
        const latestVideo = response.data.items[0];

        if (latestVideo && latestVideo.id.videoId && latestVideo.id.videoId !== ytLastVideoId) {
            ytLastVideoId = latestVideo.id.videoId;
            const stmt = db.prepare(`
                INSERT INTO posts (title, category, image, content)
                VALUES (?, ?, ?, ?)
            `);
            stmt.run(
                latestVideo.snippet.title,
                "YouTube",
                latestVideo.snippet.thumbnails.high.url,
                `https://www.youtube.com/watch?v=${ytLastVideoId}`
            );
        }
    } catch (error) {
        console.error("YouTube Sync Error:", error.message);
    }
});

/* ==========================================
   SERVER START
========================================== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Eralcy TV running on port ${PORT}`);
});