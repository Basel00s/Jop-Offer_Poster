const express = require('express');
const router = express.Router();
const PostJob = require('../models/PostJob');
const Account = require('../models/Account');

function toPublicJob(job) {
  const doc = job.toObject ? job.toObject() : job;
  return {
    ...doc,
    offerTitle: doc.offer?.title ?? null,
    groupName: doc.group?.name ?? null,
    accountNickname: doc.account?.nickname ?? null,
    offer: doc.offer?._id ?? doc.offer,
    group: doc.group?._id ?? doc.group,
    account: doc.account?._id ?? doc.account,
  };
}

// GET post jobs (optional ?status=, ?account=, ?ownerId= filters)
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.account) filter.account = req.query.account;

  const role = req.session.role;
  if (role === 'recruiter') {
    filter.owner = req.session.userId;
  } else if (req.query.ownerId) {
    filter.owner = req.query.ownerId;
  }

  const jobs = await PostJob.find(filter)
    .sort({ queuedAt: -1 })
    .populate('offer', 'title')
    .populate('group', 'name')
    .populate('account', 'nickname');

  res.json(jobs.map(toPublicJob));
});

// Bulk-create post jobs (account × group × offer combinations)
router.post('/', async (req, res) => {
  try {
    const { accountId, groupIds, offerIds } = req.body;

    if (
      !accountId ||
      !Array.isArray(groupIds) ||
      !Array.isArray(offerIds) ||
      !groupIds.length ||
      !offerIds.length
    ) {
      return res.status(400).json({
        error: 'accountId must be a non-empty string, groupIds and offerIds must be non-empty arrays',
      });
    }

    const account = await Account.findById(accountId).select('owner').lean();
    if (!account) {
      return res.status(400).json({ error: 'Account not found' });
    }

    const candidates = [];
    for (const groupId of groupIds) {
      for (const offerId of offerIds) {
        candidates.push({ offer: offerId, group: groupId, account: accountId });
      }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await PostJob.find({
      account: accountId,
      group: { $in: groupIds },
      offer: { $in: offerIds },
      status: { $in: ['queued', 'posted'] },
      queuedAt: { $gte: twentyFourHoursAgo },
    }).lean();

    const dupKey = (doc) => `${doc.offer.toString()}|${doc.group.toString()}|${doc.account.toString()}`;
    const existingSet = new Set(existing.map(dupKey));

    const jobs = [];
    let skipped = 0;
    for (const c of candidates) {
      if (existingSet.has(`${c.offer}|${c.group}|${c.account}`)) {
        skipped++;
      } else {
        jobs.push({ ...c, owner: account.owner });
      }
    }

    let created = 0;
    if (jobs.length) {
      created = (await PostJob.insertMany(jobs)).length;
    }

    res.status(201).json({ created, skipped });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
