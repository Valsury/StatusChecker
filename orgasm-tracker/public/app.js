const API = '';

// ===== Theme =====
const THEMES = ['crimson', 'midnight-rose', 'velvet', 'neon-lust', 'obsidian'];
const savedTheme = localStorage.getItem('theme') || 'crimson';
applyTheme(savedTheme);

document.getElementById('theme-switcher').addEventListener('click', (e) => {
  const dot = e.target.closest('.theme-dot');
  if (!dot) return;
  applyTheme(dot.dataset.theme);
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.theme === theme);
  });
}

// Set today's date as default
document.getElementById('date').valueAsDate = new Date();

// Rating slider live update
const ratingInput = document.getElementById('rating');
const ratingDisplay = document.getElementById('rating-display');
ratingInput.addEventListener('input', () => {
  ratingDisplay.textContent = ratingInput.value;
});

// ===== Tags =====
const selectedTags = new Set();
document.querySelectorAll('.tag-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tag = btn.dataset.tag;
    if (selectedTags.has(tag)) { selectedTags.delete(tag); btn.classList.remove('active'); }
    else                        { selectedTags.add(tag);    btn.classList.add('active'); }
  });
});

// ===== Mood pickers =====
const moodState = { mood_before: null, mood_after: null };
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const val    = parseInt(btn.dataset.val);
    moodState[target] = val;
    document.getElementById(target).value = val;
    const display = target === 'mood_before' ? 'mood-before-display' : 'mood-after-display';
    document.getElementById(display).textContent = btn.textContent;
    // highlight
    document.querySelectorAll(`.mood-btn[data-target="${target}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// Load on start
loadStats();
loadRecords();
loadAnalytics();
loadFunFeatures();

// Form submit
document.getElementById('record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date        = document.getElementById('date').value;
  const rating      = parseInt(ratingInput.value);
  const note        = document.getElementById('note').value.trim();
  const tags        = selectedTags.size ? [...selectedTags] : null;
  const mood_before = moodState.mood_before;
  const mood_after  = moodState.mood_after;
  const duration_min = parseInt(document.getElementById('duration_min').value) || null;

  const res = await fetch(`${API}/api/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rating, note, tags, mood_before, mood_after, duration_min })
  });

  if (res.ok) {
    document.getElementById('note').value = '';
    document.getElementById('duration_min').value = '';
    ratingInput.value = 5;
    ratingDisplay.textContent = '5';
    selectedTags.clear();
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    moodState.mood_before = null; moodState.mood_after = null;
    document.getElementById('mood_before').value = '';
    document.getElementById('mood_after').value  = '';
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('mood-before-display').textContent = '—';
    document.getElementById('mood-after-display').textContent  = '—';
    showToast('сохранено ✨');
    showCompliment(rating);
    loadStats(); loadRecords(); loadAnalytics(); loadCalendar(); loadFunFeatures();
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
    <div class="record-item-wrap" id="wrap-${r.id}">
      <div class="swipe-delete-bg">свайп для удаления 🗑️</div>
      <div class="record-item" id="rec-${r.id}" data-id="${r.id}">
        <div class="record-rating-badge">
          ${r.rating}<span>/10</span>
        </div>
        <div class="record-info">
          <div class="record-date">${formatDate(r.date)}</div>
          <div class="record-meta">
            ${r.duration_min ? `<span class="meta-chip">⏱ ${r.duration_min} мин</span>` : ''}
            ${r.mood_before  ? `<span class="meta-chip">до ${moodEmoji(r.mood_before)}</span>` : ''}
            ${r.mood_after   ? `<span class="meta-chip">после ${moodEmoji(r.mood_after)}</span>` : ''}
          </div>
          ${r.tags && r.tags.length ? `<div class="record-tags">${r.tags.map(t => `<span class="record-tag">${t}</span>`).join('')}</div>` : ''}
          ${r.note ? `<div class="record-note">${escapeHtml(r.note)}</div>` : ''}
          <div class="record-stars">${starsFor(r.rating)}</div>
        </div>
        <div class="record-actions">
          <button class="btn-edit"   onclick="openEditPopup(${r.id})" title="редактировать">✏️</button>
          <button class="btn-delete" onclick="confirmDelete(${r.id})" title="удалить">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach swipe listeners
  list.querySelectorAll('.record-item').forEach(el => attachSwipe(el));
}

async function deleteRecord(id) {
  const wrap = document.getElementById(`wrap-${id}`) || document.getElementById(`rec-${id}`);
  if (wrap) { wrap.style.opacity = '0'; wrap.style.transform = 'translateX(-100%)'; wrap.style.transition = 'all 0.3s ease'; }
  setTimeout(async () => {
    await fetch(`${API}/api/records/${id}`, { method: 'DELETE' });
    showToast('удалено');
    loadStats(); loadRecords(); loadAnalytics(); loadCalendar(); loadFunFeatures();
  }, 280);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function starsFor(rating) {
  const filled = Math.round(rating / 2);
  return '💜'.repeat(filled) + '🤍'.repeat(5 - filled);
}

function moodEmoji(val) {
  return ['😔','😐','🙂','😊','🥰'][val - 1] || '—';
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
        ${hasRec ? `<span class="cal-heart" title="${records.length} запис${records.length === 1 ? 'ь' : 'и'}">❤️‍🔥</span>` : ''}
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
        ${r.duration_min ? `<span class="popup-badge" style="background:rgba(255,179,71,0.2);color:var(--gold)">⏱ ${r.duration_min} мин</span>` : ''}
        ${r.tags && r.tags.length ? `<div class="record-tags" style="width:100%;margin-top:6px">${r.tags.map(t=>`<span class="record-tag">${t}</span>`).join('')}</div>` : ''}
        ${r.mood_before || r.mood_after ? `<div style="font-size:0.8rem;color:var(--text-secondary);width:100%;margin-top:4px">${r.mood_before ? `до ${moodEmoji(r.mood_before)}` : ''} ${r.mood_after ? `→ после ${moodEmoji(r.mood_after)}` : ''}</div>` : ''}
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

// ===== Fun Features =====

// --- Compliments ---
const COMPLIMENTS = [
  { emoji: '🔥', text: 'ты просто огонь!' },
  { emoji: '💋', text: 'мммм, записано~' },
  { emoji: '😈', text: 'нехорошая ты... нехорошая 😏' },
  { emoji: '✨', text: 'ещё один момент в истории' },
  { emoji: '💦', text: 'жарко тут стало' },
  { emoji: '🌹', text: 'красиво живёшь' },
  { emoji: '👑', text: 'королева удовольствий' },
  { emoji: '🎯', text: 'цель достигнута 😏' },
  { emoji: '🌙', text: 'ночь удалась' },
  { emoji: '⚡', text: 'заряд получен!' },
];

const HIGH_RATING_COMPLIMENTS = [
  { emoji: '🤩', text: '10 из 10, не иначе как шедевр' },
  { emoji: '🏆', text: 'это войдёт в историю' },
  { emoji: '💫', text: 'такое бывает раз в жизни... или чаще 😏' },
  { emoji: '🎆', text: 'фейерверк засчитан!' },
];

function showCompliment(rating) {
  const pool = rating >= 9 ? HIGH_RATING_COMPLIMENTS : COMPLIMENTS;
  const c = pool[Math.floor(Math.random() * pool.length)];

  const popup = document.getElementById('compliment-popup');
  document.getElementById('compliment-emoji').textContent = c.emoji;
  document.getElementById('compliment-text').textContent  = c.text;

  popup.style.display = 'flex';
  popup.classList.add('show');

  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => { popup.style.display = 'none'; }, 400);
  }, 2200);
}

// --- Achievements ---
const ACHIEVEMENTS = [
  { id: 'first',     emoji: '🌸', title: 'первый раз',      desc: 'добавь первую запись',           condition: 'первая запись в дневнике',      check: (s) => s.total >= 1,        unlockedAt: (r) => r.sort((a,b)=>a.date>b.date?1:-1)[0]?.date },
  { id: 'ten',       emoji: '🔥', title: '10 раз',          desc: 'накопи 10 записей',              condition: '10 записей в дневнике',         check: (s) => s.total >= 10,       unlockedAt: (r) => r.sort((a,b)=>a.date>b.date?1:-1)[9]?.date },
  { id: 'fifty',     emoji: '💯', title: '50 раз',          desc: 'накопи 50 записей',              condition: '50 записей — серьёзно!',        check: (s) => s.total >= 50,       unlockedAt: (r) => r.sort((a,b)=>a.date>b.date?1:-1)[49]?.date },
  { id: 'perfect',   emoji: '💎', title: 'идеально',        desc: 'поставь оценку 10/10',           condition: 'хотя бы одна оценка 10/10',     check: (s) => s.best >= 10,        unlockedAt: (r) => r.find(x => x.rating >= 10)?.date },
  { id: 'highavg',   emoji: '📈', title: 'высокая планка',  desc: 'средняя оценка выше 8',          condition: 'средняя оценка ≥ 8',            check: (s) => s.avg >= 8,          unlockedAt: (r) => null },
  { id: 'streak3',   emoji: '⚡', title: '3 дня подряд',    desc: 'добавляй записи 3 дня подряд',   condition: '3 дня подряд с записями',       check: (s) => s.streak >= 3,       unlockedAt: (r) => null },
  { id: 'streak7',   emoji: '🌶️', title: 'неделя огня',     desc: 'добавляй записи 7 дней подряд', condition: '7 дней подряд с записями',      check: (s) => s.streak >= 7,       unlockedAt: (r) => null },
  { id: 'quickie',   emoji: '💨', title: 'quickie-мастер',  desc: 'добавь тег "quickie"',           condition: 'использован тег quickie',       check: (s) => s.tags.includes('quickie'),  unlockedAt: (r) => r.find(x => x.tags?.includes('quickie'))?.date },
  { id: 'toys',      emoji: '🎀', title: 'игрушечница',     desc: 'добавь тег "игрушки"',           condition: 'использован тег игрушки',       check: (s) => s.tags.includes('игрушки'), unlockedAt: (r) => r.find(x => x.tags?.includes('игрушки'))?.date },
  { id: 'longplay',  emoji: '🕯️', title: 'марафонец',       desc: 'укажи продолжительность 60+ мин','condition': 'запись дольше 60 минут',      check: (s) => s.maxDuration >= 60, unlockedAt: (r) => r.find(x => (x.duration_min||0) >= 60)?.date },
  { id: 'moodboost', emoji: '🥰', title: 'mood booster',    desc: 'настроение после выше, чем до — 3 раза', condition: 'настроение выросло после (3 раза)', check: (s) => s.moodBoosts >= 3, unlockedAt: (r) => null },
];

let _achRecords = []; // cache for popup

async function loadFunFeatures() {
  const [statsRes, recordsRes, analyticsRes] = await Promise.all([
    fetch(`${API}/api/stats`),
    fetch(`${API}/api/records`),
    fetch(`${API}/api/analytics`),
  ]);
  const stats     = await statsRes.json();
  const records   = await recordsRes.json();
  const analytics = await analyticsRes.json();

  if (!records.length) return;

  _achRecords = records;

  const allTags     = records.flatMap(r => r.tags || []);
  const maxDuration = Math.max(...records.map(r => r.duration_min || 0));
  const moodBoosts  = records.filter(r => r.mood_after && r.mood_before && r.mood_after > r.mood_before).length;

  const summary = {
    total:    parseInt(stats.total),
    best:     parseInt(stats.best_rating),
    avg:      parseFloat(stats.avg_rating),
    streak:   analytics.streak || 0,
    tags:     allTags,
    maxDuration,
    moodBoosts,
  };

  renderDrySpell(stats.last_date);
  renderAchievements(summary, records);
}

function renderDrySpell(lastDateStr) {
  if (!lastDateStr) return;
  const card = document.getElementById('dry-spell-card');
  const last = new Date(lastDateStr); last.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const days = Math.round((today - last) / 86400000);

  card.style.display = 'flex';

  if (days === 0) {
    document.getElementById('dry-spell-icon').textContent = '❤️‍🔥';
    document.getElementById('dry-spell-days').textContent = 'сегодня!';
    document.getElementById('dry-spell-label').textContent = 'ты уже отметилась сегодня 😏';
  } else if (days === 1) {
    document.getElementById('dry-spell-icon').textContent = '😏';
    document.getElementById('dry-spell-days').textContent = 'вчера';
    document.getElementById('dry-spell-label').textContent = 'совсем недавно было~';
  } else if (days <= 3) {
    document.getElementById('dry-spell-icon').textContent = '🌶️';
    document.getElementById('dry-spell-days').textContent = `${days} дня назад`;
    document.getElementById('dry-spell-label').textContent = 'пора бы снова 😈';
  } else if (days <= 7) {
    document.getElementById('dry-spell-icon').textContent = '🌵';
    document.getElementById('dry-spell-days').textContent = `${days} дней без`;
    document.getElementById('dry-spell-label').textContent = 'засуха начинается...';
  } else {
    document.getElementById('dry-spell-icon').textContent = '🏜️';
    document.getElementById('dry-spell-days').textContent = `${days} дней без`;
    document.getElementById('dry-spell-label').textContent = 'пустыня. серьёзная пустыня.';
  }
}

function renderAchievements(summary, records) {
  const section = document.getElementById('achievements-section');
  const grid    = document.getElementById('achievements-grid');

  section.style.display = 'block';

  const unlocked = ACHIEVEMENTS.filter(a => a.check(summary));
  const locked   = ACHIEVEMENTS.filter(a => !a.check(summary));

  grid.innerHTML = [
    ...unlocked.map(a => {
      const dateStr = a.unlockedAt(records);
      const dateLabel = dateStr ? formatDate(dateStr) : '';
      return `<div class="achievement unlocked" onclick="openAchPopup('${a.id}', true, '${dateLabel}')">
        <span class="ach-emoji">${a.emoji}</span>
        <span class="ach-title">${a.title}</span>
        ${dateLabel ? `<span class="ach-date">${dateLabel}</span>` : ''}
      </div>`;
    }),
    ...locked.map(a => `
      <div class="achievement locked" onclick="openAchPopup('${a.id}', false, '')">
        <span class="ach-emoji">🔒</span>
        <span class="ach-title">${a.title}</span>
      </div>
    `),
  ].join('');
}

function openAchPopup(id, isUnlocked, dateLabel) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;

  document.getElementById('ach-popup-emoji').textContent = isUnlocked ? a.emoji : '🔒';
  document.getElementById('ach-popup-title').textContent = a.title;
  document.getElementById('ach-popup-desc').textContent  = a.condition;
  document.getElementById('ach-popup-date').textContent  = isUnlocked
    ? (dateLabel ? `получено: ${dateLabel}` : 'получено ✓')
    : 'ещё не получено';
  document.getElementById('ach-popup-date').className = 'ach-popup-date ' + (isUnlocked ? 'unlocked' : 'locked');
  document.getElementById('ach-popup').style.display = 'flex';
}

function closeAchPopup(e) {
  if (e.target === document.getElementById('ach-popup')) {
    document.getElementById('ach-popup').style.display = 'none';
  }
}

// ===== UX Features =====

// --- Confirm delete ---
let _pendingDeleteId = null;

function confirmDelete(id) {
  _pendingDeleteId = id;
  document.getElementById('confirm-popup').style.display = 'flex';
}

document.getElementById('confirm-delete-btn').addEventListener('click', () => {
  document.getElementById('confirm-popup').style.display = 'none';
  if (_pendingDeleteId) { deleteRecord(_pendingDeleteId); _pendingDeleteId = null; }
});

function closeConfirm(e) {
  if (!e || e.target === document.getElementById('confirm-popup')) {
    document.getElementById('confirm-popup').style.display = 'none';
    _pendingDeleteId = null;
  }
}

// --- Edit popup ---
const editRatingInput = document.getElementById('edit-rating');
editRatingInput.addEventListener('input', () => {
  document.getElementById('edit-rating-display').textContent = editRatingInput.value;
});

async function openEditPopup(id) {
  const res = await fetch(`${API}/api/records`);
  const records = await res.json();
  const r = records.find(x => x.id === id);
  if (!r) return;

  document.getElementById('edit-id').value       = r.id;
  document.getElementById('edit-date').value     = r.date.slice(0, 10);
  editRatingInput.value                          = r.rating;
  document.getElementById('edit-rating-display').textContent = r.rating;
  document.getElementById('edit-note').value     = r.note || '';
  document.getElementById('edit-duration').value = r.duration_min || '';
  document.getElementById('edit-popup').style.display = 'flex';
}

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id           = document.getElementById('edit-id').value;
  const date         = document.getElementById('edit-date').value;
  const rating       = parseInt(editRatingInput.value);
  const note         = document.getElementById('edit-note').value.trim();
  const duration_min = parseInt(document.getElementById('edit-duration').value) || null;

  await fetch(`${API}/api/records/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, rating, note, duration_min })
  });

  document.getElementById('edit-popup').style.display = 'none';
  showToast('обновлено ✨');
  loadStats(); loadRecords(); loadAnalytics(); loadCalendar(); loadFunFeatures();
});

function closeEditPopup(e) {
  if (!e || e.target === document.getElementById('edit-popup')) {
    document.getElementById('edit-popup').style.display = 'none';
  }
}

// --- Swipe to delete ---
function attachSwipe(el) {
  let startX = 0, currentX = 0, dragging = false;
  const THRESHOLD = 80;

  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    dragging = true;
    el.style.transition = 'none';
  }, { passive: true });

  el.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    currentX = e.touches[0].clientX - startX;
    if (currentX < 0) {
      el.style.transform = `translateX(${Math.max(currentX, -120)}px)`;
    }
  }, { passive: true });

  el.addEventListener('touchend', () => {
    dragging = false;
    el.style.transition = 'transform 0.25s ease';
    if (currentX < -THRESHOLD) {
      const id = parseInt(el.dataset.id);
      el.style.transform = 'translateX(-120px)';
      setTimeout(() => confirmDelete(id), 150);
    } else {
      el.style.transform = 'translateX(0)';
    }
    currentX = 0;
  });
}
