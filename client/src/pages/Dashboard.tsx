import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../lib/api';
import type { Account, Group, Offer, PostJob } from '../lib/types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import MultiSelect from '../components/ui/MultiSelect';
import Table from '../components/ui/Table';
import { showToast } from '../components/ui/Toast';

const HEALTH_POLL = 20000;
const HISTORY_POLL = 5000;

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [postHistory, setPostHistory] = useState<PostJob[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyAccount, setHistoryAccount] = useState('');
  const [historyAccounts, setHistoryAccounts] = useState<Account[]>([]);

  const filteredAccounts = accounts.filter((a) => a.status === 'active');
  const filteredOffers = offers.filter((o) => o.status === 'active');

  const groupsForSelected = allGroups.filter(
    (g) =>
      g.status === 'active' &&
      g.accountId &&
      g.accountId === selectedAccountId
  );

  const postCount = useMemo(
    () => selectedOfferIds.length * selectedGroupIds.length,
    [selectedOfferIds, selectedGroupIds]
  );

  const canPost = Boolean(selectedAccountId && selectedGroupIds.length && selectedOfferIds.length);

  const loadHealthStrip = useCallback(async () => {
    try {
      setAccounts(await api<Account[]>('/api/accounts'));
    } catch {
      // handled by api interceptor
    }
  }, []);

  const loadComposerOptions = useCallback(async () => {
    try {
      const [accts, grps, offs] = await Promise.all([
        api<Account[]>('/api/accounts'),
        api<Group[]>('/api/groups'),
        api<Offer[]>('/api/offers'),
      ]);
      setAccounts(accts);
      setAllGroups(grps);
      setOffers(offs);
    } catch {
      // handled by api interceptor
    }
  }, []);

  const loadPostHistory = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (historyStatus) params.set('status', historyStatus);
      if (historyAccount) params.set('account', historyAccount);
      const qs = params.toString();
      const jobs = await api<PostJob[]>(`/api/post-jobs${qs ? `?${qs}` : ''}`);
      setPostHistory(jobs);
    } catch {
      // handled by api interceptor
    }
  }, [historyStatus, historyAccount]);

  const loadHistoryAccountOptions = useCallback(async () => {
    try {
      const accts = await api<Account[]>('/api/accounts');
      setHistoryAccounts(accts);
    } catch {
      // handled
    }
  }, []);

  useEffect(() => {
    loadComposerOptions();
    loadPostHistory();
    loadHistoryAccountOptions();
  }, [loadComposerOptions, loadPostHistory, loadHistoryAccountOptions]);

  useEffect(() => {
    const h = setInterval(loadHealthStrip, HEALTH_POLL);
    return () => clearInterval(h);
  }, [loadHealthStrip]);

  useEffect(() => {
    const h = setInterval(loadPostHistory, HISTORY_POLL);
    return () => clearInterval(h);
  }, [loadPostHistory]);

  const handlePost = async () => {
    if (!canPost) {
      showToast('Select an account, at least one group, and at least one offer.', 'error');
      return;
    }
    setPosting(true);
    try {
      const result = await api<{ created: number; skipped: number }>('/api/post-jobs', {
        method: 'POST',
        body: JSON.stringify({
          accountId: selectedAccountId,
          groupIds: selectedGroupIds,
          offerIds: selectedOfferIds,
        }),
      });
      let msg = `Queued ${result.created} job${result.created === 1 ? '' : 's'}.`;
      if (result.skipped) msg += ` ${result.skipped} skipped (already posted).`;
      showToast(msg, 'success');
      loadPostHistory();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to post', 'error');
    } finally {
      setPosting(false);
    }
  };

  const historyColumns = [
    { key: 'offer', header: 'Offer', render: (j: PostJob) => j.offerTitle || '—' },
    { key: 'group', header: 'Group', render: (j: PostJob) => j.groupName || '—' },
    { key: 'account', header: 'Account', render: (j: PostJob) => j.accountNickname || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (j: PostJob) => <StatusPill status={j.status} />,
    },
    {
      key: 'time',
      header: 'Time',
      render: (j: PostJob) => {
        const d = j.status === 'posted' && j.postedAt ? j.postedAt : j.queuedAt;
        return d ? new Date(d).toLocaleString() : '—';
      },
    },
    {
      key: 'error',
      header: 'Error',
      render: (j: PostJob) =>
        j.status === 'failed' && j.error ? (
          <span className="text-danger text-xs" title={j.error}>
            {j.error.length > 40 ? j.error.slice(0, 40) + '…' : j.error}
          </span>
        ) : (
          '—'
        ),
      className: 'max-w-[200px] truncate',
    },
  ];

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Health strip */}
      <section>
        <div className="flex flex-wrap gap-3">
          {accounts.length === 0 && (
            <p className="text-sm text-text-muted px-4 py-3 border border-dashed border-border rounded-lg w-full bg-surface">
              No accounts configured.
            </p>
          )}
          {accounts.map((a) => (
            <div
              key={a._id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-surface shadow-sm transition-all duration-150 hover:shadow-[0_8px_32px_rgba(0,0,0,0.38)] hover:-translate-y-0.5 ${
                a.status === 'checkpoint'
                  ? 'border-danger bg-danger/5'
                  : a.status === 'cooldown'
                  ? 'border-warning bg-warning/5'
                  : a.status === 'disabled'
                  ? 'border-border opacity-60'
                  : 'border-border'
              }`}
            >
              <span className="font-semibold text-sm">{a.nickname}</span>
              <StatusPill status={a.status} />
              <span className="text-xs text-text-muted">
                {a.dailyPostCount}/{a.dailyPostCap}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Post composer */}
      <Card accent className="p-6">
        <h3 className="text-base font-semibold text-text-primary mb-5">Post</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-text-secondary font-medium mb-2">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setSelectedGroupIds([]);
              }}
              className="w-full rounded-lg border border-border bg-bg-600 text-text-primary px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">Select an account</option>
              {filteredAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.nickname}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary font-medium mb-2">Groups</label>
            <MultiSelect
              options={groupsForSelected.map((g) => ({ value: g._id, label: g.name }))}
              selected={selectedGroupIds}
              onChange={setSelectedGroupIds}
              placeholder={selectedAccountId ? 'Select groups' : 'Select an account first'}
              emptyLabel={selectedAccountId ? 'No groups for selected account' : 'Select an account first'}
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary font-medium mb-2">Offers</label>
            <MultiSelect
              options={filteredOffers.map((o) => ({ value: o._id, label: o.title }))}
              selected={selectedOfferIds}
              onChange={setSelectedOfferIds}
              placeholder="Select offers"
              emptyLabel="No active offers"
            />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-6">
          <Button onClick={handlePost} disabled={!canPost || posting}>
            {posting ? 'Posting...' : 'Post'}
          </Button>
          {selectedAccountId ? (
            <span className="text-sm text-text-muted">
              This will create <strong className="text-text-primary">{postCount}</strong> post{postCount === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="text-sm text-text-muted">Select an account, groups, and offers</span>
          )}
        </div>
      </Card>

      {/* Post history */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent mb-4 pl-3 border-l-3 border-accent">
          Post History
        </h2>

        <div className="flex flex-wrap gap-5 mb-5">
          <label className="text-sm text-text-secondary font-medium">
            Status
            <select
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              className="block min-w-[180px] mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All</option>
              <option value="queued">queued</option>
              <option value="posted">posted</option>
              <option value="pending_approval">pending_approval</option>
              <option value="failed">failed</option>
              <option value="skipped">skipped</option>
            </select>
          </label>
          <label className="text-sm text-text-secondary font-medium">
            Account
            <select
              value={historyAccount}
              onChange={(e) => setHistoryAccount(e.target.value)}
              className="block min-w-[180px] mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="">All</option>
              {historyAccounts.map((a) => (
                <option key={a._id} value={a._id}>
                  {a.nickname}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Table
          columns={historyColumns}
          data={postHistory}
          emptyMessage="No post jobs yet."
          emptySub="Queued jobs will appear here."
        />
      </section>
    </div>
  );
}
