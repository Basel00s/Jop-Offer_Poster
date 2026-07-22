require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./db');

const offersRouter = require('./routes/offers');
const groupsRouter = require('./routes/groups');
const accountsRouter = require('./routes/accounts');
const postJobsRouter = require('./routes/postJobs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/offers', offersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/post-jobs', postJobsRouter);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Running at http://localhost:${PORT}`);
  });
});
