import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, doc, query, where, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAV_k_524LY4pPlEngZ763qeq8viYFLgJk",
  authDomain: "mybudget-ecb46.firebaseapp.com",
  projectId: "mybudget-ecb46",
  storageBucket: "mybudget-ecb46.firebasestorage.app",
  messagingSenderId: "891853073723",
  appId: "1:891853073723:web:29ec6bcf063a7fa8e8db1e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const P3_LIMIT_2026 = 7258;
const state = {
  user:null, view:"dashboard", selectedMonth:new Date().toISOString().slice(0,7),
  transactions:[], stocks:[], credits:[], projects:[], pillar3:[], sport:[], watchlist:[],
  savings:{sq:0,ep:0,ec:0}, immo:{dury:{},amiens:{}}, p2:{}, tax:{},
  eurChf:0.95, listeners:[], editingStock:null, editingCredit:null
};

const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const num=(v,d=2)=>Number.isFinite(Number(v))?Number(v).toLocaleString("fr-CH",{minimumFractionDigits:d,maximumFractionDigits:d}):"—";
const chf=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("fr-CH",{style:"currency",currency:"CHF",maximumFractionDigits:0}):"—";
const money=(v,ccy="CHF")=>Number.isFinite(Number(v))?Number(v).toLocaleString("fr-CH",{style:"currency",currency:ccy,maximumFractionDigits:2}):"—";
const n=v=>Number(v)||0;
const today=()=>new Date().toISOString().slice(0,10);
const currentYear=()=>new Date().getFullYear();
const monthLabel=ym=>{if(!ym)return"Toutes périodes";const [y,m]=ym.split("-").map(Number);return new Intl.DateTimeFormat("fr-CH",{month:"long",year:"numeric"}).format(new Date(y,m-1,1));};
const dateLabel=iso=>{if(!iso)return"—";const d=new Date(iso.length===10?iso+"T12:00:00":iso);return Number.isNaN(d.getTime())?iso:new Intl.DateTimeFormat("fr-CH",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);};

function sum(arr,fn){return arr.reduce((s,x)=>s+n(fn(x)),0)}
function collectionSub(name,key,uid){
  const q=query(collection(db,name),where("uid","==",uid));
  const unsub=onSnapshot(q,snap=>{state[key]=snap.docs.map(d=>({id:d.id,...d.data()}));render();},err=>console.error(name,err));
  state.listeners.push(unsub);
}
function docSub(name,key,uid,defaults={}){
  const unsub=onSnapshot(doc(db,name,uid),snap=>{state[key]=snap.exists()?{...defaults,...snap.data()}:{...defaults};render();},err=>console.error(name,err));
  state.listeners.push(unsub);
}
function stopListeners(){state.listeners.forEach(fn=>{try{fn()}catch{}});state.listeners=[];}

async function refreshFx(){
  try{const r=await fetch("https://open.er-api.com/v6/latest/EUR",{cache:"no-store"});const j=await r.json();if(j?.rates?.CHF)state.eurChf=Number(j.rates.CHF)||state.eurChf;}
  catch(e){console.warn("EUR/CHF fallback",e)}
}

onAuthStateChanged(auth,async user=>{
  stopListeners();state.user=user;
  if(!user){$("login").classList.remove("hidden");$("shell").classList.add("hidden");return;}
  $("login").classList.add("hidden");$("shell").classList.remove("hidden");$("userLabel").textContent=user.email||"Espace privé";
  await refreshFx();
  collectionSub("transactions","transactions",user.uid);
  collectionSub("bourse","stocks",user.uid);
  collectionSub("creditsconso","credits",user.uid);
  collectionSub("projects","projects",user.uid);
  collectionSub("pillar3","pillar3",user.uid);
  collectionSub("sport","sport",user.uid);
  collectionSub("watchlist","watchlist",user.uid);
  docSub("savings","savings",user.uid,{sq:0,ep:0,ec:0});
  docSub("immo","immo",user.uid,{dury:{},amiens:{}});
  docSub("prevoyance2","p2",user.uid,{baseK:0,annK:0,baseC:0,annC:0,targetY:2035,rate:1.25});
  docSub("taxconfig","tax",user.uid,{rev:0,fort:0,status:"single",travel:0,meals:0,insurance:0,immo:0,others:0,monthlyProvision:0});
  render();
});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginError").textContent="";
  try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}
  catch{$("loginError").textContent="Identifiants refusés ou connexion indisponible."}
});
$("logoutBtn").addEventListener("click",()=>signOut(auth));

function metrics(){
  const monthTx=state.transactions.filter(t=>String(t.date||"").startsWith(state.selectedMonth));
  const income=sum(monthTx,t=>t.type==="income"?t.amt:0), expenses=sum(monthTx,t=>t.type!=="income"?t.amt:0);
  const liquid=n(state.savings.sq)+n(state.savings.ep)+n(state.savings.ec);
  const stocks=sum(state.stocks,x=>n(x.qty)*n(x.live));
  const p3=sum(state.pillar3,x=>x.amt);
  const p2=n(state.p2.baseK)+n(state.p2.baseC);
  const tracked=liquid+stocks+p3+p2;
  return {income,expenses,net:income-expenses,liquid,stocks,p3,p2,tracked};
}

function sectionHead(title,subtitle,actions=""){return `<div class="section-title"><div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="toolbar">${actions}</div></div>`}
function card(title,sub,body,span=6){return `<article class="card span${span}"><h2>${esc(title)}</h2>${sub?`<p class="sub">${esc(sub)}</p>`:""}${body}</article>`}
function empty(text){return `<div class="empty">${esc(text)}</div>`}
function setActiveNav(){document.querySelectorAll("#mainNav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));}

function render(){
  if(!state.user)return;setActiveNav();
  const views={dashboard:renderDashboard,budget:renderBudget,patrimoine:renderPatrimoine,prevoyance:renderPrevoyance,immobilier:renderImmobilier,credits:renderCredits,projets:renderProjects,sport:renderSport};
  $("app").innerHTML=(views[state.view]||renderDashboard)();bindView();
}

function renderDashboard(){
  const m=metrics();
  const recent=[...state.transactions].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,5);
  const debt=sum(state.credits,c=>remainingCredit(c));
  const projectBudget=sum(state.projects,p=>p.budget);
  return `
    <section class="hero"><div><p class="eyebrow">Family Office · ${esc(monthLabel(state.selectedMonth))}</p><h1>Une vue claire de votre vie financière.</h1><p class="lead">Suivez les flux, le patrimoine financier, la prévoyance, les engagements et les projets sans multiplier les outils.</p></div>
      <div class="hero-kpis"><div class="kpi"><strong>${chf(m.tracked)}</strong><span>Patrimoine financier suivi</span></div><div class="kpi"><strong class="${m.net>=0?"good":"bad"}">${chf(m.net)}</strong><span>Solde du mois</span></div><div class="kpi"><strong>${chf(m.liquid)}</strong><span>Épargne liquide</span></div><div class="kpi"><strong>${chf(m.stocks)}</strong><span>Portefeuille boursier saisi</span></div></div>
    </section>
    <section class="grid">
      ${card("Budget du mois","Entrées, sorties et capacité d’épargne.",`<div class="metric-line"><span>Revenus</span><b class="good">${chf(m.income)}</b></div><div class="metric-line"><span>Dépenses</span><b class="bad">${chf(m.expenses)}</b></div><div class="metric-line"><span>Solde</span><b class="${m.net>=0?"good":"bad"}">${chf(m.net)}</b></div><button class="secondary" data-view="budget" style="margin-top:14px">Voir le budget</button>`,4)}
      ${card("Patrimoine","Consolidation des masses financières suivies.",`<div class="metric-line"><span>Liquidités</span><b>${chf(m.liquid)}</b></div><div class="metric-line"><span>Bourse</span><b>${chf(m.stocks)}</b></div><div class="metric-line"><span>3a versé</span><b>${chf(m.p3)}</b></div><div class="metric-line"><span>2e pilier saisi</span><b>${chf(m.p2)}</b></div>`,4)}
      ${card("Engagements & projets","Ordres de grandeur à garder visibles.",`<div class="metric-line"><span>Crédits conso estimés</span><b>${chf(debt)}</b></div><div class="metric-line"><span>Budgets projets</span><b>${chf(projectBudget)}</b></div><div class="metric-line"><span>EUR/CHF indicatif</span><b>${num(state.eurChf,4)}</b></div>`,4)}
      ${card("Derniers flux","Les dernières écritures enregistrées.",recent.length?`<div class="list">${recent.map(t=>`<div class="list-item"><div><b>${esc(t.desc||"Flux")}</b><small>${dateLabel(t.date)} · ${esc(t.cat||"")}</small></div><div class="amount ${t.type==="income"?"good":"bad"}">${t.type==="income"?"+":"−"}${money(t.amt)}</div></div>`).join("")}</div>`:empty("Aucun flux enregistré."),7)}
      ${card("Repères","Le tableau de bord reste volontairement prudent.",`<div class="info-note">Les valeurs boursières sont celles que vous saisissez manuellement. Le module fiscal prépare vos données mais ne remplace pas le calcul officiel de l’administration fiscale. Les valeurs immobilières ne sont pas incluses dans le patrimoine tant qu’aucune valeur de bien n’est renseignée.</div>`,5)}
    </section>`;
}

function monthOptions(){
  const set=new Set(state.transactions.map(t=>String(t.date||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)));set.add(state.selectedMonth);
  return [...set].sort().reverse().map(x=>`<option value="${x}" ${x===state.selectedMonth?"selected":""}>${esc(monthLabel(x))}</option>`).join("");
}
function categoryStats(){
  const tx=state.transactions.filter(t=>String(t.date||"").startsWith(state.selectedMonth)&&t.type!=="income");const stats={};
  tx.forEach(t=>stats[t.cat||"Autres"]=(stats[t.cat||"Autres"]||0)+n(t.amt));return Object.entries(stats).sort((a,b)=>b[1]-a[1]);
}
function renderBudget(){
  const m=metrics(),stats=categoryStats(),max=Math.max(1,...stats.map(x=>x[1]));
  const tx=[...state.transactions].filter(t=>String(t.date||"").startsWith(state.selectedMonth)).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  return `${sectionHead("Budget","Journal des flux et lecture mensuelle.",`<select id="monthSelect">${monthOptions()}</select><button class="primary" data-modal="transaction">+ Nouveau flux</button>`)}
    <section class="grid">
      ${card("Synthèse mensuelle",monthLabel(state.selectedMonth),`<div class="pillars"><div class="pillar"><strong class="good">${chf(m.income)}</strong><span>Revenus</span></div><div class="pillar"><strong class="bad">${chf(m.expenses)}</strong><span>Dépenses</span></div></div><div class="wealth-total"><span>Solde du mois</span><b class="${m.net>=0?"good":"bad"}">${chf(m.net)}</b></div>`,5)}
      ${card("Répartition des dépenses","Catégories du mois sélectionné.",stats.length?`<div class="breakdown">${stats.map(([k,v])=>`<div class="breakdown-row"><span>${esc(k)}</span><div class="bar"><i style="width:${Math.max(2,v/max*100)}%"></i></div><b>${chf(v)}</b></div>`).join("")}</div>`:empty("Aucune dépense ce mois-ci."),7)}
      ${card("Écritures","Vous pouvez supprimer une ligne erronée puis la ressaisir.",tx.length?`<div class="list">${tx.map(t=>`<div class="list-item"><div><b>${esc(t.desc||"Flux")}</b><small>${dateLabel(t.date)} · ${esc(t.cat||"")}</small></div><div class="list-actions"><div class="amount ${t.type==="income"?"good":"bad"}">${t.type==="income"?"+":"−"}${money(t.amt)}</div><button class="tiny-btn delete" data-delete="transactions" data-id="${esc(t.id)}">Supprimer</button></div></div>`).join("")}</div>`:empty("Aucune écriture sur cette période."),12)}
    </section>`;
}

function renderPatrimoine(){
  const m=metrics();
  return `${sectionHead("Patrimoine","Épargne liquide, bourse et consolidation financière.",`<button class="primary" data-modal="stock">+ Position bourse</button>`)}
    <section class="grid">
      ${card("Épargne liquide","Montants disponibles ou non investis.",`<form id="savingsForm" class="form-grid"><div class="field"><label>Liquidités courtier / attente<input name="sq" type="number" step="0.01" value="${n(state.savings.sq)}"></label></div><div class="field"><label>Épargne personnelle<input name="ep" type="number" step="0.01" value="${n(state.savings.ep)}"></label></div><div class="field"><label>Épargne commune<input name="ec" type="number" step="0.01" value="${n(state.savings.ec)}"></label></div><div class="field"><label>Total<input value="${num(m.liquid)} CHF" disabled></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`,5)}
      ${card("Consolidation","Ce total reprend la logique historique de votre Family Hub.",`<div class="metric-line"><span>Épargne liquide</span><b>${chf(m.liquid)}</b></div><div class="metric-line"><span>Portefeuille boursier</span><b>${chf(m.stocks)}</b></div><div class="metric-line"><span>Versements 3a cumulés</span><b>${chf(m.p3)}</b></div><div class="metric-line"><span>2e pilier actuel saisi</span><b>${chf(m.p2)}</b></div><div class="wealth-total"><span>PATRIMOINE FINANCIER SUIVI</span><b>${chf(m.tracked)}</b></div>`,7)}
      ${card("Portefeuille boursier","Cours et PRM saisis manuellement ; aucune API payante.",state.stocks.length?`<div class="list">${state.stocks.map(s=>{const val=n(s.qty)*n(s.live),cost=n(s.qty)*n(s.prm),pl=val-cost;return `<div class="list-item"><div><b>${esc(s.ticker||"Titre")}</b><small>${num(s.qty,4)} unités · PRM ${num(s.prm)} · cours ${num(s.live)}</small></div><div class="list-actions"><div><div class="amount">${chf(val)}</div><small class="${pl>=0?"good":"bad"}">${pl>=0?"+":""}${chf(pl)}</small></div><button class="tiny-btn" data-edit-stock="${esc(s.id)}">Modifier</button><button class="tiny-btn delete" data-delete="bourse" data-id="${esc(s.id)}">Supprimer</button></div></div>`}).join("")}</div>`:empty("Aucune position boursière saisie."),8)}
      ${card("Watchlist","Repères personnels, sans cotation automatique.",`<form id="watchForm" class="form-grid"><div class="field full"><label>Ajouter un ticker<input name="ticker" placeholder="Ex. AAPL, SIX:ASML"></label></div><div class="field full"><button class="secondary" type="submit">Ajouter</button></div></form><div class="list" style="margin-top:14px">${state.watchlist.length?state.watchlist.map(w=>`<div class="list-item"><div><b>${esc(w.ticker)}</b></div><button class="tiny-btn delete" data-delete="watchlist" data-id="${esc(w.id)}">×</button></div>`).join(""):empty("Watchlist vide.")}</div>`,4)}
    </section>`;
}

function p3YearTotal(){return sum(state.pillar3.filter(x=>String(x.date||"").includes(String(currentYear()))),x=>x.amt)}
function projectionP2(){
  const base=n(state.p2.baseK)+n(state.p2.baseC),ann=n(state.p2.annK)+n(state.p2.annC),target=Math.max(currentYear(),parseInt(state.p2.targetY)||currentYear()),years=target-currentYear(),r=n(state.p2.rate)/100;
  let projected=base*Math.pow(1+r,years);projected+=r>0?ann*((Math.pow(1+r,years)-1)/r):ann*years;return {base,ann,target,years,projected};
}
function renderPrevoyance(){
  const p3Y=p3YearTotal(),p3All=sum(state.pillar3,x=>x.amt),room=Math.max(0,P3_LIMIT_2026-p3Y),p2=projectionP2();
  const tax=state.tax||{},ded=n(tax.travel)+n(tax.meals)+n(tax.insurance)+p3Y+n(tax.immo)+n(tax.others),taxable=Math.max(0,n(tax.rev)-ded);
  return `${sectionHead("Prévoyance & fiscalité","Suivi 3a, projection 2e pilier et préparation des données fiscales.",`<button class="primary" data-modal="p3">+ Versement 3a</button>`)}
    <section class="grid">
      ${card("Pilier 3a","Le plafond 2026 est individuel ; les versements historiques sans bénéficiaire sont agrégés.",`<div class="pillars"><div class="pillar"><strong>${chf(p3All)}</strong><span>Versements cumulés saisis</span></div><div class="pillar"><strong class="${room>0?"warn":"good"}">${chf(room)}</strong><span>Écart indicatif au plafond 2026 de 7’258 CHF</span></div></div><div class="info-note" style="margin-top:14px">Le plafond de 7’258 CHF concerne une personne salariée affiliée au 2e pilier. Pour un couple, ne comparez pas le total familial à un seul plafond.</div><div class="list" style="margin-top:14px">${state.pillar3.length?[...state.pillar3].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>`<div class="list-item"><div><b>${dateLabel(normalizeDate(x.date))}</b><small>${esc(x.owner||"Bénéficiaire non renseigné")}</small></div><div class="list-actions"><div class="amount">${money(x.amt)}</div><button class="tiny-btn delete" data-delete="pillar3" data-id="${esc(x.id)}">Supprimer</button></div></div>`).join(""):empty("Aucun versement 3a enregistré.")}</div>`,6)}
      ${card("2e pilier","Projection mathématique basée sur les avoirs, cotisations et intérêt technique que vous saisissez.",`<form id="p2Form" class="form-grid"><div class="field"><label>Avoirs Kévin<input name="baseK" type="number" value="${n(state.p2.baseK)}"></label></div><div class="field"><label>Cotisation annuelle Kévin<input name="annK" type="number" value="${n(state.p2.annK)}"></label></div><div class="field"><label>Avoirs Charlotte<input name="baseC" type="number" value="${n(state.p2.baseC)}"></label></div><div class="field"><label>Cotisation annuelle Charlotte<input name="annC" type="number" value="${n(state.p2.annC)}"></label></div><div class="field"><label>Année cible<input name="targetY" type="number" value="${parseInt(state.p2.targetY)||2035}"></label></div><div class="field"><label>Intérêt technique %<input name="rate" type="number" step="0.05" value="${n(state.p2.rate)||1.25}"></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form><div class="wealth-total"><span>Projection ${p2.target}</span><b>${chf(p2.projected)}</b></div>`,6)}
      ${card("Préparation fiscale","Nous ne simulons plus un impôt vaudois avec une formule approximative.",`<form id="taxForm" class="form-grid"><div class="field"><label>Revenu annuel brut CHF<input name="rev" type="number" value="${n(tax.rev)}"></label></div><div class="field"><label>Fortune déclarée CHF<input name="fort" type="number" value="${n(tax.fort)}"></label></div><div class="field"><label>Frais déplacement<input name="travel" type="number" value="${n(tax.travel)}"></label></div><div class="field"><label>Repas hors domicile<input name="meals" type="number" value="${n(tax.meals)}"></label></div><div class="field"><label>Assurances / primes<input name="insurance" type="number" value="${n(tax.insurance)}"></label></div><div class="field"><label>Frais immeubles<input name="immo" type="number" value="${n(tax.immo)}"></label></div><div class="field"><label>Autres déductions<input name="others" type="number" value="${n(tax.others)}"></label></div><div class="field"><label>Provision fiscale mensuelle manuelle<input name="monthlyProvision" type="number" value="${n(tax.monthlyProvision)}"></label></div><div class="field full"><button class="primary" type="submit">Enregistrer la préparation</button></div></form><div class="metric-line"><span>Déductions saisies + 3a année</span><b>${chf(ded)}</b></div><div class="metric-line"><span>Revenu après déductions saisies</span><b>${chf(taxable)}</b></div><div class="metric-line"><span>Provision mensuelle choisie</span><b>${chf(tax.monthlyProvision)}</b></div><div class="notice">Ces chiffres préparent le dossier mais ne constituent pas un calcul fiscal officiel. Utilisez le calculateur officiel du canton pour le montant d’impôt.</div>`,12)}
    </section>`;
}

function normalizeDate(v){if(!v)return"";if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;if(/^\d{2}\.\d{2}\.\d{4}$/.test(v)){const [d,m,y]=v.split(".");return `${y}-${m}-${d}`}return v;}
function parseMonth(v){if(!v)return null;const s=String(v).trim();let m,y;if(/^\d{2}\/\d{4}$/.test(s))[m,y]=s.split("/").map(Number);else if(/^\d{2}\.\d{4}$/.test(s))[m,y]=s.split(".").map(Number);else if(/^\d{2}\.\d{2}\.\d{4}$/.test(s)){const p=s.split(".").map(Number);m=p[1];y=p[2]}else if(/^\d{4}-\d{2}/.test(s)){[y,m]=s.split("-").map(Number)}else return null;return {m,y};}
function loanAt(principal,ratePct,years,start,target){
  const P=n(principal),N=Math.max(1,Math.round(n(years)*12)),R=n(ratePct)/100/12,s=parseMonth(start),t=parseMonth(target);if(!P||!s||!t)return{payment:0,balance:P,repaid:0,interest:0,completion:0};
  let elapsed=Math.max(0,Math.min(N,(t.y-s.y)*12+(t.m-s.m)));const payment=R===0?P/N:P*(R*Math.pow(1+R,N))/(Math.pow(1+R,N)-1);let balance=P,interest=0,repaid=0;
  for(let i=0;i<elapsed;i++){const ii=balance*R;let cap=Math.min(balance,payment-ii);balance-=cap;interest+=ii;repaid+=cap}return{payment,balance:Math.max(0,balance),repaid,interest,completion:P?repaid/P*100:0};
}
function propertyCard(key,label){
  const x=state.immo[key]||{},target=`${String(new Date().getMonth()+1).padStart(2,"0")}/${currentYear()}`,res=loanAt(x.total,x.rate,x.dur,x.start,target),ccy=x.ccy||"EUR";
  const balanceChf=ccy==="EUR"?res.balance*state.eurChf:res.balance;
  return `<article class="card"><h2>${esc(label)}</h2><p class="sub">Financement et amortissement estimatif à aujourd’hui.</p><form class="propertyForm form-grid" data-key="${key}"><div class="field"><label>Capital emprunté<input name="total" type="number" step="0.01" value="${n(x.total)}"></label></div><div class="field"><label>Devise<select name="ccy"><option value="EUR" ${ccy==="EUR"?"selected":""}>EUR</option><option value="CHF" ${ccy==="CHF"?"selected":""}>CHF</option></select></label></div><div class="field"><label>Taux fixe %<input name="rate" type="number" step="0.01" value="${n(x.rate)}"></label></div><div class="field"><label>Durée années<input name="dur" type="number" value="${n(x.dur)}"></label></div><div class="field full"><label>Date d’effet MM/AAAA<input name="start" value="${esc(x.start||"")}" placeholder="05/2024"></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form><div class="loan-result"><div class="metric-line"><span>Mensualité théorique</span><b>${money(res.payment,ccy)}</b></div><div class="metric-line"><span>Capital restant estimé</span><b>${money(res.balance,ccy)}</b></div>${ccy==="EUR"?`<div class="metric-line"><span>Équivalent CHF indicatif</span><b>${chf(balanceChf)}</b></div>`:""}<div class="progress"><span style="width:${Math.max(0,Math.min(100,res.completion))}%"></span></div></div></article>`;
}
function renderImmobilier(){return `${sectionHead("Immobilier","Suivi des financements existants et amortissement théorique.",`<span class="tag">EUR/CHF ${num(state.eurChf,4)}</span>`)}<div class="loan-grid">${propertyCard("dury","Bien immobilier 1")}${propertyCard("amiens","Bien immobilier 2")}</div><div class="notice" style="margin-top:14px">Le calcul suppose un prêt amortissable à mensualité constante et un taux fixe. Il ne remplace pas le tableau d’amortissement contractuel de la banque. Le taux EUR/CHF est indicatif.</div>`;}

function creditDates(c){const s=parseMonth(c.start),e=parseMonth(c.end);if(!s||!e)return{elapsed:0,total:0,progress:0};const now={m:new Date().getMonth()+1,y:currentYear()};const total=Math.max(1,(e.y-s.y)*12+(e.m-s.m)),elapsed=Math.max(0,Math.min(total,(now.y-s.y)*12+(now.m-s.m)));return{elapsed,total,progress:elapsed/total*100};}
function remainingCredit(c){const d=creditDates(c);return Math.max(0,d.total-d.elapsed)*n(c.mens)}
function renderCredits(){
  return `${sectionHead("Crédits","Engagements de consommation et horizon restant.",`<button class="primary" data-modal="credit">+ Nouveau crédit</button>`)}<section class="grid">${card("Engagements actifs","Le restant estimé correspond aux mensualités futures, pas au capital bancaire exact.",state.credits.length?`<div class="list">${state.credits.map(c=>{const d=creditDates(c),rem=remainingCredit(c);return `<div class="list-item"><div><b>${esc(c.name||"Crédit")}</b><small>${esc(c.ccy||"CHF")} · ${esc(c.start||"?")} → ${esc(c.end||"?")}</small><div class="progress"><span style="width:${d.progress}%"></span></div></div><div class="list-actions"><div><div class="amount">${money(c.mens,c.ccy||"CHF")}/mois</div><small>${money(rem,c.ccy||"CHF")} restant estimé</small></div><button class="tiny-btn" data-edit-credit="${esc(c.id)}">Modifier</button><button class="tiny-btn delete" data-delete="creditsconso" data-id="${esc(c.id)}">Supprimer</button></div></div>`}).join("")}</div>`:empty("Aucun crédit saisi."),12)}</section>`;
}

function renderProjects(){const total=sum(state.projects,p=>p.budget);return `${sectionHead("Projets","Budgets prévisionnels et enveloppes à financer.",`<button class="primary" data-modal="project">+ Nouveau projet</button>`)}<section class="grid">${card("Enveloppes projets","Montants cibles saisis.",state.projects.length?`<div class="list">${state.projects.map(p=>`<div class="list-item"><div><b>${esc(p.name||"Projet")}</b><small>Budget prévisionnel</small></div><div class="list-actions"><div class="amount">${chf(p.budget)}</div><button class="tiny-btn delete" data-delete="projects" data-id="${esc(p.id)}">Supprimer</button></div></div>`).join("")}</div>`:empty("Aucun projet enregistré."),8)}${card("Budget harmonisé","Somme des enveloppes prévues.",`<div class="wealth-total"><span>BUDGET TOTAL</span><b>${chf(total)}</b></div><div class="info-note" style="margin-top:14px">Cette enveloppe n’est pas soustraite du patrimoine : elle représente un objectif futur, pas une dette.</div>`,4)}</section>`;}

function renderSport(){const year=state.sport.filter(x=>String(x.date||"").includes(String(currentYear()))),mins=sum(year,x=>x.dur),kcal=sum(year,x=>x.kcal);return `${sectionHead("Sport","Un petit module de suivi personnel conservé dans le Family Office.",`<button class="primary" data-modal="sport">+ Activité</button>`)}<section class="grid">${card("Année en cours","Volume enregistré.",`<div class="pillars"><div class="pillar"><strong>${num(mins,0)} min</strong><span>Durée totale</span></div><div class="pillar"><strong>${num(kcal,0)}</strong><span>kcal saisies</span></div></div>`,4)}${card("Historique","Activités les plus récentes.",state.sport.length?`<div class="list">${[...state.sport].sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(x=>`<div class="list-item"><div><b>${esc(x.type||"Activité")}</b><small>${dateLabel(normalizeDate(x.date))} · ${num(x.dur,0)} min</small></div><div class="list-actions"><div class="amount">${num(x.kcal,0)} kcal</div><button class="tiny-btn delete" data-delete="sport" data-id="${esc(x.id)}">Supprimer</button></div></div>`).join("")}</div>`:empty("Aucune activité saisie."),8)}</section>`;}

function openModal(type,id=null){
  const m=$("modal"),title=$("modalTitle"),ey=$("modalEyebrow"),body=$("modalBody");ey.textContent="Family Office";
  if(type==="transaction"){
    title.textContent="Nouveau flux";body.innerHTML=`<form id="transactionForm" class="form-grid"><div class="field"><label>Date<input name="date" type="date" value="${today()}" required></label></div><div class="field"><label>Montant CHF<input name="amt" type="number" step="0.01" required></label></div><div class="field"><label>Libellé<input name="desc" required></label></div><div class="field"><label>Catégorie<select name="cat"><option>Logement</option><option>Assurances</option><option>Électricité</option><option>Internet & Téléphone</option><option>Alimentation</option><option>Restaurant</option><option>Transport</option><option>Recharge voiture</option><option>Loisirs</option><option>Santé</option><option>Voyages</option><option>Revenu</option><option>Autres</option></select></label></div><div class="field"><label>Type<select name="type"><option value="expense">Dépense</option><option value="income">Revenu</option></select></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  } else if(type==="stock"){
    const s=state.stocks.find(x=>x.id===id)||{};state.editingStock=id||null;title.textContent=id?"Modifier la position":"Nouvelle position";body.innerHTML=`<form id="stockForm" class="form-grid"><div class="field full"><label>Ticker<input name="ticker" value="${esc(s.ticker||"")}" required></label></div><div class="field"><label>Quantité<input name="qty" type="number" step="0.0001" value="${n(s.qty)}" required></label></div><div class="field"><label>Prix moyen<input name="prm" type="number" step="0.01" value="${n(s.prm)}" required></label></div><div class="field full"><label>Cours actuel manuel<input name="live" type="number" step="0.01" value="${n(s.live)}" required></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  } else if(type==="credit"){
    const c=state.credits.find(x=>x.id===id)||{};state.editingCredit=id||null;title.textContent=id?"Modifier le crédit":"Nouveau crédit";body.innerHTML=`<form id="creditForm" class="form-grid"><div class="field full"><label>Nom<input name="name" value="${esc(c.name||"")}" required></label></div><div class="field"><label>Capital initial<input name="total" type="number" value="${n(c.total)}" required></label></div><div class="field"><label>Mensualité<input name="mens" type="number" step="0.01" value="${n(c.mens)}" required></label></div><div class="field"><label>Date de début<input name="start" placeholder="05.2024" value="${esc(c.start||"")}" required></label></div><div class="field"><label>Date de fin<input name="end" placeholder="05.2028" value="${esc(c.end||"")}" required></label></div><div class="field"><label>Devise<select name="ccy"><option value="CHF" ${(c.ccy||"CHF")==="CHF"?"selected":""}>CHF</option><option value="EUR" ${c.ccy==="EUR"?"selected":""}>EUR</option></select></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  } else if(type==="p3"){
    title.textContent="Versement 3a";body.innerHTML=`<form id="p3Form" class="form-grid"><div class="field"><label>Date<input name="date" type="date" value="${today()}" required></label></div><div class="field"><label>Montant CHF<input name="amt" type="number" step="0.01" required></label></div><div class="field full"><label>Bénéficiaire / compte<input name="owner" placeholder="Optionnel : Kévin, Charlotte…"></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  } else if(type==="project"){
    title.textContent="Nouveau projet";body.innerHTML=`<form id="projectForm" class="form-grid"><div class="field full"><label>Projet<input name="name" required></label></div><div class="field full"><label>Budget CHF<input name="budget" type="number" step="0.01" required></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  } else if(type==="sport"){
    title.textContent="Nouvelle activité";body.innerHTML=`<form id="sportForm" class="form-grid"><div class="field"><label>Date<input name="date" type="date" value="${today()}" required></label></div><div class="field"><label>Activité<input name="type" required></label></div><div class="field"><label>Durée min<input name="dur" type="number" required></label></div><div class="field"><label>Calories<input name="kcal" type="number"></label></div><div class="field full"><button class="primary" type="submit">Enregistrer</button></div></form>`;
  }
  m.classList.add("show");m.setAttribute("aria-hidden","false");bindView();
}
function closeModal(){$("modal").classList.remove("show");$("modal").setAttribute("aria-hidden","true");state.editingStock=null;state.editingCredit=null;}
$("modalClose").onclick=closeModal;$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});

function bindView(){
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{state.view=b.dataset.view;render()});
  document.querySelectorAll("[data-modal]").forEach(b=>b.onclick=()=>openModal(b.dataset.modal));
  document.querySelectorAll("[data-edit-stock]").forEach(b=>b.onclick=()=>openModal("stock",b.dataset.editStock));
  document.querySelectorAll("[data-edit-credit]").forEach(b=>b.onclick=()=>openModal("credit",b.dataset.editCredit));
  document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{if(confirm("Confirmer la suppression ?"))await deleteDoc(doc(db,b.dataset.delete,b.dataset.id))});
  const ms=$("monthSelect");if(ms)ms.onchange=()=>{state.selectedMonth=ms.value;render()};
  bindForm("transactionForm",saveTransaction);bindForm("stockForm",saveStock);bindForm("creditForm",saveCredit);bindForm("p3Form",saveP3);bindForm("projectForm",saveProject);bindForm("sportForm",saveSport);bindForm("savingsForm",saveSavings);bindForm("watchForm",saveWatch);bindForm("p2Form",saveP2);bindForm("taxForm",saveTax);
  document.querySelectorAll(".propertyForm").forEach(f=>f.onsubmit=e=>saveProperty(e,f.dataset.key));
}
function bindForm(id,fn){const f=$(id);if(f)f.onsubmit=e=>fn(e,f)}
function formData(f){return Object.fromEntries(new FormData(f).entries())}

async function saveTransaction(e,f){e.preventDefault();const d=formData(f);await addDoc(collection(db,"transactions"),{uid:state.user.uid,date:d.date,desc:d.desc.trim(),amt:n(d.amt),cat:d.cat,type:d.type,ts:Date.now()});closeModal()}
async function saveStock(e,f){e.preventDefault();const d=formData(f),p={ticker:d.ticker.trim().toUpperCase(),qty:n(d.qty),prm:n(d.prm),live:n(d.live),uid:state.user.uid};if(state.editingStock)await setDoc(doc(db,"bourse",state.editingStock),p);else await addDoc(collection(db,"bourse"),{...p,ts:Date.now()});closeModal()}
async function saveCredit(e,f){e.preventDefault();const d=formData(f),p={name:d.name.trim(),total:n(d.total),mens:n(d.mens),dur:0,start:d.start,end:d.end,ccy:d.ccy,uid:state.user.uid};if(state.editingCredit)await setDoc(doc(db,"creditsconso",state.editingCredit),p);else await addDoc(collection(db,"creditsconso"),{...p,ts:Date.now()});closeModal()}
async function saveP3(e,f){e.preventDefault();const d=formData(f);await addDoc(collection(db,"pillar3"),{uid:state.user.uid,date:d.date,amt:n(d.amt),owner:d.owner?.trim()||"",ts:Date.now()});closeModal()}
async function saveProject(e,f){e.preventDefault();const d=formData(f);await addDoc(collection(db,"projects"),{uid:state.user.uid,name:d.name.trim(),budget:n(d.budget),ts:Date.now()});closeModal()}
async function saveSport(e,f){e.preventDefault();const d=formData(f);await addDoc(collection(db,"sport"),{uid:state.user.uid,date:d.date,type:d.type.trim(),dur:n(d.dur),kcal:n(d.kcal),ts:Date.now()});closeModal()}
async function saveSavings(e,f){e.preventDefault();const d=formData(f);await setDoc(doc(db,"savings",state.user.uid),{sq:n(d.sq),ep:n(d.ep),ec:n(d.ec)},{merge:true})}
async function saveWatch(e,f){e.preventDefault();const d=formData(f),ticker=d.ticker.trim().toUpperCase();if(ticker)await addDoc(collection(db,"watchlist"),{uid:state.user.uid,ticker});f.reset()}
async function saveP2(e,f){e.preventDefault();const d=formData(f);await setDoc(doc(db,"prevoyance2",state.user.uid),{baseK:n(d.baseK),annK:n(d.annK),baseC:n(d.baseC),annC:n(d.annC),targetY:parseInt(d.targetY)||2035,rate:n(d.rate)},{merge:true})}
async function saveTax(e,f){e.preventDefault();const d=formData(f);await setDoc(doc(db,"taxconfig",state.user.uid),{...state.tax,rev:n(d.rev),fort:n(d.fort),travel:n(d.travel),meals:n(d.meals),insurance:n(d.insurance),immo:n(d.immo),others:n(d.others),monthlyProvision:n(d.monthlyProvision)},{merge:true})}
async function saveProperty(e,key){e.preventDefault();const f=e.currentTarget,d=formData(f),payload={total:n(d.total),ccy:d.ccy,rate:n(d.rate),dur:n(d.dur),start:d.start};await setDoc(doc(db,"immo",state.user.uid),{[key]:payload},{merge:true})}

render();
