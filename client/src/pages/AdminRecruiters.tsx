import { useEffect, useState, useCallback } from 'react';
import api from '../lib/api';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';
import type { PostJob } from '../lib/types';

interface RecruiterStats {
  offers: number;
  groups: number;
  accounts: number;
  positions: number;
  candidates: number;
  postedJobs: number;
  failedJobs: number;
}

interface Recruiter {
  _id: string;
  name: string;
  email: string;
  applySlug: string;
  status: string;
  createdAt: string;
  stats: RecruiterStats;
}

interface ExpandedState {
  recruiterId: string;
  statusFilter: string;
  accountFilter: string;
  jobs: PostJob[];
  accounts: { _id: string; nickname: string }[];
}

const accountOptionsCache = new Map<string, { _id: string; nickname: string }[]>();

export default function AdminRecruitersPage() {
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);

  const load = async () => {
    try {
      setRecruiters(await api<Recruiter[]>('/api/admin/recruiters'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load recruiters', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api<{ applyLink: string }>('/api/admin/recruiters', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      showToast(`Recruiter created. Apply link: ${created.applyLink}`, 'success');
      setShowForm(false);
      setName('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (r: Recruiter) => {
    const newStatus = r.status === 'active' ? 'disabled' : 'active';
    try {
      await api(`/api/admin/recruiters/${r._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Recruiter ${newStatus}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const copyLink = (slug: string) => {
    const link = `${window.location.origin}/apply/${slug}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Apply link copied!', 'success');
    });
  };

  const loadJobs = useCallback(async (r: Recruiter, status: string, account: string) => {
    try {
      const params = new URLSearchParams({ ownerId: r._id });
      if (status) params.set('status', status);
      if (account) params.set('account', account);
      const jobs = await api<PostJob[]>(`/api/post-jobs?${params.toString()}`);

      let accts = accountOptionsCache.get(r._id);
      if (!accts) {
        accts = await api<{ _id: string; nickname: string }[]>('/api/accounts');
        accountOptionsCache.set(r._id, accts);
      }

      setExpanded((prev) =>
        prev?.recruiterId === r._id
          ? { ...prev, jobs, statusFilter: status, accountFilter: account, accounts: accts }
          : prev
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load jobs', 'error');
    }
  }, []);

  const toggleExpand = async (r: Recruiter) => {
    if (expanded?.recruiterId === r._id) {
      setExpanded(null);
      return;
    }
    setExpanded({
      recruiterId: r._id,
      statusFilter: '',
      accountFilter: '',
      jobs: [],
      accounts: [],
    });
    await loadJobs(r, '', '');
  };

  const columns = [
    {
      key: 'expand',
      header: '',
      render: (r: Recruiter) => (
        <button
          onClick={() => toggleExpand(r)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${expanded?.recruiterId === r._id ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ),
      className: 'w-10',
    },
    { key: 'name', header: 'Name', render: (r: Recruiter) => r.name },
    { key: 'email', header: 'Email', render: (r: Recruiter) => r.email },
    { key: 'slug', header: 'Apply Slug', render: (r: Recruiter) => r.applySlug },
    {
      key: 'applyLink',
      header: 'Apply Link',
      render: (r: Recruiter) => (
        <button
          onClick={() => copyLink(r.applySlug)}
          className="text-accent hover:underline text-xs font-medium"
        >
          Copy link
        </button>
      ),
    },
    {
      key: 'stats',
      header: 'Stats',
      render: (r: Recruiter) => (
        <span className="text-xs text-text-secondary">
          O:{r.stats.offers} G:{r.stats.groups} A:{r.stats.accounts} P:{r.stats.positions} C:{r.stats.candidates}
          {' | '}
          <span className="text-success">✓{r.stats.postedJobs}</span>{' '}
          <span className="text-danger">✗{r.stats.failedJobs}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r: Recruiter) => <StatusPill status={r.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (r: Recruiter) => (
        <Button variant="ghost" onClick={() => toggleStatus(r)}>
          {r.status === 'active' ? 'Disable' : 'Enable'}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          Recruiters
        </h2>
        <Button onClick={() => setShowForm(true)}>+ New Recruiter</Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">New Recruiter</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleCreate} className="space-y-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email address" />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Set a password" />
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Table
        columns={columns}
        data={recruiters}
        emptyMessage="No recruiters yet."
        emptySub="Create your first recruiter to get started."
      />

      {expanded && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden animate-fade-in -mt-4">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-accent">Post History</span>
              <label className="text-sm text-text-secondary font-medium">
                Status
                <select
                  value={expanded.statusFilter}
                  onChange={(e) => loadJobs(
                    recruiters.find((r) => r._id === expanded.recruiterId)!,
                    e.target.value,
                    expanded.accountFilter
                  )}
                  className="block min-w-[150px] mt-1 px-3 py-1.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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
                  value={expanded.accountFilter}
                  onChange={(e) => loadJobs(
                    recruiters.find((r) => r._id === expanded.recruiterId)!,
                    expanded.statusFilter,
                    e.target.value
                  )}
                  className="block min-w-[150px] mt-1 px-3 py-1.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="">All</option>
                  {expanded.accounts.map((a) => (
                    <option key={a._id} value={a._id}>{a.nickname}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-accent/5">
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Offer</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Group</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Account</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Status</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Time</th>
                  <th className="text-left px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-accent">Error</th>
                </tr>
              </thead>
              <tbody>
                {expanded.jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-text-muted">
                      No post jobs for this recruiter.
                    </td>
                  </tr>
                ) : (
                  expanded.jobs.map((j) => (
                    <tr key={j._id} className="border-b border-border last:border-b-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-2.5 text-sm text-text-primary">{j.offerTitle || '—'}</td>
                      <td className="px-5 py-2.5 text-sm text-text-primary">{j.groupName || '—'}</td>
                      <td className="px-5 py-2.5 text-sm text-text-primary">{j.accountNickname || '—'}</td>
                      <td className="px-5 py-2.5"><StatusPill status={j.status} /></td>
                      <td className="px-5 py-2.5 text-sm text-text-muted">
                        {(j.status === 'posted' && j.postedAt ? j.postedAt : j.queuedAt)
                          ? new Date(j.status === 'posted' && j.postedAt ? j.postedAt : j.queuedAt).toLocaleString()
                          : '—'}
                      </td>
                      <td className="px-5 py-2.5 text-sm">
                        {j.status === 'failed' && j.error ? (
                          <span className="text-danger text-xs" title={j.error}>
                            {j.error.length > 40 ? j.error.slice(0, 40) + '…' : j.error}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
