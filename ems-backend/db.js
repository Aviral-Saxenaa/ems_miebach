const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  user: 'aviral',
  password: '1234',
  database: 'miebach',
  port: 5432
});


/* 🔥 CONNECTION TEST */
pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL connected successfully');
    client.release();
  })
  .catch(err => {
    console.error('❌ PostgreSQL connection failed');
    console.error(err.message);
  });

  pool.query('SELECT current_database()', (err, res) => {
  if (!err) {
    console.log('📦 Connected Database:', res.rows[0].current_database);
  }
});


module.exports = pool;
