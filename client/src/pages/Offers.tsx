import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import type { Offer, BulkResult } from '../lib/types';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import { Input, Textarea } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';

export default function OffersPage() {
  const { role } = useOutletContext<{ role: string | null }>();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editOffer, setEditOffer] = useState<Offer | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);

  const loadOffers = async () => {
    try {
      setOffers(await api<Offer[]>('/api/offers'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load offers', 'error');
    }
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const openNew = () => {
    setEditOffer(null);
    setTitle('');
    setDescription('');
    setPaused(false);
    setShowForm(true);
  };

  const openEdit = (o: Offer) => {
    setEditOffer(o);
    setTitle(o.title);
    setDescription(o.description);
    setPaused(o.status === 'paused');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title, description, status: paused ? 'paused' : 'active' };
      if (editOffer) {
        await api(`/api/offers/${editOffer._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Offer updated.', 'success');
      } else {
        await api('/api/offers', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Offer created.', 'success');
      }
      setShowForm(false);
      await loadOffers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offer?')) return;
    try {
      await api(`/api/offers/${id}`, { method: 'DELETE' });
      showToast('Offer deleted.', 'success');
      await loadOffers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    try {
      const lines = bulkText.trim().split('\n').filter(Boolean);
      const offersToImport = [];
      for (const line of lines) {
        const trimmed = line.trim();
        const sep = trimmed.indexOf('|');
        if (sep === -1) continue;
        const t = trimmed.slice(0, sep).trim();
        const d = trimmed.slice(sep + 1).trim();
        if (t && d) offersToImport.push({ title: t, description: d });
      }
      const result = await api<BulkResult>('/api/offers/bulk', {
        method: 'POST',
        body: JSON.stringify({ offers: offersToImport }),
      });
      let msg = `Created ${result.created} offer(s).`;
      if (result.failed > 0) {
        msg += ` ${result.failed} failed.`;
        for (const f of result.failures) msg += `\n- ${f.reason}`;
      }
      showToast(msg, result.failed > 0 ? 'error' : 'success');
      setShowBulk(false);
      setBulkText('');
      await loadOffers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const columns = [
    ...(role === 'owner'
      ? [{ key: 'owner', header: 'Recruiter', render: (o: Offer) => <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{o.owner?.name || '—'}</span> }]
      : []),
    { key: 'title', header: 'Title', render: (o: Offer) => o.title },
    {
      key: 'status',
      header: 'Status',
      render: (o: Offer) => <StatusPill status={o.status} />,
    },
    {
      key: 'created',
      header: 'Added',
      render: (o: Offer) => new Date(o.createdAt).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      render: (o: Offer) => (
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => openEdit(o)}>Edit</Button>
          <Button variant="ghost" onClick={() => handleDelete(o._id)}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          Job Offers
        </h2>
        <div className="flex gap-2">
          <Button onClick={openNew}>+ New Offer</Button>
          <Button variant="secondary" onClick={() => setShowBulk(true)}>Bulk import</Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{editOffer ? 'Edit Offer' : 'New Offer'}</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Bilingual Call Center Agent — Remote" />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={4} placeholder="Full offer text as it will be posted..." />
              <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
                <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)} className="w-4 h-4 rounded border-border bg-bg-500 accent-accent" />
                Paused (won't be picked up for posting)
              </label>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulk && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">Bulk Import Offers</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleBulkImport} className="space-y-4">
              <Textarea
                label="Paste offers (one per line, format: Title | Description)"
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                required
                rows={6}
                placeholder="Software Engineer | We're looking for...&#10;Product Manager | Join our team..."
              />
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={importing}>{importing ? 'Importing...' : 'Import'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowBulk(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Table columns={columns} data={offers} emptyMessage="No offers yet." emptySub="Add your first job offer to get started." />
    </div>
  );
}
