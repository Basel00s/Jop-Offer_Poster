#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');
const User = require('../models/User');

async function main() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/job-poster';
  await mongoose.connect(uri);
  console.log(`[Seed] Connected to MongoDB (${uri})`);

  let name = process.env.OWNER_NAME;
  let email = process.env.OWNER_EMAIL;
  let password = process.env.OWNER_PASSWORD;

  if (name && email && password) {
    console.log('[Seed] Using OWNER_NAME, OWNER_EMAIL, OWNER_PASSWORD from environment.');
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((r) => rl.question(q, r));

    name = name || await ask('Name: ');
    email = email || await ask('Email: ');
    password = password || await ask('Password: ');
    rl.close();
  }

  if (!name || !email || !password) {
    console.error('[Seed] All fields are required.');
    process.exit(1);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.error('[Seed] A user with this email already exists.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const applySlug = await User.generateApplySlug(name);

  await User.create({ name, email, passwordHash, role: 'owner', applySlug });
  console.log('[Seed] Owner user created successfully.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[Seed] Failed:', err.message);
  process.exit(1);
});
