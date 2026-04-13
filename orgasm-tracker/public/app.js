const API = '';

// Set today's date as default
document.getElementById('date').valueAsDate = new Date();

// Rating slider live update
const ratingInput = document.getElementById('rating');
const ratingDisplay = document.getElementById('rating-display');
ratingInput.addEventListener('input', () => {
  ratingDisplay.textContent = ratingInput.value;
});

// Load on start
loadStats();
loadRecords();

// Form submit
document.getElementById('record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date   = document.getElementById('date').value;
  const rating = parseInt(ratingInput.value);
  const note   = document.getElementById('note').value.trim();

  const res = await fetch(`${API}/api/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rating, note })
  });

  if (res.ok) {
    document.getElementById('note').value = '';
    ratingInput.value = 5;
    ratingDisplay.textContent = '5';
    showToast('сохранено ✨');
    loadStats();
    loadRecords();
  }
});

async function loadStats() {
  const res = await fetch(`${API}/api/stats`);
  const s = await res.json();

  document.getElementById('stat-total').textContent = s.total || '0';
  document.getElementById('stat-avg').textContent   = s.avg_rating || '—';
  document.getElementById('stat-best').textContent  = s.best_rating || '—';
  document.getElementById('stat-last').textContent  = s.last_date
    ? formatDate(s.last_date) : '—';
}

async function loadRecords() {
  const res = await fetch(`${API}/api/records`);
  const records = await res.json();
  const list = document.getElementById('records-list');

  if (!records.length) {
    list.innerHTML = `<div class="empty-state"><span class="emoji">🌸</span>пока пусто — добавь первую запись</div>`;
    return;
  }

  list.innerHTML = records.map(r => `
    <div class="record-item" id="rec-${r.id}">
      <div class="record-rating-badge">
        ${r.rating}<span>/10</span>
      </div>
      <div class="record-info">
        <div class="record-date">${formatDate(r.date)}</div>
        ${r.note ? `<div class="record-note">${escapeHtml(r.note)}</div>` : ''}
        <div class="record-stars">${starsFor(r.rating)}</div>
      </div>
      <button class="btn-delete" onclick="deleteRecord(${r.id})" title="удалить">🗑️</button>
    </div>
  `).join('');
}

async function deleteRecord(id) {
  const el = document.getElementById(`rec-${id}`);
  if (el) { el.style.opacity = '0.4'; el.style.transform = 'scale(0.97)'; }

  await fetch(`${API}/api/records/${id}`, { method: 'DELETE' });
  showToast('удалено');
  loadStats();
  loadRecords();
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function starsFor(rating) {
  const filled = Math.round(rating / 2);
  return '💜'.repeat(filled) + '🤍'.repeat(5 - filled);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
