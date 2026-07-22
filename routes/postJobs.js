const express = require('express');
const router = express.Router();
const PostJob = require('../models/PostJob');

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

// GET post jobs (optional ?status= and ?account= filters)
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.account) filter.account = req.query.account;

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
    const { accountIds, groupIds, offerIds } = req.body;

    if (
      !Array.isArray(accountIds) ||
      !Array.isArray(groupIds) ||
      !Array.isArray(offerIds) ||
      !accountIds.length ||
      !groupIds.length ||
      !offerIds.length
    ) {
      return res.status(400).json({
        error: 'accountIds, groupIds, and offerIds must each be non-empty arrays',
      });
    }

    const jobs = [];
    for (const accountId of accountIds) {
      for (const groupId of groupIds) {
        for (const offerId of offerIds) {
          jobs.push({ offer: offerId, group: groupId, account: accountId });
        }
      }
    }

    const created = await PostJob.insertMany(jobs);
    res.status(201).json({ created: created.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
