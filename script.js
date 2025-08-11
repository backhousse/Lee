// Simple offline-first agenda with localStorage + PWA shell.
// - Vertical list of days
// - Each day shows 3 tasks preview
// - Click a day to expand and edit 3 tasks + notes
// - Save button persists to localStorage
// - Drag-to-scroll for desktop (mobile scrolls naturally)
// - Export/Import JSON

const SCROLL_CONTAINER = document.getElementById('scrollContainer');
const DAY_TMPL = document.getElementById('dayTemplate');
const EXPORT_BTN = document.getElementById('exportBtn');
const IMPORT_INPUT = document.getElementById('importInput');
const INSTALL_BTN = document.getElementById('installBtn');

const STORAGE_KEY = 'calendar_mvp_v1';

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

// ---- Render Days (lazy-ish) ----
let startDate = new Date(); // today
startDate.setHours(0,0,0,0);
let daysRenderedBefore = 30; // render 30 days before today
let daysRenderedAfter = 90;  // render 90 days after today

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

  // Expand/Collapse logic
  node.querySelector('.day-header').addEventListener('click', () => {
    document.querySelectorAll('.day.expanded').forEach(d => d.classList.remove('expanded'));
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
    // Tiny feedback
    node.style.transform = 'scale(0.995)';
    setTimeout(()=> node.style.transform = '', 120);
  });

  return node;
}

function renderInitial() {
  // Render past days
  for (let i=daysRenderedBefore; i>=1; i--) {
    const d = new Date(startDate);
    d.setDate(d.getDate() - i);
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
  // Today onward
  for (let i=0; i<=daysRenderedAfter; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
}
renderInitial();

// Lazy extend when near bottom/top
SCROLL_CONTAINER.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = SCROLL_CONTAINER;
  if (scrollTop + clientHeight > scrollHeight - 800) {
    // add 60 more days after
    const current = new Date(startDate);
    for (let i=daysRenderedAfter+1; i<=daysRenderedAfter+60; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      SCROLL_CONTAINER.appendChild(createDay(d));
    }
    daysRenderedAfter += 60;
  }
  if (scrollTop < 400) {
    // prepend 30 more days before
    const frag = document.createDocumentFragment();
    for (let i=daysRenderedBefore+30; i>daysRenderedBefore; i--) {
      const d = new Date(startDate);
      d.setDate(d.getDate() - i);
      frag.appendChild(createDay(d));
    }
    SCROLL_CONTAINER.prepend(frag);
    daysRenderedBefore += 30;
    // keep view roughly stable
    SCROLL_CONTAINER.scrollTop = scrollTop + 1;
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

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
