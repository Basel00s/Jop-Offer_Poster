import { useEffect, useState } from 'react';
import api from '../lib/api';
import type { Group } from '../lib/types';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import Modal from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadGroups = async () => {
    try {
      setGroups(await api<Group[]>('/api/groups'));
    } catch {
      // handled
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const openNew = () => {
    setEditGroup(null);
    setName('');
    setUrl('');
    setNotes('');
    setPaused(false);
    setShowForm(true);
  };

  const openEdit = (g: Group) => {
    setEditGroup(g);
    setName(g.name);
    setUrl(g.url);
    setNotes(g.notes || '');
    setPaused(g.status === 'paused');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { name, url, notes, status: paused ? 'paused' : 'active' };
      if (editGroup) {
        await api(`/api/groups/${editGroup._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Group updated.', 'success');
      } else {
        await api('/api/groups', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Group created.', 'success');
      }
      setShowForm(false);
      await loadGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group?')) return;
    try {
      await api(`/api/groups/${id}`, { method: 'DELETE' });
      showToast('Group deleted.', 'success');
      await loadGroups();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const columns = [
    { key: 'name', header: 'Name', render: (g: Group) => g.name },
    {
      key: 'url',
      header: 'URL',
      render: (g: Group) => (
        <span className="text-text-muted text-xs truncate block max-w-[250px]" title={g.url}>
          {g.url}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (g: Group) => <StatusPill status={g.status} />,
    },
    {
      key: 'actions',
      header: '',
      render: (g: Group) => (
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => openEdit(g)}>Edit</Button>
          <Button variant="ghost" onClick={() => handleDelete(g._id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          All Facebook Groups
        </h2>
        <Button onClick={openNew}>+ New Group</Button>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editGroup ? 'Edit Group' : 'New Group'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Group name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Cairo Call Center Jobs" />
          <Input label="Group URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://www.facebook.com/groups/..." />
          <Input label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. approves instantly" />
          <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
            <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="w-4 h-4 rounded border-border bg-bg-500 accent-accent" />
            Paused (skip when posting)
          </label>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
            <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      <Table columns={columns} data={groups} emptyMessage="No groups yet." emptySub="Add the Facebook groups you post offers into." />
    </div>
  );
}
