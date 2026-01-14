const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * =====================================================
 * GET ALL EMPLOYEES (Region-based + image)
 * Used by: Employee List page
 * URL: GET /api/employees
 * =====================================================
 */
router.get('/employees', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const offset = (page - 1) * limit;

  const { region_id } = req.user;

  const data = await pool.query(
    `
    SELECT v.*
    FROM vw_employee_details v
    JOIN location l
      ON l.city = v.location
    WHERE l.region_id = $1
    ORDER BY v.first_name
    LIMIT $2 OFFSET $3
    `,
    [region_id, limit, offset]
  );

  const count = await pool.query(
    `
    SELECT COUNT(*)
    FROM vw_employee_details v
    JOIN location l
      ON l.city = v.location
    WHERE l.region_id = $1
    `,
    [region_id]
  );

  res.json({
    employees: data.rows,
    total: parseInt(count.rows[0].count),
    page,
    limit
  });
});




/**
 * =====================================================
 * GET SINGLE EMPLOYEE (Full details)
 * Used by: Employee Details page
 * URL: GET /api/employees/:id
 * =====================================================
 */
router.get('/employees/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { region_id } = req.user;

  const result = await pool.query(
    `
    SELECT v.*
    FROM vw_employee_details v
    JOIN location l
      ON l.city = v.location
    WHERE v.employee_id = $1
      AND l.region_id = $2
    `,
    [id, region_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  res.json(result.rows[0]);
});


router.get('/employee/:id/documents', async (req, res) => {
  const { id } = req.params;

  const result = await pool.query(
    `
    SELECT document_type, file_url
    FROM employee_document
    WHERE employee_id = $1
      AND is_active = true
    `,
    [id]
  );

  res.json(result.rows);
});



/**
 * =====================================================
 * SEARCH EMPLOYEES (optional – backend search)
 * Used if you want server-side search
 * URL: GET /api/employees/search?q=aviral
 * =====================================================
 */
router.get('/employees/search', auth, async (req, res) => {
  try {
    const { q } = req.query;
    const { region_id } = req.user;

    const result = await pool.query(
      `
      SELECT
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        img.image_url
      FROM employee e
      LEFT JOIN employee_img img
        ON e.employee_id = img.employee_id
      WHERE e.location_id = $1
        AND (
          LOWER(e.first_name) LIKE LOWER($2)
          OR LOWER(e.last_name) LIKE LOWER($2)
          OR LOWER(e.email) LIKE LOWER($2)
        )
      `,
      [region_id, `%${q}%`]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('SEARCH employees error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * =====================================================
 * UPDATE EMPLOYEE (basic edit – optional)
 * URL: PUT /api/employees/:id
 * =====================================================
 */
router.put('/employees/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      phone,
      status,
      employment_type,
      department_id,
      designation_id
    } = req.body;

    await pool.query(
      `
      UPDATE employee
      SET
        phone = $1,
        status = $2,
        employment_type = $3,
        department_id = $4,
        designation_id = $5
      WHERE employee_id = $6
      `,
      [
        phone,
        status,
        employment_type,
        department_id,
        designation_id,
        id
      ]
    );

    res.json({ message: 'Employee updated successfully' });
  } catch (err) {
    console.error('UPDATE employee error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
