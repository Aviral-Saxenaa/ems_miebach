const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'aviral',
  password: '1234',
  database: 'miebach',
  port: 5432
});

async function testSalary() {
  try {
    console.log('Testing employee_salary_current table:');
    const salaryResult = await pool.query('SELECT * FROM employee_salary_current LIMIT 3');
    console.log('Salary data:', salaryResult.rows);
    console.log('\n');

    console.log('Testing vw_employee_with_current_salary view:');
    const viewResult = await pool.query('SELECT * FROM vw_employee_with_current_salary LIMIT 3');
    console.log('View data:', viewResult.rows);
    console.log('\n');

    console.log('Testing combined query (what the API does):');
    const combinedResult = await pool.query(`
      SELECT 
        employee_id,
        ctc_lpa,
        salary_type,
        effective_from,
        remarks,
        updated_at,
        currency
      FROM employee_salary_current
      WHERE employee_id = 10
    `);
    console.log('Combined query for employee 10:', combinedResult.rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

testSalary();
