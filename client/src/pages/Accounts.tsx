import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../lib/api';
import type { Account, Group, BulkResult } from '../lib/types';
import Button from '../components/ui/Button';
import StatusPill from '../components/ui/StatusPill';
import Table from '../components/ui/Table';
import { Input, Textarea } from '../components/ui/Input';
import { showToast } from '../components/ui/Toast';

export default function AccountsPage() {
  const { role } = useOutletContext<{ role: string | null }>();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Account form
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [accNickname, setAccNickname] = useState('');
  const [accStatus, setAccStatus] = useState<string>('active');
  const [accDailyCap, setAccDailyCap] = useState(40);
  const [accNotes, setAccNotes] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Groups
  const [groups, setGroups] = useState<Group[]>([]);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupUrl, setGroupUrl] = useState('');
  const [groupNotes, setGroupNotes] = useState('');
  const [groupPaused, setGroupPaused] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  // Bulk groups
  const [showBulkGroups, setShowBulkGroups] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importingBulk, setImportingBulk] = useState(false);

  // Rename group
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [renamingGroup, setRenamingGroup] = useState(false);

  // Group selection when editing account
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  const loadAccounts = async () => {
    try {
      const data = await api<Account[]>('/api/accounts');
      setAccounts(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load accounts', 'error');
    }
  };

  const loadGroups = async (accountId: string) => {
    try {
      const data = await api<Group[]>(`/api/accounts/${accountId}/groups`);
      setGroups(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load groups', 'error');
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const openNewAccount = () => {
    setEditAccount(null);
    setAccNickname('');
    setAccStatus('active');
    setAccDailyCap(40);
    setAccNotes('');
    setShowAccountForm(true);
  };

  const openEditAccount = async (a: Account) => {
    setEditAccount(a);
    setAccNickname(a.nickname);
    setAccStatus(a.status);
    setAccDailyCap(a.dailyPostCap);
    setAccNotes(a.notes || '');
    setShowAccountForm(true);
    const groups = await api<Group[]>('/api/groups');
    setAllGroups(groups);
    setSelectedGroupIds(new Set(groups.filter((g) => g.accountId === a._id).map((g) => g._id)));
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAccount(true);
    try {
      const payload = { nickname: accNickname, status: accStatus, dailyPostCap: accDailyCap, notes: accNotes };
      if (editAccount) {
        await api(`/api/accounts/${editAccount._id}`, { method: 'PUT', body: JSON.stringify(payload) });
        showToast('Account updated.', 'success');
        if (selectedAccount && selectedAccount._id === editAccount._id) {
          setSelectedAccount({ ...selectedAccount, ...payload, hasSession: selectedAccount.hasSession } as Account);
        }
        const accountId = editAccount._id;
        const prevIds = new Set(allGroups.filter((g) => g.accountId === accountId).map((g) => g._id));
        const toLink = [...selectedGroupIds].filter((id) => !prevIds.has(id));
        const toUnlink = [...prevIds].filter((id) => !selectedGroupIds.has(id));
        await Promise.all([
          ...toLink.map((id) => api(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify({ accountId }) })),
          ...toUnlink.map((id) => api(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify({ accountId: null }) })),
        ]);
      } else {
        await api('/api/accounts', { method: 'POST', body: JSON.stringify(payload) });
        showToast('Account created.', 'success');
      }
      setShowAccountForm(false);
      await loadAccounts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save account', 'error');
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Delete this account?')) return;
    try {
      await api(`/api/accounts/${id}`, { method: 'DELETE' });
      showToast('Account deleted.', 'success');
      if (selectedAccount?._id === id) setSelectedAccount(null);
      await loadAccounts();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const handleSelectAccount = async (a: Account) => {
    setSelectedAccount(a);
    await loadGroups(a._id);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setSavingGroup(true);
    try {
      await api(`/api/accounts/${selectedAccount._id}/groups`, {
        method: 'POST',
        body: JSON.stringify({ name: groupName, url: groupUrl, notes: groupNotes, status: groupPaused ? 'paused' : 'active' }),
      });
      showToast('Group added.', 'success');
      setShowGroupForm(false);
      setGroupName('');
      setGroupUrl('');
      setGroupNotes('');
      setGroupPaused(false);
      await loadGroups(selectedAccount._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add group', 'error');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    setImportingBulk(true);
    try {
      const urls = bulkText.trim().split('\n').filter(Boolean);
      const result = await api<BulkResult>(`/api/accounts/${selectedAccount._id}/groups/bulk`, {
        method: 'POST',
        body: JSON.stringify({ urls }),
      });
      showToast(`Created ${result.created} group(s).${result.failed > 0 ? ` ${result.failed} failed.` : ''}`, result.failed > 0 ? 'error' : 'success');
      setShowBulkGroups(false);
      setBulkText('');
      await loadGroups(selectedAccount._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImportingBulk(false);
    }
  };

  const handleRenameGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !renameGroupId) return;
    setRenamingGroup(true);
    try {
      const group = groups.find((g) => g._id === renameGroupId);
      await api(`/api/accounts/${selectedAccount._id}/groups/${renameGroupId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: renameGroupName, notes: group?.notes || '', status: group?.status || 'active' }),
      });
      showToast('Group renamed.', 'success');
      setRenameGroupId(null);
      setRenameGroupName('');
      await loadGroups(selectedAccount._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename', 'error');
    } finally {
      setRenamingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!selectedAccount || !confirm('Delete this group?')) return;
    try {
      await api(`/api/accounts/${selectedAccount._id}/groups/${groupId}`, { method: 'DELETE' });
      showToast('Group deleted.', 'success');
      await loadGroups(selectedAccount._id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  const accountColumns = [
    ...(role === 'owner'
      ? [{ key: 'owner', header: 'Recruiter', render: (a: Account) => <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{a.owner?.name || '—'}</span> }]
      : []),
    { key: 'name', header: 'Nickname', render: (a: Account) => a.nickname },
    {
      key: 'status',
      header: 'Status',
      render: (a: Account) => <StatusPill status={a.status} />,
    },
    {
      key: 'posts',
      header: 'Posts today',
      render: (a: Account) => `${a.dailyPostCount}/${a.dailyPostCap}`,
    },
    {
      key: 'lastUsed',
      header: 'Last used',
      render: (a: Account) =>
        a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleDateString() : '—',
    },
    {
      key: 'actions',
      header: '',
      render: (a: Account) => (
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => handleSelectAccount(a)}>
            View
          </Button>
          <Button variant="ghost" onClick={() => openEditAccount(a)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => handleDeleteAccount(a._id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const groupColumns = [
    { key: 'name', header: 'Name', render: (g: Group) => g.name },
    {
      key: 'url',
      header: 'URL',
      render: (g: Group) => (
        <span className="text-text-muted text-xs truncate block max-w-[200px]" title={g.url}>
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
          <Button
            variant="ghost"
            onClick={() => {
              setRenameGroupId(g._id);
              setRenameGroupName(g.name);
            }}
          >
            Rename
          </Button>
          <Button variant="ghost" onClick={() => handleDeleteGroup(g._id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (selectedAccount) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="secondary" onClick={() => setSelectedAccount(null)}>
            &larr; Back
          </Button>
          <h2 className="text-lg font-semibold text-text-primary">{selectedAccount.nickname}</h2>
          <StatusPill status={selectedAccount.hasSession ? 'Connected' : 'Not connected'} />
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" onClick={() => openEditAccount(selectedAccount)}>
              Edit Account
            </Button>
          </div>
        </div>

        {!selectedAccount.hasSession && (
          <p className="text-sm text-text-muted bg-bg-600 rounded-lg px-4 py-3">
            To connect a Facebook account, run the login agent on your own computer — see the setup instructions.
          </p>
        )}

        {/* Groups section */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
            Groups for {selectedAccount.nickname}
          </h3>
          <div className="flex gap-2">
            <Button onClick={() => setShowGroupForm(true)}>+ Add Group</Button>
            <Button variant="secondary" onClick={() => setShowBulkGroups(true)}>
              Bulk Add
            </Button>
          </div>
        </div>

        {showGroupForm && (
          <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">New Group</h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleSaveGroup} className="space-y-4">
                <Input label="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required placeholder="e.g. Cairo Call Center Jobs" />
                <Input label="Group URL" type="url" value={groupUrl} onChange={(e) => setGroupUrl(e.target.value)} required placeholder="https://www.facebook.com/groups/..." />
                <Input label="Notes (optional)" value={groupNotes} onChange={(e) => setGroupNotes(e.target.value)} placeholder="e.g. approves instantly" />
                <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={groupPaused} onChange={(e) => setGroupPaused(e.target.checked)} className="w-4 h-4 rounded border-border bg-bg-500 accent-accent" />
                  Paused (skip when posting)
                </label>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={savingGroup}>{savingGroup ? 'Saving...' : 'Save'}</Button>
                  <Button variant="secondary" type="button" onClick={() => setShowGroupForm(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showBulkGroups && (
          <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Bulk Add Groups</h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleBulkImport} className="space-y-4">
                <Textarea
                  label="Paste Facebook group links (one per line)"
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  required
                  rows={6}
                  placeholder="https://www.facebook.com/groups/cairocallcenterjobs&#10;https://www.facebook.com/share/g/abc123/"
                />
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={importingBulk}>{importingBulk ? 'Importing...' : 'Add Groups'}</Button>
                  <Button variant="secondary" type="button" onClick={() => setShowBulkGroups(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!!renameGroupId && (
          <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-text-primary">Rename Group</h3>
            </div>
            <div className="p-5">
              <form onSubmit={handleRenameGroup} className="space-y-4">
                <Input label="New group name" value={renameGroupName} onChange={(e) => setRenameGroupName(e.target.value)} required />
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={renamingGroup}>{renamingGroup ? 'Saving...' : 'Save'}</Button>
                  <Button variant="secondary" type="button" onClick={() => setRenameGroupId(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Table columns={groupColumns} data={groups} emptyMessage="No groups yet." emptySub="Add the Facebook groups this account posts offers into." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-accent pl-3 border-l-3 border-accent">
          Facebook Accounts
        </h2>
        <Button onClick={openNewAccount}>+ New Account</Button>
      </div>

      {showAccountForm && (
        <div className="rounded-xl border border-border bg-surface shadow-[0_4px_16px_rgba(0,0,0,0.3)] overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{editAccount ? 'Edit Account' : 'New Account'}</h3>
          </div>
          <div className="p-5">
            <form onSubmit={handleSaveAccount} className="space-y-4">
              <Input label="Nickname" value={accNickname} onChange={(e) => setAccNickname(e.target.value)} required placeholder="e.g. acc-1" />
              <label className="block text-sm text-text-secondary font-medium">
                Status
                <select
                  value={accStatus}
                  onChange={(e) => setAccStatus(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2.5 rounded-lg border border-border bg-bg-600 text-text-primary text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="active">active</option>
                  <option value="cooldown">cooldown</option>
                  <option value="checkpoint">checkpoint</option>
                  <option value="disabled">disabled</option>
                </select>
              </label>
              <Input label="Daily post cap" type="number" min={1} value={accDailyCap} onChange={(e) => setAccDailyCap(Number(e.target.value))} required />
              <Input label="Notes" value={accNotes} onChange={(e) => setAccNotes(e.target.value)} placeholder="Optional notes" />
              {editAccount?.lastUsedAt && (
                <p className="text-xs text-text-muted">Last used: {new Date(editAccount.lastUsedAt).toLocaleDateString()}</p>
              )}
              {editAccount && allGroups.length > 0 && (
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm font-medium text-text-secondary mb-3">Linked Groups</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {allGroups.map((g) => (
                      <label key={g._id} className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(g._id)}
                          onChange={(e) => {
                            const next = new Set(selectedGroupIds);
                            if (e.target.checked) next.add(g._id);
                            else next.delete(g._id);
                            setSelectedGroupIds(next);
                          }}
                          className="w-4 h-4 rounded border-border bg-bg-500 accent-accent"
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={savingAccount}>{savingAccount ? 'Saving...' : 'Save'}</Button>
                <Button variant="secondary" type="button" onClick={() => setShowAccountForm(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Table
        columns={accountColumns}
        data={accounts}
        emptyMessage="No accounts yet."
        emptySub="Add a Facebook account to get started."
      />
    </div>
  );
}
