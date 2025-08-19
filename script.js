// ----- Utilities -----
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = n => "₹" + Number(n || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});

// Storage key
const KEY = 'finexpress:transactions:v1';

// ----- State -----
let tx = load();

function load(){
  try { return JSON.parse(localStorage.getItem(KEY)) || []; }
  catch { return []; }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(tx)); }

// ----- Views / Navigation -----
$$('.nav .link').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.nav .link').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const view = btn.dataset.view;
    $$('.view').forEach(v=>v.classList.remove('active'));
    $('#view-' + view).classList.add('active');
    if(view==='transactions'){ renderAll(); }
  });
});
$('#year').textContent = new Date().getFullYear();

// ----- Add Transaction -----
$('#tx-form').addEventListener('submit', e=>{
  e.preventDefault();
  const date = $('#tx-date').value || new Date().toISOString().slice(0,10);
  const note = $('#tx-note').value.trim();
  const type = $('#tx-type').value;
  const category = $('#tx-category').value;
  const amount = parseFloat($('#tx-amount').value);

  if(!note || !amount || amount <= 0){ alert('Enter a valid note and amount'); return; }

  tx.push({ id: crypto.randomUUID(), date, type, category, note, amount });
  save();
  e.target.reset();
  // Keep selected type/category for convenience
  $('#tx-type').value = type; $('#tx-category').value = category;

  render();
});

// ----- Filters -----
$('#clear-filters').addEventListener('click', ()=>{
  $('#filter-month').value = '';
  $('#filter-category').value = '';
  render();
});

// ----- Export CSV -----
$('#btn-export').addEventListener('click', ()=>{
  const header = 'date,type,category,note,amount';
  const lines = tx.map(t => [t.date, t.type, t.category, safeCSV(t.note), t.amount].join(','));
  const csv = [header, ...lines].join('\n');
  download('finexpress_export.csv', csv, 'text/csv');
});

function safeCSV(s){ return '"' + String(s).replaceAll('"','""') + '"'; }

function download(filename, content, type){
  const blob = new Blob([content], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ----- Import CSV -----
$('#btn-import').addEventListener('click', ()=>{
  const file = $('#file-input').files[0];
  if(!file){ alert('Choose a CSV file first.'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const lines = reader.result.split(/\r?\n/).filter(Boolean);
    const header = lines.shift().trim().toLowerCase();
    if(header !== 'date,type,category,note,amount'){ alert('Invalid CSV header'); return; }
    let added = 0;
    for(const line of lines){
      const parts = parseCSV(line);
      if(parts.length < 5) continue;
      const [date,type,category,note,amountStr] = parts;
      const amount = parseFloat(amountStr);
      if(!date || !['income','expense'].includes(type) || !amount) continue;
      tx.push({ id: crypto.randomUUID(), date, type, category, note, amount });
      added++;
    }
    save();
    render();
    alert(`Imported ${added} transactions`);
  };
  reader.readAsText(file);
});

// Basic CSV parser for quoted fields
function parseCSV(line){
  const out = [];
  let cur = '', inside = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch === '"' ){
      if(inside && line[i+1] === '"'){ cur += '"'; i++; }
      else inside = !inside;
    } else if(ch === ',' && !inside){
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

// ----- Delete -----
function del(id){
  if(!confirm('Delete this transaction?')) return;
  tx = tx.filter(t=>t.id !== id);
  save();
  render();
}

// ----- Rendering -----
function applyFilters(list){
  const month = $('#filter-month').value;   // format YYYY-MM
  const category = $('#filter-category').value;
  return list.filter(t=>{
    const okMonth = !month || t.date.startsWith(month);
    const okCat = !category || t.category === category;
    return okMonth && okCat;
  });
}

function render(){
  const filtered = applyFilters(tx);

  // Stats
  const income = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  $('#stat-income').textContent = fmt(income);
  $('#stat-expense').textContent = fmt(expense);
  $('#stat-balance').textContent = fmt(income - expense);

  // Recent table (latest 10)
  const tbody = $('#tx-tbody');
  tbody.innerHTML = '';
  filtered.slice().sort((a,b)=> b.date.localeCompare(a.date)).slice(0,10).forEach(row=>{
    tbody.appendChild(rowEl(row));
  });

  // Full table
  renderAll();
}

function renderAll(){
  const tbodyAll = $('#tx-tbody-all');
  tbodyAll.innerHTML = '';
  applyFilters(tx).slice().sort((a,b)=> b.date.localeCompare(a.date)).forEach(row=>{
    tbodyAll.appendChild(rowEl(row));
  });
}

function rowEl(t){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${t.date}</td>
    <td><span class="badge ${t.type}">${t.type}</span></td>
    <td>${t.category}</td>
    <td>${escapeHtml(t.note)}</td>
    <td class="num">${fmt(t.amount)}</td>
    <td class="num"><button onclick="del('${t.id}')">Delete</button></td>
  `;
  return tr;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Initialize filters to current month
(function init(){
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  $('#filter-month').value = ym;
  render();
})();
