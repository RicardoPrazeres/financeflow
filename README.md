# 💳 FinanceFlow — Controle de Gastos Inteligente & PWA

<p align="center">
  <strong>Sistema SaaS de Controle de Gastos Pessoais com IA (Gemini API), Gestão de Cartões, Parcelamentos e Sincronização Firebase.</strong>
</p>

---

## ✨ Principais Funcionalidades

- **🤖 Leitura de Notas Fiscais com IA (Gemini Multimodal):** Tire fotos de recibos e comprovantes para preencher a transação automaticamente via inteligência artificial.
- **💳 Cartões de Crédito & Parcelamentos:** Acompanhe limites de cartões (Inter, Nubank, Amazon, etc.) e simule/registre parcelamentos com cálculo automático do valor mensal.
- **📊 Gráficos Interativos:** Visualização por categoria, distribuição de receitas vs. despesas e evolução financeira.
- **☁️ Sincronização Nuvem (Firebase Firestore & Auth):** Acesse suas finanças em qualquer dispositivo com login seguro.
- **📱 PWA (Progressive Web App):** Instalável no celular ou desktop, com suporte a cache offline via Service Worker.
- **🏷️ Categorização Inteligente:** Regras automáticas por palavra-chave para classificar gastos (mercado, transporte, streaming, etc.).

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, Vanilla CSS3 (Dark Theme moderno), JavaScript ES6+
- **Inteligência Artificial:** Google Gemini 1.5 Flash API (Multimodal Vision)
- **Backend / Database:** Firebase Firestore & Firebase Authentication
- **Gráficos:** Chart.js
- **PWA:** Web App Manifest & Service Worker

---

## 🚀 Como Executar o Projeto Localmente

### Pré-requisitos
- Node.js (versão 18 ou superior)

### Passo a Passo

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/RicardoPrazeres/financeflow.git
   cd financeflow
   ```

2. **Instalar as dependências:**
   ```bash
   npm install
   ```

3. **Iniciar o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

4. Acesse a aplicação no seu navegador pelo endereço indicado (ex: `http://localhost:5173`).

---

## 🔒 Configuração da API do Gemini (Leitor de Nota Fiscal)

Para utilizar o scanner de notas fiscais por IA:
1. Obtenha uma chave gratuita no [Google AI Studio](https://aistudio.google.com/).
2. No FinanceFlow, acesse a aba **Configurações**.
3. Insira sua chave no campo **Gemini API Key** e salve.

---

## 📂 Estrutura do Repositório

```
financeflow/
├── index.html        # Estrutura da interface web
├── style.css         # Estilização em modo escuro e componentes visuais
├── app.js            # Lógica do aplicativo, Firebase, IA e manipulação de estado
├── sw.js             # Service Worker para funcionalidades PWA offline
├── manifest.json     # Configuração do PWA
├── firestore.rules   # Regras de segurança do Cloud Firestore
└── README.md         # Documentação oficial do repositório
```

---

## 📄 Licença

Este projeto é distribuído sob a licença MIT. Sinta-se à vontade para utilizar, modificar e contribuir!
