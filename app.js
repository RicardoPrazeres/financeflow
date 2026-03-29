// ═══════════════════════════════════════════════
//  FinanceFlow — app.js
//  CRUD · Categorização Inteligente · Gráficos
//  Orçamentos · Alertas · Export CSV
// ═══════════════════════════════════════════════

// ── CATEGORIES ──────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:'food',       name:'Alimentação',   emoji:'🍔', color:'#f59e0b' },
  { id:'transport',  name:'Transporte',    emoji:'🚗', color:'#3b82f6' },
  { id:'housing',    name:'Moradia',       emoji:'🏠', color:'#8b5cf6' },
  { id:'health',     name:'Saúde',         emoji:'🏥', color:'#ef4444' },
  { id:'education',  name:'Educação',      emoji:'📚', color:'#06b6d4' },
  { id:'leisure',    name:'Lazer',         emoji:'🎮', color:'#ec4899' },
  { id:'clothing',   name:'Vestuário',     emoji:'👕', color:'#f97316' },
  { id:'bills',      name:'Contas',        emoji:'💡', color:'#eab308' },
  { id:'salary',     name:'Salário',       emoji:'💰', color:'#22c55e' },
  { id:'freelance',  name:'Freelance',     emoji:'💼', color:'#10b981' },
  { id:'investment', name:'Investimento',  emoji:'📈', color:'#6366f1' },
  { id:'other',      name:'Outros',        emoji:'📦', color:'#6b7280' },
];

// ── SMART CATEGORY KEYWORDS ──────────────────────
const SMART_RULES = [
  { keywords:['mercado','supermercado','padaria','açougue','hortifruti','ifood','rappi','aiqfome','pizza','hambur','restaurante','lanche','almoço','jantar','café'], cat:'food' },
  { keywords:['uber','99','cabify','ônibus','metrô','combustível','gasolina','posto','estacionamento','pedágio','táxi'], cat:'transport' },
  { keywords:['aluguel','condomínio','iptu','luz','água','gás','energia','internet','net','claro','vivo','tim','oi'], cat:'bills' },
  { keywords:['farmácia','remédio','médico','plano de saúde','dentista','hospital','exame','consulta'], cat:'health' },
  { keywords:['escola','faculdade','curso','livro','udemy','alura','langfy','mensalidade','matrícula'], cat:'education' },
  { keywords:['cinema','netflix','spotify','amazon prime','disney','teatro','show','concert','bar','balada','jogo'], cat:'leisure' },
  { keywords:['roupa','calçado','zara','hm','renner','c&a','americanas','shein','roupas'], cat:'clothing' },
  { keywords:['aluguel','financiamento','hipoteca','condomínio','reforma'], cat:'housing' },
  { keywords:['salário','pagamento','holerite','prolabore','adiantamento'], cat:'salary' },
  { keywords:['freelance','projeto','serviço','cliente','consultoria'], cat:'freelance' },
  { keywords:['ação','fundo','tesouro','cdb','poupança','dividendo','investimento','renda fixa'], cat:'investment' },
];

// ── FIREBASE ─────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCI31-BVkX2z7i_D9bn9UWdjMEjVIj5EwI",
  authDomain: "financeflow-98869.firebaseapp.com",
  projectId: "financeflow-98869",
  storageBucket: "financeflow-98869.firebasestorage.app",
  messagingSenderId: "303697782800",
  appId: "1:303697782800:web:d53a70759d9bab3954c295",
  measurementId: "G-9H52PYRSNP"
};
let app, db, auth, currentUser = null;
if (typeof firebase !== 'undefined') {
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(err => console.error("Auth persistence setup erro: ", err));
}

// ── STATE ────────────────────────────────────────
let transactions = [];
let budgets = [];
let categories = [];
let editingId = null;
let currentType = 'expense';
let chartMonthly = null, chartCategory = null, chartAnnual = null, chartTopCat = null, chartTrend = null;

// ── INIT ─────────────────────────────────────────
function init() {
  if (auth) {
    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;
        document.getElementById('loginOverlay').style.display = 'none';
        loadDataFromFirebase();
      } else {
        currentUser = null;
        document.getElementById('loginOverlay').style.display = 'flex';
      }
    });
  } else {
    loadData();
    finishInit();
  }
}

function finishInit() {
  buildCategorySelects();
  setDefaultDate();
  setDefaultFilterMonth();
  setupEventListeners();
  navigate('dashboard');
  if (!currentUser) loadDemoDataIfEmpty();
}

function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => alert('Erro no login: ' + err.message));
}

function logout() {
  if (auth) auth.signOut();
}

function loadData() {
  transactions = JSON.parse(localStorage.getItem('ff_transactions') || '[]');
  budgets      = JSON.parse(localStorage.getItem('ff_budgets')      || '[]');
  categories   = JSON.parse(localStorage.getItem('ff_categories')   || JSON.stringify(DEFAULT_CATEGORIES));
}

function loadDataFromFirebase() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      transactions = JSON.parse(data.transactions || '[]');
      budgets      = JSON.parse(data.budgets      || '[]');
      categories   = JSON.parse(data.categories   || JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('ff_transactions', JSON.stringify(transactions));
      localStorage.setItem('ff_budgets',      JSON.stringify(budgets));
      localStorage.setItem('ff_categories',   JSON.stringify(categories));
    } else {
       loadData(); 
       loadDemoDataIfEmpty();
       saveData();
    }
    finishInit();
  }).catch(err => {
    console.error('Erro ao ler firestore:', err);
    loadData();
    finishInit();
  });
}

function saveData() {
  localStorage.setItem('ff_transactions', JSON.stringify(transactions));
  localStorage.setItem('ff_budgets',      JSON.stringify(budgets));
  localStorage.setItem('ff_categories',   JSON.stringify(categories));
  
  if (currentUser && db) {
    db.collection('users').doc(currentUser.uid).set({
      transactions: JSON.stringify(transactions),
      budgets: JSON.stringify(budgets),
      categories: JSON.stringify(categories),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(e => console.error("Erro ao salvar nuvem", e));
  }
}

// ── DEMO DATA ────────────────────────────────────
function loadDemoDataIfEmpty() {
  if (transactions.length > 0) return;
  const now = new Date();
  const m = now.toISOString().slice(0,7);
  const demos = [
    { type:'income',  desc:'Salário',           amount:5000, cat:'salary',    payment:'Transferência', date:`${m}-05`, notes:'' },
    { type:'income',  desc:'Freelance Design',  amount:1200, cat:'freelance', payment:'Pix',           date:`${m}-10`, notes:'' },
    { type:'expense', desc:'Supermercado',      amount:480,  cat:'food',      payment:'Débito',        date:`${m}-03`, notes:'' },
    { type:'expense', desc:'Aluguel',           amount:1400, cat:'housing',   payment:'Transferência', date:`${m}-01`, notes:'' },
    { type:'expense', desc:'Conta de Luz',      amount:180,  cat:'bills',     payment:'Débito',        date:`${m}-07`, notes:'' },
    { type:'expense', desc:'Uber',              amount:95,   cat:'transport', payment:'Cartão de Crédito', date:`${m}-12`, notes:'' },
    { type:'expense', desc:'Netflix + Spotify', amount:75,   cat:'leisure',   payment:'Cartão de Crédito', date:`${m}-02`, notes:'' },
    { type:'expense', desc:'Farmácia',          amount:130,  cat:'health',    payment:'Dinheiro',      date:`${m}-09`, notes:'' },
    { type:'expense', desc:'Roupa C&A',         amount:220,  cat:'clothing',  payment:'Cartão de Crédito', date:`${m}-14`, notes:'' },
    { type:'expense', desc:'Restaurante',       amount:160,  cat:'food',      payment:'Pix',           date:`${m}-16`, notes:'' },
  ];
  // also add last 5 months for charts
  for (let i=1; i<=5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 10);
    const dm = d.toISOString().slice(0,7);
    demos.push({ type:'income',  desc:'Salário',       amount:4800+i*50, cat:'salary', payment:'Transferência', date:`${dm}-05`, notes:'' });
    demos.push({ type:'expense', desc:'Gastos gerais', amount:2800+i*80, cat:'other',  payment:'Vários',         date:`${dm}-15`, notes:'' });
  }
  demos.forEach(d => {
    transactions.push({ id: uid(), ...d, recurring: false, createdAt: new Date().toISOString() });
  });
  // default budgets
  budgets = [
    { id:uid(), cat:'food',      limit:600,  month: m },
    { id:uid(), cat:'transport', limit:200,  month: m },
    { id:uid(), cat:'leisure',   limit:150,  month: m },
    { id:uid(), cat:'housing',   limit:1500, month: m },
  ];
  saveData();
}

// ── NAVIGATION ───────────────────────────────────
function navigate(sec) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`sec-${sec}`).classList.add('active');
  document.querySelector(`[data-section="${sec}"]`)?.classList.add('active');

  const titles = { dashboard:'Dashboard', transactions:'Transações', cards:'Meus Cartões', budgets:'Orçamentos', reports:'Relatórios', settings:'Preferências' };
  document.getElementById('topbarTitle').textContent = titles[sec] || sec;

  closeSidebar();
  renderSection(sec);
}

function renderSection(sec) {
  if (sec === 'dashboard')    renderDashboard();
  if (sec === 'transactions') renderTransactions();
  if (sec === 'cards')        renderCards();
  if (sec === 'budgets')      renderBudgets();
  if (sec === 'reports')      renderReports();
  if (sec === 'settings')     renderSettings();
}

// ── EVENT LISTENERS ──────────────────────────────
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.section); });
  });
  document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);
  document.getElementById('btnAddTransaction').addEventListener('click', openModal);
  document.getElementById('alertBell').addEventListener('click', toggleAlerts);
  document.getElementById('dashPeriod').addEventListener('change', renderDashboard);
  ['filterMonth','filterType','filterCategory','filterSearch'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderTransactions);
  });
  const filterMonthCards = document.getElementById('filterMonthCards');
  if (filterMonthCards) {
    filterMonthCards.addEventListener('input', renderCards);
  }
}

// ── SIDEBAR ──────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── CATEGORY HELPERS ─────────────────────────────
function getCat(id) {
  return categories.find(c => c.id === id) || { name:'Outros', emoji:'📦', color:'#6b7280' };
}

function buildCategorySelects() {
  const selects = ['fCategory','bCategory','filterCategory'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isFilter = id === 'filterCategory';
    el.innerHTML = isFilter ? '<option value="">Todas as categorias</option>' : '';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.emoji} ${c.name}`;
      el.appendChild(opt);
    });
  });
}

// ── SMART AUTO-CATEGORY ──────────────────────────
function detectCategory(desc) {
  const d = desc.toLowerCase();
  for (const rule of SMART_RULES) {
    if (rule.keywords.some(k => d.includes(k))) return rule.cat;
  }
  return null;
}

function autoCategory() {
  const desc = document.getElementById('fDesc').value;
  const detected = detectCategory(desc);
  const box = document.getElementById('catSuggestion');
  if (detected) {
    const cat = getCat(detected);
    box.style.display = 'block';
    box.innerHTML = `✨ Sugestão: ${cat.emoji} <strong>${cat.name}</strong> — <u>Aplicar</u>`;
    box.onclick = () => {
      document.getElementById('fCategory').value = detected;
      box.style.display = 'none';
    };
  } else {
    box.style.display = 'none';
  }
}

// ── MODAL: TRANSACTION ───────────────────────────
function openModal(id = null) {
  editingId = id;
  const modal = document.getElementById('txModal');
  document.getElementById('modalTitle').textContent = id ? 'Editar Transação' : 'Nova Transação';
  document.getElementById('catSuggestion').style.display = 'none';

  if (id) {
    const tx = transactions.find(t => t.id === id);
    setType(tx.type);
    document.getElementById('fDesc').value     = tx.desc;
    document.getElementById('fAmount').value   = tx.amount;
    document.getElementById('fDate').value     = tx.date;
    document.getElementById('fCategory').value = tx.cat;
    document.getElementById('fPayment').value  = tx.payment;
    document.getElementById('fNotes').value    = tx.notes || '';
    document.getElementById('fRecurring').checked = tx.recurring || false;
  } else {
    setType('expense');
    document.getElementById('fDesc').value   = '';
    document.getElementById('fAmount').value = '';
    document.getElementById('fNotes').value  = '';
    document.getElementById('fRecurring').checked = false;
    setDefaultDate();
  }

  modal.classList.add('open');
}

function closeModal() {
  document.getElementById('txModal').classList.remove('open');
  editingId = null;
}

function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

function saveTransaction() {
  const desc   = document.getElementById('fDesc').value.trim();
  const amount = parseFloat(document.getElementById('fAmount').value);
  const date   = document.getElementById('fDate').value;
  const cat    = document.getElementById('fCategory').value;
  const payment = document.getElementById('fPayment').value;
  const notes  = document.getElementById('fNotes').value.trim();
  const recurring = document.getElementById('fRecurring').checked;

  if (!desc) { showToast('Informe uma descrição', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Informe um valor válido', 'error'); return; }
  if (!date) { showToast('Informe a data', 'error'); return; }

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    transactions[idx] = { ...transactions[idx], type:currentType, desc, amount, date, cat, payment, notes, recurring };
    showToast('Transação atualizada ✓', 'success');
  } else {
    transactions.push({ id:uid(), type:currentType, desc, amount, date, cat, payment, notes, recurring, createdAt:new Date().toISOString() });
    showToast('Transação adicionada ✓', 'success');
  }

  saveData();
  closeModal();
  renderSection(currentSection());
  renderDashboardKPIs();
  checkAlerts();
}

function deleteTransaction(id) {
  if (!confirm('Excluir esta transação?')) return;
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  renderSection(currentSection());
  renderDashboardKPIs();
  checkAlerts();
  showToast('Transação excluída', 'warning');
}

// ── MODAL: BUDGET ────────────────────────────────
function openBudgetModal() {
  document.getElementById('bCategory').value = categories[0]?.id || '';
  document.getElementById('bLimit').value = '';
  document.getElementById('budgetModal').classList.add('open');
}

function closeBudgetModal() {
  document.getElementById('budgetModal').classList.remove('open');
}

function saveBudget() {
  const cat   = document.getElementById('bCategory').value;
  const limit = parseFloat(document.getElementById('bLimit').value);
  const month = new Date().toISOString().slice(0,7);

  if (!limit || limit <= 0) { showToast('Informe um limite válido', 'error'); return; }

  const existing = budgets.findIndex(b => b.cat === cat && b.month === month);
  if (existing >= 0) {
    budgets[existing].limit = limit;
  } else {
    budgets.push({ id:uid(), cat, limit, month });
  }
  saveData();
  closeBudgetModal();
  renderBudgets();
  checkAlerts();
  showToast('Orçamento salvo ✓', 'success');
}

function deleteBudget(id) {
  budgets = budgets.filter(b => b.id !== id);
  saveData();
  renderBudgets();
  checkAlerts();
  showToast('Orçamento removido', 'warning');
}

// ── ALERTS ───────────────────────────────────────
function checkAlerts() {
  const month = new Date().toISOString().slice(0,7);
  const alerts = [];

  budgets.filter(b => b.month === month).forEach(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.cat === b.cat && t.date?.startsWith(month))
      .reduce((s,t) => s + t.amount, 0);
    const pct = spent / b.limit;
    const cat = getCat(b.cat);

    if (pct >= 1) alerts.push({ text:`${cat.emoji} ${cat.name}: orçamento <strong>EXCEDIDO</strong> (R$ ${fmt(spent)} / ${fmt(b.limit)})`, level:'danger' });
    else if (pct >= 0.8) alerts.push({ text:`${cat.emoji} ${cat.name}: 80% do orçamento usado (R$ ${fmt(spent)} / ${fmt(b.limit)})`, level:'warning' });
  });

  const inc = document.getElementById('alertCount');
  if (alerts.length > 0) {
    inc.textContent = alerts.length;
    inc.style.display = 'flex';
  } else {
    inc.style.display = 'none';
  }

  const list = document.getElementById('alertsList');
  list.innerHTML = alerts.map(a => `<div class="alert-item">${a.level === 'danger' ? '🔴' : '🟡'} ${a.text}</div>`).join('');
  return alerts;
}

function toggleAlerts() {
  const p = document.getElementById('alertsPanel');
  p.style.display = p.style.display === 'none' ? 'block' : 'none';
  checkAlerts();
}

function closeAlerts() {
  document.getElementById('alertsPanel').style.display = 'none';
}

// ── DASHBOARD ────────────────────────────────────
function renderDashboard() {
  renderDashboardKPIs();
  renderMonthlyChart();
  renderCategoryChart();
  renderBudgetOverview();
  renderRecentTransactions();
}

function getPeriodTransactions() {
  const period = document.getElementById('dashPeriod').value;
  const now = new Date();
  return transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (period === 'last3') {
      const cutoff = new Date(now.getFullYear(), now.getMonth()-2, 1);
      return d >= cutoff;
    }
    return d.getFullYear() === now.getFullYear();
  });
}

function renderDashboardKPIs() {
  const txs = getPeriodTransactions();
  const income  = txs.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const balance = income - expense;
  const savings = income > 0 ? ((income - expense) / income * 100) : 0;

  document.getElementById('kpiIncome').textContent   = `R$ ${fmt(income)}`;
  document.getElementById('kpiExpense').textContent  = `R$ ${fmt(expense)}`;
  document.getElementById('kpiBalance').textContent  = `R$ ${fmt(balance)}`;
  document.getElementById('kpiSavings').textContent  = `${savings.toFixed(0)}%`;
  document.getElementById('kpiIncomeSub').textContent  = `${txs.filter(t=>t.type==='income').length} transações`;
  document.getElementById('kpiExpenseSub').textContent = `${txs.filter(t=>t.type==='expense').length} transações`;
  document.getElementById('kpiBalance').style.color  = balance >= 0 ? 'var(--green)' : 'var(--red)';

  const sideBalance = document.getElementById('sidebarBalance');
  sideBalance.textContent = `R$ ${fmt(balance)}`;
  sideBalance.style.color = balance >= 0 ? 'var(--green)' : 'var(--red)';
  checkAlerts();
}

function renderMonthlyChart() {
  const now = new Date();
  const months = [];
  const incomes = [], expenses = [];

  for (let i=5; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.toISOString().slice(0,7);
    months.push(d.toLocaleString('pt-BR', { month:'short' }));
    const mTxs = transactions.filter(t => t.date?.startsWith(m));
    incomes.push(mTxs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    expenses.push(mTxs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }

  const ctx = document.getElementById('chartMonthly').getContext('2d');
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type:'bar',
    data:{
      labels:months,
      datasets:[
        { label:'Entradas', data:incomes,  backgroundColor:'rgba(34,197,94,.5)', borderColor:'#22c55e', borderWidth:2, borderRadius:6 },
        { label:'Saídas',   data:expenses, backgroundColor:'rgba(239,68,68,.5)', borderColor:'#ef4444', borderWidth:2, borderRadius:6 },
      ]
    },
    options:{ ...chartOpts(), scales:{ x:{ ...scaleOpts() }, y:{ ...scaleOpts(), ticks:{ ...ticksOpts(), callback:v=>`R$${fmtK(v)}` } } } }
  });
}

function renderCategoryChart() {
  const month = new Date().toISOString().slice(0,7);
  const exp = transactions.filter(t => t.type==='expense' && t.date?.startsWith(month));
  const catTotals = {};
  exp.forEach(t => { catTotals[t.cat] = (catTotals[t.cat]||0) + t.amount; });

  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,7);
  const total = sorted.reduce((s,[,v])=>s+v,0);

  const ctx = document.getElementById('chartCategory').getContext('2d');
  if (chartCategory) chartCategory.destroy();
  chartCategory = new Chart(ctx, {
    type:'doughnut',
    data:{
      labels: sorted.map(([k])=>getCat(k).name),
      datasets:[{ data: sorted.map(([,v])=>v), backgroundColor: sorted.map(([k])=>getCat(k).color+'cc'), borderColor: sorted.map(([k])=>getCat(k).color), borderWidth:2 }]
    },
    options:{ ...chartOpts(), cutout:'65%', plugins:{ legend:{ display:false } } }
  });

  const leg = document.getElementById('categoryLegend');
  leg.innerHTML = sorted.map(([k,v])=>{
    const cat = getCat(k);
    const pct = total > 0 ? (v/total*100).toFixed(0) : 0;
    return `<div class="legend-item">
      <div class="legend-dot" style="background:${cat.color}"></div>
      <span>${cat.emoji} ${cat.name}</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderBudgetOverview() {
  const month = new Date().toISOString().slice(0,7);
  const el = document.getElementById('budgetBars');
  const active = budgets.filter(b => b.month === month);

  if (active.length === 0) {
    el.innerHTML = '<p style="color:var(--text2);font-size:13px;padding:4px 0">Nenhum orçamento definido para este mês.</p>';
    document.getElementById('budgetOverviewCard').style.display = 'block';
    return;
  }

  el.innerHTML = active.map(b => {
    const cat = getCat(b.cat);
    const spent = transactions.filter(t=>t.type==='expense'&&t.cat===b.cat&&t.date?.startsWith(month)).reduce((s,t)=>s+t.amount,0);
    const pct = Math.min(spent/b.limit*100, 100);
    const color = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
    return `<div class="budget-item">
      <div class="budget-item-header">
        <span class="budget-item-name">${cat.emoji} ${cat.name}</span>
        <span class="budget-item-amount">R$ ${fmt(spent)} / R$ ${fmt(b.limit)}</span>
      </div>
      <div class="budget-bar"><div class="budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
  }).join('');
}

function renderRecentTransactions() {
  const recent = [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const el = document.getElementById('recentList');
  el.innerHTML = recent.length ? recent.map(t => txItemHTML(t)).join('') : '<p style="padding:20px;color:var(--text2);font-size:13px">Nenhuma transação ainda.</p>';
}

// ── TRANSACTIONS ─────────────────────────────────
function renderTransactions() {
  const month  = document.getElementById('filterMonth').value;
  const type   = document.getElementById('filterType').value;
  const cat    = document.getElementById('filterCategory').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  let list = [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if (month)  list = list.filter(t => t.date?.startsWith(month));
  if (type)   list = list.filter(t => t.type === type);
  if (cat)    list = list.filter(t => t.cat === cat);
  if (search) list = list.filter(t => t.desc.toLowerCase().includes(search) || t.notes?.toLowerCase().includes(search));

  const el = document.getElementById('txList');
  const empty = document.getElementById('txEmpty');

  if (list.length === 0) {
    el.innerHTML = '';
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    el.innerHTML = list.map(t => txItemHTML(t, true)).join('');
  }
}

function txItemHTML(t, showActions=false) {
  const cat = getCat(t.cat);
  const dateStr = t.date ? new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR') : '';
  const actions = showActions ? `<div class="tx-actions">
    <button class="tx-btn" onclick="event.stopPropagation();openModal('${t.id}')" title="Editar">✏️</button>
    <button class="tx-btn" onclick="event.stopPropagation();deleteTransaction('${t.id}')" title="Excluir">🗑</button>
  </div>` : '';

  return `<div class="tx-item" onclick="openModal('${t.id}')">
    <div class="tx-icon" style="background:${cat.color}22">${cat.emoji}</div>
    <div class="tx-info">
      <div class="tx-desc">${esc(t.desc)}${t.recurring?' 🔄':''}</div>
      <div class="tx-meta">${cat.name} · ${dateStr} · ${t.payment}</div>
    </div>
    <div class="tx-amount ${t.type}">${t.type==='income'?'+':'-'}R$ ${fmt(t.amount)}</div>
    ${actions}
  </div>`;
}

// ── BUDGETS ──────────────────────────────────────
function renderBudgets() {
  const month = new Date().toISOString().slice(0,7);
  const el = document.getElementById('budgetGrid');

  if (budgets.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>Nenhum orçamento definido.<br>Clique em "+ Novo" para começar.</p></div>`;
    return;
  }

  el.innerHTML = budgets.map(b => {
    const cat = getCat(b.cat);
    const spent = transactions.filter(t=>t.type==='expense'&&t.cat===b.cat&&t.date?.startsWith(b.month||month)).reduce((s,t)=>s+t.amount,0);
    const pct = Math.min(spent/b.limit*100,100);
    const color = pct>=100?'var(--red)':pct>=80?'var(--yellow)':'var(--green)';
    const status = pct>=100?'🔴 Excedido':pct>=80?'🟡 Atenção':'🟢 OK';

    return `<div class="budget-card">
      <div class="budget-card-header">
        <span class="budget-card-emoji">${cat.emoji}</span>
        <button class="budget-delete" onclick="deleteBudget('${b.id}')">✕</button>
      </div>
      <div class="budget-card-title">${cat.name}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:2px">${status}</div>
      <div class="budget-big-bar"><div class="budget-big-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="budget-amounts">
        <span class="budget-spent">Gasto: R$ ${fmt(spent)}</span>
        <span class="budget-limit">Limite: R$ ${fmt(b.limit)}</span>
      </div>
    </div>`;
  }).join('');
}

// ── REPORTS ──────────────────────────────────────
function renderReports() {
  renderAnnualChart();
  renderTopCatChart();
  renderTrendChart();
  renderReportTable();
}

function renderAnnualChart() {
  const now = new Date();
  const months = [], incomes = [], expenses = [];
  for (let i=11; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.toISOString().slice(0,7);
    months.push(d.toLocaleString('pt-BR',{month:'short'}));
    const mT = transactions.filter(t=>t.date?.startsWith(m));
    incomes.push(mT.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
    expenses.push(mT.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0));
  }
  const ctx = document.getElementById('chartAnnual').getContext('2d');
  if (chartAnnual) chartAnnual.destroy();
  chartAnnual = new Chart(ctx, {
    type:'line',
    data:{
      labels:months,
      datasets:[
        { label:'Entradas', data:incomes,  borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,.1)', tension:.4, fill:true, pointBackgroundColor:'#22c55e' },
        { label:'Saídas',   data:expenses, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,.1)', tension:.4, fill:true, pointBackgroundColor:'#ef4444' },
      ]
    },
    options:{ ...chartOpts(), scales:{ x:{...scaleOpts()}, y:{...scaleOpts(), ticks:{...ticksOpts(),callback:v=>`R$${fmtK(v)}`}} } }
  });
}

function renderTopCatChart() {
  const catTotals = {};
  transactions.filter(t=>t.type==='expense').forEach(t=>{ catTotals[t.cat]=(catTotals[t.cat]||0)+t.amount; });
  const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const ctx = document.getElementById('chartTopCat').getContext('2d');
  if (chartTopCat) chartTopCat.destroy();
  chartTopCat = new Chart(ctx, {
    type:'bar',
    data:{
      labels: sorted.map(([k])=>`${getCat(k).emoji} ${getCat(k).name}`),
      datasets:[{ data: sorted.map(([,v])=>v), backgroundColor: sorted.map(([k])=>getCat(k).color+'99'), borderColor: sorted.map(([k])=>getCat(k).color), borderWidth:2, borderRadius:6 }]
    },
    options:{ ...chartOpts(), indexAxis:'y', plugins:{legend:{display:false}}, scales:{ x:{...scaleOpts(),ticks:{...ticksOpts(),callback:v=>`R$${fmtK(v)}`}}, y:{...scaleOpts()} } }
  });
}

function renderTrendChart() {
  const now = new Date();
  const labels=[], saldos=[];
  let running = 0;
  for (let i=11; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const m = d.toISOString().slice(0,7);
    const mT = transactions.filter(t=>t.date?.startsWith(m));
    const inc = mT.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp = mT.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    running += inc-exp;
    labels.push(d.toLocaleString('pt-BR',{month:'short'}));
    saldos.push(running);
  }
  const ctx = document.getElementById('chartTrend').getContext('2d');
  if (chartTrend) chartTrend.destroy();
  chartTrend = new Chart(ctx, {
    type:'line',
    data:{
      labels,
      datasets:[{ label:'Saldo Acumulado', data:saldos, borderColor:'#6366f1', backgroundColor:'rgba(99,102,241,.1)', tension:.4, fill:true, pointBackgroundColor:'#6366f1' }]
    },
    options:{ ...chartOpts(), scales:{ x:{...scaleOpts()}, y:{...scaleOpts(),ticks:{...ticksOpts(),callback:v=>`R$${fmtK(v)}`}} } }
  });
}

function renderReportTable() {
  const catTotals = {};
  categories.forEach(c => { catTotals[c.id] = { name:c.name, emoji:c.emoji, income:0, expense:0 }; });
  transactions.forEach(t => {
    if (!catTotals[t.cat]) catTotals[t.cat] = { name:getCat(t.cat).name, emoji:getCat(t.cat).emoji, income:0, expense:0 };
    catTotals[t.cat][t.type] += t.amount;
  });

  const rows = Object.entries(catTotals).filter(([,v])=>v.income+v.expense>0).sort((a,b)=>b[1].expense-a[1].expense);
  document.getElementById('reportTable').innerHTML = `
    <table>
      <thead><tr><th>Categoria</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead>
      <tbody>${rows.map(([,v])=>{
        const bal=v.income-v.expense;
        return `<tr>
          <td>${v.emoji} ${v.name}</td>
          <td style="color:var(--green)">R$ ${fmt(v.income)}</td>
          <td style="color:var(--red)">R$ ${fmt(v.expense)}</td>
          <td style="color:${bal>=0?'var(--green)':'var(--red)'}">R$ ${fmt(Math.abs(bal))}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ── SETTINGS ─────────────────────────────────────
function renderSettings() {
  const el = document.getElementById('categoryList');
  const defaults = DEFAULT_CATEGORIES.map(c=>c.id);
  const custom = categories.filter(c => !defaults.includes(c.id));

  if (custom.length === 0) {
    el.innerHTML = '<p style="color:var(--text2);font-size:13px;margin-bottom:8px">Nenhuma categoria personalizada.</p>';
  } else {
    el.innerHTML = custom.map(c => `<div class="cat-item">
      <div class="cat-dot" style="background:${c.color}"></div>
      <span class="cat-name">${c.emoji||'📦'} ${c.name}</span>
      <button class="cat-del" onclick="deleteCategory('${c.id}')">✕</button>
    </div>`).join('');
  }
}

function addCustomCategory() {
  const name = document.getElementById('newCatName').value.trim();
  const color = document.getElementById('newCatColor').value;
  if (!name) { showToast('Informe o nome', 'error'); return; }
  const id = 'cat_' + Date.now();
  categories.push({ id, name, emoji:'📦', color });
  saveData();
  buildCategorySelects();
  renderSettings();
  document.getElementById('newCatName').value = '';
  showToast('Categoria adicionada ✓', 'success');
}

function deleteCategory(id) {
  if (!confirm('Excluir esta categoria?')) return;
  categories = categories.filter(c=>c.id!==id);
  saveData();
  buildCategorySelects();
  renderSettings();
  showToast('Categoria removida', 'warning');
}

function clearAllData() {
  if (!confirm('⚠️ Isso irá apagar TODOS os dados locais e na nuvem. Continuar?')) return;
  if (!confirm('Tem certeza absoluta? Esta ação não pode ser desfeita.')) return;
  localStorage.clear();
  if (currentUser && db) {
    db.collection('users').doc(currentUser.uid).delete().then(() => {
      location.reload();
    });
  } else {
    location.reload();
  }
}

// ── EXPORT CSV ───────────────────────────────────
function exportCSV() {
  const header = 'Data,Tipo,Descrição,Categoria,Valor,Pagamento,Notas\n';
  const rows = transactions.map(t => [
    t.date, t.type==='income'?'Entrada':'Saída', `"${t.desc}"`, getCat(t.cat).name, t.amount.toFixed(2), t.payment, `"${t.notes||''}"`
  ].join(',')).join('\n');

  const blob = new Blob(['\ufeff'+header+rows], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=`financeflow_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportado com sucesso ✓', 'success');
}

// ── CHART DEFAULTS ───────────────────────────────
function chartOpts() {
  return {
    responsive:true, maintainAspectRatio:false,
    animation:{ duration:500 },
    plugins:{ legend:{ labels:{ color:'#8b8fa8', font:{ family:'Inter', size:12 }, boxWidth:12, usePointStyle:true } }, tooltip:{ backgroundColor:'#1e2029', titleColor:'#e8eaf0', bodyColor:'#8b8fa8', borderColor:'#2a2d3a', borderWidth:1, padding:10, callbacks:{ label:ctx=>`R$ ${fmt(ctx.parsed.y ?? ctx.parsed)}` } } }
  };
}
function scaleOpts() { return { grid:{ color:'rgba(255,255,255,.04)' }, border:{ display:false } }; }
function ticksOpts() { return { color:'#4a4d62', font:{ family:'Inter', size:11 } }; }

// ── HELPERS ──────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(n) { return Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtK(v) { return v>=1000?(v/1000).toFixed(1)+'k':v.toFixed(0); }
function esc(s) { const d=document.createElement('div');d.textContent=s;return d.innerHTML; }
function currentSection() {
  const s = document.querySelector('.section.active');
  if (!s) return 'dashboard';
  return s.id.replace('sec-','');
}
function setDefaultDate() {
  document.getElementById('fDate').value = new Date().toISOString().slice(0,10);
}
function setDefaultFilterMonth() {
  const m = new Date().toISOString().slice(0,7);
  document.getElementById('filterMonth').value = m;
  const filterMonthCards = document.getElementById('filterMonthCards');
  if (filterMonthCards) filterMonthCards.value = m;
}

// ── CARDS ────────────────────────────────────────
function renderCards() {
  const month = document.getElementById('filterMonthCards').value;
  const el = document.getElementById('cardsGrid');
  if (!el) return;
  
  const knownCards = [
    { id: 'inter', name: 'Inter', initials: 'IN' },
    { id: 'nubank', name: 'Nubank', initials: 'NU' },
    { id: 'amazon', name: 'Amazon', initials: 'AZ' },
    { id: 'outro', name: 'Outro', initials: '++' }
  ];

  const html = knownCards.map(c => {
    const monthlyAmount = transactions.filter(t => 
      t.type === 'expense' && 
      t.cardKey === c.id && 
      t.date?.startsWith(month)
    ).reduce((sum, t) => sum + t.amount, 0);

    const totalAmount = transactions.filter(t => 
      t.type === 'expense' && 
      t.cardKey === c.id
    ).reduce((sum, t) => sum + t.amount, 0);

    return `
      <div class="cc-widget cc-${c.id}">
        <div class="cc-header">
          <h3>${c.name}</h3>
          <div class="cc-brand-icon">${c.initials}</div>
        </div>
        <div class="cc-stats">
          <div class="cc-stat-row">
            <span class="cc-stat-label">Gasto no Mês</span>
            <span class="cc-val-monthly">R$ ${fmt(monthlyAmount)}</span>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat-label">Gasto Total Acumulado</span>
            <span class="cc-val-total">R$ ${fmt(totalAmount)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = html;
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(()=>{ t.classList.remove('show'); }, 3000);
}

// ── START ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
