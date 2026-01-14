const express = require('express');
const pool = require('../db');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');


const router = express.Router();

/**
 * Upload employee document (proof or photo)
 */
router.post(
  '/employee/:id/document',
  upload.single('file'),
  async (req, res) => {
    const { id } = req.params;
    const { document_type } = req.body;

    if (!document_type) {
      return res.status(400).json({ message: 'Document type required' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'File is required' });
    }

    // ❗ Check if ANY ID proof document already exists (only if not PROFILE_PHOTO)
    if (document_type !== 'PROFILE_PHOTO') {
      const existingDoc = await pool.query(
        `
        SELECT document_type
        FROM employee_document
        WHERE employee_id = $1
          AND document_type != 'PROFILE_PHOTO'
          AND is_active = true
        LIMIT 1
        `,
        [id]
      );

      if (existingDoc.rows.length > 0) {
        return res.status(400).json({
          message: `You have already uploaded ${existingDoc.rows[0].document_type}. Please delete it first to upload a different document.`
        });
      }
    }

    // ❗ Check if PROFILE_PHOTO already exists (allow only one profile photo)
    if (document_type === 'PROFILE_PHOTO') {
      const existingPhoto = await pool.query(
        `
        SELECT 1
        FROM employee_document
        WHERE employee_id = $1
          AND document_type = 'PROFILE_PHOTO'
          AND is_active = true
        `,
        [id]
      );

      if (existingPhoto.rows.length > 0) {
        return res.status(400).json({
          message: 'Profile photo already uploaded. Please delete it first to upload a new one.'
        });
      }
    }

    const fileUrl = `http://localhost:3001/uploads/${req.file.filename}`;

    await pool.query(
      `
      INSERT INTO employee_document
        (employee_id, document_type, document_name, file_url, is_active)
      VALUES
        ($1, $2, $3, $4, true)
      `,
      [
        id,
        document_type,
        req.file.originalname,
        fileUrl
      ]
    );

    res.json({
      message: 'Document uploaded successfully',
      fileUrl
    });
  }
);

router.get('/employee/:id/documents', async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `
    SELECT document_id, document_type, file_url
    FROM employee_document
    WHERE employee_id = $1
      AND is_active = true
    `,
    [id]
  );

  res.json(result.rows);
});


router.delete('/employee/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    console.log('🗑️ Delete request for document ID:', documentId);

    // 1️⃣ Get document
    const result = await pool.query(
      `
      SELECT file_url
      FROM employee_document
      WHERE document_id = $1
        AND is_active = true
      `,
      [documentId]
    );

    console.log('📄 Found documents:', result.rows.length);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Document not found or already deleted'
      });
    }

    const fileUrl = result.rows[0].file_url;
    const fileName = fileUrl ? fileUrl.split('/uploads/')[1] : null;
    console.log('📎 File to delete:', fileName);

    // 2️⃣ Delete file safely
    if (fileName) {
      const filePath = path.join(
        process.cwd(),
        'uploads',
        fileName
      );

      console.log('📍 File path:', filePath);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ File deleted from disk');
      } else {
        console.log('⚠️ File not found on disk');
      }
    }

    // 3️⃣ Soft delete in DB
    await pool.query(
      `
      UPDATE employee_document
      SET is_active = false
      WHERE document_id = $1
      `,
      [documentId]
    );

    console.log('✅ Document marked as deleted in DB');
    res.json({ message: 'Document deleted successfully' });

  } catch (err) {
    console.error('❌ DELETE DOCUMENT ERROR:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({
      message: 'Failed to delete document',
      error: err.message
    });
  }
});



module.exports = router;
