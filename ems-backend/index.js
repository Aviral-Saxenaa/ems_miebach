const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use((req, res, next) => {
  console.log('➡️ Incoming:', req.method, req.url);
  next();
});

app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/employee'));
app.use('/api', require('./routes/employeeImg'));
app.use('/api', require('./routes/employeeDocument'));


app.listen(3001, () =>
  console.log('🚀 Backend running on 3001')
);
