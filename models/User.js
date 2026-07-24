const mongoose = require('mongoose');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['owner', 'recruiter'], required: true },
    applySlug: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
  },
  { timestamps: true }
);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function randomSuffix() {
  return crypto.randomBytes(3).toString('hex');
}

async function generateUniqueSlug(name) {
  const base = slugify(name) || 'user';
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const exists = await mongoose.model('User').findOne({ applySlug: slug });
    if (!exists) return slug;
    slug = `${base}-${randomSuffix()}`;
  }
  throw new Error('Could not generate unique applySlug after 10 attempts');
}

userSchema.statics.generateApplySlug = generateUniqueSlug;

module.exports = mongoose.model('User', userSchema);
