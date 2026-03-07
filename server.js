require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Kết nối và tự động nâng cấp bảng Database
pool.connect(async (err, client, release) => {
  if (err) return console.error('Lỗi kết nối database:', err.stack);
  console.log('✨ Đã kết nối thành công với Supabase PostgreSQL!');
  
  try {
    // 1. Tạo bảng nếu chưa có
    await client.query(`CREATE TABLE IF NOT EXISTS vocabulary (
      id SERIAL PRIMARY KEY,
      word TEXT NOT NULL,
      part_of_speech TEXT NOT NULL,
      mean TEXT NOT NULL
    )`);
    
    // 2. Thêm cột phát âm và ví dụ (nếu chưa có)
    await client.query(`ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS pronunciation TEXT DEFAULT '';`);
    await client.query(`ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS examples TEXT DEFAULT '';`);
    
    console.log('✅ Bảng dữ liệu đã được nâng cấp thêm Phát âm và Ví dụ!');
  } catch (error) {
    console.error('Lỗi khởi tạo bảng:', error);
  } finally {
    release();
  }
});

// Lấy danh sách từ
app.get('/api/words', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vocabulary ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thêm từ mới (đã nâng cấp)
app.post('/api/add-word', async (req, res) => {
  const { word, part_of_speech, mean, pronunciation, examples } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO vocabulary (word, part_of_speech, mean, pronunciation, examples) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [word, part_of_speech, mean, pronunciation || '', examples || '']
    );
    res.json({ message: "Đã thêm từ vựng thành công!", id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sửa từ vựng (đã nâng cấp)
app.put('/api/words/:id', async (req, res) => {
  const { word, part_of_speech, mean, pronunciation, examples } = req.body;
  try {
    await pool.query(
      `UPDATE vocabulary SET word = $1, part_of_speech = $2, mean = $3, pronunciation = $4, examples = $5 WHERE id = $6`,
      [word, part_of_speech, mean, pronunciation || '', examples || '', req.params.id]
    );
    res.json({ message: "Đã cập nhật từ vựng!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa từ vựng
app.delete('/api/words/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM vocabulary WHERE id = $1`, [req.params.id]);
    res.json({ message: "Đã xóa từ vựng!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Server đang chạy!');
});