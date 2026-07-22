// ---------- Helpers ----------
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================================================
// ACCOUNTS
// ==================================================
// List View Elements
const accountsListView = document.getElementById('accounts-list-view');
const accountFormWrap = document.getElementById('account-form-wrap');
const accountForm = document.getElementById('account-form');
const accountFormTitle = document.getElementById('account-form-title');
const accountIdField = document.getElementById('account-id');
const accountNicknameField = document.getElementById('account-nickname');
const accountStatusField = document.getElementById('account-status');
const accountDailyPostCapField = document.getElementById('account-daily-post-cap');
const accountNotesField = document.getElementById('account-notes');
const accountLastUsedWrap = document.getElementById('account-last-used');
const accountLastUsedValue = document.getElementById('account-last-used-value');
const accountsTable = document.getElementById('accounts-table');
const accountsTbody = document.getElementById('accounts-tbody');
const accountsEmpty = document.getElementById('accounts-empty');

// Detail View Elements
const accountDetailView = document.getElementById('account-detail-view');
const detailAccountName = document.getElementById('detail-account-name');
const groupFormWrap = document.getElementById('group-form-wrap');
const groupForm = document.getElementById('group-form');
const groupNameField = document.getElementById('group-name');
const groupUrlField = document.getElementById('group-url');
const groupNotesField = document.getElementById('group-notes');
const groupStatusField = document.getElementById('group-status');
const bulkGroupsWrap = document.getElementById('bulk-groups-wrap');
const bulkGroupsForm = document.getElementById('bulk-groups-form');
const bulkGroupsTextarea = document.getElementById('bulk-groups-textarea');
const groupsTable = document.getElementById('groups-table');
const groupsTbody = document.getElementById('groups-tbody');
const groupsEmpty = document.getElementById('groups-empty');
const editGroupNameWrap = document.getElementById('edit-group-name-wrap');
const editGroupNameForm = document.getElementById('edit-group-name-form');
const editGroupIdField = document.getElementById('edit-group-id');
const editGroupNameField = document.getElementById('edit-group-name');
const editGroupNameCancelBtn = document.getElementById('edit-group-name-cancel-btn');

let currentAccountId = null;

function showAccountForm(account = null) {
  accountForm.reset();
  if (account) {
    accountFormTitle.textContent = 'Edit Account';
    accountIdField.value = account._id;
    accountNicknameField.value = account.nickname;
    accountStatusField.value = account.status;
    accountDailyPostCapField.value = account.dailyPostCap;
    accountNotesField.value = account.notes || '';
    if (account.lastUsedAt) {
      accountLastUsedWrap.classList.remove('hidden');
      accountLastUsedValue.textContent = formatDate(account.lastUsedAt);
    } else {
      accountLastUsedWrap.classList.add('hidden');
      accountLastUsedValue.textContent = '';
    }
  } else {
    accountFormTitle.textContent = 'New Account';
    accountIdField.value = '';
    accountDailyPostCapField.value = 40;
    accountLastUsedWrap.classList.add('hidden');
    accountLastUsedValue.textContent = '';
  }
  accountFormWrap.classList.remove('hidden');
}

function hideAccountForm() {
  accountFormWrap.classList.add('hidden');
  accountForm.reset();
}

function showGroupForm() {
  groupForm.reset();
  groupFormWrap.classList.remove('hidden');
  bulkGroupsWrap.classList.add('hidden');
}

function hideGroupForm() {
  groupFormWrap.classList.add('hidden');
  groupForm.reset();
}

function showBulkGroupsForm() {
  bulkGroupsForm.reset();
  bulkGroupsWrap.classList.remove('hidden');
  groupFormWrap.classList.add('hidden');
}

function hideBulkGroupsForm() {
  bulkGroupsWrap.classList.add('hidden');
  bulkGroupsForm.reset();
}

function showEditGroupNameForm(group) {
  editGroupIdField.value = group._id;
  editGroupNameField.value = group.name;
  editGroupNameWrap.classList.remove('hidden');
  groupFormWrap.classList.add('hidden');
  bulkGroupsWrap.classList.add('hidden');
}

function hideEditGroupNameForm() {
  editGroupNameWrap.classList.add('hidden');
  editGroupNameForm.reset();
}

function showListView() {
  accountsListView.classList.remove('hidden');
  accountDetailView.classList.add('hidden');
  currentAccountId = null;
}

async function showDetailView(accountId) {
  currentAccountId = accountId;
  const account = (window.__accounts || []).find((a) => a._id === accountId);
  if (!account) return;

  detailAccountName.textContent = account.nickname;
  accountsListView.classList.add('hidden');
  accountDetailView.classList.remove('hidden');
  await loadGroupsForAccount(accountId);
}

document.getElementById('new-account-btn').addEventListener('click', () => showAccountForm());
document.getElementById('account-cancel-btn').addEventListener('click', hideAccountForm);
document.getElementById('back-to-list-btn').addEventListener('click', () => {
  showListView();
  loadAccounts();
});
document.getElementById('add-group-btn').addEventListener('click', showGroupForm);
document.getElementById('group-cancel-btn').addEventListener('click', hideGroupForm);
document.getElementById('bulk-add-groups-btn').addEventListener('click', showBulkGroupsForm);
document.getElementById('bulk-groups-cancel-btn').addEventListener('click', hideBulkGroupsForm);
document.getElementById('login-btn').addEventListener('click', async () => {
  if (!currentAccountId) return;
  if (!confirm('This will open a browser window for you to login to Facebook. When you are done, close the browser to save the session. Continue?')) return;
  try {
    alert('Opening browser... Please login to Facebook, then close the browser window to save your session.');
    await api(`/api/accounts/${currentAccountId}/session`, { method: 'POST' });
    alert('Session saved successfully!');
  } catch (err) {
    alert(err.message);
  }
});
document.getElementById('edit-account-detail-btn').addEventListener('click', () => {
  const account = (window.__accounts || []).find((a) => a._id === currentAccountId);
  if (account) showAccountForm(account);
});
editGroupNameCancelBtn.addEventListener('click', hideEditGroupNameForm);

accountForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    nickname: accountNicknameField.value.trim(),
    status: accountStatusField.value,
    dailyPostCap: Number(accountDailyPostCapField.value),
    notes: accountNotesField.value.trim(),
  };
  const id = accountIdField.value;
  try {
    if (id) {
      await api(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/accounts', { method: 'POST', body: JSON.stringify(payload) });
    }
    hideAccountForm();
    if (id && currentAccountId === id) {
      // Refresh detail view
      await loadAccounts();
      const account = (window.__accounts || []).find((a) => a._id === id);
      if (account) detailAccountName.textContent = account.nickname;
    } else {
      showListView();
      loadAccounts();
    }
  } catch (err) {
    alert(err.message);
  }
});

groupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentAccountId) return;
  const payload = {
    name: groupNameField.value.trim(),
    url: groupUrlField.value.trim(),
    notes: groupNotesField.value.trim(),
    status: groupStatusField.checked ? 'paused' : 'active',
  };
  try {
    await api(`/api/accounts/${currentAccountId}/groups`, { method: 'POST', body: JSON.stringify(payload) });
    hideGroupForm();
    loadGroupsForAccount(currentAccountId);
  } catch (err) {
    alert(err.message);
  }
});

bulkGroupsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentAccountId) return;
  const text = bulkGroupsTextarea.value.trim();
  if (!text) return;

  // Parse lines into URLs
  const lines = text.split('\n');
  const urlsToImport = [];

  for (const line of lines) {
    urlsToImport.push(line);
  }

  try {
    const result = await api(`/api/accounts/${currentAccountId}/groups/bulk`, {
      method: 'POST',
      body: JSON.stringify({ urls: urlsToImport })
    });

    let message = `Successfully created ${result.created} group(s)`;
    if (result.failed > 0) {
      message += `\nFailed to parse ${result.failed} line(s):`;
      for (const failure of result.failures) {
        message += `\n- ${failure.reason}`;
      }
    }
    alert(message);

    hideBulkGroupsForm();
    loadGroupsForAccount(currentAccountId);
  } catch (err) {
    alert(err.message);
  }
});

editGroupNameForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentAccountId) return;
  const groupId = editGroupIdField.value;
  const newName = editGroupNameField.value.trim();

  try {
    const group = (window.__currentGroups || []).find(g => g._id === groupId);
    await api(`/api/accounts/${currentAccountId}/groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: newName, notes: group.notes, status: group.status })
    });
    hideEditGroupNameForm();
    loadGroupsForAccount(currentAccountId);
  } catch (err) {
    alert(err.message);
  }
});

function renderAccounts(accounts) {
  if (!accounts.length) {
    accountsTable.classList.add('hidden');
    accountsEmpty.classList.remove('hidden');
    return;
  }
  accountsEmpty.classList.add('hidden');
  accountsTable.classList.remove('hidden');

  accountsTbody.innerHTML = accounts
    .map(
      (a) => `
      <tr data-id="${a._id}">
        <td>${escapeHtml(a.nickname)}</td>
        <td><span class="status-pill ${a.status}">${a.status}</span></td>
        <td>${a.dailyPostCount}/${a.dailyPostCap}</td>
        <td>${formatDate(a.lastUsedAt)}</td>
        <td>
          <button class="btn-icon view-account">View</button>
          <button class="btn-icon edit-account">Edit</button>
          <button class="btn-icon danger delete-account">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadAccounts() {
  const accounts = await api('/api/accounts');
  renderAccounts(accounts);
  window.__accounts = accounts;
}

function renderGroups(groups) {
  if (!groups.length) {
    groupsTable.classList.add('hidden');
    groupsEmpty.classList.remove('hidden');
    return;
  }
  groupsEmpty.classList.add('hidden');
  groupsTable.classList.remove('hidden');

  groupsTbody.innerHTML = groups
    .map(
      (g) => `
      <tr data-id="${g._id}">
        <td>${escapeHtml(g.name)}</td>
        <td class="url-cell" title="${escapeHtml(g.url)}">${escapeHtml(g.url)}</td>
        <td><span class="status-pill ${g.status}">${g.status}</span></td>
        <td>
          <button class="btn-icon rename-group">Rename</button>
          <button class="btn-icon danger delete-group">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadGroupsForAccount(accountId) {
  const groups = await api(`/api/accounts/${accountId}/groups`);
  renderGroups(groups);
  window.__currentGroups = groups;
}

accountsTbody.addEventListener('click', async (e) => {
  const row = e.target.closest('tr');
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains('view-account')) {
    showDetailView(id);
  }

  if (e.target.classList.contains('edit-account')) {
    const account = (window.__accounts || []).find((a) => a._id === id);
    if (account) showAccountForm(account);
  }

  if (e.target.classList.contains('delete-account')) {
    if (!confirm('Delete this account?')) return;
    await api(`/api/accounts/${id}`, { method: 'DELETE' });
    loadAccounts();
  }
});

groupsTbody.addEventListener('click', async (e) => {
  const row = e.target.closest('tr');
  if (!row || !currentAccountId) return;
  const groupId = row.dataset.id;

  if (e.target.classList.contains('rename-group')) {
    const group = (window.__currentGroups || []).find(g => g._id === groupId);
    if (group) showEditGroupNameForm(group);
  }

  if (e.target.classList.contains('delete-group')) {
    if (!confirm('Delete this group?')) return;
    await api(`/api/accounts/${currentAccountId}/groups/${groupId}`, { method: 'DELETE' });
    loadGroupsForAccount(currentAccountId);
  }
});

// ---------- Init ----------
loadAccounts();
