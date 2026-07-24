import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import type { Position } from '../lib/types';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import { Input, Textarea } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';

export default function PositionsPage() {
  const { role } = useOutletContext<{ role: string | null }>();
  const [positions, setPositions] = useState<Position[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [salary, setSalary] = useState('');
  const [hours, setHours] = useState('');
  const [languageRequired, setLanguageRequired] = useState('');
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setPositions(await api<Position[]>('/api/positions'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load positions', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditPos(null);
    setTitle('');
    setDescription('');
    setSalary('');
    setHours('');
    setLanguageRequired('');
    setPaused(false);
    setShowForm(true);
  };

  const openEdit = (p: Position) => {
    setEditPos(p);
    setTitle(p.title);
    setDescription(p.description);
    setSalary(p.salary || '');
    setHours(p.hours || '');
    setLanguageRequired(p.languageRequired || '');
    setPaused(p.status === 'paused');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title, description, salary, hours, languageRequired, status: paused ? 'paused' : 'active' };
      if (editPos) {
        await api(`/api/positions/${editPos._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Position updated.', 'success');
      } else {
        await api('/api/positions', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Position created.', 'success');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this position?')) return;
    try {
      await api(`/api/positions/${id}`, { method: 'DELETE' });
      showToast('Position deleted.', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const columns = [
    ...(role === 'owner'
      ? [{ key: 'owner', header: 'Recruiter', render: (p: Position) => <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{p.owner?.name || '—'}</span> }]
      : []),
    { key: 'title', header: 'Title', render: (p: Position) => p.title },
    {
      key: 'status',
      header: 'Status',
      render: (p: Position) => <StatusPill status={p.status} />,
    },
    {
      key: 'created',
      header: 'Added',
      render: (p: Position) => new Date(p.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Position) => (
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
          <Button variant="ghost" onClick={() => handleDelete(p._id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          Positions
        </h2>
        <Button onClick={openNew}>+ New Position</Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{editPos ? 'Edit Position' : 'New Position'}</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Call Center Agent" />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Full description including responsibilities and requirements..." />
              <Input label="Salary" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="e.g. $15-20/hr" />
              <Input label="Hours" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. Full-time, 40hrs/week" />
              <Input label="Language Required" value={languageRequired} onChange={(e) => setLanguageRequired(e.target.value)} placeholder="e.g. English C1" />
              <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="w-4 h-4 rounded border-border bg-bg-500 accent-accent" />
                Paused (won't appear on the apply page)
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Table columns={columns} data={positions} emptyMessage="No positions yet." emptySub="Add your first position to get started." />
    </div>
  );
}
