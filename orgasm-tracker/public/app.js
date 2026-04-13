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
loadAnalytics();

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
    loadAnalytics();
    loadCalendar();
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
  loadAnalytics();
  loadCalendar();
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

// ===== Analytics =====

async function loadAnalytics() {
  const res = await fetch(`${API}/api/analytics`);
  const data = await res.json();

  if (!data.byMonth.length) return;

  document.getElementById('analytics-section').style.display = 'block';

  // Streak banner
  if (data.streak > 1) {
    const banner = document.getElementById('streak-banner');
    banner.style.display = 'flex';
    document.getElementById('streak-text').textContent =
      `${data.streak} дня подряд — ты в огне!`;
  }

  drawBarChart('chart-months', {
    labels: data.byMonth.map(r => {
      const [y, m] = r.month.split('-');
      return new Date(y, m - 1).toLocaleDateString('ru-RU', { month: 'short' });
    }),
    values: data.byMonth.map(r => parseInt(r.count)),
    color: '#ff2d55'
  });

  drawBarChart('chart-ratings', {
    labels: Array.from({length: 10}, (_, i) => i + 1),
    values: (() => {
      const map = {};
      data.ratingDist.forEach(r => map[r.rating] = parseInt(r.count));
      return Array.from({length: 10}, (_, i) => map[i + 1] || 0);
    })(),
    color: '#9b1dea'
  });

  const weekdays = ['вс','пн','вт','ср','чт','пт','сб'];
  drawBarChart('chart-weekdays', {
    labels: (() => {
      const map = {};
      data.byWeekday.forEach(r => map[r.dow] = parseInt(r.count));
      return weekdays.map((_, i) => weekdays[i]);
    })(),
    values: (() => {
      const map = {};
      data.byWeekday.forEach(r => map[r.dow] = parseInt(r.count));
      return weekdays.map((_, i) => map[i] || 0);
    })(),
    color: '#ffb347'
  });
}

function drawBarChart(canvasId, { labels, values, color }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Retina support
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = rect.width || canvas.parentElement.clientWidth || 280;
  const H = parseInt(canvas.getAttribute('height')) || 120;

  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const padL = 8, padR = 8, padT = 10, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const max = Math.max(...values, 1);
  const barW = chartW / labels.length;
  const gap  = barW * 0.25;

  ctx.clearRect(0, 0, W, H);

  // Grid line
  ctx.strokeStyle = 'rgba(255,45,85,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT + chartH);
  ctx.lineTo(W - padR, padT + chartH);
  ctx.stroke();

  labels.forEach((label, i) => {
    const val  = values[i];
    const barH = val > 0 ? Math.max((val / max) * chartH, 3) : 0;
    const x    = padL + i * barW + gap / 2;
    const y    = padT + chartH - barH;
    const w    = barW - gap;

    if (val > 0) {
      // Gradient bar
      const grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color + '55');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, w, barH, [3, 3, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(x, padT + chartH - 3, w, 3, [1, 1, 0, 0]);
      ctx.fill();
    }

    // Label
    ctx.fillStyle = val > 0 ? 'rgba(196,122,149,0.9)' : 'rgba(122,61,85,0.5)';
    ctx.font = `500 ${Math.min(10, barW * 0.55)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, H - 6);
  });
}

// ===== Calendar =====

let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-based
let calRecordsMap = {}; // 'YYYY-MM-DD' -> [records]

async function loadCalendar() {
  const res = await fetch(`${API}/api/records`);
  const records = await res.json();

  calRecordsMap = {};
  records.forEach(r => {
    const key = r.date.slice(0, 10);
    if (!calRecordsMap[key]) calRecordsMap[key] = [];
    calRecordsMap[key].push(r);
  });

  renderCalendar();
}

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const grid  = document.getElementById('cal-grid');

  title.textContent = new Date(calYear, calMonth).toLocaleDateString('ru-RU', {
    month: 'long', year: 'numeric'
  });

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);

  // Monday-based offset
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const todayStr = toDateStr(new Date());
  let html = '';

  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const records = calRecordsMap[dateStr];
    const isToday = dateStr === todayStr;
    const hasRec  = records && records.length > 0;

    // Pick best rating for glow intensity
    const bestRating = hasRec ? Math.max(...records.map(r => r.rating)) : 0;
    const glowClass  = hasRec ? `glow-${Math.ceil(bestRating / 3)}` : '';

    html += `
      <div class="cal-day ${isToday ? 'today' : ''} ${hasRec ? 'has-record' : ''} ${glowClass}"
           data-date="${dateStr}" onclick="openDayPopup('${dateStr}')">
        <span class="cal-day-num">${d}</span>
        ${hasRec ? `<span class="cal-heart" title="${records.length} запис${records.length === 1 ? 'ь' : 'и'}">🔥❤️</span>` : ''}
      </div>`;
  }

  grid.innerHTML = html;
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});

document.getElementById('cal-next').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// ===== Day popup =====

function openDayPopup(dateStr) {
  const popup    = document.getElementById('day-popup');
  const dateEl   = document.getElementById('popup-date');
  const recordsEl = document.getElementById('popup-records');
  const addBtn   = document.getElementById('popup-add-btn');

  const d = new Date(dateStr + 'T00:00:00');
  dateEl.textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

  const records = calRecordsMap[dateStr] || [];

  if (records.length) {
    recordsEl.innerHTML = records.map(r => `
      <div class="popup-record">
        <span class="popup-badge">${r.rating}/10</span>
        <span class="popup-stars">${starsFor(r.rating)}</span>
        ${r.note ? `<span class="popup-note">${escapeHtml(r.note)}</span>` : ''}
      </div>
    `).join('');
  } else {
    recordsEl.innerHTML = `<div class="popup-empty">нет записей на этот день</div>`;
  }

  addBtn.onclick = () => {
    document.getElementById('date').value = dateStr;
    popup.style.display = 'none';
    document.getElementById('record-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('note').focus();
  };

  popup.style.display = 'flex';
}

document.getElementById('popup-close').addEventListener('click', () => {
  document.getElementById('day-popup').style.display = 'none';
});

document.getElementById('day-popup').addEventListener('click', (e) => {
  if (e.target === document.getElementById('day-popup')) {
    document.getElementById('day-popup').style.display = 'none';
  }
});

// Init calendar
loadCalendar();

// Patch existing refresh calls to also refresh calendar
const _origLoadRecords = loadRecords;
async function refreshAll() {
  await Promise.all([loadStats(), loadRecords(), loadAnalytics(), loadCalendar()]);
}
