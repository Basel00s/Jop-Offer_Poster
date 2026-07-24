import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import type { Candidate } from '../lib/types';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import Button from '../components/ui/Button';
import { showToast } from '../components/ui/Toast';

const statuses = ['submitted', 'offer_selected', 'accepted', 'rejected'] as const;

export default function CandidatesPage() {
  const { role } = useOutletContext<{ role: string | null }>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = async () => {
    try {
      const query = statusFilter ? `?status=${statusFilter}` : '';
      setCandidates(await api<Candidate[]>(`/api/candidates${query}`));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load candidates', 'error');
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api(`/api/candidates/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      showToast(`Marked as ${status}`, 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const canAct = (s: string) => s === 'submitted' || s === 'offer_selected';

  const recruiterCol = role === 'owner'
    ? [{
        key: 'recruiter' as const,
        header: 'Recruiter',
        render: (c: Candidate) => {
          const r = c.recruiter;
          return r && typeof r === 'object' ? r.name : '-';
        },
      }]
    : [];

  const columns = [
    { key: 'name', header: 'Name', render: (c: Candidate) => c.name },
    { key: 'phone', header: 'Phone', render: (c: Candidate) => c.phone },
    { key: 'graduation', header: 'Graduation', render: (c: Candidate) => c.graduation },
    { key: 'experience', header: 'Experience', render: (c: Candidate) => c.experience },
    {
      key: 'language',
      header: 'Language',
      render: (c: Candidate) => `${c.language} (${c.languageLevel})`,
    },
    { key: 'nationality', header: 'Nationality', render: (c: Candidate) => c.nationality },
    {
      key: 'position',
      header: 'Position',
      render: (c: Candidate) => (c.position as { title: string } | undefined)?.title || '-',
    },
    ...recruiterCol,
    {
      key: 'status',
      header: 'Status',
      render: (c: Candidate) => <StatusPill status={c.status} />,
    },
    {
      key: 'recording',
      header: 'Recording',
      render: (c: Candidate) =>
        c.recordingUrl ? (
          <a
            href={c.recordingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline text-sm"
          >
            Listen
          </a>
        ) : (
          '-'
        ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (c: Candidate) => new Date(c.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (c: Candidate) =>
        canAct(c.status) ? (
          <div className="flex gap-1">
            <Button variant="ghost" onClick={() => updateStatus(c._id, 'accepted')}>
              Accept
            </Button>
            <Button variant="ghost" onClick={() => updateStatus(c._id, 'rejected')}>
              Reject
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          Candidates
        </h2>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                statusFilter === s
                  ? 'bg-accent text-white'
                  : 'bg-bg-600 text-text-secondary border border-border hover:border-accent/40 hover:text-accent'
              }`}
            >
              {s
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={candidates}
        emptyMessage="No candidates yet."
        emptySub="Candidates will appear here after applying."
      />
    </div>
  );
}
