const SCROLL_CONTAINER = document.getElementById('scrollContainer');
const DAY_TMPL = document.getElementById('dayTemplate');
const EXPORT_BTN = document.getElementById('exportBtn');
const IMPORT_INPUT = document.getElementById('importInput');
const INSTALL_BTN = document.getElementById('installBtn');
const TODAY_BTN = document.getElementById('todayBtn');
const COLLAPSE_ALL_BTN = document.getElementById('collapseAllBtn');

const MIN_DATE = new Date('2025-08-01T00:00:00');
const STORAGE_KEY = 'calendar_mvp_v3';

// Reward sound
let audioCtx = null;
function ensureAudio(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); }
function rewardSound(){
  ensureAudio();
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
  notes.forEach((freq, i)=>{
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    const t = now + i*0.07;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t+0.22);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t+0.25);
  });
}

// Utils
function ymd(d){ const yr=d.getFullYear(); const mo=String(d.getMonth()+1).padStart(2,'0'); const da=String(d.getDate()).padStart(2,'0'); return `${yr}-${mo}-${da}`; }
function fmtLong(d){ return d.toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' }); }
function loadAll(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); } catch{ return {}; } }
function saveAll(map){ localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); }
function getDayData(key){ const all=loadAll(); return all[key] || { tasks:["","",""], notes:"" }; }
function setDayData(key,data){ const all=loadAll(); all[key]=data; saveAll(all); }

// Sizing
function applySizing(section, notesText, tasks){
  const len = notesText.length;
  let titleSize = 16;
  let notesSize = 14;
  if (len > 140) { titleSize = 15; notesSize = 13; }
  if (len > 300) { titleSize = 14; notesSize = 12; }
  if (len > 600) { titleSize = 13; notesSize = 11.5; }
  section.style.setProperty('--title-size', titleSize+'px');
  section.style.setProperty('--notes-size', notesSize+'px');
  const taskLen = (tasks.join('')).length;
  let taskSize = 12;
  if (taskLen > 60) taskSize = 11.5;
  if (taskLen > 120) taskSize = 11;
  if (taskLen > 220) taskSize = 10.5;
  section.style.setProperty('--task-font', taskSize+'px');
}

// Today with lower bound
let today = new Date();
today.setHours(0,0,0,0);
if (today < MIN_DATE) today = new Date(MIN_DATE);

// Initial window
const initialAfterDays = 120;
let daysRenderedBefore = Math.min(30, Math.floor((today - MIN_DATE)/(1000*60*60*24)));
let daysRenderedAfter = initialAfterDays;

// Create tile
function createDay(dateObj){
  const key = ymd(dateObj);
  const node = DAY_TMPL.content.firstElementChild.cloneNode(true);
  node.dataset.date = key;

  const titleEl = node.querySelector('.day-title');
  const notesPrev = node.querySelector('.notes-preview');
  const h1 = node.querySelector('.hover-tasks .htask1');
  const h2 = node.querySelector('.hover-tasks .htask2');
  const h3 = node.querySelector('.hover-tasks .htask3');

  const data = getDayData(key);
  const [t1,t2,t3] = data.tasks;
  titleEl.textContent = fmtLong(dateObj);
  notesPrev.textContent = data.notes || '—';
  h1.textContent = t1 || '—';
  h2.textContent = t2 || '—';
  h3.textContent = t3 || '—';

  node.querySelectorAll('.task-input').forEach((inp,i)=> inp.value = data.tasks[i] || '');
  node.querySelector('.notes-input').value = data.notes || '';

  applySizing(node, data.notes||'', data.tasks||["","",""]);

  const header = node.querySelector('.day-header');
  header.addEventListener('click', ()=>{
    document.querySelectorAll('.day.expanded').forEach(d=>{ if(d!==node) d.classList.remove('expanded'); });
    node.classList.toggle('expanded');
  });
  node.querySelector('.collapse-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    node.classList.remove('expanded');
  });

  node.querySelector('.save-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    const newTasks = Array.from(node.querySelectorAll('.task-input')).map(i=>i.value.trim());
    const newNotes = node.querySelector('.notes-input').value;
    setDayData(key, { tasks:newTasks, notes:newNotes });
    notesPrev.textContent = newNotes || '—';
    node.querySelector('.hover-tasks .htask1').textContent = newTasks[0] || '—';
    node.querySelector('.hover-tasks .htask2').textContent = newTasks[1] || '—';
    node.querySelector('.hover-tasks .htask3').textContent = newTasks[2] || '—';
    applySizing(node, newNotes, newTasks);
    rewardSound();
  });

  return node;
}

// Render initial
function renderInitial(){
  for (let i=daysRenderedBefore; i>=1; i--){
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (d < MIN_DATE) continue;
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
  for (let i=0; i<=daysRenderedAfter; i++){
    const d = new Date(today); d.setDate(d.getDate() + i);
    SCROLL_CONTAINER.appendChild(createDay(d));
  }
}
renderInitial();

// Labels
const minLabel = document.getElementById('minDateLabel');
const maxLabel = document.getElementById('maxDateLabel');
minLabel.textContent = new Date(MIN_DATE).toLocaleDateString();
let maxRenderedDate = new Date(today); maxRenderedDate.setDate(maxRenderedDate.getDate() + daysRenderedAfter);
maxLabel.textContent = maxRenderedDate.toLocaleDateString();

// Lazy load with guards
let isAppending = false;
let isPrepending = false;
SCROLL_CONTAINER.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = SCROLL_CONTAINER;
  // append
  if (!isAppending && scrollTop + clientHeight > scrollHeight - 800){
    isAppending = true;
    const add = 60;
    const frag = document.createDocumentFragment();
    for (let i=daysRenderedAfter+1; i<=daysRenderedAfter+add; i++){
      const d = new Date(today); d.setDate(d.getDate() + i);
      frag.appendChild(createDay(d));
    }
    SCROLL_CONTAINER.appendChild(frag);
    daysRenderedAfter += add;
    maxRenderedDate = new Date(today); maxRenderedDate.setDate(maxRenderedDate.getDate()+daysRenderedAfter);
    maxLabel.textContent = maxRenderedDate.toLocaleDateString();
    isAppending = false;
  }
  // prepend
  if (!isPrepending && scrollTop < 400){
    const first = SCROLL_CONTAINER.querySelector('.day');
    if (first){
      const firstDate = new Date(first.dataset.date+'T00:00:00');
      const prev = new Date(firstDate); prev.setDate(prev.getDate()-1);
      if (prev >= MIN_DATE){
        isPrepending = true;
        const prevHeight = SCROLL_CONTAINER.scrollHeight;
        const add = 30;
        const frag = document.createDocumentFragment();
        for (let i=add; i>=1; i--){
          const d = new Date(firstDate); d.setDate(d.getDate()-i);
          if (d < MIN_DATE) continue;
          frag.appendChild(createDay(d));
        }
        SCROLL_CONTAINER.prepend(frag);
        const newHeight = SCROLL_CONTAINER.scrollHeight;
        SCROLL_CONTAINER.scrollTop = scrollTop + (newHeight - prevHeight);
        isPrepending = false;
      }
    }
  }
});

// desktop drag-to-scroll (mobile uses native)
let isDown=false, startY=0, scrollStart=0;
SCROLL_CONTAINER.addEventListener('mousedown', (e)=>{
  isDown = true;
  SCROLL_CONTAINER.classList.add('dragging');
  startY = e.pageY - SCROLL_CONTAINER.offsetTop;
  scrollStart = SCROLL_CONTAINER.scrollTop;
});
window.addEventListener('mouseup', ()=>{ isDown=false; SCROLL_CONTAINER.classList.remove('dragging'); });
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
  const a = document.createElement('a'); a.href = url; a.download = 'my-calendar-export.json'; a.click(); URL.revokeObjectURL(url);
});
IMPORT_INPUT.addEventListener('change', (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(String(reader.result));
      saveAll(json);
      document.querySelectorAll('.day').forEach(section=>{
        const key = section.dataset.date;
        const data = getDayData(key);
        section.querySelector('.notes-preview').textContent = data.notes || '—';
        const [t1,t2,t3] = data.tasks || ["","",""];
        section.querySelector('.htask1').textContent = t1 || '—';
        section.querySelector('.htask2').textContent = t2 || '—';
        section.querySelector('.htask3').textContent = t3 || '—';
        section.querySelectorAll('.task-input').forEach((inp,i)=> inp.value = data.tasks?.[i] || '');
        section.querySelector('.notes-input').value = data.notes || '';
        applySizing(section, data.notes||'', data.tasks||["","",""]);
      });
      alert('Import complete!');
    } catch (err) { alert('Import failed: invalid file.'); }
  };
  reader.readAsText(file);
});

// Install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; INSTALL_BTN.style.display='inline-block'; });
INSTALL_BTN.addEventListener('click', async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null; INSTALL_BTN.style.display='none';
});

TODAY_BTN.addEventListener('click', ()=>{
  const todayKey = ymd(today);
  const el = document.querySelector(`[data-date="${todayKey}"]`);
  if (el) el.scrollIntoView({behavior:'smooth', block:'center'});
});
COLLAPSE_ALL_BTN.addEventListener('click', ()=> document.querySelectorAll('.day.expanded').forEach(d=>d.classList.remove('expanded')) );

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
