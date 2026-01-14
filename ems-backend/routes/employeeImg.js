const express = require('express');
const pool = require('../db');
const upload = require('../middleware/upload');

const router = express.Router();

console.log('✅ employeeImg routes loaded');


router.post(
  '/employee/:id/image',
  upload.single('image'),
  async (req, res) => {
    const employeeId = req.params.id;

    // ❗ Check if image already exists
    const exists = await pool.query(
      'SELECT 1 FROM employee_img WHERE employee_id = $1',
      [employeeId]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        message: 'Image already exists for this employee'
      });
    }

    const imageUrl =
      `http://localhost:3001/uploads/${req.file.filename}`;

    await pool.query(
      `INSERT INTO employee_img (employee_id, image_url)
       VALUES ($1, $2)`,
      [employeeId, imageUrl]
    );

    res.json({ message: 'Image uploaded', imageUrl });
  }
);

module.exports = router;
