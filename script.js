// Offline-first vertical agenda (v2)
// Changes:
// - Lower bound: no days before 2025-08-01
// - Stronger lazy-load guards to avoid runaway/infinite behavior
// - Preserve scroll position when prepending
// - Redesigned UI + animations
// - Hover/click sounds via WebAudio

const SCROLL_CONTAINER = document.getElementById('scrollContainer');
const DAY_TMPL = document.getElementById('dayTemplate');
const EXPORT_BTN = document.getElementById('exportBtn');
const IMPORT_INPUT = document.getElementById('importInput');
const INSTALL_BTN = document.getElementById('installBtn');
const TODAY_BTN = document.getElementById('todayBtn');
const COLLAPSE_ALL_BTN = document.getElementById('collapseAllBtn');

const MIN_DATE = new Date('2025-08-01T00:00:00'); // lower bound
const STORAGE_KEY = 'calendar_mvp_v2';

// ---- WebAudio tiny sfx ----
let audioCtx = null;
let lastHoverTime = 0;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playBubble() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(650, now);
  o.frequency.exponentialRampToValueAtTime(360, now + 0.12);
  g.gain.setValueAtTime(0.05, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
  o.connect(g).connect(audioCtx.destination);
  o.start(now);
  o.stop(now + 0.15);
}
function playClick() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(900, now);
  g.gain.setValueAtTime(0.06, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  o.connect(g).connect(audioCtx.destination);
  o.start(now);
  o.stop(now + 0.07);
}
document.addEventListener('pointerdown', ensureAudio); // user gesture unlock

// ---- Utilities ----
function ymd(d) {
  const yr = d.getFullYear();
  const mo = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${yr}-${mo}-${da}`;
}
function fmtLong(d) {
  return d.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
}
function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}
function saveAll(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}
function getDayData(key) {
  const all = loadAll();
  return all[key] || { tasks: ["","",""], notes:"" };
}
function setDayData(key, data) {
  const all = loadAll();
  all[key] = data;
  saveAll(all);
}

// ---- Bounds & initial range ----
let today = new Date();
today.setHours(0,0,0,0);
if (today < MIN_DATE) today = new Date(MIN_DATE);

const initialAfterDays = 120; // how many after today to render initially
let daysRenderedBefore = Math.round((today - MIN_DATE) / (1000*60*60*24)); // how many can exist before
if (daysRenderedBefore > 30) daysRenderedBefore = 30; // render at most 30 before today initially
let daysRenderedAfter = initialAfterDays;

// ---- Render ----
function createDay(dateObj) {
  const key = ymd(dateObj);
  const node = DAY_TMPL.content.firstElementChild.cloneNode(true);
  node.dataset.date = key;

  // Header
  const title = node.querySelector('.day-title');
  title.textContent = fmtLong(dateObj);

  // Load data
  const data = getDayData(key);
  const [t1,t2,t3] = data.tasks;

  node.querySelector('.pill.task1').textContent = t1 || '—';
  node.querySelector('.pill.task2').textContent = t2 || '—';
  node.querySelector('.pill.task3').textContent = t3 || '—';

  // Body inputs
  const inputs = node.querySelectorAll('.task-input');
  inputs.forEach((inp,i)=> { inp.value = data.tasks[i] || ""; });

  const notes = node.querySelector('.notes-input');
  notes.value = data.notes || "";

  // Sounds
  const header = node.querySelector('.day-header');
  header.addEventListener('mouseenter', () => {
    const now = performance.now();
    if (now - lastHoverTime > 160) {
      lastHoverTime = now;
      playBubble();
    }
  });
  header.addEventListener('click', () => playClick());

  // Expand/Collapse logic
  header.addEventListener('click', () => {
    document.querySelectorAll('.day.expanded').forEach(d => {
      if (d !== node) d.classList.remove('expanded');
    });
    node.classList.toggle('expanded');
  });
  node.querySelector('.collapse-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    node.classList.remove('expanded');
  });

  // Save
  node.querySelector('.save-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    const newTasks = Array.from(node.querySelectorAll('.task-input')).map(i=>i.value.trim());
    const newNotes = node.querySelector('.notes-input').value;
    setDayData(key, { tasks: newTasks, notes: newNotes });
    node.querySelector('.pill.task1').textContent = newTasks[0] || '—';
    node.querySelector('.pill.task2').textContent = newTasks[1] || '—';
    node.querySelector('.pill.task3').textContent = newTasks[2] || '—';
    node.style.transform = 'scale(0.997)';
    setTimeout(()=> node.style.transform = '', 120);
    playClick();
  });

  return node;
}

function renderInitial() {
  // Past days (but not before MIN_DATE)
  for (let i=daysRenderedBefore; i>=1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (d < MIN_DATE) continue;
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
  // Today onward
  for (let i=0; i<=daysRenderedAfter; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
}
renderInitial();

// Labels for bounds
const minLabel = document.getElementById('minDateLabel');
const maxLabel = document.getElementById('maxDateLabel');
minLabel.textContent = new Date(MIN_DATE).toLocaleDateString();
let maxRenderedDate = new Date(today); maxRenderedDate.setDate(maxRenderedDate.getDate() + daysRenderedAfter);
maxLabel.textContent = maxRenderedDate.toLocaleDateString();

// Lazy extend when near bottom/top, with guards
let isAppending = false;
let isPrepending = false;

SCROLL_CONTAINER.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = SCROLL_CONTAINER;

  // Append (bottom)
  if (!isAppending && scrollTop + clientHeight > scrollHeight - 800) {
    isAppending = true;
    const prevMax = daysRenderedAfter;
    const addCount = 60;
    const frag = document.createDocumentFragment();
    for (let i=prevMax+1; i<=prevMax+addCount; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      frag.appendChild(createDay(d));
    }
    SCROLL_CONTAINER.appendChild(frag);
    daysRenderedAfter += addCount;
    maxRenderedDate = new Date(today); maxRenderedDate.setDate(maxRenderedDate.getDate() + daysRenderedAfter);
    maxLabel.textContent = maxRenderedDate.toLocaleDateString();
    isAppending = false;
  }

  // Prepend (top), but never before MIN_DATE
  if (!isPrepending && scrollTop < 400) {
    // Can we actually add more before?
    const firstRendered = SCROLL_CONTAINER.querySelector('.day');
    if (firstRendered) {
      const firstDate = new Date(firstRendered.dataset.date + 'T00:00:00');
      const nextDate = new Date(firstDate);
      nextDate.setDate(firstDate.getDate() - 1);
      if (nextDate >= MIN_DATE) {
        isPrepending = true;
        const prevHeight = SCROLL_CONTAINER.scrollHeight;
        const addCount = 30;
        const frag = document.createDocumentFragment();
        for (let i=addCount; i>=1; i--) {
          const d = new Date(firstDate);
          d.setDate(firstDate.getDate() - i);
          if (d < MIN_DATE) continue;
          frag.appendChild(createDay(d));
        }
        SCROLL_CONTAINER.prepend(frag);
        // Preserve scroll position relative to content
        const newHeight = SCROLL_CONTAINER.scrollHeight;
        SCROLL_CONTAINER.scrollTop = scrollTop + (newHeight - prevHeight);
        isPrepending = false;
      }
    }
  }
});

// Desktop drag-to-scroll
let isDown = false;
let startY;
let scrollStart;
SCROLL_CONTAINER.addEventListener('mousedown', (e)=>{
  isDown = true;
  SCROLL_CONTAINER.classList.add('dragging');
  startY = e.pageY - SCROLL_CONTAINER.offsetTop;
  scrollStart = SCROLL_CONTAINER.scrollTop;
});
window.addEventListener('mouseup', ()=>{
  isDown = false;
  SCROLL_CONTAINER.classList.remove('dragging');
});
SCROLL_CONTAINER.addEventListener('mousemove', (e)=>{
  if(!isDown) return;
  e.preventDefault();
  const y = e.pageY - SCROLL_CONTAINER.offsetTop;
  const walk = (y - startY) * 1.2;
  SCROLL_CONTAINER.scrollTop = scrollStart - walk;
});

// Export / Import
EXPORT_BTN.addEventListener('click', ()=>{
  const data = loadAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-calendar-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

IMPORT_INPUT.addEventListener('change', (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      saveAll(json);
      // refresh preview text chips
      document.querySelectorAll('.day').forEach(section => {
        const key = section.dataset.date;
        const data = getDayData(key);
        const [t1,t2,t3] = data.tasks || ["","",""];
        section.querySelector('.pill.task1').textContent = t1 || '—';
        section.querySelector('.pill.task2').textContent = t2 || '—';
        section.querySelector('.pill.task3').textContent = t3 || '—';
        section.querySelectorAll('.task-input').forEach((inp,i)=>{ inp.value = data.tasks?.[i] || ""; });
        const notes = section.querySelector('.notes-input');
        if (notes) notes.value = data.notes || "";
      });
      alert('Import complete!');
    } catch (err) {
      alert('Import failed: invalid file.');
    }
  };
  reader.readAsText(file);
});

// PWA install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  INSTALL_BTN.style.display = 'inline-block';
});
INSTALL_BTN.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  INSTALL_BTN.style.display = 'none';
});

// Helpers
TODAY_BTN.addEventListener('click', ()=>{
  const todayKey = ymd(today);
  const el = document.querySelector(`[data-date="${todayKey}"]`);
  if (el) {
    el.scrollIntoView({ behavior:'smooth', block:'center' });
    el.classList.add('expanded');
    setTimeout(()=> el.classList.remove('expanded'), 1500); // pulse
  }
});
COLLAPSE_ALL_BTN.addEventListener('click', ()=>{
  document.querySelectorAll('.day.expanded').forEach(d => d.classList.remove('expanded'));
});

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
