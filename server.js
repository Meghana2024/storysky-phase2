// backend/server.js
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- In-memory sample data ----------
let stories = [
  {
    id: 's1',
    title: 'A Moonlit Night',
    body: 'Once upon a moonlit night...',
    authorId: 'u1',
    genre: 'Fantasy',
    likes: 3,
    createdAt: new Date().toISOString(),
  }
];

let users = [
  { id: 'u1', name: 'Meghana M', bio: 'Student', avatarUrl: '' }
];

let comments = [];

// ---------- Story routes ----------
app.get('/api/stories', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  let result = stories;
  if (q) result = result.filter(s => (s.title + ' ' + s.body).toLowerCase().includes(q));
  res.json({ data: result, meta: { total: result.length } });
});

app.get('/api/stories/:id', (req, res) => {
  const story = stories.find(s => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const storyComments = comments.filter(c => c.storyId === story.id);
  res.json({ ...story, comments: storyComments });
});

app.post('/api/stories', (req, res) => {
  const { title, body, authorId, genre } = req.body;
  if (!title || !body || !authorId)
    return res.status(400).json({ error: 'title, body, authorId required' });

  const newStory = {
    id: uuidv4(),
    title,
    body,
    authorId,
    genre: genre || '',
    likes: 0,
    createdAt: new Date().toISOString(),
  };
  stories.unshift(newStory);
  res.status(201).json(newStory);
});

app.put('/api/stories/:id', (req, res) => {
  const idx = stories.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Story not found' });

  const { title, body, genre } = req.body;
  if (title !== undefined) stories[idx].title = title;
  if (body !== undefined) stories[idx].body = body;
  if (genre !== undefined) stories[idx].genre = genre;
  res.json(stories[idx]);
});

app.delete('/api/stories/:id', (req, res) => {
  const before = stories.length;
  stories = stories.filter(s => s.id !== req.params.id);
  if (stories.length === before) return res.status(404).json({ error: 'Story not found' });
  comments = comments.filter(c => c.storyId !== req.params.id);
  res.status(204).send();
});

// ---------- Comments ----------
app.get('/api/stories/:id/comments', (req, res) => {
  const story = stories.find(s => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  res.json(comments.filter(c => c.storyId === story.id));
});

app.post('/api/stories/:id/comments', (req, res) => {
  const story = stories.find(s => s.id === req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });

  const { authorId, text } = req.body;
  if (!authorId || !text) return res.status(400).json({ error: 'authorId and text required' });

  const newComment = {
    id: uuidv4(),
    storyId: story.id,
    authorId,
    text,
    createdAt: new Date().toISOString(),
  };
  comments.push(newComment);
  res.status(201).json(newComment);
});

app.delete('/api/comments/:commentId', (req, res) => {
  const before = comments.length;
  comments = comments.filter(c => c.id !== req.params.commentId);
  if (comments.length === before) return res.status(404).json({ error: 'Comment not found' });
  res.status(204).send();
});

// ---------- Users ----------
app.get('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const newUser = { id: uuidv4(), name, email: email || '', bio: '' };
  users.push(newUser);
  res.status(201).json(newUser);
});

// ---------- Global error handler ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ StorySky backend running at http://localhost:${PORT}/api`)
);
