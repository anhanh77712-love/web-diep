require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Khởi tạo AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn("⚠️ CẢNH BÁO: Chưa cấu hình GEMINI_API_KEY.");
}

// 2. Kết nối Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect(async (err, client, release) => {
  if (err) return console.error('Lỗi kết nối database:', err.message);
  console.log('✨ Đã kết nối Supabase PostgreSQL!');
  try {
    // Bảng Từ Vựng (Cũ)
    await client.query(`CREATE TABLE IF NOT EXISTS vocabulary (id SERIAL PRIMARY KEY, word TEXT NOT NULL, part_of_speech TEXT NOT NULL, mean TEXT NOT NULL, pronunciation TEXT DEFAULT '', examples TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await client.query(`ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    
    // BẢNG CỤM TỪ (MỚI)
    await client.query(`CREATE TABLE IF NOT EXISTS phrases (id SERIAL PRIMARY KEY, phrase TEXT NOT NULL, mean TEXT NOT NULL, examples TEXT DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  } catch (error) { console.error('Lỗi khởi tạo bảng:', error); } finally { if(release) release(); }
});

// ================= API TỪ VỰNG =================
app.get('/api/words', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vocabulary ORDER BY created_at DESC, id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/add-word', async (req, res) => {
  const { word, part_of_speech, mean, pronunciation, examples } = req.body;
  try {
    const result = await pool.query(`INSERT INTO vocabulary (word, part_of_speech, mean, pronunciation, examples) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [word, part_of_speech, mean, pronunciation || '', examples || '']);
    res.json({ message: "Thành công!", id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/words/:id', async (req, res) => {
  const { word, part_of_speech, mean, pronunciation, examples } = req.body;
  try {
    await pool.query(`UPDATE vocabulary SET word = $1, part_of_speech = $2, mean = $3, pronunciation = $4, examples = $5 WHERE id = $6`, [word, part_of_speech, mean, pronunciation || '', examples || '', req.params.id]);
    res.json({ message: "Đã cập nhật!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/words/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM vocabulary WHERE id = $1`, [req.params.id]);
    res.json({ message: "Đã xóa!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ================= API CỤM TỪ (MỚI) =================
app.get('/api/phrases', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM phrases ORDER BY created_at DESC, id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/phrases', async (req, res) => {
  const { phrase, mean, examples } = req.body;
  try {
    const result = await pool.query(`INSERT INTO phrases (phrase, mean, examples) VALUES ($1, $2, $3) RETURNING id`, [phrase, mean, examples || '']);
    res.json({ message: "Thành công!", id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/phrases/:id', async (req, res) => {
  const { phrase, mean, examples } = req.body;
  try {
    await pool.query(`UPDATE phrases SET phrase = $1, mean = $2, examples = $3 WHERE id = $4`, [phrase, mean, examples || '', req.params.id]);
    res.json({ message: "Đã cập nhật!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/phrases/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM phrases WHERE id = $1`, [req.params.id]);
    res.json({ message: "Đã xóa!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ================= API PHÂN TÍCH AI =================
app.post('/api/ai-analyze', async (req, res) => {
  if (!genAI) return res.status(500).json({ error: "Thiếu GEMINI_API_KEY" });
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Chưa nhập từ" });
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Phân tích từ/cụm từ "${word}". Trả về JSON hợp lệ: {"word": "${word}", "phonetic": "phiên âm", "pos": "Loại từ", "mean": "Nghĩa ngắn", "family": [{"pos": "Từ loại", "word": "từ", "mean": "nghĩa"}], "examples": [{"en": "Câu TA", "vi": "Nghĩa TV"}]}`;
    const result = await model.generateContent(prompt);
    let text = await result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    res.json(JSON.parse(text));
  } catch (err) { res.status(500).json({ error: "AI đang bận" }); }
});

app.listen(process.env.PORT || 3000, () => { console.log('🚀 Server đã chạy!'); });