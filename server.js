require('dotenv').config(); // Lấy dữ liệu từ file .env
const express = require('express');
const { Pool } = require('pg'); // Thư viện kết nối PostgreSQL
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// THIẾT LẬP KẾT NỐI DATABASE SUPABASE
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Bắt buộc khi dùng Cloud Database
});

// Kiểm tra kết nối và tạo bảng
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Lỗi kết nối Database:', err.stack);
    }
    console.log('1. Đã kết nối thành công với Supabase PostgreSQL!');
    
    // Lệnh tạo bảng của Postgres (Dùng SERIAL thay cho AUTOINCREMENT)
    client.query(`CREATE TABLE IF NOT EXISTS vocabulary (
        id SERIAL PRIMARY KEY,
        word VARCHAR(255) NOT NULL,
        part_of_speech VARCHAR(100) NOT NULL,
        mean TEXT NOT NULL
    )`, (err) => {
        release(); // Giải phóng kết nối
        if (err) console.error('Lỗi khi tạo bảng:', err.stack);
        else console.log('2. Bảng "vocabulary" đã sẵn sàng trên Cloud.');
    });
});

// ==========================================
// CÁC API XỬ LÝ DỮ LIỆU (Dùng async/await cho gọn gàng)
// ==========================================

// 1. API Lấy danh sách từ (Sắp xếp theo ID giảm dần để từ mới lên đầu)
app.get('/api/words', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM vocabulary ORDER BY id DESC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. API Thêm từ mới (Postgres dùng $1, $2, $3 thay cho dấu ? của SQLite)
app.post('/api/add-word', async (req, res) => {
    const { word, part_of_speech, mean } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO vocabulary (word, part_of_speech, mean) VALUES ($1, $2, $3) RETURNING id`,
            [word, part_of_speech, mean]
        );
        res.json({ message: "Đã thêm từ vựng lên Cloud!", id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. API Xóa từ vựng
app.delete('/api/words/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM vocabulary WHERE id = $1`, [req.params.id]);
        res.json({ message: "Đã xóa từ vựng khỏi Cloud!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. API Sửa từ vựng
app.put('/api/words/:id', async (req, res) => {
    const { word, part_of_speech, mean } = req.body;
    try {
        await pool.query(
            `UPDATE vocabulary SET word = $1, part_of_speech = $2, mean = $3 WHERE id = $4`,
            [word, part_of_speech, mean, req.params.id]
        );
        res.json({ message: "Đã cập nhật từ vựng trên Cloud!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// KHỞI ĐỘNG MÁY CHỦ
// ==========================================
app.listen(port, () => {
    console.log(`3. Máy chủ đang chạy tại: http://localhost:${port}`);
});