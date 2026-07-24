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

let GEMINI_API_KEY = localStorage.getItem('ff_gemini_api_key') || '';

function escapeHTML(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

// ── HELPER FUNCTIONS (LOCAL DATES & AMOUNT PARSING) ───
function getTodayStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getSafeMonthDate(year, monthIndex, day) {
  const targetDate = new Date(year, monthIndex, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(day, maxDays);
  const result = new Date(targetYear, targetMonth, safeDay);
  return result.getFullYear() + '-' + String(result.getMonth() + 1).padStart(2, '0') + '-' + String(result.getDate()).padStart(2, '0');
}

function parseAmount(amtRaw) {
  if (typeof amtRaw === 'number') return isNaN(amtRaw) ? 0 : amtRaw;
  if (!amtRaw) return 0;
  let str = String(amtRaw).replace(/R\$\s*/gi, '').replace(/[\u00A0\s]/g, '').trim();
  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

const DEFAULT_CARDS = [
  { id: 'inter',  name: 'Inter',  initials: 'IN', color: 'linear-gradient(135deg,#f97316,#ea580c)', limit: 5000 },
  { id: 'nubank', name: 'Nubank', initials: 'NU', color: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', limit: 8000 },
  { id: 'amazon', name: 'Amazon', initials: 'AZ', color: 'linear-gradient(135deg,#f59e0b,#d97706)', limit: 4000 },
  { id: 'outro',  name: 'Outro',  initials: '++', color: 'linear-gradient(135deg,#64748b,#475569)', limit: 2000 }
];
let customCards = [];

function triggerScanReceipt() {
  document.getElementById('receiptFileInput').click();
}

async function handleReceiptImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const previewImg = document.getElementById('scanPreview');
  if (previewImg) {
    previewImg.src = URL.createObjectURL(file);
  }

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
  if (!GEMINI_API_KEY) {
    throw new Error('Chave da API do Gemini não configurada. Por favor, insira sua chave nas Configurações.');
  }

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
    
    const fields = {
      fDesc: data.desc || '',
      fAmount: data.amount ? String(data.amount).replace('.', ',') : '',
      fDate: data.date || new Date().toISOString().slice(0,10),
      fNotes: data.notes || '',
      fCategory: data.cat || 'other'
    };

    for (const [id, val] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) {
        el.value = val;
        el.classList.add('ia-filled');
        
        const removeFn = () => {
          el.classList.remove('ia-filled');
          el.removeEventListener('focus', removeFn);
          el.removeEventListener('input', removeFn);
          el.removeEventListener('change', removeFn);
        };
        el.addEventListener('focus', removeFn);
        el.addEventListener('input', removeFn);
        el.addEventListener('change', removeFn);
      }
    }
    
    if (typeof updateInstallmentPreview === 'function') {
      updateInstallmentPreview();
    }
    
    showToast(`✅ Nota analisada! Confira os dados em amarelo e salve.`);
  }, 200);
}

// ── STATE ────────────────────────────────────────
let transactions = [];
let budgets = [];
let categories = [];
let goals = [];
let editingId = null;
let editingGoalId = null;
let editingCardId = null;
let loginInProgress = false;
let currentType = 'expense';
let chartMonthly = null, chartCategory = null, chartAnnual = null, chartTopCat = null, chartTrend = null;

// Bulk select state
let selectMode = false;
let selectedIds = new Set();

// ── INIT ─────────────────────────────────────────
function init() {
  if (auth) {
    auth.useDeviceLanguage();
    auth.getRedirectResult().then(result => {
      if (result && result.user) {
        localStorage.removeItem('ff_guest_mode');
        setLoginState('Login concluído. Carregando seus dados...', 'success');
        showToast(`Login realizado! Bem-vindo(a) ${result.user.displayName || ''} 👋`, 'success');
      }
    }).catch(err => {
      console.error('Erro no resultado do redirecionamento:', err);
      handleLoginError(err);
    });

    auth.onAuthStateChanged(user => {
      if (user) {
        localStorage.removeItem('ff_guest_mode');
        loginInProgress = false;
        setLoginState('', 'success');
        currentUser = user;
        document.getElementById('loginOverlay').style.display = 'none';
        loadDataFromFirebase();
      } else {
        currentUser = null;
        if (localStorage.getItem('ff_guest_mode') === 'true') {
          loadData();
          finishInit();
        } else {
          document.getElementById('loginOverlay').style.display = 'flex';
        }
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
  buildCardSelector();
  setDefaultDate();
  setDefaultFilterMonth();
  setupEventListeners();
  setupDragAndDrop();
  processRecurringTransactions();
  navigate('dashboard');
  if (!currentUser) loadDemoDataIfEmpty();
}

function processRecurringTransactions() {
  if (!transactions || transactions.length === 0) return;

  const currentMonth = getCurrentMonthStr();
  const recurringTxs = transactions.filter(t => t.recurring);
  if (recurringTxs.length === 0) return;

  const templatesMap = new Map();
  recurringTxs.forEach(t => {
    const key = `${t.desc.toLowerCase()}|${t.cat}|${t.amount}`;
    if (!templatesMap.has(key)) {
      templatesMap.set(key, t);
    }
  });

  let createdCount = 0;
  templatesMap.forEach(tpl => {
    const existsThisMonth = transactions.some(t => 
      t.date && t.date.slice(0, 7) === currentMonth &&
      t.desc.toLowerCase() === tpl.desc.toLowerCase() &&
      t.cat === tpl.cat
    );

    if (!existsThisMonth) {
      const targetDate = `${currentMonth}-01`;
      transactions.push({
        id: uid(),
        type: tpl.type || 'expense',
        desc: tpl.desc,
        amount: tpl.amount,
        date: targetDate,
        cat: tpl.cat,
        payment: tpl.payment || 'outro',
        notes: (tpl.notes ? tpl.notes + ' ' : '') + '(Recorrente automático)',
        recurring: true,
        cardKey: tpl.cardKey || null,
        cardLabel: tpl.cardLabel || null,
        installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null,
        createdAt: new Date().toISOString()
      });
      createdCount++;
    }
  });

  if (createdCount > 0) {
    saveData();
    showToast(`${createdCount} despesa(s) recorrente(s) gerada(s) para este mês 🔄`, 'info');
  }
}

function setLoginState(message = '', type = 'info', busy = false) {
  const button = document.getElementById('googleLoginBtn');
  const label = document.getElementById('googleLoginButtonLabel');
  const status = document.getElementById('loginStatus');

  if (button) button.disabled = busy;
  if (label) label.textContent = busy ? 'Abrindo o Google...' : 'Entrar com Google';
  if (status) {
    status.textContent = message;
    status.className = `login-status ${message ? 'show' : ''} ${type}`;
  }
}

function handleLoginError(err) {
  const code = err?.code || '';
  const messages = {
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente.',
    'auth/popup-closed-by-user': 'A entrada foi cancelada antes de concluir. Toque em “Entrar com Google” para tentar novamente.',
    'auth/cancelled-popup-request': 'Já existe uma tentativa de entrada em andamento.',
    'auth/network-request-failed': 'Não foi possível conectar ao Google. Verifique a internet e tente novamente.',
    'auth/web-storage-unsupported': 'O navegador está bloqueando o armazenamento necessário. Abra o site no Safari ou Chrome fora do modo privado.',
    'auth/unauthorized-domain': `O domínio ${window.location.hostname} precisa ser autorizado no Firebase. Enquanto isso, use o modo local.`,
    'auth/operation-not-supported-in-this-environment': 'Este navegador não permite a entrada do Google. Abra o site diretamente no Safari ou Chrome.',
  };
  const message = messages[code] || 'Não foi possível entrar com o Google. Tente novamente ou use o modo local.';

  loginInProgress = false;
  setLoginState(message, 'error', false);
  showToast(message, 'error');
}

async function loginWithGoogle() {
  if (loginInProgress) return;
  localStorage.removeItem('ff_guest_mode');
  if (typeof firebase === 'undefined' || !auth) {
    handleLoginError({ code: 'auth/operation-not-supported-in-this-environment' });
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  loginInProgress = true;
  setLoginState('Uma janela segura do Google será aberta para você escolher a conta.', 'info', true);

  try {
    const result = await auth.signInWithPopup(provider);
    if (result?.user) {
      localStorage.removeItem('ff_guest_mode');
      setLoginState('Login concluído. Carregando seus dados...', 'success', true);
    }
  } catch (err) {
    console.error('Erro no login Google:', err);
    handleLoginError(err);
  }
}

function useGuestMode() {
  localStorage.setItem('ff_guest_mode', 'true');
  loginInProgress = false;
  setLoginState('', 'info', false);
  currentUser = null;
  loadData();
  finishInit();
  showToast('Modo Local (Offline) ativado ⚡', 'info');
}

function logout() {
  localStorage.removeItem('ff_guest_mode');
  if (auth) {
    auth.signOut().then(() => {
      document.getElementById('loginOverlay').style.display = 'flex';
    });
  } else {
    document.getElementById('loginOverlay').style.display = 'flex';
  }
}

function loadData() {
  transactions = JSON.parse(localStorage.getItem('ff_transactions') || '[]');
  budgets      = JSON.parse(localStorage.getItem('ff_budgets')      || '[]');
  categories   = JSON.parse(localStorage.getItem('ff_categories')   || JSON.stringify(DEFAULT_CATEGORIES));
  customCards  = JSON.parse(localStorage.getItem('ff_custom_cards')  || JSON.stringify(DEFAULT_CARDS));
  goals        = JSON.parse(localStorage.getItem('ff_goals')         || '[]');
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
      customCards  = JSON.parse(data.customCards  || JSON.stringify(DEFAULT_CARDS));
      goals        = JSON.parse(data.goals        || '[]');
      localStorage.setItem('ff_transactions', JSON.stringify(transactions));
      localStorage.setItem('ff_budgets',      JSON.stringify(budgets));
      localStorage.setItem('ff_categories',   JSON.stringify(categories));
      localStorage.setItem('ff_custom_cards',  JSON.stringify(customCards));
      localStorage.setItem('ff_goals',         JSON.stringify(goals));
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
  localStorage.setItem('ff_custom_cards',  JSON.stringify(customCards));
  localStorage.setItem('ff_goals',         JSON.stringify(goals));
  
  if (currentUser && db) {
    db.collection('users').doc(currentUser.uid).set({
      transactions: JSON.stringify(transactions),
      budgets: JSON.stringify(budgets),
      categories: JSON.stringify(categories),
      customCards: JSON.stringify(customCards),
      goals: JSON.stringify(goals),
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

  const titles = { dashboard:'Dashboard', transactions:'Transações', cards:'Meus Cartões', budgets:'Orçamentos', goals:'Metas', reports:'Relatórios', settings:'Preferências' };
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
  if (sec === 'goals')        renderGoals();
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
  };

  for (const [id, setup] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) setup();
  }

  setupPeriodFilter('dash', renderDashboard);
  setupPeriodFilter('transactions', renderTransactions);
  setupPeriodFilter('cards', renderCards);

  ['filterType','filterCategory','filterSearch'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderTransactions);
  });
}

const PERIOD_FILTER_IDS = {
  dash: { mode:'dashPeriodMode', day:'dashDate', month:'dashMonth', year:'dashYear' },
  transactions: { mode:'transactionsPeriodMode', day:'transactionsDate', month:'transactionsMonth', year:'transactionsYear' },
  cards: { mode:'cardsPeriodMode', day:'cardsDate', month:'cardsMonth', year:'cardsYear' },
};

function populatePeriodYears() {
  const currentYear = new Date().getFullYear();
  const years = new Set();
  for (let year = currentYear - 8; year <= currentYear + 1; year++) years.add(year);
  transactions.forEach(t => {
    const year = Number(t.date?.slice(0, 4));
    if (year) years.add(year);
  });

  const options = [...years].sort((a,b) => b-a).map(year => `<option value="${year}">${year}</option>`).join('');
  Object.values(PERIOD_FILTER_IDS).forEach(ids => {
    const select = document.getElementById(ids.year);
    if (select) select.innerHTML = options;
  });
}

function syncPeriodFilter(prefix) {
  const ids = PERIOD_FILTER_IDS[prefix];
  if (!ids) return;
  const mode = document.getElementById(ids.mode)?.value || 'month';
  const container = document.querySelector(`[data-period-filter="${prefix}"]`);
  container?.querySelectorAll('[data-period-mode]').forEach(button => {
    const isActive = button.dataset.periodMode === mode;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
  ['day','month','year'].forEach(type => {
    const input = document.getElementById(ids[type]);
    if (input) input.hidden = type !== mode;
  });
}

function setupPeriodFilter(prefix, callback) {
  const ids = PERIOD_FILTER_IDS[prefix];
  if (!ids) return;
  const mode = document.getElementById(ids.mode);
  const container = document.querySelector(`[data-period-filter="${prefix}"]`);
  container?.querySelectorAll('[data-period-mode]').forEach(button => {
    button.addEventListener('click', () => {
      if (!mode || mode.value === button.dataset.periodMode) return;
      mode.value = button.dataset.periodMode;
      syncPeriodFilter(prefix);
      callback();
    });
  });
  ['day','month','year'].forEach(type => {
    document.getElementById(ids[type])?.addEventListener('input', callback);
  });
  syncPeriodFilter(prefix);
}

function getPeriodSelection(prefix) {
  const ids = PERIOD_FILTER_IDS[prefix];
  if (!ids) return { mode:'month', value:getCurrentMonthStr() };
  const mode = document.getElementById(ids.mode)?.value || 'month';
  const fallback = mode === 'day' ? getTodayStr() : mode === 'year' ? String(new Date().getFullYear()) : getCurrentMonthStr();
  return { mode, value: document.getElementById(ids[mode])?.value || fallback };
}

function matchesPeriod(date, prefix) {
  if (!date) return false;
  const { mode, value } = getPeriodSelection(prefix);
  if (mode === 'day') return date === value;
  return date.startsWith(value);
}

function getPeriodMonth(prefix) {
  const { mode, value } = getPeriodSelection(prefix);
  if (mode === 'day') return value.slice(0, 7);
  if (mode === 'month') return value;
  return `${value}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodNoun(prefix) {
  const mode = getPeriodSelection(prefix).mode;
  return mode === 'day' ? 'Dia' : mode === 'year' ? 'Ano' : 'Mês';
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

function buildCardSelector() {
  const el = document.getElementById('cardSelector');
  if (!el) return;
  el.innerHTML = customCards.map((c, index) => {
    const initials = escapeHTML(c.initials || c.name.slice(0, 2).toUpperCase());
    const name = escapeHTML(c.name);
    return `<div class="card-chip ${index === 0 ? 'selected' : ''}" data-card="${c.id}" onclick="selectCard('${c.id}')">
      <div class="chip-logo" style="background:${c.color}">${initials}</div>
      ${name}
    </div>`;
  }).join('');
  
  if (customCards.length > 0) {
    window._selectedCard = customCards[0].id;
  } else {
    window._selectedCard = 'outro';
  }
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

  buildCardSelector();

  const defaultCard = customCards.length > 0 ? customCards[0].id : 'outro';

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
    if (typeof selectCard === 'function') selectCard(tx.cardKey || defaultCard);
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
    if (typeof selectCard === 'function') selectCard(defaultCard);
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
  const totalAmt  = parseAmount(document.getElementById('fAmount').value);
  const date      = document.getElementById('fDate').value;
  const cat       = document.getElementById('fCategory').value;
  const payment   = document.getElementById('fPayment').value;
  const notes     = document.getElementById('fNotes').value.trim();
  const recurring = document.getElementById('fRecurring').checked;

  const installEl  = document.getElementById('fInstallments');
  const n          = (payment === 'credito' && installEl) ? (parseInt(installEl.value) || 1) : 1;
  const cardKey    = (payment === 'credito' || payment === 'debito') ? (window._selectedCard || 'outro') : null;
  const cardObj    = customCards.find(c => c.id === cardKey);
  const cardLabel  = cardObj ? cardObj.name : (cardKey ? cardKey : null);

  if (!desc)   { showToast('Informe uma descrição', 'error'); return; }
  if (!totalAmt || totalAmt <= 0) { showToast('Informe um valor válido', 'error'); return; }
  if (!date)   { showToast('Informe a data', 'error'); return; }

  const savedAmount = n > 1 ? +(totalAmt / n).toFixed(2) : totalAmt;

  const [yy, mm, dd] = date.split('-').map(Number);
  let monthOffset = 0;
  if (payment === 'credito' && cardObj && cardObj.closingDay) {
    if (dd > parseInt(cardObj.closingDay)) {
      monthOffset = 1;
    }
  }

  if (editingId) {
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx === -1) { closeModal(); return; }
    
    const oldTx = transactions[idx];
    const gid = oldTx.installmentGroupId;

    if (gid) {
      const startDate = getSafeMonthDate(yy, (mm - 1) + monthOffset - (oldTx.installmentPaid - 1), dd);

      transactions = transactions.filter(t => t.installmentGroupId !== gid);

      if (n > 1) {
        const [sy, sm, sd] = startDate.split('-').map(Number);
        for (let i = 1; i <= n; i++) {
          const loopDateStr = getSafeMonthDate(sy, (sm - 1) + (i - 1), sd);
          transactions.push({
            id:uid(), type:currentType, desc, amount:savedAmount, date:loopDateStr, cat, payment, notes, recurring,
            cardKey, cardLabel,
            installments: n, installmentPaid: i, installmentValue: savedAmount, installmentTotal: totalAmt,
            installmentGroupId: gid, createdAt:new Date().toISOString()
          });
        }
      } else {
        transactions.push({
          id:uid(), type:currentType, desc, amount:savedAmount, date: startDate, cat, payment, notes, recurring,
          cardKey, cardLabel,
          installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null,
          createdAt:new Date().toISOString()
        });
      }
    } else {
      if (n > 1) {
        transactions.splice(idx, 1);
        const newGid = uid();
        for (let i = 1; i <= n; i++) {
          const loopDateStr = getSafeMonthDate(yy, (mm - 1) + monthOffset + (i - 1), dd);
          transactions.push({
            id:uid(), type:currentType, desc, amount:savedAmount, date:loopDateStr, cat, payment, notes, recurring,
            cardKey, cardLabel,
            installments: n, installmentPaid: i, installmentValue: savedAmount, installmentTotal: totalAmt,
            installmentGroupId: newGid, createdAt:new Date().toISOString()
          });
        }
      } else {
        const txDate = monthOffset === 1 ? getSafeMonthDate(yy, (mm - 1) + monthOffset, dd) : date;
        transactions[idx] = {
          ...transactions[idx],
          type:currentType, desc, amount:savedAmount, date: txDate, cat, payment, notes, recurring,
          cardKey, cardLabel,
          installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null
        };
      }
    }
    showToast('Transação atualizada ✓', 'success');
  } else {
    if (n > 1) {
      const groupId = uid();
      for (let i = 1; i <= n; i++) {
        const loopDateStr = getSafeMonthDate(yy, (mm - 1) + monthOffset + (i - 1), dd);

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
      showToast(`Compra parcelada: ${n}x de R$ ${(savedAmount).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} ${monthOffset === 1 ? '(mês seguinte)' : ''} ✓`, 'success');
    } else {
      const txDate = monthOffset === 1 ? getSafeMonthDate(yy, (mm - 1) + monthOffset, dd) : date;
      transactions.push({
        id:uid(), type:currentType, desc, amount:savedAmount, date: txDate, cat, payment, notes, recurring,
        cardKey, cardLabel,
        installments: null, installmentPaid: null, installmentValue: null, installmentTotal: null,
        createdAt:new Date().toISOString()
      });
      showToast(monthOffset === 1 ? 'Lançado na fatura do mês seguinte (após fechamento) 💳' : 'Transação adicionada ✓', 'success');
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

// ── METAS (GOALS) ──────────────────────────────────
function openGoalModal() {
  document.getElementById('gName').value = '';
  document.getElementById('gEmoji').value = '🎯';
  document.getElementById('gTargetDate').value = '';
  document.getElementById('gTargetValue').value = '';
  document.getElementById('gCurrentValue').value = '0';
  document.getElementById('goalModal').classList.add('open');
}

function closeGoalModal() {
  document.getElementById('goalModal').classList.remove('open');
}

function saveGoal() {
  const name = document.getElementById('gName').value.trim();
  const emoji = document.getElementById('gEmoji').value.trim() || '🎯';
  const targetDate = document.getElementById('gTargetDate').value;
  const targetValue = parseFloat(document.getElementById('gTargetValue').value);
  const currentValue = parseFloat(document.getElementById('gCurrentValue').value) || 0;

  if (!name) { showToast('Informe o nome da meta', 'error'); return; }
  if (!targetValue || targetValue <= 0) { showToast('Informe um valor objetivo válido', 'error'); return; }
  if (!targetDate) { showToast('Informe a data limite', 'error'); return; }

  goals.push({
    id: uid(),
    name,
    emoji,
    targetDate,
    targetValue,
    currentValue,
    createdAt: new Date().toISOString()
  });

  saveData();
  closeGoalModal();
  renderGoals();
  showToast('Meta criada ✓', 'success');
}

function deleteGoal(id) {
  if (!confirm('Deseja excluir esta meta?')) return;
  goals = goals.filter(g => g.id !== id);
  saveData();
  renderGoals();
  showToast('Meta excluída', 'warning');
}

function renderGoals() {
  const el = document.getElementById('goalsGrid');
  if (!el) return;

  if (goals.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><p>Nenhuma meta definida.<br>Clique em "+ Nova Meta" para começar.</p></div>`;
    return;
  }

  el.innerHTML = goals.map(g => {
    const pct = Math.min(100, (g.currentValue / g.targetValue) * 100);
    const color = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--accent-bright)' : 'var(--yellow)';
    const dateStr = g.targetDate ? new Date(g.targetDate+'T00:00:00').toLocaleDateString('pt-BR') : '';

    return `
      <div class="budget-card animate-fade-in">
        <div class="budget-card-header">
          <span class="budget-card-emoji">${g.emoji || '🏆'}</span>
          <div style="display:flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="openAporteModal('${g.id}')">Aportar</button>
            <button class="budget-delete" onclick="deleteGoal('${g.id}')">✕</button>
          </div>
        </div>
        <div class="budget-card-title">${g.name}</div>
        <div style="font-size:11px;color:var(--text2);margin-top:2px">Alvo: ${dateStr}</div>
        <div class="budget-big-bar" style="background: rgba(255,255,255,0.05);"><div class="budget-big-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="budget-amounts">
          <span class="budget-spent">Guardado: R$ ${fmt(g.currentValue)}</span>
          <span class="budget-limit">Objetivo: R$ ${fmt(g.targetValue)} (${pct.toFixed(0)}%)</span>
        </div>
      </div>
    `;
  }).join('');
}

let activeAporteGoalId = null;

function openAporteModal(goalId) {
  activeAporteGoalId = goalId;
  const g = goals.find(x => x.id === goalId);
  if (!g) return;
  document.getElementById('aporteGoalLabel').textContent = `Adicionar valor à meta "${g.name}":`;
  document.getElementById('aporteValue').value = '';
  document.getElementById('aporteRegisterTx').checked = true;
  document.getElementById('aporteModal').classList.add('open');
}

function closeAporteModal() {
  document.getElementById('aporteModal').classList.remove('open');
  activeAporteGoalId = null;
}

function saveAporte() {
  const val = parseFloat(document.getElementById('aporteValue').value);
  if (!val || val <= 0) { showToast('Informe um valor de aporte válido', 'error'); return; }

  const g = goals.find(x => x.id === activeAporteGoalId);
  if (!g) { closeAporteModal(); return; }

  g.currentValue += val;

  const registerTx = document.getElementById('aporteRegisterTx').checked;
  if (registerTx) {
    // Registrar transação como "investimento" (Saída)
    transactions.push({
      id: uid(),
      type: 'expense',
      desc: `Aporte meta: ${g.name}`,
      amount: val,
      date: new Date().toISOString().slice(0,10),
      cat: 'investment',
      payment: 'Pix',
      notes: `Aporte automático para a meta ${g.name}`,
      recurring: false,
      createdAt: new Date().toISOString()
    });
  }

  saveData();
  closeAporteModal();
  renderGoals();
  if (currentSection() === 'dashboard') {
    renderDashboard();
  }
  showToast(`Aporte de R$ ${fmt(val)} realizado com sucesso!`, 'success');
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
  return transactions.filter(t => matchesPeriod(t.date, 'dash'));
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
  const selection = getPeriodSelection('dash');
  const anchorMonth = getPeriodMonth('dash');
  const [py, pm] = anchorMonth.split('-').map(Number);
  const selectedDate = new Date(py, pm - 1, 1);
  const months = [];
  const incomes = [], expenses = [];

  const points = selection.mode === 'year' ? 12 : 6;
  for (let i=points-1; i>=0; i--) {
    const d = selection.mode === 'year'
      ? new Date(Number(selection.value), points - 1 - i, 1)
      : new Date(selectedDate.getFullYear(), selectedDate.getMonth()-i, 1);
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
  const exp = getPeriodTransactions().filter(t => t.type==='expense');
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
  const el = document.getElementById('budgetBars');
  const selection = getPeriodSelection('dash');
  const month = getPeriodMonth('dash');

  if (selection.mode === 'year') {
    el.innerHTML = '<p class="context-message">Os orçamentos são mensais. Selecione “Mês” ou “Dia” para acompanhar os limites.</p>';
    document.getElementById('budgetOverviewCard').style.display = 'block';
    return;
  }
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
  const periodTxs = getPeriodTransactions();
  const recent = [...periodTxs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  const el = document.getElementById('recentList');
  el.innerHTML = recent.length ? recent.map(t => txItemHTML(t)).join('') : '<p style="padding:20px;color:var(--text2);font-size:13px">Nenhuma transação para este período.</p>';
}

// ── TRANSACTIONS ─────────────────────────────────
function renderTransactions() {
  const type   = document.getElementById('filterType').value;
  const cat    = document.getElementById('filterCategory').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  let list = [...transactions].sort((a,b)=>new Date(b.date)-new Date(a.date));
  list = list.filter(t => matchesPeriod(t.date, 'transactions'));
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
  // Categorias
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

  // Cartões
  const elCards = document.getElementById('customCardsList');
  if (elCards) {
    if (customCards.length === 0) {
      elCards.innerHTML = '<p style="color:var(--text2);font-size:13px;margin-bottom:8px">Nenhum cartão cadastrado.</p>';
    } else {
      elCards.innerHTML = customCards.map(c => `<div class="cat-item card-settings-item">
        <div class="cat-dot" style="background:${c.color}"></div>
        <span class="cat-name"><strong>${escapeHTML(c.name)}</strong> (${escapeHTML(c.initials || 'CC')})<br><span class="card-settings-meta">Limite: R$ ${fmt(c.limit)}${c.closingDay ? ` · Fecha dia ${c.closingDay}` : ''}${c.dueDay ? ` · Vence dia ${c.dueDay}` : ''}</span></span>
        <div class="cat-actions">
          <button class="cat-edit" onclick="editCustomCard('${c.id}')" aria-label="Editar cartão ${escapeHTML(c.name)}">✎ Editar</button>
          <button class="cat-del" onclick="deleteCustomCard('${c.id}')" aria-label="Excluir cartão ${escapeHTML(c.name)}">✕</button>
        </div>
      </div>`).join('');
    }
  }

  // Gemini API Key
  const apiKeyInput = document.getElementById('geminiApiKeyInput');
  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('ff_gemini_api_key') || '';
  }
}

function saveGeminiApiKey() {
  const val = document.getElementById('geminiApiKeyInput').value.trim();
  if (val) {
    localStorage.setItem('ff_gemini_api_key', val);
    GEMINI_API_KEY = val;
    showToast('Chave API do Gemini salva ✓', 'success');
  } else {
    localStorage.removeItem('ff_gemini_api_key');
    GEMINI_API_KEY = '';
    showToast('Chave API redefinida', 'warning');
  }
}

function resetCustomCardForm() {
  editingCardId = null;
  document.getElementById('newCardName').value = '';
  document.getElementById('newCardInitials').value = '';
  document.getElementById('newCardLimit').value = '';
  document.getElementById('newCardClosingDay').value = '';
  document.getElementById('newCardDueDay').value = '';
  document.getElementById('newCardColor').selectedIndex = 0;
  document.getElementById('cardFormTitle').textContent = 'Adicionar novo cartão';
  document.getElementById('saveCardBtn').textContent = 'Adicionar cartão';
  document.getElementById('cancelCardEditBtn').style.display = 'none';
}

function editCustomCard(id) {
  const card = customCards.find(c => c.id === id);
  if (!card) return;

  editingCardId = id;
  document.getElementById('newCardName').value = card.name || '';
  document.getElementById('newCardInitials').value = card.initials || '';
  document.getElementById('newCardLimit').value = card.limit || '';
  document.getElementById('newCardClosingDay').value = card.closingDay || '';
  document.getElementById('newCardDueDay').value = card.dueDay || '';
  document.getElementById('newCardColor').value = card.color;
  document.getElementById('cardFormTitle').textContent = `Editando ${card.name}`;
  document.getElementById('saveCardBtn').textContent = 'Salvar alterações';
  document.getElementById('cancelCardEditBtn').style.display = '';
  document.getElementById('newCardName').focus();
}

function cancelCustomCardEdit() {
  resetCustomCardForm();
  showToast('Edição cancelada', 'warning');
}

function saveCustomCard() {
  const name = document.getElementById('newCardName').value.trim();
  const initials = document.getElementById('newCardInitials').value.trim().toUpperCase();
  const limit = parseAmount(document.getElementById('newCardLimit').value);
  const color = document.getElementById('newCardColor').value;
  const closingDayEl = document.getElementById('newCardClosingDay');
  const dueDayEl = document.getElementById('newCardDueDay');
  const closingDay = closingDayEl ? (parseInt(closingDayEl.value) || null) : null;
  const dueDay = dueDayEl ? (parseInt(dueDayEl.value) || null) : null;

  if (!name) { showToast('Informe o nome do cartão', 'error'); return; }
  if (!limit || limit <= 0) { showToast('Informe um limite válido', 'error'); return; }
  if (closingDay && (closingDay < 1 || closingDay > 31)) { showToast('O fechamento deve ser entre os dias 1 e 31', 'error'); return; }
  if (dueDay && (dueDay < 1 || dueDay > 31)) { showToast('O vencimento deve ser entre os dias 1 e 31', 'error'); return; }
  if (customCards.some(c => c.id !== editingCardId && c.name.toLowerCase() === name.toLowerCase())) {
    showToast('Já existe um cartão com esse nome', 'error');
    return;
  }

  const cardData = { name, initials: initials || name.slice(0,2).toUpperCase(), color, limit, closingDay, dueDay };
  const wasEditing = Boolean(editingCardId);

  if (wasEditing) {
    const index = customCards.findIndex(c => c.id === editingCardId);
    if (index === -1) { resetCustomCardForm(); return; }
    customCards[index] = { ...customCards[index], ...cardData };
    transactions.forEach(t => {
      if (t.cardKey === editingCardId) t.cardLabel = name;
    });
  } else {
    customCards.push({ id: 'card_' + Date.now(), ...cardData });
  }

  saveData();
  resetCustomCardForm();
  buildCardSelector();
  renderSettings();
  renderCards();
  showToast(wasEditing ? 'Cartão atualizado ✓' : 'Cartão adicionado ✓', 'success');
}

function deleteCustomCard(id) {
  if (!confirm('Excluir este cartão?')) return;
  if (editingCardId === id) resetCustomCardForm();
  customCards = customCards.filter(c => c.id !== id);
  saveData();
  buildCardSelector();
  renderSettings();
  showToast('Cartão removido', 'warning');
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
    return getSafeMonthDate(y, (m - 1) + n, d);
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

    const amount = parseAmount(amtRaw);
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
  a.download = `financeflow_${getTodayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exportado com sucesso ✓', 'success');
}

function exportJSON() {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    transactions,
    customCategories,
    customCards,
    goals,
    budgets,
    GEMINI_API_KEY
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `financeflow_backup_${getTodayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exportado com sucesso! 💾', 'success');
}

function triggerImportJSON() {
  const input = document.getElementById('jsonFileInput');
  if (input) input.click();
}

function handleImportJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || !Array.isArray(data.transactions)) {
        throw new Error('Formato do arquivo de backup inválido');
      }

      if (confirm(`Deseja importar ${data.transactions.length} transações? Seus dados atuais serão sobrescritos.`)) {
        transactions = data.transactions || [];
        if (data.customCategories) customCategories = data.customCategories;
        if (data.customCards) customCards = data.customCards;
        if (data.goals) goals = data.goals;
        if (data.budgets) budgets = data.budgets;
        if (data.GEMINI_API_KEY) {
          GEMINI_API_KEY = data.GEMINI_API_KEY;
          localStorage.setItem('ff_gemini_api_key', GEMINI_API_KEY);
        }

        saveData();
        renderSection(currentSection());
        renderDashboardKPIs();
        showToast('Backup restaurado com sucesso! ✓', 'success');
      }
    } catch (err) {
      console.error('Erro ao importar JSON:', err);
      showToast('Erro ao ler arquivo de backup JSON: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
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
  const today = getTodayStr();
  const month = getCurrentMonthStr();
  const year = today.slice(0, 4);
  populatePeriodYears();
  Object.entries(PERIOD_FILTER_IDS).forEach(([prefix, ids]) => {
    const dayInput = document.getElementById(ids.day);
    const monthInput = document.getElementById(ids.month);
    const yearInput = document.getElementById(ids.year);
    if (dayInput) dayInput.value = today;
    if (monthInput) monthInput.value = month;
    if (yearInput) yearInput.value = year;
    syncPeriodFilter(prefix);
  });
}

function renderCards() {
  const selection = getPeriodSelection('cards');
  const periodValue = selection.value;
  const periodNoun = getPeriodNoun('cards');
  const el = document.getElementById('cardsGrid');
  if (!el) return;

  if (customCards.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">💳</div><p>Nenhum cartão cadastrado. Vá em Preferências para adicionar.</p></div>';
    return;
  }

  const html = customCards.map(c => {
    const isThisCard = (t) => {
      if (t.type !== 'expense') return false;
      if (t.cardKey) return t.cardKey === c.id;
      return (t.payment === 'credito' && c.id === 'outro');
    };

    // Gasto no período selecionado
    const periodAmount = transactions
      .filter(t => isThisCard(t) && matchesPeriod(t.date, 'cards'))
      .reduce((sum, t) => sum + t.amount, 0);

    // O limite sempre considera a fatura mensal correspondente ao período.
    const limitMonth = selection.mode === 'day'
      ? periodValue.slice(0, 7)
      : selection.mode === 'month' ? periodValue : getCurrentMonthStr();
    const invoiceAmount = transactions
      .filter(t => isThisCard(t) && t.date?.startsWith(limitMonth))
      .reduce((sum, t) => sum + t.amount, 0);

    // Parcelas futuras após a fatura usada no cálculo do limite.
    const futureTxs = transactions.filter(t =>
      isThisCard(t) && t.installmentGroupId && t.date?.slice(0,7) > limitMonth
    );
    const pendingTotal = futureTxs.reduce((s, t) => s + t.amount, 0);
    const pendingCount = futureTxs.length;

    const pendingHtml = pendingTotal > 0 ? `
          <div class="cc-stat-row">
            <span class="cc-stat-label">Parcelas Futuras</span>
            <span class="cc-val-pending" style="color:#f59e0b">R$ ${fmt(pendingTotal)} (${pendingCount}x)</span>
          </div>` : '';

    const limitSpent = invoiceAmount + pendingTotal;
    const limitPct = Math.min(100, (limitSpent / c.limit) * 100);

    const safeName = escapeHTML(c.name);
    const safeInitials = escapeHTML(c.initials || c.name.slice(0, 2).toUpperCase());
    return `
      <div class="cc-widget animate-fade-in" style="--chip-bg: ${c.color}; border-top-color: ${c.color.replace('linear-gradient(135deg,', '').split(',')[0]}33;">
        <div class="cc-header">
          <h3>${safeName}</h3>
          <div class="cc-brand-icon" style="background: ${c.color}">${safeInitials}</div>
        </div>
        <div class="cc-stats">
          <div class="cc-stat-row" style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            <span>📅 Fechamento: <strong>${c.closingDay ? 'Dia ' + c.closingDay : 'Não def.'}</strong></span>
            <span>💳 Vencimento: <strong>${c.dueDay ? 'Dia ' + c.dueDay : 'Não def.'}</strong></span>
          </div>
          <div class="cc-stat-row">
            <span class="cc-stat-label">Gasto no ${periodNoun}</span>
            <span class="cc-val-monthly">R$ ${fmt(periodAmount)}</span>
          </div>
          ${pendingHtml}
          <div class="cc-stat-row">
            <span class="cc-stat-label">Limite Disponível${selection.mode === 'year' ? ' (atual)' : ''}</span>
            <span class="cc-val-total" style="color: ${limitSpent >= c.limit ? 'var(--red)' : 'var(--green)'}">R$ ${fmt(Math.max(0, c.limit - limitSpent))} / R$ ${fmt(c.limit)}</span>
          </div>
          <div class="cc-stat-row">
            <div class="budget-bar" style="background: rgba(255,255,255,0.05); height: 6px;">
              <div class="budget-bar-fill" style="width: ${limitPct}%; background: ${c.color}"></div>
            </div>
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

// ── DRAG & DROP FILE IMPORT ───────────────────────
function setupDragAndDrop() {
  const overlay = document.getElementById('dragOverlay');
  if (!overlay) return;

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    overlay.style.display = 'flex';
  });

  const hideOverlay = () => {
    overlay.style.display = 'none';
  };

  window.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      hideOverlay();
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    hideOverlay();

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    const name = file.name.toLowerCase();

    if (name.endsWith('.csv')) {
      showToast('Importando CSV...', 'warning');
      const reader = new FileReader();
      reader.onload = (evt) => {
        parseCSVAndImport(evt.target.result);
      };
      reader.readAsText(file);
    } else if (file.type.startsWith('image/')) {
      const scanOverlay = document.getElementById('scanOverlay');
      if (scanOverlay) {
        const previewImg = document.getElementById('scanPreview');
        if (previewImg) {
          previewImg.src = URL.createObjectURL(file);
        }
        scanOverlay.style.display = 'flex';
      }
      try {
        const base64 = await fileToBase64(file);
        const result = await analyzeReceiptWithGemini(base64, file.type);
        if (scanOverlay) scanOverlay.style.display = 'none';
        prefillTransactionFromReceipt(result);
      } catch (err) {
        if (scanOverlay) scanOverlay.style.display = 'none';
        console.error('Erro ao escanear nota via drag & drop:', err);
        alert('❌ Não foi possível analisar a imagem. Tente uma foto mais clara da nota fiscal.');
      }
    } else {
      showToast('Formato de arquivo não suportado!', 'error');
    }
  });
}

// ── KEYBOARD SHORTCUTS & ACCESSIBILITY ────────────────
window.addEventListener('keydown', (e) => {
  const activeEl = document.activeElement;
  const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
  } else if ((e.key === 'n' || e.key === 'N') && !isTyping && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (typeof openModal === 'function') openModal('expense');
  }
});

// ── START ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
