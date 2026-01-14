const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const result = await pool.query(
    `SELECT hr_id, hr_name, username, country_id, region_id, is_active
     FROM hr_login
     WHERE username = $1 AND password = $2`,
    [username, password]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const hr = result.rows[0];

  if (!hr.is_active) {
    return res.status(403).json({ message: 'HR is inactive' });
  }

  const token = jwt.sign(
    {
      hr_id: hr.hr_id,
      hr_name: hr.hr_name,
      region_id: hr.region_id,
      country_id: hr.country_id
    },
    'secret_key',
    { expiresIn: '1h' }
  );

  res.json({
    token,
    hr
  });
});

module.exports = router;
