// ════════════════════════════════
// FIREBASE CONFIG & INIT
// ════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyCaIFCsZAxHuuMrc-N7Uysaq270q-eP4Ac",
  authDomain: "latihansoalakp.firebaseapp.com",
  databaseURL: "https://latihansoalakp-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "latihansoalakp",
  storageBucket: "latihansoalakp.firebasestorage.app",
  messagingSenderId: "546555757194",
  appId: "1:546555757194:web:37eac3d3fa7c586cf4a373",
  measurementId: "G-DBVM4DFDJ5"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
}

// ════════════════════════════════
// STATE & STORAGE
// ════════════════════════════════
const LS_PW = 'akp_admin_pw';
let _semesters = [];
let _matkuls = [];
let _questions = {};
let _materi = {};
let _users = {};
let _timerSettings = { enabled: false, mode: 'per_question', value: 60 };
let pendingMateriPDF = null;

// ════════════════════════════════
// DATA LAYER (Firebase)
// ════════════════════════════════
const getSemesters = () => _semesters;
const setSemesters = d => { _semesters = d; db.ref('semesters').set(d); };
const getMatkuls = () => _matkuls;
const setMatkuls = d => { _matkuls = d; db.ref('matkuls').set(d); };
const getQuestions = () => _questions;
const setQuestions = d => { _questions = d; db.ref('questions').set(d); };
const getMateri = () => _materi;
const setMateri = d => { _materi = d; db.ref('materi').set(d); };
const getUsers = () => _users;
const setUsers = d => { _users = d; db.ref('users').set(d); };
const getTimerSettings = () => _timerSettings;
const setTimerSettings = d => { _timerSettings = d; db.ref('timerSettings').set(d); };
const getPw = () => localStorage.getItem(LS_PW) || 'admin123';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ════════════════════════════════
// UTILS
// ════════════════════════════════
function escHtml(str = '') { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function showToast(id) { const el = document.getElementById(id); if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 3000); } }
function showErr(id, msg) { const el = document.getElementById(id); if (el) { el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 5000); } }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(ov => {
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
});

// ════════════════════════════════
// EMOJI PICKER
// ════════════════════════════════
const EMOJIS = [
  '📚','📖','📝','📊','📈','📉','🧮','💰','🏛','🧾',
  '📋','📌','🔖','💡','🎓','📓','📔','📒','📕','📗',
  '📘','📙','🗂','📁','📂','✏️','✒️','🔍','💼','⚖️',
  '💹','🌐','🏢','🧠','💻','📱','🔬','🎯','🏆','🌟',
  '⭐','🔢','📐','📏','🖊','🖋','📃','📄','🗃','🗄'
];

function buildEmojiPanels() {
  document.querySelectorAll('.emoji-panel').forEach(panel => {
    const id = panel.id;
    const targetInput = id === 'ep-new-matkul' ? 'new-matkul-icon' : id === 'ep-edit-matkul' ? 'edit-matkul-icon' : '';
    const previewId = id === 'ep-new-matkul' ? 'new-matkul-icon-preview' : id === 'ep-edit-matkul' ? 'edit-matkul-icon-preview' : '';
    panel.innerHTML = EMOJIS.map(e => `<div class="emoji-opt" onclick="setEmoji('${targetInput}','${previewId}','${e}','${id}')" title="${e}">${e}</div>`).join('');
  });
}

function toggleEmojiPicker(panelId) {
  const panel = document.getElementById(panelId);
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.emoji-panel.open').forEach(p => p.classList.remove('open'));
  if (!isOpen) panel.classList.add('open');
}

function setEmoji(inputId, previewId, emoji, panelId) {
  if (inputId) document.getElementById(inputId).value = emoji;
  if (previewId) document.getElementById(previewId).textContent = emoji;
  document.getElementById(panelId).classList.remove('open');
}

function syncIconPreview(inputId, previewId) {
  document.getElementById(previewId).textContent = document.getElementById(inputId).value || '📚';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.emoji-picker-wrap')) document.querySelectorAll('.emoji-panel.open').forEach(p => p.classList.remove('open'));
});

// ════════════════════════════════
// AUTH & PAGE ROUTING
// ════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => { p.classList.remove('active'); p.style.display = ''; });
  document.getElementById(id).classList.add('active');
}

function doLogin() {
  if (document.getElementById('admin-pw-input').value === getPw()) {
    showPage('page-admin');
    populateAdminSelects();
    showPanel('overview');
    logActivity('Admin login');
  } else {
    document.getElementById('login-err').style.display = 'block';
    document.getElementById('admin-pw-input').value = '';
    document.getElementById('admin-pw-input').focus();
  }
}

function doLogout() {
  showPage('page-login');
  document.getElementById('admin-pw-input').value = '';
  document.getElementById('login-err').style.display = 'none';
}

// ════════════════════════════════
// ADMIN PANELS
// ════════════════════════════════
function showPanel(name) {
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.admin-nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  const navItem = document.querySelector(`[data-panel="${name}"]`);
  if (navItem) navItem.classList.add('active');
  populateAdminSelects();
  if (name === 'overview') updateOverview();
  if (name === 'semesters') { renderSemTable(); renderMatkulList(); }
  if (name === 'materi') { updateMateriMatkulSel(); renderMateriAdminList(); }
  if (name === 'questions') { updateQMatkulSel(); renderQList(); }
  if (name === 'users') refreshUsers();
  if (name === 'timer') loadTimerSettings();
}

function populateAdminSelects() {
  const sems = getSemesters();
  const nms = document.getElementById('new-matkul-sem');
  if (nms) nms.innerHTML = sems.map(s => `<option value="${s.id}">Semester ${s.num} — ${s.label || ''}</option>`).join('') || '<option value="">— Belum ada semester —</option>';
  const mss = document.getElementById('materi-sem-sel');
  if (mss) { mss.innerHTML = sems.map(s => `<option value="${s.id}">Semester ${s.num}</option>`).join('') || '<option value="">—</option>'; }
  const qss = document.getElementById('q-sem-sel');
  if (qss) { qss.innerHTML = sems.map(s => `<option value="${s.id}">Semester ${s.num}</option>`).join('') || '<option value="">—</option>'; }
}


// ════════════════════════════════
// OVERVIEW
// ════════════════════════════════
function updateOverview() {
  const sems = getSemesters(), matkuls = getMatkuls(), qs = getQuestions(), mat = getMateri(), users = getUsers(), timer = getTimerSettings();
  let totalSoal = 0, totalMateri = 0;
  Object.values(qs).forEach(arr => totalSoal += (arr || []).length);
  Object.values(mat).forEach(arr => totalMateri += (arr || []).length);
  const userCount = Object.keys(users || {}).length;
  document.getElementById('ov-sem').textContent = sems.length;
  document.getElementById('ov-matkul').textContent = matkuls.length;
  document.getElementById('ov-soal').textContent = totalSoal;
  document.getElementById('ov-materi').textContent = totalMateri;
  document.getElementById('ov-users').textContent = userCount;
  document.getElementById('ov-timer').textContent = timer.enabled ? (timer.mode === 'per_question' ? timer.value + 's/soal' : timer.value + ' menit') : 'OFF';
  renderRecentActivity();
}

function renderRecentActivity() {
  const wrap = document.getElementById('recent-activity');
  const users = getUsers() || {};
  const activities = [];
  Object.entries(users).forEach(([userId, data]) => {
    if (data.quizzes) {
      Object.values(data.quizzes).forEach(q => {
        activities.push({ userId: userId.slice(0, 8), action: `Mengerjakan quiz "${q.matkulName || 'Unknown'}"`, score: q.score, time: q.timestamp });
      });
    }
  });
  activities.sort((a, b) => (b.time || 0) - (a.time || 0));
  const recent = activities.slice(0, 10);
  if (recent.length === 0) {
    wrap.innerHTML = '<div class="empty-msg">Belum ada aktivitas tercatat.</div>';
    return;
  }
  wrap.innerHTML = recent.map(a => `<div class="q-list-item">
    <div class="q-list-num" style="font-size:14px;">👤</div>
    <div class="q-list-body">
      <div class="q-list-text">${escHtml(a.action)}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:3px;">User: ${a.userId}... | Skor: ${a.score || 0}% | ${a.time ? new Date(a.time).toLocaleString('id-ID') : '-'}</div>
    </div>
  </div>`).join('');
}

// ════════════════════════════════
// SEMESTERS
// ════════════════════════════════
function addSemester() {
  const num = parseInt(document.getElementById('new-sem-num').value);
  const label = document.getElementById('new-sem-label').value.trim();
  if (!num || num < 1) { alert('Nomor semester wajib diisi.'); return; }
  const sems = getSemesters();
  if (sems.find(s => s.num === num)) { alert('Semester ' + num + ' sudah ada.'); return; }
  sems.push({ id: uid(), num, label });
  sems.sort((a, b) => a.num - b.num);
  setSemesters(sems);
  document.getElementById('new-sem-num').value = '';
  document.getElementById('new-sem-label').value = '';
  renderSemTable(); populateAdminSelects(); showToast('sem-toast');
  logActivity('Tambah Semester ' + num);
}

function renderSemTable() {
  const sems = getSemesters(), matkuls = getMatkuls(), qs = getQuestions(), mat = getMateri();
  const tbody = document.getElementById('sem-tbody');
  if (!tbody) return;
  if (sems.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Belum ada semester.</td></tr>'; return; }
  tbody.innerHTML = sems.map(s => {
    const mks = matkuls.filter(m => m.semId === s.id);
    let totalSoal = 0, totalMat = 0;
    mks.forEach(m => { totalSoal += (qs[m.id] || []).length; totalMat += (mat[m.id] || []).length; });
    return `<tr>
      <td><strong>Semester ${s.num}</strong><br><span style="font-size:11px;color:var(--text2)">${escHtml(s.label || '')}</span></td>
      <td>${mks.length}</td><td>${totalSoal}</td><td>${totalMat}</td>
      <td><button class="btn-danger" onclick="deleteSemester('${s.id}')">Hapus</button></td>
    </tr>`;
  }).join('');
}

function deleteSemester(id) {
  if (!confirm('Hapus semester ini beserta semua mata kuliah, soal, dan materinya?')) return;
  const mks = getMatkuls().filter(m => m.semId === id);
  const qsData = getQuestions(), matData = getMateri();
  mks.forEach(m => { delete qsData[m.id]; delete matData[m.id]; });
  setQuestions(qsData); setMateri(matData);
  setSemesters(getSemesters().filter(s => s.id !== id));
  setMatkuls(getMatkuls().filter(m => m.semId !== id));
  renderSemTable(); renderMatkulList(); populateAdminSelects();
  logActivity('Hapus semester');
}

// ════════════════════════════════
// MATKUL
// ════════════════════════════════
function addMatkul() {
  const semId = document.getElementById('new-matkul-sem').value;
  const name = document.getElementById('new-matkul-name').value.trim();
  const icon = document.getElementById('new-matkul-icon').value.trim() || '📚';
  const desc = document.getElementById('new-matkul-desc').value.trim();
  if (!semId) { alert('Pilih semester.'); return; }
  if (!name) { alert('Nama mata kuliah wajib diisi.'); return; }
  const matkuls = getMatkuls();
  matkuls.push({ id: uid(), semId, name, icon, desc });
  setMatkuls(matkuls);
  document.getElementById('new-matkul-name').value = '';
  document.getElementById('new-matkul-icon').value = '';
  document.getElementById('new-matkul-icon-preview').textContent = '📚';
  document.getElementById('new-matkul-desc').value = '';
  renderMatkulList(); populateAdminSelects(); showToast('matkul-toast');
  logActivity('Tambah matkul: ' + name);
}

function renderMatkulList() {
  const sems = getSemesters(), matkuls = getMatkuls(), qs = getQuestions(), mat = getMateri();
  const wrap = document.getElementById('matkul-list-admin');
  if (!wrap) return;
  if (matkuls.length === 0) { wrap.innerHTML = ''; return; }
  let html = '<div class="section-title">Daftar Mata Kuliah</div>';
  sems.forEach(s => {
    const mks = matkuls.filter(m => m.semId === s.id);
    if (mks.length === 0) return;
    html += `<div style="margin-bottom:16px;"><div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">Semester ${s.num}</div>`;
    mks.forEach(m => {
      html += `<div class="q-list-item">
        <div class="matkul-icon">${m.icon || '📚'}</div>
        <div class="q-list-body">
          <div class="q-list-text" style="font-weight:600;">${escHtml(m.name)}</div>
          <div style="font-size:11px;color:var(--text2);margin-top:2px;">${(qs[m.id] || []).length} soal · ${(mat[m.id] || []).length} materi${m.desc ? ' · ' + escHtml(m.desc) : ''}</div>
        </div>
        <div class="q-list-actions">
          <button class="btn-edit" onclick="openEditMatkul('${m.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteMatkul('${m.id}')">Hapus</button>
        </div>
      </div>`;
    });
    html += '</div>';
  });
  wrap.innerHTML = html;
}

function deleteMatkul(id) {
  if (!confirm('Hapus mata kuliah ini beserta semua soal dan materinya?')) return;
  const qsData = getQuestions(); delete qsData[id]; setQuestions(qsData);
  const matData = getMateri(); delete matData[id]; setMateri(matData);
  setMatkuls(getMatkuls().filter(m => m.id !== id));
  renderMatkulList(); populateAdminSelects();
}

function openEditMatkul(matkulId) {
  const m = getMatkuls().find(x => x.id === matkulId);
  if (!m) return;
  document.getElementById('edit-matkul-id').value = matkulId;
  document.getElementById('edit-matkul-name').value = m.name;
  document.getElementById('edit-matkul-icon').value = m.icon || '📚';
  document.getElementById('edit-matkul-icon-preview').textContent = m.icon || '📚';
  document.getElementById('edit-matkul-desc').value = m.desc || '';
  openModal('modal-edit-matkul');
}

function saveEditMatkul() {
  const id = document.getElementById('edit-matkul-id').value;
  const name = document.getElementById('edit-matkul-name').value.trim();
  if (!name) { alert('Nama mata kuliah wajib diisi.'); return; }
  const icon = document.getElementById('edit-matkul-icon').value.trim() || '📚';
  const desc = document.getElementById('edit-matkul-desc').value.trim();
  const matkuls = getMatkuls();
  const idx = matkuls.findIndex(m => m.id === id);
  if (idx > -1) { matkuls[idx] = { ...matkuls[idx], name, icon, desc }; setMatkuls(matkuls); }
  showToast('edit-matkul-toast');
  setTimeout(() => { closeModal('modal-edit-matkul'); renderMatkulList(); populateAdminSelects(); }, 1200);
}


// ════════════════════════════════
// MATERI ADMIN
// ════════════════════════════════
function updateMateriMatkulSel() {
  const semId = document.getElementById('materi-sem-sel').value;
  const mks = getMatkuls().filter(m => m.semId === semId);
  const sel = document.getElementById('materi-matkul-sel');
  if (sel) sel.innerHTML = mks.map(m => `<option value="${m.id}">${escHtml(m.name)}</option>`).join('') || '<option value="">— Belum ada matkul —</option>';
  renderMateriAdminList();
}

function handleMateriPDF(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { pendingMateriPDF = { name: file.name, dataUrl: e.target.result }; document.getElementById('materi-pdf-name').textContent = file.name; };
  reader.readAsDataURL(file);
}

function saveMateri() {
  const semId = document.getElementById('materi-sem-sel').value;
  const matkulId = document.getElementById('materi-matkul-sel').value;
  const title = document.getElementById('materi-title').value.trim();
  const content = document.getElementById('materi-content').value.trim();
  if (!semId || !matkulId) { showErr('materi-err', 'Pilih semester & mata kuliah.'); return; }
  if (!title) { showErr('materi-err', 'Judul materi wajib diisi.'); return; }
  if (!content && !pendingMateriPDF) { showErr('materi-err', 'Isi konten teks atau upload PDF.'); return; }
  const matData = getMateri(); if (!matData[matkulId]) matData[matkulId] = [];
  const newMat = { id: uid(), title, content };
  if (pendingMateriPDF) { newMat.fileName = pendingMateriPDF.name; newMat.fileData = pendingMateriPDF.dataUrl; }
  matData[matkulId].push(newMat); setMateri(matData);
  document.getElementById('materi-title').value = '';
  document.getElementById('materi-content').value = '';
  document.getElementById('materi-pdf-name').textContent = '';
  document.getElementById('materi-pdf-input').value = '';
  pendingMateriPDF = null;
  renderMateriAdminList(); showToast('materi-toast');
  logActivity('Upload materi: ' + title);
}

function renderMateriAdminList() {
  const matkulId = document.getElementById('materi-matkul-sel') ? document.getElementById('materi-matkul-sel').value : '';
  const mats = matkulId ? (getMateri()[matkulId] || []) : [];
  const wrap = document.getElementById('materi-admin-list-wrap');
  if (!wrap) return;
  if (!matkulId) { wrap.innerHTML = ''; return; }
  if (mats.length === 0) { wrap.innerHTML = '<div class="empty-msg">Belum ada materi untuk mata kuliah ini.</div>'; return; }
  wrap.innerHTML = '<div class="section-title" style="margin-top:8px;">Materi yang tersimpan</div>' +
    mats.map(m => `<div class="q-list-item">
      <div class="q-list-num">${m.fileName ? '📄' : '📝'}</div>
      <div class="q-list-body">
        <div class="q-list-text" style="font-weight:600;">${escHtml(m.title)}</div>
        <div style="font-size:11px;color:var(--text2);">${m.fileName ? 'PDF: ' + escHtml(m.fileName) : 'Teks'}${m.content ? ' · ' + m.content.slice(0, 40) + '...' : ''}</div>
      </div>
      <div class="q-list-actions"><button class="btn-danger" onclick="deleteMateri('${m.id}','${matkulId}')">Hapus</button></div>
    </div>`).join('');
}

function deleteMateri(matId, matkulId) {
  if (!confirm('Hapus materi ini?')) return;
  const matData = getMateri(); matData[matkulId] = (matData[matkulId] || []).filter(m => m.id !== matId); setMateri(matData); renderMateriAdminList();
}

// ════════════════════════════════
// QUESTIONS ADMIN
// ════════════════════════════════
function updateQMatkulSel() {
  const semId = document.getElementById('q-sem-sel').value;
  const mks = getMatkuls().filter(m => m.semId === semId);
  const sel = document.getElementById('q-matkul-sel');
  if (sel) sel.innerHTML = mks.map(m => `<option value="${m.id}">${escHtml(m.name)}</option>`).join('') || '<option value="">— Belum ada matkul —</option>';
  renderQList();
}

function renderQList() {
  const matkulId = document.getElementById('q-matkul-sel') ? document.getElementById('q-matkul-sel').value : '';
  const qs = (matkulId && getQuestions()[matkulId]) || [];
  const container = document.getElementById('q-list-container');
  if (!container) return;
  if (!matkulId) { container.innerHTML = '<div class="empty-msg">Pilih semester & mata kuliah.</div>'; return; }
  if (qs.length === 0) { container.innerHTML = '<div class="empty-msg">Belum ada soal. Tambahkan via PDF atau form manual.</div>'; return; }
  const pg = qs.filter(q => q.type !== 'essay').length, es = qs.filter(q => q.type === 'essay').length;
  container.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
    <span style="font-size:11px;font-weight:700;font-family:var(--mono);color:var(--muted);text-transform:uppercase;letter-spacing:.08em;">${qs.length} soal</span>
    ${pg > 0 ? `<span class="q-type-chip chip-pg">${pg} PG</span>` : ''}
    ${es > 0 ? `<span class="q-type-chip chip-essay">${es} Esai</span>` : ''}
  </div>` +
    qs.map((q, i) => {
      const isEssay = q.type === 'essay';
      const chip = isEssay ? `<span class="q-type-chip chip-essay">Esai</span>` : `<span class="q-type-chip chip-pg">PG</span>`;
      return `<div class="q-list-item">
        <div class="q-list-num">${i + 1}</div>
        <div class="q-list-body">${chip}<div class="q-list-text">${escHtml(q.q)}</div></div>
        <div class="q-list-actions">
          <button class="btn-edit" onclick="openEditQ('${matkulId}','${q.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteQ('${matkulId}','${q.id}')">Hapus</button>
        </div>
      </div>`;
    }).join('');
}

function toggleQType() {
  const t = document.getElementById('new-q-type').value;
  document.getElementById('area-mcq').style.display = t === 'mcq' ? 'block' : 'none';
  document.getElementById('area-essay').style.display = t === 'essay' ? 'block' : 'none';
}

function toggleManualForm() {
  const h = document.getElementById('manual-toggle'), b = document.getElementById('manual-form-body');
  const open = b.classList.contains('open');
  h.classList.toggle('open', !open); b.classList.toggle('open', !open);
}

function addQuestion() {
  const matkulId = document.getElementById('q-matkul-sel').value;
  if (!matkulId) { alert('Pilih semester & mata kuliah terlebih dahulu.'); return; }
  const qType = document.getElementById('new-q-type').value;
  const qText = document.getElementById('new-q-text').value.trim();
  const tag = document.getElementById('new-q-tag').value.trim();
  const exp = document.getElementById('new-q-exp').value.trim();
  if (!qText) { alert('Pertanyaan wajib diisi.'); return; }
  let newQ = { id: uid(), type: qType, q: qText, tag, exp };
  if (qType === 'mcq') {
    const opts = [0, 1, 2, 3].map(i => document.getElementById(`opt${i}`).value.trim());
    if (opts.some(o => !o)) { alert('Semua pilihan ganda wajib diisi.'); return; }
    newQ.opts = opts; newQ.ans = parseInt(document.getElementById('new-q-ans').value);
  } else {
    const kw = document.getElementById('new-q-keywords').value;
    if (!kw) { alert('Kata kunci esai wajib diisi.'); return; }
    newQ.keywords = kw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    newQ.maxScore = parseInt(document.getElementById('new-q-maxscore').value) || 5;
  }
  const qsData = getQuestions(); if (!qsData[matkulId]) qsData[matkulId] = [];
  qsData[matkulId].push(newQ); setQuestions(qsData);
  clearQForm(); renderQList(); showToast('q-toast');
  logActivity('Tambah soal ' + qType);
}

function clearQForm() {
  document.getElementById('new-q-text').value = '';
  [0, 1, 2, 3].forEach(i => document.getElementById(`opt${i}`).value = '');
  document.getElementById('new-q-ans').value = '0';
  document.getElementById('new-q-keywords').value = '';
  document.getElementById('new-q-maxscore').value = '5';
  document.getElementById('new-q-tag').value = '';
  document.getElementById('new-q-exp').value = '';
}

function deleteQ(matkulId, qId) {
  if (!confirm('Hapus soal ini?')) return;
  const qsData = getQuestions(); qsData[matkulId] = (qsData[matkulId] || []).filter(q => q.id !== qId); setQuestions(qsData); renderQList();
}

function openEditQ(matkulId, qId) {
  const q = (getQuestions()[matkulId] || []).find(x => x.id === qId);
  if (!q) return;
  document.getElementById('edit-q-id').value = qId;
  document.getElementById('edit-q-matkulid').value = matkulId;
  document.getElementById('edit-q-type').value = q.type || 'mcq';
  document.getElementById('edit-q-text').value = q.q;
  if (q.type === 'essay') {
    document.getElementById('edit-area-mcq').style.display = 'none';
    document.getElementById('edit-area-essay').style.display = 'block';
    document.getElementById('eq-keywords').value = (q.keywords || []).join(', ');
    document.getElementById('eq-maxscore').value = q.maxScore || 5;
  } else {
    document.getElementById('edit-area-mcq').style.display = 'block';
    document.getElementById('edit-area-essay').style.display = 'none';
    (q.opts || []).forEach((o, i) => { document.getElementById(`eq-opt${i}`).value = o; });
    document.getElementById('eq-ans').value = q.ans;
  }
  document.getElementById('eq-tag').value = q.tag || '';
  document.getElementById('eq-exp').value = q.exp || '';
  openModal('modal-edit-q');
}

function saveEditQ() {
  const qId = document.getElementById('edit-q-id').value;
  const matkulId = document.getElementById('edit-q-matkulid').value;
  const qType = document.getElementById('edit-q-type').value;
  const qText = document.getElementById('edit-q-text').value.trim();
  if (!qText) { alert('Pertanyaan wajib diisi.'); return; }
  const qsData = getQuestions();
  const idx = (qsData[matkulId] || []).findIndex(q => q.id === qId);
  if (idx > -1) {
    let upd = { ...qsData[matkulId][idx], type: qType, q: qText, tag: document.getElementById('eq-tag').value.trim(), exp: document.getElementById('eq-exp').value.trim() };
    if (qType === 'essay') {
      const kw = document.getElementById('eq-keywords').value;
      if (!kw) { alert('Kata kunci esai wajib diisi.'); return; }
      upd.keywords = kw.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
      upd.maxScore = parseInt(document.getElementById('eq-maxscore').value) || 5;
    } else {
      const opts = [0, 1, 2, 3].map(i => document.getElementById(`eq-opt${i}`).value.trim());
      if (opts.some(o => !o)) { alert('Semua pilihan wajib diisi.'); return; }
      upd.opts = opts; upd.ans = parseInt(document.getElementById('eq-ans').value);
    }
    qsData[matkulId][idx] = upd; setQuestions(qsData);
  }
  closeModal('modal-edit-q'); renderQList();
}


// ════════════════════════════════
// PDF IMPORT
// ════════════════════════════════
async function processPDF(input) {
  const semId = document.getElementById('q-sem-sel').value;
  const matkulId = document.getElementById('q-matkul-sel').value;
  if (!semId || !matkulId) { alert('Pilih semester & mata kuliah terlebih dahulu!'); input.value = ''; return; }
  const file = input.files[0]; if (!file) return;
  try {
    const ab = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      txt += tc.items.map(it => it.str).join(' ') + ' ';
    }
    parseTextToQuestions(txt, matkulId);
  } catch (e) { console.error(e); showErr('pdf-err', 'Gagal membaca PDF.'); }
  input.value = '';
}

function parseTextToQuestions(text, matkulId) {
  const clean = text.replace(/\s+/g, ' ');
  let count = 0;
  const qsData = getQuestions();
  if (!qsData[matkulId]) qsData[matkulId] = [];
  const rMCQ = /Soal:\s*(.*?)\s*A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*D\.\s*(.*?)\s*Kunci:\s*([A-D])(?:\s*Penjelasan:\s*(.*?))?(?=\s*Soal:|\s*Esai:|$)/gi;
  let m;
  while ((m = rMCQ.exec(clean)) !== null) {
    const ai = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }[m[6].toUpperCase()] ?? 0;
    qsData[matkulId].push({ id: uid(), type: 'mcq', q: m[1].trim(), opts: [m[2].trim(), m[3].trim(), m[4].trim(), m[5].trim()], ans: ai, tag: 'Import PDF', exp: m[7] ? m[7].trim() : '' });
    count++;
  }
  const rEsai = /Esai:\s*(.*?)\s*Kata Kunci:\s*(.*?)\s*Bobot:\s*(\d+)(?:\s*Penjelasan:\s*(.*?))?(?=\s*Soal:|\s*Esai:|$)/gi;
  while ((m = rEsai.exec(clean)) !== null) {
    qsData[matkulId].push({ id: uid(), type: 'essay', q: m[1].trim(), keywords: m[2].trim().split(',').map(k => k.trim().toLowerCase()).filter(k => k), maxScore: parseInt(m[3]) || 5, tag: 'Import PDF', exp: m[4] ? m[4].trim() : '' });
    count++;
  }
  if (count > 0) {
    setQuestions(qsData); renderQList();
    const t = document.getElementById('pdf-toast');
    t.textContent = `${count} soal dari PDF berhasil ditambahkan!`;
    showToast('pdf-toast');
    logActivity('Import ' + count + ' soal dari PDF');
  } else {
    showErr('pdf-err', 'Gagal menemukan soal. Pastikan format Soal: atau Esai: sudah benar.');
  }
}

// ════════════════════════════════
// USERS (MONITORING)
// ════════════════════════════════
function refreshUsers() {
  const users = getUsers() || {};
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const entries = Object.entries(users);
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">Belum ada data pengguna.</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(([userId, data]) => {
    const quizzes = data.quizzes ? Object.values(data.quizzes) : [];
    const lastActive = data.lastActive ? new Date(data.lastActive).toLocaleString('id-ID') : '-';
    const avgScore = quizzes.length > 0 ? Math.round(quizzes.reduce((s, q) => s + (q.score || 0), 0) / quizzes.length) : 0;
    return `<tr>
      <td><code style="font-size:11px;color:var(--accent);">${userId.slice(0, 12)}...</code></td>
      <td>${lastActive}</td>
      <td>${quizzes.length}</td>
      <td><strong style="color:${avgScore >= 70 ? 'var(--green)' : avgScore >= 50 ? 'var(--yellow)' : 'var(--red)'}">${avgScore}%</strong></td>
      <td><button class="btn-edit" onclick="showUserDetail('${userId}')">Detail</button></td>
    </tr>`;
  }).join('');
}

function showUserDetail(userId) {
  const users = getUsers() || {};
  const data = users[userId];
  if (!data) return;
  document.getElementById('user-detail-sub').textContent = `User: ${userId.slice(0, 12)}... | Terakhir aktif: ${data.lastActive ? new Date(data.lastActive).toLocaleString('id-ID') : '-'}`;
  const quizzes = data.quizzes ? Object.values(data.quizzes) : [];
  const content = document.getElementById('user-detail-content');
  if (quizzes.length === 0) {
    content.innerHTML = '<div class="empty-msg">Belum ada riwayat quiz.</div>';
  } else {
    quizzes.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    content.innerHTML = quizzes.map(q => `<div class="user-quiz-item">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div class="uq-title">${escHtml(q.matkulName || 'Quiz')}</div>
          <div class="uq-meta">${q.tag ? escHtml(q.tag) + ' · ' : ''}${q.timestamp ? new Date(q.timestamp).toLocaleString('id-ID') : '-'} · ${q.totalQuestions || 0} soal</div>
        </div>
        <div class="uq-score" style="color:${(q.score || 0) >= 70 ? 'var(--green)' : (q.score || 0) >= 50 ? 'var(--yellow)' : 'var(--red)'}">${q.score || 0}%</div>
      </div>
    </div>`).join('');
  }
  openModal('modal-user-detail');
}

function clearUserData() {
  if (!confirm('Hapus semua data pengguna? Data ini tidak bisa dikembalikan.')) return;
  if (!confirm('Konfirmasi sekali lagi?')) return;
  setUsers({});
  refreshUsers();
  logActivity('Hapus semua data user');
}

// ════════════════════════════════
// TIMER SETTINGS
// ════════════════════════════════
function loadTimerSettings() {
  const t = getTimerSettings();
  document.getElementById('timer-enabled').checked = t.enabled;
  document.getElementById('timer-mode-select').value = t.mode || 'per_question';
  document.getElementById('timer-value').value = t.value || 60;
  document.getElementById('timer-config').style.display = t.enabled ? 'block' : 'none';
  document.getElementById('timer-mode-text').textContent = t.enabled ? 'Timer: Aktif' : 'Timer: Nonaktif';
  updateTimerPreview();
}

function toggleTimerMode() {
  const enabled = document.getElementById('timer-enabled').checked;
  document.getElementById('timer-config').style.display = enabled ? 'block' : 'none';
  document.getElementById('timer-mode-text').textContent = enabled ? 'Timer: Aktif' : 'Timer: Nonaktif';
}

function updateTimerPreview() {
  const mode = document.getElementById('timer-mode-select').value;
  const value = parseInt(document.getElementById('timer-value').value) || 60;
  const label = document.getElementById('timer-value-label');
  const preview = document.getElementById('timer-preview');
  if (mode === 'per_question') {
    label.textContent = 'Waktu per Soal (detik)';
    preview.innerHTML = `Dengan pengaturan ini, setiap soal memiliki <strong>${value} detik</strong> untuk dijawab. Jika waktu habis, soal otomatis dilewati.`;
  } else {
    label.textContent = 'Total Waktu (menit)';
    preview.innerHTML = `Dengan pengaturan ini, user memiliki <strong>${value} menit</strong> untuk menyelesaikan seluruh quiz. Jika waktu habis, jawaban otomatis dikumpulkan.`;
  }
}

function saveTimerSettings() {
  const enabled = document.getElementById('timer-enabled').checked;
  const mode = document.getElementById('timer-mode-select').value;
  const value = parseInt(document.getElementById('timer-value').value) || 60;
  setTimerSettings({ enabled, mode, value });
  _timerSettings = { enabled, mode, value };
  showToast('timer-toast');
  logActivity('Update timer: ' + (enabled ? mode + ' = ' + value : 'OFF'));
}

// ════════════════════════════════
// SETTINGS
// ════════════════════════════════
function changePw() {
  const old = document.getElementById('pw-old').value;
  const nw = document.getElementById('pw-new').value;
  const nw2 = document.getElementById('pw-new2').value;
  if (old !== getPw()) { showErr('pw-err', 'Password lama salah.'); return; }
  if (nw.length < 6) { showErr('pw-err', 'Password baru minimal 6 karakter.'); return; }
  if (nw !== nw2) { showErr('pw-err', 'Konfirmasi password tidak sama.'); return; }
  localStorage.setItem(LS_PW, nw);
  ['pw-old', 'pw-new', 'pw-new2'].forEach(id => document.getElementById(id).value = '');
  showToast('pw-toast');
}

function exportData() {
  const data = { semesters: getSemesters(), matkuls: getMatkuls(), questions: getQuestions(), materi: getMateri(), timerSettings: getTimerSettings(), users: getUsers() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'latsol-akp-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
}

function importData(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!confirm('Import akan mengganti semua data. Lanjutkan?')) return;
      if (data.semesters) setSemesters(data.semesters);
      if (data.matkuls) setMatkuls(data.matkuls);
      if (data.questions) setQuestions(data.questions);
      if (data.materi) setMateri(data.materi);
      if (data.timerSettings) setTimerSettings(data.timerSettings);
      if (data.users) setUsers(data.users);
      populateAdminSelects(); showPanel('overview');
      alert('Import berhasil!');
      logActivity('Import data dari backup');
    } catch { alert('Gagal membaca file.'); }
  };
  reader.readAsText(file); input.value = '';
}

function clearAllData() {
  if (!confirm('Hapus semua data secara permanen?')) return;
  if (!confirm('Konfirmasi sekali lagi? SEMUA DATA akan hilang.')) return;
  setSemesters([]); setMatkuls([]); setQuestions({}); setMateri({}); setUsers({});
  populateAdminSelects(); showPanel('overview');
  alert('Semua data berhasil dihapus.');
}

// ════════════════════════════════
// ACTIVITY LOG
// ════════════════════════════════
function logActivity(action) {
  db.ref('activityLog').push({
    action,
    timestamp: Date.now(),
    type: 'admin'
  });
}

// ════════════════════════════════
// INIT
// ════════════════════════════════
async function initApp() {
  buildEmojiPanels();

  // Load data from Firebase
  try {
    const snapshot = await db.ref('/').once('value');
    const data = snapshot.val();
    if (data) {
      _semesters = data.semesters || [];
      _matkuls = data.matkuls || [];
      _questions = data.questions || {};
      _materi = data.materi || {};
      _users = data.users || {};
      _timerSettings = data.timerSettings || { enabled: false, mode: 'per_question', value: 60 };
    }
  } catch (e) {
    console.error('Firebase load error:', e);
  }

  // Listen for realtime updates
  db.ref('semesters').on('value', snap => { _semesters = snap.val() || []; });
  db.ref('matkuls').on('value', snap => { _matkuls = snap.val() || []; });
  db.ref('questions').on('value', snap => { _questions = snap.val() || {}; });
  db.ref('materi').on('value', snap => { _materi = snap.val() || {}; });
  db.ref('users').on('value', snap => { _users = snap.val() || {}; });
  db.ref('timerSettings').on('value', snap => { _timerSettings = snap.val() || { enabled: false, mode: 'per_question', value: 60 }; });
}

initApp();
