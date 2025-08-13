// v3 fixed2 full: start 2025-08-01, end 2027-12-31, notes in tile, hover tasks, reward sound.

const MIN_DATE = new Date('2025-08-01T00:00:00');
const MAX_DATE = new Date('2027-12-31T23:59:59');
const STORAGE_KEY = 'locked_in_calendar_v3_fixed2_full';

const SCROLL_CONTAINER = document.getElementById('scrollContainer');
const DAY_TMPL = document.getElementById('dayTemplate');
const EXPORT_BTN = document.getElementById('exportBtn');
const IMPORT_INPUT = document.getElementById('importInput');
const INSTALL_BTN = document.getElementById('installBtn');
const TODAY_BTN = document.getElementById('todayBtn');
const COLLAPSE_ALL_BTN = document.getElementById('collapseAllBtn');
const MIN_LABEL = document.getElementById('minDateLabel');
const MAX_LABEL = document.getElementById('maxDateLabel');

// ----- Audio -----
let audioCtx;
function ac(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); if(audioCtx.state==='suspended') audioCtx.resume(); return audioCtx; }
function hoverSound(){ const ctx=ac(); const t=ctx.currentTime; const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(680,t); o.frequency.exponentialRampToValueAtTime(420,t+0.12); g.gain.setValueAtTime(0.03,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.15); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+0.16); }
function clickSound(){ const ctx=ac(); const t=ctx.currentTime; const o=ctx.createOscillator(), g=ctx.createGain(); o.type='square'; o.frequency.setValueAtTime(900,t); g.gain.setValueAtTime(0.05,t); g.gain.exponentialRampToValueAtTime(0.0001,t+0.06); o.connect(g).connect(ctx.destination); o.start(t); o.stop(t+0.07); }
function rewardSound(){ const ctx=ac(); const t0=ctx.currentTime; [523.25,659.25,783.99,1046.5].forEach((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(f,t0+i*0.07); g.gain.setValueAtTime(0.0001,t0+i*0.07); g.gain.exponentialRampToValueAtTime(0.06,t0+i*0.07+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t0+i*0.07+0.28); o.connect(g).connect(ctx.destination); o.start(t0+i*0.07); o.stop(t0+i*0.07+0.3); }); }
document.addEventListener('pointerdown', ac);

// ----- Utils -----
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtLong(d){return d.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
function loadAll(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}catch{return{}}}
function saveAll(m){localStorage.setItem(STORAGE_KEY, JSON.stringify(m))}
function getDayData(k){const a=loadAll(); return a[k] || {tasks:["","",""], notes:""};}
function setDayData(k,d){const a=loadAll(); a[k]=d; saveAll(a);}
function applySizing(node, notesText, tasksArr){ const n=(notesText||'').length; const tl=(tasksArr.join(' ')||'').length; let title=16, notes=14, tf=12; if(n>300){notes=13; title=15;} if(n>700){notes=12; title=14;} if(n>1200){notes=11; title=13;} if(tl>80) tf=11; if(tl>160) tf=10; if(tl>240) tf=9; node.style.setProperty('--title-size', title+'px'); node.style.setProperty('--notes-size', notes+'px'); node.style.setProperty('--task-font', tf+'px'); }

// ----- Bounds & initial dates -----
let today = new Date(); today.setHours(0,0,0,0);
if (today < MIN_DATE) today = new Date(MIN_DATE);
if (today > MAX_DATE) today = new Date(MAX_DATE);
MIN_LABEL.textContent = MIN_DATE.toLocaleDateString();
MAX_LABEL.textContent = MAX_DATE.toLocaleDateString();

const initialAfterDays = 120;
let daysBeforeAvail = Math.floor((today - MIN_DATE)/(24*60*60*1000));
let daysRenderedBefore = Math.max(0, Math.min(30, daysBeforeAvail));
let daysRenderedAfter = initialAfterDays;

// ----- Rendering -----
function createDay(dateObj){
  if (dateObj < MIN_DATE || dateObj > MAX_DATE) return null;
  const key = ymd(dateObj);
  const node = DAY_TMPL.content.firstElementChild.cloneNode(true);
  node.dataset.date = key;
  node.querySelector('.day-title').textContent = fmtLong(dateObj);

  const data = getDayData(key);
  const [t1,t2,t3] = data.tasks;
  const notes = data.notes || "";

  node.querySelector('.notes-preview').textContent = notes || "—";
  node.querySelector('.htask1').textContent = t1 || "Task 1: —";
  node.querySelector('.htask2').textContent = t2 || "Task 2: —";
  node.querySelector('.htask3').textContent = t3 || "Task 3: —";
  node.querySelectorAll('.task-input').forEach((inp,i)=> inp.value = data.tasks[i] || "");
  node.querySelector('.notes-input').value = notes;
  applySizing(node, notes, [t1,t2,t3]);

  const header = node.querySelector('.day-header');
  let lastHover = 0;
  header.addEventListener('mouseenter', ()=>{ const now=performance.now(); if(now-lastHover>160){ lastHover=now; hoverSound(); } });
  header.addEventListener('click', ()=>{ clickSound(); document.querySelectorAll('.day.expanded').forEach(d=>{ if(d!==node) d.classList.remove('expanded'); }); node.classList.toggle('expanded'); });
  node.querySelector('.collapse-btn').addEventListener('click', (e)=>{ e.stopPropagation(); node.classList.remove('expanded'); });

  node.querySelector('.save-btn').addEventListener('click', (e)=>{
    e.stopPropagation();
    const newTasks = Array.from(node.querySelectorAll('.task-input')).map(i=>i.value.trim());
    const newNotes = node.querySelector('.notes-input').value;
    setDayData(key, { tasks: newTasks, notes: newNotes });
    node.querySelector('.notes-preview').textContent = newNotes || "—";
    node.querySelector('.htask1').textContent = newTasks[0] || "Task 1: —";
    node.querySelector('.htask2').textContent = newTasks[1] || "Task 2: —";
    node.querySelector('.htask3').textContent = newTasks[2] || "Task 3: —";
    applySizing(node, newNotes, newTasks);
    node.style.transform='scale(0.997)'; setTimeout(()=> node.style.transform='', 130);
    rewardSound();
  });

  return node;
}

function renderInitial(){
  for(let i=daysRenderedBefore; i>=1; i--){
    const d = new Date(today); d.setDate(d.getDate()-i);
    const el = createDay(d); if(el) SCROLL_CONTAINER.appendChild(el);
  }
  for(let i=0; i<=daysRenderedAfter; i++){
    const d = new Date(today); d.setDate(d.getDate()+i);
    const el = createDay(d); if(el) SCROLL_CONTAINER.appendChild(el);
  }
}
renderInitial();

// Lazy extend (bounded)
let isAppending=false, isPrepending=false;
SCROLL_CONTAINER.addEventListener('scroll', ()=>{
  const {scrollTop, scrollHeight, clientHeight} = SCROLL_CONTAINER;

  if(!isAppending && scrollTop + clientHeight > scrollHeight - 800){
    const last = SCROLL_CONTAINER.querySelector('.day:last-of-type');
    if(last){
      const lastDate = new Date(last.dataset.date + 'T00:00:00');
      if(lastDate < MAX_DATE){
        isAppending = true;
        const frag = document.createDocumentFragment();
        for(let add=1; add<=60; add++){
          const d = new Date(lastDate); d.setDate(d.getDate()+add);
          if(d > MAX_DATE) break;
          const el = createDay(d); if(el) frag.appendChild(el);
        }
        SCROLL_CONTAINER.appendChild(frag);
        isAppending = false;
      }
    }
  }

  if(!isPrepending && scrollTop < 400){
    const first = SCROLL_CONTAINER.querySelector('.day');
    if(first){
      const firstDate = new Date(first.dataset.date + 'T00:00:00');
      if(firstDate > MIN_DATE){
        isPrepending = true;
        const prevHeight = SCROLL_CONTAINER.scrollHeight;
        const frag = document.createDocumentFragment();
        for(let add=30; add>=1; add--){
          const d = new Date(firstDate); d.setDate(d.getDate()-add);
          if(d < MIN_DATE) continue;
          const el = createDay(d); if(el) frag.appendChild(el);
        }
        SCROLL_CONTAINER.prepend(frag);
        const newHeight = SCROLL_CONTAINER.scrollHeight;
        SCROLL_CONTAINER.scrollTop = scrollTop + (newHeight - prevHeight);
        isPrepending = false;
      }
    }
  }
});

// Drag to scroll (desktop)
let isDown=false, startY=0, scrollStart=0;
SCROLL_CONTAINER.addEventListener('mousedown', (e)=>{
  isDown=true; SCROLL_CONTAINER.classList.add('dragging');
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
  const a = document.createElement('a');
  a.href = url; a.download = 'my-calendar-export.json'; a.click();
  URL.revokeObjectURL(url);
});
IMPORT_INPUT.addEventListener('change', (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try {
      const json = JSON.parse(String(reader.result));
      saveAll(json);
      document.querySelectorAll('.day').forEach(section => {
        const k = section.dataset.date;
        const data = getDayData(k);
        const [t1,t2,t3] = data.tasks || ["","",""];
        section.querySelector('.notes-preview').textContent = data.notes || "—";
        section.querySelector('.htask1').textContent = t1 || "Task 1: —";
        section.querySelector('.htask2').textContent = t2 || "Task 2: —";
        section.querySelector('.htask3').textContent = t3 || "Task 3: —";
        section.querySelectorAll('.task-input').forEach((inp,i)=> inp.value = data.tasks?.[i] || "");
        const notesArea = section.querySelector('.notes-input'); if (notesArea) notesArea.value = data.notes || "";
        applySizing(section, data.notes || "", [t1,t2,t3]);
      });
      alert('Import complete!');
    } catch { alert('Import failed: invalid file.'); }
  };
  reader.readAsText(file);
});

// PWA
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js')); }

// Buttons
TODAY_BTN.addEventListener('click', ()=>{
  const k = ymd(today);
  const el = document.querySelector(`[data-date="${k}"]`);
  if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); el.classList.add('expanded'); setTimeout(()=> el.classList.remove('expanded'), 1200); }
});
COLLAPSE_ALL_BTN.addEventListener('click', ()=> document.querySelectorAll('.day.expanded').forEach(d=>d.classList.remove('expanded')));

// Debug
console.log('Bounds:', MIN_DATE.toISOString(), '→', MAX_DATE.toISOString());
const firstEl = SCROLL_CONTAINER.querySelector('.day');
if(firstEl) console.log('First rendered:', firstEl.dataset.date);
const lastEl = SCROLL_CONTAINER.querySelector('.day:last-of-type');
if(lastEl) console.log('Last rendered:', lastEl.dataset.date);
