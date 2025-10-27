// backend/server.js
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs-extra");
const webpush = require("web-push");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = "./data.json";
const VAPID_FILE = "./vapid.json";

// ------------------ Load VAPID keys ------------------
let vapidKeys;
try {
  vapidKeys = fs.readJsonSync(VAPID_FILE);
} catch (err) {
  console.error("VAPID keys not found. Run generateVapid.js first.");
  process.exit(1);
}

webpush.setVapidDetails(
  "mailto:20meg24@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ------------------ Load or initialize data ------------------
let db = fs.readJsonSync(DATA_FILE, { throws: false }) || {
  stories: [
    {
      id: "s1",
      title: "A Moonlit Night",
      body: "Once upon a moonlit night...",
      authorId: "u1",
      genre: "Fantasy",
      likes: 3,
      createdAt: new Date().toISOString(),
    },
  ],
  users: [{ id: "u1", name: "Meghana M", bio: "Student", avatarUrl: "" }],
  comments: [],
};

let { stories, users, comments } = db;

// Utility to save DB
const saveDB = async () => {
  db.stories = stories;
  db.users = users;
  db.comments = comments;
  await fs.writeJson(DATA_FILE, db, { spaces: 2 });
};

// ------------------ PUSH NOTIFICATIONS ------------------
app.post("/subscribe", (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  // Test notification
  webpush
    .sendNotification(
      subscription,
      JSON.stringify({ title: "New Story!", body: "A new story has been added!" })
    )
    .catch(console.error);

  res.status(201).json({});
});

// ------------------ STORY ROUTES ------------------

// Get all stories with optional search
app.get("/api/stories", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  let result = stories;

  if (q)
    result = result.filter((s) =>
      (s.title + " " + s.body).toLowerCase().includes(q)
    );

  result = result.map((s) => {
    const author = users.find((u) => u.id === s.authorId);
    return { ...s, authorName: author ? author.name : "Unknown" };
  });

  res.json({ data: result, meta: { total: result.length } });
});

// Get story by id with comments
app.get("/api/stories/:id", (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: "Story not found" });

  const author = users.find((u) => u.id === story.authorId);
  const storyComments = comments
    .filter((c) => c.storyId === story.id)
    .map((c) => {
      const commentAuthor = users.find((u) => u.id === c.authorId);
      return { ...c, authorName: commentAuthor ? commentAuthor.name : "Unknown" };
    });

  res.json({ ...story, authorName: author ? author.name : "Unknown", comments: storyComments });
});

// Add new story
app.post("/api/stories", async (req, res) => {
  const { title, body, authorId, genre } = req.body;
  if (!title || !body || !authorId)
    return res.status(400).json({ error: "title, body, authorId required" });

  const newStory = {
    id: uuidv4(),
    title,
    body,
    authorId,
    genre: genre || "",
    likes: 0,
    createdAt: new Date().toISOString(),
  };
  stories.unshift(newStory);
  await saveDB();

  const author = users.find((u) => u.id === authorId);

  res.status(201).json({ ...newStory, authorName: author ? author.name : "Unknown" });
});

// Update story
app.put("/api/stories/:id", async (req, res) => {
  const idx = stories.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Story not found" });

  const { title, body, genre, likes } = req.body;
  if (title !== undefined) stories[idx].title = title;
  if (body !== undefined) stories[idx].body = body;
  if (genre !== undefined) stories[idx].genre = genre;
  if (likes !== undefined) stories[idx].likes = likes;

  await saveDB();
  const author = users.find((u) => u.id === stories[idx].authorId);
  res.json({ ...stories[idx], authorName: author ? author.name : "Unknown" });
});

// Delete story
app.delete("/api/stories/:id", async (req, res) => {
  const before = stories.length;
  stories = stories.filter((s) => s.id !== req.params.id);
  comments = comments.filter((c) => c.storyId !== req.params.id);
  if (stories.length === before) return res.status(404).json({ error: "Story not found" });
  await saveDB();
  res.status(204).send();
});

// Increment likes
app.post("/api/stories/:id/like", async (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: "Story not found" });
  story.likes += 1;
  await saveDB();
  const author = users.find((u) => u.id === story.authorId);
  res.json({ ...story, authorName: author ? author.name : "Unknown" });
});

// ------------------ COMMENTS ------------------

// Get comments for a story
app.get("/api/stories/:id/comments", (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: "Story not found" });

  const storyComments = comments
    .filter((c) => c.storyId === story.id)
    .map((c) => {
      const commentAuthor = users.find((u) => u.id === c.authorId);
      return { ...c, authorName: commentAuthor ? commentAuthor.name : "Unknown" };
    });

  res.json(storyComments);
});

// Add comment
app.post("/api/stories/:id/comments", async (req, res) => {
  const story = stories.find((s) => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: "Story not found" });

  const { authorId, text } = req.body;
  if (!authorId || !text) return res.status(400).json({ error: "authorId and text required" });

  const newComment = {
    id: uuidv4(),
    storyId: story.id,
    authorId,
    text,
    createdAt: new Date().toISOString(),
  };
  comments.push(newComment);
  await saveDB();

  const commentAuthor = users.find((u) => u.id === authorId);
  res.status(201).json({ ...newComment, authorName: commentAuthor ? commentAuthor.name : "Unknown" });
});

// Delete comment
app.delete("/api/comments/:commentId", async (req, res) => {
  const before = comments.length;
  comments = comments.filter((c) => c.id !== req.params.commentId);
  if (comments.length === before) return res.status(404).json({ error: "Comment not found" });
  await saveDB();
  res.status(204).send();
});
// ------------------ USER ACTIVITY (CONTENT PERSONALIZATION) ------------------

app.post("/api/userActivity", (req, res) => {
  const { userId, viewedStoryId } = req.body;

  if (!userId || !viewedStoryId) {
    return res.status(400).json({ error: "userId and viewedStoryId are required" });
  }

  // Load user activity file (or create new)
  const activityFile = "./userActivity.json";
  let activityData = [];

  try {
    if (fs.existsSync(activityFile)) {
      const lines = fs.readFileSync(activityFile, "utf-8").trim().split("\n");
      activityData = lines.map((line) => JSON.parse(line));
    }
  } catch (err) {
    console.error("Error reading userActivity.json:", err);
  }

  // Add new record
  activityData.push({ userId, viewedStoryId, timestamp: new Date().toISOString() });

  // Save (append new line)
  fs.appendFileSync(activityFile, JSON.stringify({ userId, viewedStoryId, timestamp: new Date().toISOString() }) + "\n");

  res.status(200).json({ message: "User activity recorded" });
});
// Helper: Get user activity history
function getUserHistory(userId) {
  const activityFile = "./userActivity.json";
  if (!fs.existsSync(activityFile)) return [];

  const lines = fs.readFileSync(activityFile, "utf-8").trim().split("\n");
  const allActivity = lines.map((line) => JSON.parse(line));
  return allActivity.filter((a) => a.userId === userId);
}

// Recommend stories based on last viewed genre
app.get("/api/recommend/:userId", (req, res) => {
  const { userId } = req.params;
  const userHistory = getUserHistory(userId);

  if (userHistory.length === 0) {
    return res.json([]); // no history yet
  }

  const lastViewed = userHistory[userHistory.length - 1];
  const viewedStory = stories.find((s) => s.id === lastViewed.viewedStoryId);

  if (!viewedStory) return res.json([]);

  const lastGenre = viewedStory.genre;
  const recommendations = stories
    .filter((s) => s.genre === lastGenre && s.id !== viewedStory.id)
    .slice(0, 3);

  res.json(recommendations);
});


// ------------------ USERS ------------------

app.get("/api/users/:id", (req, res) => {
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
});

app.post("/api/users", async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const newUser = { id: uuidv4(), name, email: email || "", bio: "" };
  users.push(newUser);
  await saveDB();
  res.status(201).json(newUser);
});

// ------------------ GLOBAL ERROR HANDLER ------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ StorySky backend running at http://localhost:${PORT}/api`)
);

// Export public key for frontend
module.exports = { publicVapidKey: vapidKeys.publicKey };
