const HEALTH_POLL_MS = 20000;
const HISTORY_POLL_MS = 5000;

const healthStripEmpty = document.getElementById('health-strip-empty');
const healthStripPills = document.getElementById('health-strip-pills');
const postAccountsSelect = document.getElementById('post-accounts');
const postGroupsSelect = document.getElementById('post-groups');
const postOffersSelect = document.getElementById('post-offers');
const postSubmitBtn = document.getElementById('post-submit-btn');
const postSuccess = document.getElementById('post-success');
const historyStatusFilter = document.getElementById('history-status-filter');
const historyAccountFilter = document.getElementById('history-account-filter');
const historyEmpty = document.getElementById('history-empty');
const historyTable = document.getElementById('history-table');
const historyTbody = document.getElementById('history-tbody');

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
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSelectedIds(select) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function fillMultiSelect(select, items, labelKey) {
  select.innerHTML = items
    .map(
      (item) =>
        `<option value="${item._id}">${escapeHtml(item[labelKey])}</option>`
    )
    .join('');
}

// ==================================================
// Health strip
// ==================================================
function renderHealthStrip(accounts) {
  if (!accounts.length) {
    healthStripEmpty.classList.remove('hidden');
    healthStripPills.classList.add('hidden');
    healthStripPills.innerHTML = '';
    return;
  }

  healthStripEmpty.classList.add('hidden');
  healthStripPills.classList.remove('hidden');
  healthStripPills.innerHTML = accounts
    .map(
      (account) => `
      <div class="account-health-pill ${account.status}">
        <span class="account-health-nickname">${escapeHtml(account.nickname)}</span>
        <span class="status-pill ${account.status}">${account.status}</span>
        <span class="account-health-count">${account.dailyPostCount}/${account.dailyPostCap}</span>
      </div>`
    )
    .join('');
}

async function loadHealthStrip() {
  const accounts = await api('/api/accounts');
  renderHealthStrip(accounts);
}

// ==================================================
// Post composer
// ==================================================
async function loadComposerOptions() {
  const [accounts, groups, offers] = await Promise.all([
    api('/api/accounts'),
    api('/api/groups'),
    api('/api/offers'),
  ]);

  fillMultiSelect(
    postAccountsSelect,
    accounts.filter((a) => a.status === 'active'),
    'nickname'
  );
  fillMultiSelect(
    postGroupsSelect,
    groups.filter((g) => g.status === 'active'),
    'name'
  );
  fillMultiSelect(
    postOffersSelect,
    offers.filter((o) => o.status === 'active'),
    'title'
  );
}

function hidePostSuccess() {
  postSuccess.classList.add('hidden');
  postSuccess.textContent = '';
}

function showPostSuccess(message) {
  postSuccess.textContent = message;
  postSuccess.classList.remove('hidden');
}

postSubmitBtn.addEventListener('click', async () => {
  hidePostSuccess();

  const accountIds = getSelectedIds(postAccountsSelect);
  const groupIds = getSelectedIds(postGroupsSelect);
  const offerIds = getSelectedIds(postOffersSelect);

  if (!accountIds.length || !groupIds.length || !offerIds.length) {
    alert('Select at least one account, one group, and one offer.');
    return;
  }

  try {
    postSubmitBtn.disabled = true;
    const result = await api('/api/post-jobs', {
      method: 'POST',
      body: JSON.stringify({ accountIds, groupIds, offerIds }),
    });
    showPostSuccess(`Queued ${result.created} job${result.created === 1 ? '' : 's'}.`);
    loadPostHistory();
  } catch (err) {
    alert(err.message);
  } finally {
    postSubmitBtn.disabled = false;
  }
});

// ==================================================
// Post history
// ==================================================
async function loadAccountFilterOptions() {
  const accounts = await api('/api/accounts');
  const selected = historyAccountFilter.value;

  historyAccountFilter.innerHTML =
    '<option value="">All</option>' +
    accounts
      .map(
        (account) =>
          `<option value="${account._id}">${escapeHtml(account.nickname)}</option>`
      )
      .join('');

  if (selected && accounts.some((account) => account._id === selected)) {
    historyAccountFilter.value = selected;
  }
}

function buildHistoryQuery() {
  const params = new URLSearchParams();
  if (historyStatusFilter.value) params.set('status', historyStatusFilter.value);
  if (historyAccountFilter.value) params.set('account', historyAccountFilter.value);
  const query = params.toString();
  return query ? `/api/post-jobs?${query}` : '/api/post-jobs';
}

function renderPostHistory(jobs) {
  if (!jobs.length) {
    historyTable.classList.add('hidden');
    historyEmpty.classList.remove('hidden');
    return;
  }

  historyEmpty.classList.add('hidden');
  historyTable.classList.remove('hidden');

  historyTbody.innerHTML = jobs
    .map((job) => {
      const time = job.status === 'posted' && job.postedAt ? job.postedAt : job.queuedAt;
      const errorText = job.status === 'failed' && job.error ? job.error : '—';

      return `
      <tr>
        <td>${escapeHtml(job.offerTitle || '—')}</td>
        <td>${escapeHtml(job.groupName || '—')}</td>
        <td>${escapeHtml(job.accountNickname || '—')}</td>
        <td><span class="status-pill ${job.status}">${job.status}</span></td>
        <td>${formatDateTime(time)}</td>
        <td class="error-cell" title="${escapeHtml(errorText)}">${escapeHtml(errorText)}</td>
      </tr>`;
    })
    .join('');
}

async function loadPostHistory() {
  const jobs = await api(buildHistoryQuery());
  renderPostHistory(jobs);
}

historyStatusFilter.addEventListener('change', loadPostHistory);
historyAccountFilter.addEventListener('change', loadPostHistory);

// ---------- Init ----------
loadHealthStrip();
loadComposerOptions();
loadAccountFilterOptions();
loadPostHistory();
setInterval(loadHealthStrip, HEALTH_POLL_MS);
setInterval(loadPostHistory, HISTORY_POLL_MS);
