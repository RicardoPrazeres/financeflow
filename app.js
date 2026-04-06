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

// ── GEMINI AI (RECEIPT SCANNING) ─────────────────
const GEMINI_API_KEY = 'AIzaSyBMrHsPG86oTgfsoXsVOC3bZ7pEIkk9fo0';

function triggerScanReceipt() {
  document.getElementById('receiptFileInput').click();
}

async function handleReceiptImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const overlay = document.getElementById('scanOverlay');
  overlay.style.display = 'flex';

  try {
    const base64 = await fileToBase64(file);
    const result = await analyzeReceiptWithGemini(base64, file.type);
    overlay.style.display = 'none';
    prefillTransactionFromReceipt(result);
  } catch (err) {
    overlay.style.display = 'none';
    console.error('Erro ao escanear nota:', err);
    alert('❌ Não foi possível analisar a imagem. Tente uma foto mais clara da nota fiscal.');
  }
  event.target.value = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });
}

async function analyzeReceiptWithGemini(base64, mimeType) {
  const prompt = `Analise esta imagem de nota fiscal ou comprovante de pagamento.
Extraia as informações da transação e retorne APENAS um JSON válido, sem markdown, sem explicações extras.
Formato exato:
{
  "desc": "nome do estabelecimento ou descrição curta da compra",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "type": "expense",
  "cat": "uma das seguintes: food, transport, housing, health, education, leisure, clothing, bills, salary, freelance, investment, other",
  "notes": "informações adicionais relevantes"
}
Regras:
- amount deve ser um número sem símbolos (ex: 45.90)
- date deve ser no formato YYYY-MM-DD (use a data de hoje se não encontrar: ${new Date().toISOString().slice(0,10)})
- cat deve ser uma das opções listadas
- Se for nota de restaurante/mercado use cat "food"
- Se for farmácia/médico use cat "health"
- Se for combustível/transporte use cat "transport"`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } }
          ]
        }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );

  if (!resp.ok) throw new Error(`Gemini API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.candidates[0].content.parts[0].text;
  const clean = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
  return JSON.parse(clean);
}

function prefillTransactionFromReceipt(data) {
  openModal();
  setTimeout(() => {
    setType(data.type || 'expense');
    document.getElementById('fDesc').value    = data.desc  || '';
    document.getElementById('fAmount').value  = data.amount || '';
    document.getElementById('fDate').value    = data.date  || new Date().toISOString().slice(0,10);
    document.getElementById('fNotes').value   = data.notes || '';
    const catSel = document.getElementById('fCategory');
    if (catSel) {
      [...catSel.options].forEach(o => { if(o.value === data.cat) catSel.value = data.cat; });
    }
    showToast(`✅ Nota analisada! Confira os dados e salve.`);
  }, 200);
}

// ── STATE ────────────────────────────────────────
let transactions = [];
let budgets = [];
let categories = [];
let editingId = null;
let currentType = 'expense';
let chartMonthly = null, chartCategory = null, chartAnnual = null, chartTopCat = null, chartTrend = null;

// Bulk select state
let selectMode = false;
let selectedIds = new Set();

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
  document.getElementById('loginOverlay').style.display = 'none';
  buildCategorySelects();
  setDefaultDate();
  setDefaultFilterMonth();
  setupEventListeners();
  navigate('dashboard');
  if (!currentUser) loadDemoDataIfEmpty();
}

function loginWithGoogle() {
  if (typeof firebase === 'undefined' || !auth) {
    alert('❌ O Google Firebase não pôde ser carregado. Verifique sua conexão e tente novamente.');
    return;
  }
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

let isInitialSync = true;
function loadDataFromFirebase() {
  if (!currentUser) return;
  db.collection('users').doc(currentUser.uid).onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      transactions = JSON.parse(data.transactions || '[]');
      budgets      = JSON.parse(data.budgets      || '[]');
      categories   = JSON.parse(data.categories   || JSON.stringify(DEFAULT_CATEGORIES));
      localStorage.setItem('ff_transactions', JSON.stringify(transactions));
      localStorage.setItem('ff_budgets',      JSON.stringify(budgets));
      localStorage.setItem('ff_categories',   JSON.stringify(categories));
    } else {
       if (isInitialSync) {
         loadData(); 
         loadDemoDataIfEmpty();
         saveData();
       }
    }
    if (isInitialSync) {
      isInitialSync = false;
      finishInit();
    } else {
      renderSection(currentSection());
      if (currentSection() !== 'dashboard') {
         renderDashboardKPIs();
      }
    }
  }, err => {
    console.error('Erro ao ler firestore:', err);
    if (err.message.includes("permission") || err.code === 'permission-denied') {
      alert("⚠️ FIREBASE: Ops! Você esqueceu de alterar as Regras do Firestore para modo de teste ('allow read, write: if true;').");
    }
    if (isInitialSync) {
      isInitialSync = false;
      loadData();
      finishInit();
    }
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
    }).catch(e => {
      console.error("Erro ao salvar nuvem", e);
      if (e.message.includes("permission") || e.code === 'permission-denied') {
        alert("O Firebase não deixou salvar. Vá no Console > Firestore > Regras, e libere o acesso!");
      }
    });
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
  // Reset bulk selection if leaving transactions
  if (sec !== 'transactions' && selectMode) {
    selectMode = false;
    selectedIds.clear();
    const btn = document.getElementById('btnSelectMode');
    const bar = document.getElementById('bulkActionBar');
    if (btn) { btn.classList.remove('select-active'); btn.textContent = '☑ Selecionar'; }
    if (bar) bar.style.display = 'none';
  }
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

function currentSection() {
  const active = document.querySelector('.section.active');
  return active ? active.id.replace('sec-', '') : 'dashboard';
}

// ── EVENT LISTENERS ──────────────────────────────
function setupEventListeners() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.section); });
  });

  const ids = {
    hamburgerBtn:   () => document.getElementById('hamburgerBtn').addEventListener('click', toggleSidebar),
    sidebarOverlay: () => document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar),
    alertBell:      () => document.getElementById('alertBell').addEventListener('click', toggleAlerts),
    dashPeriod:     () => document.getElementById('dashPeriod').addEventListener('change', renderDashboard),
  };

  for (const [id, setup] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) setup();
  }

  ['filterMonth','filterType','filterCategory','filterSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderTransactions);
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
      opt.textContent = `${c.emoji ? c.emoji + ' ' : ''}${c.name}`;
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
    box.innerHTML = `✨ Sugestão: ${cat.emoji ? cat.emoji + ' ' : ''}<strong>${cat.name}</strong> — <u>Aplicar</u>`;
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
    // Show total amount (not installment value) when editing
    const amt = tx.installmentTotal || tx.amount;
    document.getElementById('fAmount').value   = amt ? amt.toString().replace('.', ',') : '';
    document.getElementById('fDate').value     = tx.date;
    document.getElementById('fCategory').value = tx.cat;
    document.getElementById('fPayment').value  = tx.payment;
    document.getElementById('fNotes').value    = tx.notes || '';
    document.getElementById('fRecurring').checked = tx.recurring || false;
    // Restore card selection
    window._editingId = id;
    if (typeof selectCard === 'function') selectCard(tx.cardKey || 'inter');
    if (typeof onPaymentChange === 'function') onPaymentChange();
    // Restore installments
    const installEl = document.getElementById('fInstallments');
    if (installEl) installEl.value = tx.installments > 1 ? String(tx.installments) : '1';
    if (typeof updateInstallmentPreview === 'function') updateInstallmentPreview();
  } else {
    window._editingId = null;
    setType('expense');
    document.getElementById('fDesc').value   = '';
    document.getElementById('fAmount').value = '';
    document.getElementById('fNotes').value  = '';
    document.getElementById('fRecurring').checked = false;
    setDefaultDate();
    if (typeof selectCard === 'function') selectCard('inter');
    if (typeof onPaymentChange === 'function') onPaymentChange();
    const installEl = document.getElementById('fInstallments');
    if (installEl) installEl.value = '1';
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
  const desc      = document.getElementById('fDesc').value.trim();
  const rawAmt    = document.getElementById('fAmount').value.replace(',', '.');
  const totalAmt  = parseFloat(rawAmt);
  const date      = document.getElementById('fDate').value;
  const cat       = document.getElementById('fCategory').value;
  const payment   = document.getElementById('fPayment').value;
  const notes     = document.getElementById('fNotes').value.trim();
  const recurring = document.getElementById('fRecurring').checked;

  const installEl  = document.getElementById('fInstallments');
  const n          = (payment === 'credito' && installEl) ? (parseInt(installEl.value) || 1) : 1;
  const cardKey    = (payment === 'credito' || payment === 'debito') ? (window._selectedCard || 'outro') : null;
  const cardLabel  = cardKey ? ({'inter':'Inter','nubank':'Nubank','amazon':'Amazon','outro':'Outro'}[cardKey] || cardKey) : null;

  if (!desc)   { showToast('Informe uma descrição', 'error'); return; }
  if (!totalAmt || totalAmt <= 0) { showToast('Informe um valor válido', 'error'); return; }
  if (!date)   { showToast('Informe a data', 'error'); return; }

  const savedAmount = n > 1 ? +(totalAmt / n).toFixed(2) : totalAmt;

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx === -1) { closeModal(); return; }
    
    const oldTx = transactions[idx];
    const gid = oldTx.installmentGroupId;

    if (gid) {
      // Era um grupo. Vamos recalcular a data de início (mês 1) com base na transação editada
      const [y, m, d] = date.split('-').map(Number);
      const dObj = new Date(y, m - 1 - (oldTx.installmentPaid - 1), d);
      const startDate = dObj.getFullYear() + '-' + String(dObj.getMonth() + 1).padStart(2, '0') + '-' + String(dObj.getDate()).padStart(2, '0');

      // Remove todo o grupo antigo
      transactions = transactions.filter(t => t.installmentGroupId !== gid);

      if (n > 1) {
        // Recria o grupo com os novos dados e quantidade de parcelas (n)
        const [yy, mm, dd] = startDate.split('-').map(Number);
        for (let i = 1; i <= n; i++) {
          let loopDateStr = startDate;
          if (i > 1) {
            const di = new Date(yy, mm - 1 + (i - 1), dd);
            const targetMonth = ((mm - 1 + (i - 1)) % 12 + 12) % 12;
            if (di.getMonth() !== targetMonth) di.setDate(0); 
            loopDateStr = di.getFullYear() + '-' + String(di.getMonth() + 1).padStart(2, '0') + '-' + String(di.getDate()).padStart(2, '0');
          }
          transactions.push({
            id:uid(), type:currentType, desc, amount:savedAmount, date:loopDateStr, cat, payment, notes, recurring,
            cardKey, cardLabel,
            installments: n, installmentPaid: i, installmentValue: savedAmount, installmentTotal: totalAmt,
            installmentGroupId: gid, createdAt:new Date().toISOString()
          });
        }
      } else {
        // Mudou de parcelado para único. Já removemos o grupo, agora adicionamos apenas este
        transactions.push({
          id:uid(), type:currentType, desc, amount:savedAmount, date, cat, payment, notes, recurring,
          cardKey, cardLabel,
          installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null,
          createdAt:new Date().toISOString()
        });
      }
    } else {
      // Era uma transação individual
      if (n > 1) {
        // Mudou de individual para parcelado
        transactions.splice(idx, 1);
        const newGid = uid();
        const [yy, mm, dd] = date.split('-').map(Number);
        for (let i = 1; i <= n; i++) {
          let loopDateStr = date;
          if (i > 1) {
            const di = new Date(yy, mm - 1 + (i - 1), dd);
            const targetMonth = ((mm - 1 + (i - 1)) % 12 + 12) % 12;
            if (di.getMonth() !== targetMonth) di.setDate(0); 
            loopDateStr = di.getFullYear() + '-' + String(di.getMonth() + 1).padStart(2, '0') + '-' + String(di.getDate()).padStart(2, '0');
          }
          transactions.push({
            id:uid(), type:currentType, desc, amount:savedAmount, date:loopDateStr, cat, payment, notes, recurring,
            cardKey, cardLabel,
            installments: n, installmentPaid: i, installmentValue: savedAmount, installmentTotal: totalAmt,
            installmentGroupId: newGid, createdAt:new Date().toISOString()
          });
        }
      } else {
        // Apenas atualiza a individual
        transactions[idx] = {
          ...transactions[idx],
          type:currentType, desc, amount:savedAmount, date, cat, payment, notes, recurring,
          cardKey, cardLabel,
          installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null
        };
      }
    }
    showToast('Transação atualizada ✓', 'success');
  } else {
    // Se for parcelado, cria 'n' transações para os meses seguintes
    if (n > 1) {
      const groupId = uid();
      const [yy, mm, dd] = date.split('-').map(Number);
      
      for (let i = 1; i <= n; i++) {
        let loopDateStr = date;
        if (i > 1) {
          const dObj = new Date(yy, mm - 1 + (i - 1), dd);
          // Ajuste para evitar que dia 31 pule para o mês errado (ex: 31 Jan -> 3 Março)
          const targetMonth = ((mm - 1 + (i - 1)) % 12 + 12) % 12;
          if (dObj.getMonth() !== targetMonth) {
            dObj.setDate(0); 
          }
          loopDateStr = dObj.getFullYear() + '-' + String(dObj.getMonth() + 1).padStart(2, '0') + '-' + String(dObj.getDate()).padStart(2, '0');
        }

        transactions.push({
          id:uid(), type:currentType, desc, amount:savedAmount, date:loopDateStr, cat, payment, notes, recurring,
          cardKey, cardLabel,
          installments: n,
          installmentPaid: i,
          installmentValue: savedAmount,
          installmentTotal: totalAmt,
          installmentGroupId: groupId,
          createdAt:new Date().toISOString()
        });
      }
      showToast(`Compra parcelada: ${n}x de R$ ${(savedAmount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} ✓`, 'success');
    } else {
      transactions.push({
        id:uid(), type:currentType, desc, amount:savedAmount, date, cat, payment, notes, recurring,
        cardKey, cardLabel,
        installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null,
        createdAt:new Date().toISOString()
      });
      showToast('Transação adicionada ✓', 'success');
    }
  }

  saveData();
  closeModal();
  renderSection(currentSection());
  renderDashboardKPIs();
  checkAlerts();
}

function deleteTransaction(id) {
  const tx = transactions.find(t => t.id === id);
  if (!tx) return;

  const gid = tx.installmentGroupId;
  const msg = gid ? 'Esta é uma compra parcelada. Excluir TODAS as parcelas desta compra?' : 'Excluir esta transação?';

  if (!confirm(msg)) return;

  if (gid) {
    transactions = transactions.filter(t => t.installmentGroupId !== gid);
    showToast('Todas as parcelas foram excluídas ✓', 'warning');
  } else {
    transactions = transactions.filter(t => t.id !== id);
    showToast('Transação excluída', 'warning');
  }

  saveData();
  renderSection(currentSection());
  renderDashboardKPIs();
  checkAlerts();
}

// ── BULK SELECT ──────────────────────────────────
function toggleSelectMode() {
  selectMode = !selectMode;
  selectedIds.clear();

  const btn = document.getElementById('btnSelectMode');
  const bar = document.getElementById('bulkActionBar');
  const txList = document.getElementById('txList');

  if (selectMode) {
    btn.classList.add('select-active');
    btn.textContent = '✕ Cancelar';
    bar.style.display = 'flex';
    txList.classList.add('select-mode');
  } else {
    btn.classList.remove('select-active');
    btn.textContent = '☑ Selecionar';
    bar.style.display = 'none';
    txList.classList.remove('select-mode');
  }
  updateBulkBar();
  renderTransactions();
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.tx-checkbox').forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.id;
    if (checked) selectedIds.add(id);
    else selectedIds.delete(id);
    cb.closest('.tx-item').classList.toggle('tx-selected', checked);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const count = selectedIds.size;
  const countEl = document.getElementById('bulkCount');
  const deleteBtn = document.getElementById('btnDeleteSelected');
  const checkAll = document.getElementById('checkAllTx');
  const total = document.querySelectorAll('.tx-checkbox').length;

  if (countEl) countEl.textContent = count === 0 ? 'Nenhuma selecionada' : `${count} selecionada${count > 1 ? 's' : ''}`;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  if (checkAll) {
    checkAll.indeterminate = count > 0 && count < total;
    checkAll.checked = total > 0 && count === total;
  }
}

function toggleTxSelection(id, el) {
  if (!selectMode) return;
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    el.classList.remove('tx-selected');
    const cb = el.querySelector('.tx-checkbox');
    if (cb) cb.checked = false;
  } else {
    selectedIds.add(id);
    el.classList.add('tx-selected');
    const cb = el.querySelector('.tx-checkbox');
    if (cb) cb.checked = true;
  }
  updateBulkBar();
}

function deleteSelected() {
  if (selectedIds.size === 0) return;

  // Expand group IDs: clicking any installment of a group selects the whole group
  const groupIds = new Set();
  const singleIds = new Set();
  selectedIds.forEach(id => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    if (tx.installmentGroupId) groupIds.add(tx.installmentGroupId);
    else singleIds.add(id);
  });

  const totalGroups = groupIds.size;
  const totalSingles = singleIds.size;
  let msg = '';
  if (totalGroups > 0 && totalSingles > 0) {
    msg = `Você selecionou ${totalSingles} transação(ões) avulsas e ${totalGroups} compra(s) parcelada(s). Todas as parcelas das compras parceladas também serão excluídas. Confirmar?`;
  } else if (totalGroups > 0) {
    msg = `Excluir ${totalGroups} compra(s) parcelada(s) e todas as suas parcelas?`;
  } else {
    msg = `Excluir ${totalSingles} transação(ões) selecionada(s)?`;
  }

  if (!confirm(msg)) return;

  transactions = transactions.filter(t => {
    if (t.installmentGroupId && groupIds.has(t.installmentGroupId)) return false;
    if (singleIds.has(t.id)) return false;
    return true;
  });

  const totalDeleted = totalSingles + totalGroups;
  showToast(`${totalDeleted} item(ns) excluído(s) ✓`, 'warning');

  // Exit select mode
  selectMode = false;
  selectedIds.clear();
  const btn = document.getElementById('btnSelectMode');
  const bar = document.getElementById('bulkActionBar');
  const txList = document.getElementById('txList');
  if (btn) { btn.classList.remove('select-active'); btn.textContent = '☑ Selecionar'; }
  if (bar) bar.style.display = 'none';
  if (txList) txList.classList.remove('select-mode');

  saveData();
  renderSection(currentSection());
  renderDashboardKPIs();
  checkAlerts();
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

    const catPrefix = cat.emoji ? cat.emoji + ' ' : '';
    if (pct >= 1) alerts.push({ text:`${catPrefix}${cat.name}: orçamento <strong>EXCEDIDO</strong> (R$ ${fmt(spent)} / ${fmt(b.limit)})`, level:'danger' });
    else if (pct >= 0.8) alerts.push({ text:`${catPrefix}${cat.name}: 80% do orçamento usado (R$ ${fmt(spent)} / ${fmt(b.limit)})`, level:'warning' });
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
  if (!period) return transactions;
  return transactions.filter(t => t.date?.startsWith(period));
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
  const period = document.getElementById('dashPeriod').value || new Date().toISOString().slice(0,7);
  const [py, pm] = period.split('-').map(Number);
  const selectedDate = new Date(py, pm - 1, 1);
  const months = [];
  const incomes = [], expenses = [];

  for (let i=5; i>=0; i--) {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth()-i, 1);
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
  const month = document.getElementById('dashPeriod').value || new Date().toISOString().slice(0,7);
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
      <span>${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}</span>
      <span class="legend-pct">${pct}%</span>
    </div>`;
  }).join('');
}

function renderBudgetOverview() {
  const month = document.getElementById('dashPeriod').value || new Date().toISOString().slice(0,7);
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
        <span class="budget-item-name">${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}</span>
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
    const header = `<div class="tx-list-header">
      <div class="tc-icon"></div>
      <div class="tc-desc">Descrição</div>
      <div class="tc-cat">Categoria</div>
      <div class="tc-date">Data</div>
      <div class="tc-pay">Pagamento</div>
      <div class="tc-notes">Notas</div>
      <div class="tc-amt">Valor</div>
      <div class="tc-acts"></div>
    </div>`;
    el.innerHTML = header + list.map(t => txItemHTML(t, true)).join('');
    // Apply select mode class to list
    if (selectMode) {
      el.classList.add('select-mode');
      // Restore previously selected items
      selectedIds.forEach(id => {
        const item = el.querySelector(`.tx-item[data-id="${id}"]`);
        if (item) {
          item.classList.add('tx-selected');
          const cb = item.querySelector('.tx-checkbox');
          if (cb) cb.checked = true;
        }
      });
      updateBulkBar();
    } else {
      el.classList.remove('select-mode');
    }
  }
}

function txItemHTML(t, showActions=false) {
  const cat = getCat(t.cat);
  const dateStr = t.date ? new Date(t.date+'T00:00:00').toLocaleDateString('pt-BR') : '';

  // In select mode: clicking the row toggles selection; otherwise opens modal
  const rowClick = selectMode
    ? `onclick="toggleTxSelection('${t.id}', this)"`
    : `onclick="openModal('${t.id}')"`;

  const actions = showActions ? `<div class="tx-actions">
    <button class="tx-btn" onclick="event.stopPropagation();openModal('${t.id}')" title="Editar">✏️</button>
    <button class="tx-btn" onclick="event.stopPropagation();deleteTransaction('${t.id}')" title="Excluir">🗑</button>
  </div>` : '';

  const checkbox = showActions
    ? `<input type="checkbox" class="tx-checkbox" data-id="${t.id}" onclick="event.stopPropagation();toggleTxSelection('${t.id}', this.closest('.tx-item'))">`
    : '';

  // Installment info
  let installBadge = '';
  let installDetail = '';
  if (t.installments && t.installments > 1) {
    const paid      = t.installmentPaid || 1;
    const remaining = t.installments - paid;
    installBadge  = `<span class="tx-installment-badge">${paid}/${t.installments}x</span>`;
    installDetail = `<div class="tx-installment-detail">
      <span class="tx-inst-chip parcela">💳 R$ ${fmt(t.installmentValue)}/parcela</span>
      <span class="tx-inst-chip total">Total R$ ${fmt(t.installmentTotal)}</span>
      <span class="tx-inst-chip prog">Faltam ${remaining}x</span>
    </div>`;
  }

  // Card badge
  const cardBadge = t.cardLabel ? `<span class="tx-card-badge tx-card-${t.cardKey || 'outro'}">${t.cardLabel}</span>` : '';

  return `<div class="tx-item ${showActions ? 'tx-item-wide' : ''} ${selectedIds.has(t.id) ? 'tx-selected' : ''}" data-id="${t.id}" ${rowClick}>
    ${checkbox}
    <div class="tx-icon" style="background:${cat.color}22">${cat.emoji}</div>
    <div class="tx-info mobile-col">
      <div class="tx-desc">${esc(t.desc)}${t.recurring?' 🔄':''}</div>
      <div class="tx-meta">${cat.name} · ${dateStr} · ${t.payment}${cardBadge}${installBadge}</div>
      ${installDetail}
    </div>
    <div class="desktop-col tc-desc" title="${esc(t.desc)}">${esc(t.desc)}${t.recurring?' 🔄':''}</div>
    <div class="desktop-col tc-cat">${cat.emoji ? cat.emoji + ' ' : ''}${cat.name}</div>
    <div class="desktop-col tc-date">${dateStr}</div>
    <div class="desktop-col tc-pay">${t.payment}${cardBadge}${installBadge} ${installDetail}</div>
    <div class="desktop-col tc-notes" title="${esc(t.notes || '')}">${esc(t.notes || '-')}</div>
    <div class="tx-amount tc-amt ${t.type}">${t.type==='income'?'+':'-'}R$ ${fmt(t.installmentValue || t.amount)}</div>
    <div class="${showActions ? 'tc-acts' : ''}">${actions}</div>
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
        <span class="budget-card-emoji">${cat.emoji || ''}</span>
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
      labels: sorted.map(([k])=>{ const c=getCat(k); return `${c.emoji ? c.emoji + ' ' : ''}${c.name}`; }),
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
          <td>${v.emoji ? v.emoji + ' ' : ''}${v.name}</td>
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
      <span class="cat-name">${c.emoji ? c.emoji + ' ' : ''}${c.name}</span>
      <button class="cat-del" onclick="deleteCategory('${c.id}')">✕</button>
    </div>`).join('');
  }
}

function addCustomCategory() {
  const name = document.getElementById('newCatName').value.trim();
  const color = document.getElementById('newCatColor').value;
  const emojiInput = document.getElementById('newCatEmoji');
  const emoji = emojiInput ? emojiInput.value.trim() : '';
  if (!name) { showToast('Informe o nome', 'error'); return; }
  const id = 'cat_' + Date.now();
  categories.push({ id, name, emoji: emoji, color });
  saveData();
  buildCategorySelects();
  renderSettings();
  document.getElementById('newCatName').value = '';
  if (emojiInput) emojiInput.value = '';
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

// ── EXPORT / IMPORT CSV ──────────────────────────
function triggerImportCSV() {
  const input = document.getElementById('csvFileInput');
  if (input) input.click();
}

function handleCSVImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    parseCSVAndImport(text);
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

function parseCSVAndImport(csvText) {
  if (!csvText || csvText.trim() === '') {
    showToast('Arquivo CSV vazio ou inválido', 'error');
    return;
  }

  // ── 1. Parsear CSV corretamente (suporta quebras de linha dentro de aspas) ──
  const firstLineIdx = csvText.indexOf('\n');
  const firstLine = firstLineIdx !== -1 ? csvText.substring(0, firstLineIdx) : csvText;
  const delimiter = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

  function parseCSV(text, delim) {
    const rows = [];
    let curRow = [];
    let curCell = '';
    let inQ = false;
    
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];
        
        if (c === '"') {
            if (inQ && next === '"') {
                curCell += '"';
                i++; // pula aspa escapada
            } else {
                inQ = !inQ;
            }
        } else if (c === delim && !inQ) {
            curRow.push(curCell);
            curCell = '';
        } else if ((c === '\n' || c === '\r') && !inQ) {
            if (c === '\r' && next === '\n') {
                i++;
            }
            curRow.push(curCell);
            if (curRow.length > 1 || curRow[0] !== '') {
               rows.push(curRow.map(v => v.trim()));
            }
            curRow = [];
            curCell = '';
        } else {
            curCell += c;
        }
    }
    // Adiciona o restinho
    if (curCell !== '' || curRow.length > 0) {
        curRow.push(curCell);
        rows.push(curRow.map(v => v.trim()));
    }
    return rows;
  }

  const rows = parseCSV(csvText.trim(), delimiter);
  if (rows.length < 2) {
    showToast('Arquivo CSV vazio ou sem dados', 'error');
    return;
  }

  // ── Mapear colunas pelo cabeçalho ──
  const headerRow = rows[0].map(h => h.toLowerCase());
  const col = (terms) => headerRow.findIndex(h => terms.some(t => h.includes(t)));
  const idx = {
    date:    col(['data']),
    desc:    col(['lan\u00e7amento','lancamento','descri']),
    catCol:  col(['categ']),
    tipo:    col(['tipo']),
    amount:  col(['valor']),
    payment: col(['pagam']),
    card:    col(['cart\u00e3o','cartao','card']),
    notes:   col(['nota','obs']),
  };
  if (idx.date   < 0) idx.date   = 0;
  if (idx.desc   < 0) idx.desc   = 1;
  if (idx.catCol < 0) idx.catCol = 2;
  if (idx.tipo   < 0) idx.tipo   = 3;
  if (idx.amount < 0) idx.amount = 4;

  // ── Mapeamento categorias banco → app ──
  const BANK_CAT_MAP = {
    'supermercado':'food','restaurantes':'food','alimentacao':'food','alimenta\u00e7ao':'food',
    'padaria':'food','transporte':'transport','combustivel':'transport','combust\u00edvel':'transport',
    'estacionamento':'transport','saude':'health','sa\u00fade':'health','drogaria':'health',
    'farmacia':'health','farm\u00e1cia':'health','hospital':'health','ensino':'education',
    'educacao':'education','educa\u00e7\u00e3o':'education','entretenimento':'leisure',
    'esportes':'leisure','lazer':'leisure','vestuario':'clothing','vestu\u00e1rio':'clothing',
    'construcao':'housing','constru\u00e7\u00e3o':'housing','moradia':'housing',
    'servicos':'bills','servi\u00e7os':'bills','compras':'other','outros':'other',
  };

  function parseDate(str) {
    str = (str || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }

  function cleanDesc(raw) {
    return raw
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s{2,}[A-Z][A-Za-z\s]+(BRA|SC|SP|RJ|MG|RS|PR|BA|CE|GO|PE|AM|PA|MT|MS|ES|AL|PB|RN|PI|MA|TO|SE|RO|AC|AP|RR|DF)\s*$/i, '')
      .replace(/\s{2,}/g, ' ').trim();
  }

  function addMonths(dateStr, n) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1 + n, d);
    const targetMon = ((m - 1 + n) % 12 + 12) % 12;
    if (dt.getMonth() !== targetMon) dt.setDate(0);
    return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
  }

  let importedCount = 0, skippedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 2) continue;

    const dateRaw = (row[idx.date]   || '').trim();
    const descRaw = (row[idx.desc]   || '').trim();
    const catRaw  = (row[idx.catCol] || '').trim().toLowerCase();
    const tipoRaw = (row[idx.tipo]   || '').trim();
    const amtRaw  = (row[idx.amount] || '').trim();

    const date = parseDate(dateRaw);
    if (!date) { skippedCount++; continue; }

    const desc = cleanDesc(descRaw);
    if (!desc) { skippedCount++; continue; }

    // Limpeza de valor blindada
    const amtClean = amtRaw.replace(/R\$\s*/gi, '').replace(/[\u00A0\s]/g, '').replace(/\./g, '').replace(',', '.').trim();
    const amount = parseFloat(amtClean);
    if (isNaN(amount)) { skippedCount++; continue; }

    if (amount < 0 && /pagto|pagamento|debito automat/i.test(desc)) { skippedCount++; continue; }

    const type = amount < 0 ? 'income' : 'expense';
    const absAmount = Math.abs(amount);
    if (absAmount <= 0) { skippedCount++; continue; }

    const catId = BANK_CAT_MAP[catRaw] || detectCategory(desc) || 'other';

    const parcelaMatch = tipoRaw.match(/parcela\s+(\d+)\/(\d+)/i);

    if (parcelaMatch) {
      const paidNum  = parseInt(parcelaMatch[1]);
      const totalNum = parseInt(parcelaMatch[2]);
      const installValue = +absAmount.toFixed(2);
      const installTotal = +(installValue * totalNum).toFixed(2);
      const firstDate = addMonths(date, -(paidNum - 1));

      const dupKey = `${desc}|${installTotal}|${firstDate}|${totalNum}`;
      if (transactions.some(t => t._importKey === dupKey)) { skippedCount++; continue; }

      const groupId = uid();
      for (let p = 1; p <= totalNum; p++) {
        transactions.push({
          id: uid(), type, desc, amount: installValue,
          date: addMonths(firstDate, p - 1),
          cat: catId, payment: 'credito', notes: 'Importado CSV (Inter)',
          recurring: false, cardKey: 'inter', cardLabel: 'Inter',
          installments: totalNum, installmentPaid: p,
          installmentValue: installValue, installmentTotal: installTotal,
          installmentGroupId: groupId, _importKey: dupKey,
          createdAt: new Date().toISOString()
        });
      }
      importedCount++;
    } else {
      if (transactions.some(t => t.desc === desc && t.date === date && Math.abs(t.amount - absAmount) < 0.01)) {
        skippedCount++; continue;
      }
      transactions.push({
        id: uid(), type, desc, amount: absAmount, date,
        cat: catId, payment: type === 'income' ? 'Estorno' : 'credito',
        notes: 'Importado CSV (Inter)', recurring: false,
        cardKey: type === 'income' ? null : 'inter',
        cardLabel: type === 'income' ? null : 'Inter',
        installments: null, installmentPaid: null,
        installmentValue: null, installmentTotal: null,
        createdAt: new Date().toISOString()
      });
      importedCount++;
    }
  }

  if (importedCount > 0) {
    saveData();
    renderSection(currentSection());
    if (currentSection() !== 'dashboard') renderDashboardKPIs();
    checkAlerts();
    const extra = skippedCount > 0 ? ` (${skippedCount} puladas ou duplicadas)` : '';
    showToast(`${importedCount} lançamentos importados!${extra} ✓`, 'success');
  } else {
    showToast('Nenhuma transação nova importada.', 'warning');
  }
}

function exportCSV() {
  // Inclui coluna Cartão para que reimportação reconheça o cartão correto
  const header = 'Data,Tipo,Descrição,Categoria,Valor,Pagamento,Cartão,Notas\n';
  const rows = transactions.map(t => [
    t.date,
    t.type === 'income' ? 'Entrada' : 'Saída',
    `"${(t.desc  || '').replace(/"/g, '""')}"`,
    getCat(t.cat).name,
    t.amount.toFixed(2),
    t.payment || '',
    t.cardLabel || '',
    `"${(t.notes || '').replace(/"/g, '""')}"`
  ].join(',')).join('\n');

  const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `financeflow_${new Date().toISOString().slice(0, 10)}.csv`;
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

function setDefaultDate() {
  document.getElementById('fDate').value = new Date().toISOString().slice(0,10);
}
function setDefaultFilterMonth() {
  const m = new Date().toISOString().slice(0,7);
  const filterMonth = document.getElementById('filterMonth');
  if (filterMonth) filterMonth.value = m;
  const filterMonthCards = document.getElementById('filterMonthCards');
  if (filterMonthCards) filterMonthCards.value = m;
  const dashPeriod = document.getElementById('dashPeriod');
  if (dashPeriod) dashPeriod.value = m;
}

function renderCards() {
  const month = document.getElementById('filterMonthCards').value;
  const el = document.getElementById('cardsGrid');
  if (!el) return;

  const knownCards = [
    { id: 'inter',  name: 'Inter',  initials: 'IN' },
    { id: 'nubank', name: 'Nubank', initials: 'NU' },
    { id: 'amazon', name: 'Amazon', initials: 'AZ' },
    { id: 'outro',  name: 'Outro',  initials: '++' }
  ];

  const html = knownCards.map(c => {
    const isThisCard = (t) => {
      if (t.type !== 'expense') return false;
      if (t.cardKey) return t.cardKey === c.id;
      return (t.payment === 'credito' && c.id === 'outro');
    };

    // Gasto no mês = soma das parcelas com vencimento neste mês
    const monthlyAmount = transactions
      .filter(t => isThisCard(t) && t.date?.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);

    // Total acumulado = soma de todas as parcelas já lançadas
    const totalAmount = transactions
      .filter(t => isThisCard(t) && t.date?.slice(0,7) <= month)
      .reduce((sum, t) => sum + t.amount, 0);

    // Parcelas futuras (após o mês selecionado)
    const futureTxs = transactions.filter(t =>
      isThisCard(t) && t.installmentGroupId && t.date?.slice(0,7) > month
    );
    const pendingTotal = futureTxs.reduce((s, t) => s + t.amount, 0);
    const pendingCount = futureTxs.length;

    const pendingHtml = pendingTotal > 0 ? `
          <div class="cc-stat-row">
            <span class="cc-stat-label">Parcelas Futuras</span>
            <span class="cc-val-pending" style="color:#f59e0b">R$ ${fmt(pendingTotal)} (${pendingCount}x)</span>
          </div>` : '';

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
          ${pendingHtml}
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

function showToast(msg, type='success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(()=>{ t.classList.remove('show'); }, 3000);
}

// ── START ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
