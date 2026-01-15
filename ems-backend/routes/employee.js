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
 * GET LOOKUP DATA (for dropdowns in Add Employee form)
 * URL: GET /api/employees/lookups
 * NOTE: This MUST be BEFORE /api/employees/:id route
 * Returns all master data with relationships for cascading dropdowns
 * =====================================================
 */
router.get('/employees/lookups', auth, async (req, res) => {
  try {
    const { region_id, country_id } = req.user;

    // Get all countries
    const countries = await pool.query(
      'SELECT country_id, country_name FROM country ORDER BY country_name'
    );
    
    // Get all regions with country info
    const regions = await pool.query(
      `SELECT r.region_id, r.region_name, r.country_id, c.country_name
       FROM region r
       JOIN country c ON r.country_id = c.country_id
       ORDER BY c.country_name, r.region_name`
    );
    
    // Get all companies with country info
    const companies = await pool.query(
      `SELECT c.company_id, c.company_name, c.country_id, co.country_name
       FROM company c
       JOIN country co ON c.country_id = co.country_id
       ORDER BY c.company_name`
    );
    
    // Get all locations with full hierarchy (company, country, region)
    const locations = await pool.query(
      `SELECT 
         l.location_id, 
         l.city, 
         l.state, 
         l.company_id, 
         l.country_id, 
         l.region_id,
         c.company_name,
         co.country_name,
         r.region_name
       FROM location l
       JOIN company c ON l.company_id = c.company_id
       LEFT JOIN country co ON l.country_id = co.country_id
       LEFT JOIN region r ON l.region_id = r.region_id
       ORDER BY co.country_name, l.city`
    );
    
    // Get all departments
    const departments = await pool.query(
      'SELECT department_id, department_name FROM department ORDER BY department_name'
    );
    
    // Get all designations with department info
    const designations = await pool.query(
      `SELECT 
         d.designation_id, 
         d.designation_name, 
         d.department_id, 
         dep.department_name,
         d.min_ctc_lpa,
         d.max_ctc_lpa
       FROM designation d
       JOIN department dep ON d.department_id = dep.department_id
       ORDER BY dep.department_name, d.designation_name`
    );

    res.json({
      countries: countries.rows,
      regions: regions.rows,
      companies: companies.rows,
      locations: locations.rows,
      departments: departments.rows,
      designations: designations.rows,
      // Send user's context for default selections
      userContext: {
        country_id,
        region_id
      }
    });

  } catch (err) {
    console.error('GET lookups error:', err);
    res.status(500).json({ message: 'Failed to fetch lookup data' });
  }
});


/**
 * =====================================================
 * GET SINGLE EMPLOYEE (Full details)
 * Used by: Employee Details page and Update Employee form
 * URL: GET /api/employees/:id
 * =====================================================
 */
router.get('/employees/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { region_id } = req.user;

  // Get complete employee data including IDs needed for editing
  const result = await pool.query(
    `
    SELECT 
      e.employee_id,
      e.first_name,
      e.last_name,
      e.email,
      e.phone,
      e.company_id,
      e.location_id,
      e.department_id,
      e.designation_id,
      e.joining_date,
      e.employment_type,
      e.gender,
      e.dob,
      c.company_name,
      l.city AS location,
      l.state,
      l.country_id,
      l.region_id,
      co.country_name,
      d.department_name,
      des.designation_name
    FROM employee e
    JOIN company c ON e.company_id = c.company_id
    JOIN location l ON e.location_id = l.location_id
    JOIN country co ON l.country_id = co.country_id
    JOIN department d ON e.department_id = d.department_id
    JOIN designation des ON e.designation_id = des.designation_id
    WHERE e.employee_id = $1
      AND l.region_id = $2
    `,
    [id, region_id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  const employeeData = result.rows[0];

  // Fetch full salary details from employee_salary_current
  const salaryResult = await pool.query(
    `
    SELECT 
      ctc_lpa,
      salary_type,
      effective_from,
      remarks,
      updated_at,
      currency
    FROM employee_salary_current
    WHERE employee_id = $1
    `,
    [id]
  );

  // Add salary data if exists
  if (salaryResult.rows.length > 0) {
    employeeData.salary = salaryResult.rows[0];
  }

  res.json(employeeData);
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
 * ADD NEW EMPLOYEE
 * URL: POST /api/employees
 * =====================================================
 */
router.post('/employees', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      first_name,
      last_name,
      email,
      phone,
      company_id,
      location_id,
      department_id,
      designation_id,
      joining_date,
      employment_type,
      gender,
      dob,
      // Salary information
      ctc_lpa,
      salary_type = 'FIXED',
      effective_from,
      currency = 'INR',
      salary_remarks
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !company_id || !location_id || 
        !department_id || !designation_id || !employment_type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Missing required fields' 
      });
    }

    // Insert employee
    const employeeResult = await client.query(
      `
      INSERT INTO employee (
        first_name, last_name, email, phone, company_id, location_id,
        department_id, designation_id, joining_date, employment_type,
        gender, dob
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING employee_id
      `,
      [
        first_name, last_name, email, phone, company_id, location_id,
        department_id, designation_id, joining_date, employment_type,
        gender, dob
      ]
    );

    const newEmployeeId = employeeResult.rows[0].employee_id;

    // Insert salary information if provided
    if (ctc_lpa && parseFloat(ctc_lpa) > 0) {
      const salaryEffectiveDate = effective_from || joining_date || new Date().toISOString().split('T')[0];
      
      // Insert into employee_salary_current
      await client.query(
        `
        INSERT INTO employee_salary_current (
          employee_id, ctc_lpa, salary_type, effective_from, currency, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [newEmployeeId, parseFloat(ctc_lpa), salary_type, salaryEffectiveDate, currency, salary_remarks]
      );

      // Also add to history
      await client.query(
        `
        INSERT INTO employee_salary_history (
          employee_id, ctc_lpa, effective_from, salary_type, currency, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [newEmployeeId, parseFloat(ctc_lpa), salaryEffectiveDate, salary_type, currency, salary_remarks]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Employee added successfully',
      employee_id: newEmployeeId
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ADD employee error:', err);
    
    if (err.constraint === 'employee_email_key') {
      return res.status(400).json({ message: 'Email already exists' });
    }
    
    if (err.code === '23514') { // Check constraint violation
      return res.status(400).json({ 
        message: 'Invalid data: ' + (err.detail || err.message)
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to add employee',
      error: err.message 
    });
  } finally {
    client.release();
  }
});


/**
 * =====================================================
 * DELETE EMPLOYEE
 * URL: DELETE /api/employees/:id
 * Deletes employee and all related records from all tables
 * =====================================================
 */
router.delete('/employees/:id', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { region_id } = req.user;

    // Check if employee exists and belongs to HR's region
    const checkResult = await client.query(
      `
      SELECT e.employee_id
      FROM employee e
      JOIN location l ON e.location_id = l.location_id
      WHERE e.employee_id = $1 AND l.region_id = $2
      `,
      [id, region_id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        message: 'Employee not found or access denied' 
      });
    }

    await client.query('BEGIN');

    // Explicitly delete from all related tables to ensure data integrity
    // Even though some have CASCADE, explicit deletion ensures clean removal
    
    // 1. Delete attendance records
    await client.query('DELETE FROM attendance WHERE employee_id = $1', [id]);
    
    // 2. Delete leave requests
    await client.query('DELETE FROM leave_request WHERE employee_id = $1', [id]);
    
    // 3. Delete employee projects
    await client.query('DELETE FROM employee_project WHERE employee_id = $1', [id]);
    
    // 4. Delete performance reviews
    await client.query('DELETE FROM employee_performance WHERE employee_id = $1', [id]);
    
    // 5. Delete documents
    await client.query('DELETE FROM employee_document WHERE employee_id = $1', [id]);
    
    // 6. Delete salary history
    await client.query('DELETE FROM employee_salary_history WHERE employee_id = $1', [id]);
    
    // 7. Delete current salary
    await client.query('DELETE FROM employee_salary_current WHERE employee_id = $1', [id]);
    
    // 8. Finally, delete the employee record
    const deleteResult = await client.query(
      'DELETE FROM employee WHERE employee_id = $1 RETURNING employee_id',
      [id]
    );

    await client.query('COMMIT');

    console.log(`✅ Employee ${id} and all related records deleted successfully`);

    res.json({ 
      message: 'Employee and all related records deleted successfully',
      employee_id: parseInt(id)
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('DELETE employee error:', err);
    res.status(500).json({ 
      message: 'Failed to delete employee',
      error: err.message 
    });
  } finally {
    client.release();
  }
});


/**
 * =====================================================
 * UPDATE EMPLOYEE (full edit)
 * URL: PUT /api/employees/:id
 * =====================================================
 */
router.put('/employees/:id', auth, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      company_id,
      location_id,
      department_id,
      designation_id,
      joining_date,
      employment_type,
      gender,
      dob,
      // Salary information
      ctc_lpa,
      salary_type,
      effective_from,
      currency,
      salary_remarks
    } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !email || !company_id || !location_id || 
        !department_id || !designation_id || !employment_type) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        message: 'Missing required fields' 
      });
    }

    // Check if employee exists
    const empCheck = await client.query(
      'SELECT employee_id FROM employee WHERE employee_id = $1',
      [id]
    );

    if (empCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        message: 'Employee not found' 
      });
    }

    // Update employee basic information
    await client.query(
      `UPDATE employee
       SET
         first_name = $1,
         last_name = $2,
         email = $3,
         phone = $4,
         company_id = $5,
         location_id = $6,
         department_id = $7,
         designation_id = $8,
         joining_date = $9,
         employment_type = $10,
         gender = $11,
         dob = $12
       WHERE employee_id = $13`,
      [
        first_name,
        last_name,
        email,
        phone,
        company_id,
        location_id,
        department_id,
        designation_id,
        joining_date,
        employment_type,
        gender,
        dob,
        id
      ]
    );

    // Update salary information if provided
    if (ctc_lpa && effective_from) {
      // Check if current salary record exists
      const currentSalaryCheck = await client.query(
        'SELECT employee_id FROM employee_salary_current WHERE employee_id = $1',
        [id]
      );

      if (currentSalaryCheck.rows.length > 0) {
        // Get the current salary data before updating
        const oldSalary = await client.query(
          'SELECT ctc_lpa, effective_from, salary_type, currency FROM employee_salary_current WHERE employee_id = $1',
          [id]
        );

        // Check if salary has actually changed
        const oldData = oldSalary.rows[0];
        const salaryChanged = 
          parseFloat(oldData.ctc_lpa) !== parseFloat(ctc_lpa) ||
          oldData.effective_from !== effective_from ||
          oldData.salary_type !== salary_type;

        if (salaryChanged) {
          // Archive the old salary to history
          await client.query(
            `INSERT INTO employee_salary_history 
             (employee_id, ctc_lpa, effective_from, effective_to, salary_type, currency, remarks)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              oldData.ctc_lpa,
              oldData.effective_from,
              new Date().toISOString().split('T')[0], // Set effective_to to today
              oldData.salary_type,
              oldData.currency || 'INR',
              'Archived due to salary update'
            ]
          );

          // Update current salary
          await client.query(
            `UPDATE employee_salary_current
             SET
               ctc_lpa = $1,
               salary_type = $2,
               effective_from = $3,
               currency = $4,
               remarks = $5,
               updated_at = CURRENT_TIMESTAMP
             WHERE employee_id = $6`,
            [
              ctc_lpa,
              salary_type || 'FIXED',
              effective_from,
              currency || 'INR',
              salary_remarks,
              id
            ]
          );
        } else {
          // Just update remarks and other non-critical fields if no salary change
          await client.query(
            `UPDATE employee_salary_current
             SET
               remarks = $1,
               updated_at = CURRENT_TIMESTAMP
             WHERE employee_id = $2`,
            [salary_remarks, id]
          );
        }
      } else {
        // Insert new salary record if none exists
        await client.query(
          `INSERT INTO employee_salary_current 
           (employee_id, ctc_lpa, salary_type, effective_from, currency, remarks)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            id,
            ctc_lpa,
            salary_type || 'FIXED',
            effective_from,
            currency || 'INR',
            salary_remarks
          ]
        );

        // Also add to history
        await client.query(
          `INSERT INTO employee_salary_history 
           (employee_id, ctc_lpa, effective_from, effective_to, salary_type, currency, remarks)
           VALUES ($1, $2, $3, NULL, $4, $5, $6)`,
          [
            id,
            ctc_lpa,
            effective_from,
            salary_type || 'FIXED',
            currency || 'INR',
            salary_remarks
          ]
        );
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Employee ${id} updated successfully`);

    res.json({ 
      message: 'Employee updated successfully',
      employee_id: parseInt(id)
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('UPDATE employee error:', err);
    res.status(500).json({ 
      message: 'Failed to update employee',
      error: err.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
