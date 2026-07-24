// ---------- Helpers ----------
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
// OFFERS
// ==================================================
const offerFormWrap = document.getElementById('offer-form-wrap');
const offerForm = document.getElementById('offer-form');
const offerFormTitle = document.getElementById('offer-form-title');
const offerIdField = document.getElementById('offer-id');
const offerTitleField = document.getElementById('offer-title');
const offerDescField = document.getElementById('offer-description');
const offerStatusField = document.getElementById('offer-status');
const offersTable = document.getElementById('offers-table');
const offersTbody = document.getElementById('offers-tbody');
const offersEmpty = document.getElementById('offers-empty');
const bulkImportWrap = document.getElementById('bulk-import-wrap');
const bulkImportForm = document.getElementById('bulk-import-form');
const bulkImportTextarea = document.getElementById('bulk-import-textarea');

function showOfferForm(offer = null) {
  offerForm.reset();
  if (offer) {
    offerFormTitle.textContent = 'Edit Offer';
    offerIdField.value = offer._id;
    offerTitleField.value = offer.title;
    offerDescField.value = offer.description;
    offerStatusField.checked = offer.status === 'paused';
  } else {
    offerFormTitle.textContent = 'New Offer';
    offerIdField.value = '';
  }
  bulkImportWrap.classList.add('hidden');
  offerFormWrap.classList.remove('hidden');
}

function hideOfferForm() {
  offerFormWrap.classList.add('hidden');
  offerForm.reset();
}

function showBulkImportForm() {
  bulkImportForm.reset();
  offerFormWrap.classList.add('hidden');
  bulkImportWrap.classList.remove('hidden');
}

function hideBulkImportForm() {
  bulkImportWrap.classList.add('hidden');
  bulkImportForm.reset();
}

document.getElementById('new-offer-btn').addEventListener('click', () => showOfferForm());
document.getElementById('offer-cancel-btn').addEventListener('click', hideOfferForm);
document.getElementById('bulk-import-btn').addEventListener('click', () => showBulkImportForm());
document.getElementById('bulk-import-cancel-btn').addEventListener('click', hideBulkImportForm);

offerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: offerTitleField.value.trim(),
    description: offerDescField.value.trim(),
    status: offerStatusField.checked ? 'paused' : 'active',
  };
  const id = offerIdField.value;
  try {
    if (id) {
      await api(`/api/offers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/offers', { method: 'POST', body: JSON.stringify(payload) });
    }
    hideOfferForm();
    loadOffers();
  } catch (err) {
    alert(err.message);
  }
});

bulkImportForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = bulkImportTextarea.value.trim();
  if (!text) return;

  // Parse lines into offers
  const lines = text.split('\n').filter(line => line.trim());
  const offersToImport = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    const separatorIndex = trimmedLine.indexOf('|');
    if (separatorIndex === -1) continue;

    const title = trimmedLine.slice(0, separatorIndex).trim();
    const description = trimmedLine.slice(separatorIndex + 1).trim();
    if (title && description) {
      offersToImport.push({ title, description });
    }
  }

  try {
    const result = await api('/api/offers/bulk', {
      method: 'POST',
      body: JSON.stringify({ offers: offersToImport })
    });

    let message = `Successfully created ${result.created} offer(s)`;
    if (result.failed > 0) {
      message += `\nFailed to parse ${result.failed} line(s):`;
      for (const failure of result.failures) {
        message += `\n- ${failure.reason}`;
      }
    }
    alert(message);

    hideBulkImportForm();
    loadOffers();
  } catch (err) {
    alert(err.message);
  }
});

function renderOffers(offers) {
  if (!offers.length) {
    offersTable.classList.add('hidden');
    offersEmpty.classList.remove('hidden');
    return;
  }
  offersEmpty.classList.add('hidden');
  offersTable.classList.remove('hidden');

  offersTbody.innerHTML = offers
    .map(
      (o) => `
      <tr data-id="${o._id}">
        <td>${escapeHtml(o.title)}</td>
        <td><span class="status-pill ${o.status}">${o.status}</span></td>
        <td>${formatDate(o.createdAt)}</td>
        <td>
          <button class="btn-icon edit-offer">Edit</button>
          <button class="btn-icon danger delete-offer">Delete</button>
        </td>
      </tr>`
    )
    .join('');
}

async function loadOffers() {
  const offers = await api('/api/offers');
  renderOffers(offers);
  window.__offers = offers;
}

offersTbody.addEventListener('click', async (e) => {
  const row = e.target.closest('tr');
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains('edit-offer')) {
    const offer = (window.__offers || []).find((o) => o._id === id);
    if (offer) showOfferForm(offer);
  }

  if (e.target.classList.contains('delete-offer')) {
    if (!confirm('Delete this offer?')) return;
    await api(`/api/offers/${id}`, { method: 'DELETE' });
    loadOffers();
  }
});

loadOffers();
