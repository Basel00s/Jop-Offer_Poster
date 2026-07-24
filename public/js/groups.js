// ---------- Helpers ----------
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login.html';
    throw new Error('Session expired');
  }
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
// GROUPS
// ==================================================
const groupFormWrap = document.getElementById('group-form-wrap');
const groupForm = document.getElementById('group-form');
const groupFormTitle = document.getElementById('group-form-title');
const groupIdField = document.getElementById('group-id');
const groupNameField = document.getElementById('group-name');
const groupUrlField = document.getElementById('group-url');
const groupNotesField = document.getElementById('group-notes');
const groupStatusField = document.getElementById('group-status');
const groupsTable = document.getElementById('groups-table');
const groupsTbody = document.getElementById('groups-tbody');
const groupsEmpty = document.getElementById('groups-empty');

function showGroupForm(group = null) {
  groupForm.reset();
  if (group) {
    groupFormTitle.textContent = 'Edit Group';
    groupIdField.value = group._id;
    groupNameField.value = group.name;
    groupUrlField.value = group.url;
    groupNotesField.value = group.notes || '';
    groupStatusField.checked = group.status === 'paused';
  } else {
    groupFormTitle.textContent = 'New Group';
    groupIdField.value = '';
  }
  groupFormWrap.classList.remove('hidden');
}

function hideGroupForm() {
  groupFormWrap.classList.add('hidden');
  groupForm.reset();
}

document.getElementById('new-group-btn').addEventListener('click', () => showGroupForm());
document.getElementById('group-cancel-btn').addEventListener('click', hideGroupForm);

groupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: groupNameField.value.trim(),
    url: groupUrlField.value.trim(),
    notes: groupNotesField.value.trim(),
    status: groupStatusField.checked ? 'paused' : 'active',
  };
  const id = groupIdField.value;
  try {
    if (id) {
      await api(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/groups', { method: 'POST', body: JSON.stringify(payload) });
    }
    hideGroupForm();
    loadGroups();
  } catch (err) {
    alert(err.message);
  }
});

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
          <button class="btn-icon edit-group">Edit</button>
          <button class="btn-icon danger delete-group">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadGroups() {
  const groups = await api('/api/groups');
  renderGroups(groups);
  window.__groups = groups;
}

groupsTbody.addEventListener('click', async (e) => {
  const row = e.target.closest('tr');
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains('edit-group')) {
    const group = (window.__groups || []).find((g) => g._id === id);
    if (group) showGroupForm(group);
  }

  if (e.target.classList.contains('delete-group')) {
    if (!confirm('Delete this group?')) return;
    await api(`/api/groups/${id}`, { method: 'DELETE' });
    loadGroups();
  }
});

loadGroups();
