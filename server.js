require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Khởi tạo AI AN TOÀN (Chống sập nếu quên gắn Key trên Vercel)
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn("⚠️ CẢNH BÁO: Chưa cấu hình GEMINI_API_KEY. Tính năng AI sẽ tạm tắt.");
}

// 2. Kết nối Database
if (!process.env.DATABASE_URL) {
  console.error("❌ LỖI NGHIÊM TRỌNG: Chưa cấu hình DATABASE_URL trên Vercel!");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
pool.connect(async (err, client, release) => {
  if (err) return console.error('Lỗi kết nối database:', err.message);
  console.log('✨ Đã kết nối Supabase PostgreSQL!');
  try {
    // Tạo bảng với cột thời gian
    await client.query(`CREATE TABLE IF NOT EXISTS vocabulary (
      id SERIAL PRIMARY KEY, 
      word TEXT NOT NULL, 
      part_of_speech TEXT NOT NULL, 
      mean TEXT NOT NULL, 
      pronunciation TEXT DEFAULT '', 
      examples TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Nâng cấp bảng cũ (Thêm cột thời gian cho các từ đã có sẵn)
    await client.query(`ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
  } catch (error) { 
    console.error('Lỗi khởi tạo bảng:', error); 
  } finally { 
    if(release) release(); 
  }
});



// --- CÁC API TỪ VỰNG ---
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

// --- API PHÂN TÍCH AI ---
app.post('/api/ai-analyze', async (req, res) => {
  if (!genAI) return res.status(500).json({ error: "Máy chủ chưa được gắn chìa khóa AI (GEMINI_API_KEY)!" });
  
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: "Chưa nhập từ cần phân tích" });

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Bạn là một chuyên gia tiếng Anh. Hãy phân tích từ "${word}".
    Trả về CHỈ một chuỗi JSON hợp lệ theo đúng định dạng sau, tuyệt đối không có ký tự markdown (như \`\`\`json):
    {
      "word": "${word}",
      "phonetic": "phiên âm quốc tế IPA",
      "pos": "Loại từ chính (vd: Noun, Verb...)",
      "mean": "Nghĩa tiếng Việt ngắn gọn",
      "family": [
        {"pos": "Danh từ/Động từ/Tính từ...", "word": "từ liên quan", "mean": "nghĩa"}
      ],
      "examples": [
        {"en": "Câu ví dụ 1 tiếng Anh", "vi": "Dịch nghĩa 1 tiếng Việt"}
      ]
    }`;

    const result = await model.generateContent(prompt);
    let text = await result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error("Lỗi AI:", err);
    res.status(500).json({ error: "AI đang bận, vui lòng thử lại sau!" });
  }
});

app.listen(process.env.PORT || 3000, () => { console.log('🚀 Server đã chạy!'); });