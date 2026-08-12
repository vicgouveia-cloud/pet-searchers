/* ==========================================================================
   Pet Searchers Portal - Application Logic (app.js v17)
   Banco Global em Nuvem em Tempo Real (Visível para Todos na Web),
   Geolocalização Precisa com Time-out Anti-Travamento (AbortController),
   Status Verdes de Reencontro, Botão Detalhes Completos nos Cards,
   Calendário Português Brasil (dd/mm/aaaa) e Painel Admin Master (Pet129502@)
   ========================================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuração Oficial do Firebase Firestore (Projeto: pet-searchers-52c3e)
const firebaseConfig = {
  apiKey: "AIzaSyCQhXeplGxtn2a9XVJCSj2jv2OApX1xNgo",
  authDomain: "pet-searchers-52c3e.firebaseapp.com",
  projectId: "pet-searchers-52c3e",
  storageBucket: "pet-searchers-52c3e.firebasestorage.app",
  messagingSenderId: "71782496251",
  appId: "1:71782496251:web:6be4662f8ce1248e813d5e",
  measurementId: "G-10BX1Q3C9W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function initFirebaseConnection() {
  try {
    console.log("🔥 Firebase Firestore Modular inicializado no projeto:", firebaseConfig.projectId);
    listenToFirebasePets();
    return true;
  } catch (e) {
    console.error("Erro ao inicializar Firebase Firestore:", e);
    return false;
  }
}

function listenToFirebasePets() {
  if (!db) return;
  try {
    onSnapshot(collection(db, "pets"), (snapshot) => {
      const cloudPets = [];
      snapshot.forEach((docSnap) => {
        cloudPets.push({ id: docSnap.id, ...docSnap.data() });
      });

      if (cloudPets.length > 0) {
        cloudPets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const deletedSet = getDeletedPetIds();
        const filteredPets = cloudPets.filter(p => !deletedSet.has(p.id));
        petsData = deduplicatePets(filteredPets);
        savePetsToStorage();
        renderApp();
        console.log("🔥 Sincronizado em tempo real com Firebase Firestore:", petsData.length, "pets.");
      }
    }, (err) => {
      if (err && (err.code === "permission-denied" || (err.message && err.message.includes("permission-denied")))) {
        console.info("ℹ️ Firestore (pet-searchers-52c3e) aguardando você clicar em 'Criar banco de dados' no Firebase Console (Modo de teste / São Paulo).");
      } else {
        console.warn("Aviso no listener do Firestore:", err.message || err);
      }
    });
  } catch (e) {
    console.warn("Erro ao iniciar escuta do Firestore:", e);
  }
}

async function savePetToFirebase(pet) {
  if (!db) return false;
  try {
    let petToSave = { ...pet };
    if (petToSave.photo && petToSave.photo.length > 450000 && petToSave.photo.startsWith("data:image/")) {
      petToSave.photo = getRandomDefaultPhoto(petToSave.species);
    }
    await setDoc(doc(db, "pets", petToSave.id), petToSave);
    console.log("✅ Pet gravado no Firebase Firestore com sucesso:", petToSave.name);
    return true;
  } catch (e) {
    console.error("❌ Erro ao gravar no Firebase Firestore:", e);
    return false;
  }
}

async function deletePetFromFirebase(petId) {
  if (!db) return false;
  try {
    await deleteDoc(doc(db, "pets", petId));
    console.log("🗑️ Pet excluído do Firebase Firestore com sucesso:", petId);
    return true;
  } catch (e) {
    console.error("❌ Erro ao excluir do Firebase Firestore:", e);
    return false;
  }
}

// --- TODOS OS 27 ESTADOS DO BRASIL (IBGE) ---
const BRAZIL_UFS = [
  { sigla: "AC", nome: "Acre", lat: -9.0238, lng: -70.8120 },
  { sigla: "AL", nome: "Alagoas", lat: -9.5713, lng: -36.7820 },
  { sigla: "AP", nome: "Amapá", lat: 0.9020, lng: -52.0030 },
  { sigla: "AM", nome: "Amazonas", lat: -3.4168, lng: -65.8561 },
  { sigla: "BA", nome: "Bahia", lat: -12.9777, lng: -38.5016 },
  { sigla: "CE", nome: "Ceará", lat: -5.4984, lng: -39.3206 },
  { sigla: "DF", nome: "Distrito Federal", lat: -15.7975, lng: -47.8919 },
  { sigla: "ES", nome: "Espírito Santo", lat: -19.1834, lng: -40.3089 },
  { sigla: "GO", nome: "Goiás", lat: -15.8270, lng: -49.8362 },
  { sigla: "MA", nome: "Maranhão", lat: -5.4241, lng: -45.4411 },
  { sigla: "MT", nome: "Mato Grosso", lat: -12.6819, lng: -56.9211 },
  { sigla: "MS", nome: "Mato Grosso do Sul", lat: -20.7722, lng: -54.7852 },
  { sigla: "MG", nome: "Minas Gerais", lat: -18.5122, lng: -44.5550 },
  { sigla: "PA", nome: "Pará", lat: -1.9981, lng: -54.9306 },
  { sigla: "PB", nome: "Paraíba", lat: -7.2400, lng: -36.7820 },
  { sigla: "PR", nome: "Paraná", lat: -25.2521, lng: -52.0215 },
  { sigla: "PE", nome: "Pernambuco", lat: -8.8137, lng: -36.9541 },
  { sigla: "PI", nome: "Piauí", lat: -7.7183, lng: -42.7289 },
  { sigla: "RJ", nome: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
  { sigla: "RN", nome: "Rio Grande do Norte", lat: -5.7945, lng: -36.5090 },
  { sigla: "RS", nome: "Rio Grande do Sul", lat: -30.0346, lng: -51.2177 },
  { sigla: "RO", nome: "Rondônia", lat: -11.5057, lng: -63.5806 },
  { sigla: "RR", nome: "Roraima", lat: 2.7376, lng: -62.0751 },
  { sigla: "SC", nome: "Santa Catarina", lat: -27.2423, lng: -50.2189 },
  { sigla: "SP", nome: "São Paulo", lat: -23.5505, lng: -46.6333 },
  { sigla: "SE", nome: "Sergipe", lat: -10.5741, lng: -37.3857 },
  { sigla: "TO", nome: "Tocantins", lat: -10.1753, lng: -48.2982 }
];

const citiesCache = {};

// --- MOCK INITIAL DATASET ---
const INITIAL_PETS = [
  {
    id: "pet-100",
    name: "Negão",
    type: "Procurado",
    species: "Cachorro",
    breed: "SRD (Vira-lata)",
    color: "Preto",
    age: "17 anos",
    gender: "Macho",
    state: "SP",
    city: "Carapicuíba",
    address: "Trav Maria Siqueira, altura do 34, Centro",
    date: "2026-05-01",
    description: "Negão foi visto pela última vez próximo ao Cartório Eleitoral. Está com as pernas traseiras um pouco descadeiradas.",
    contactName: "Tutor Responsável",
    contactPhone: "(11) 97607-7509",
    photo: "assets/poster_example.png",
    matchConfidence: "98%",
    createdAt: new Date().toISOString(),
    lastRenewedAt: new Date().toISOString(),
    lat: -23.5222,
    lng: -46.8356
  },
  {
    id: "pet-101",
    name: "Thor",
    type: "Procurado",
    species: "Cachorro",
    breed: "Golden Retriever",
    color: "Dourado Claro",
    age: "4 anos",
    gender: "Macho",
    state: "SP",
    city: "São Paulo",
    address: "Parque Ibirapuera, Vila Mariana",
    date: "2026-08-08",
    description: "Thor sumiu durante o passeio. Pelagem dourada média, mancha branca no peito. Atende pelo nome e é muito amigável.",
    contactName: "Mariana Souza",
    contactPhone: "(11) 98765-4321",
    photo: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80",
    matchConfidence: "95%",
    createdAt: new Date().toISOString(),
    lastRenewedAt: new Date().toISOString(),
    lat: -23.5874,
    lng: -46.6576
  },
  {
    id: "pet-102",
    name: "Desconhecido (Gato Amarelo)",
    type: "Avistado",
    species: "Gato",
    breed: "Vira-lata (SRD)",
    color: "Amarelo Tigrado",
    age: "Adulto",
    gender: "Não identificado",
    state: "RJ",
    city: "Rio de Janeiro",
    address: "Rua Barata Ribeiro, Copacabana",
    date: "2026-08-09",
    description: "Avistado miando próximo à portaria do prédio 240. Sem coleira, olhos verdes bem vivos.",
    contactName: "Ricardo Mendonça",
    contactPhone: "(21) 99123-4567",
    photo: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80",
    matchConfidence: "88%",
    createdAt: new Date().toISOString(),
    lastRenewedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    lat: -22.9698,
    lng: -43.1868
  },
  {
    id: "pet-103",
    name: "Belinha",
    type: "Encontrado pelo dono",
    species: "Cachorro",
    breed: "Poodle Toy",
    color: "Branco",
    age: "3 anos",
    gender: "Fêmea",
    state: "PR",
    city: "Curitiba",
    address: "Praça do Japão, Água Verde",
    date: "2026-08-07",
    description: "Pet reencontrado em segurança pela tutora Ana Paula! Agradecemos a todos da comunidade.",
    contactName: "Ana Paula",
    contactPhone: "(41) 99888-7766",
    photo: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
    matchConfidence: "100%",
    createdAt: new Date().toISOString(),
    lastRenewedAt: new Date().toISOString(),
    lat: -25.4432,
    lng: -49.2778
  }
];

// --- GLOBAL STATE ---
let petsData = [];
let leafletMap = null;
let mapMarkers = {};
let currentActiveFilters = {
  search: "",
  state: "",
  city: "",
  status: "",
  species: ""
};

// Admin State
let isAdminAuthenticated = false;
let purgedCountTotal = 0;

// Date Picker Instance (Flatpickr pt-BR)
let datePickerInstance = null;

// --- GERENCIAMENTO DE SENHA ADMIN ---
function getAdminPassword() {
  return localStorage.getItem("pet_searchers_admin_password_v2") || "Pet129502@";
}

function setAdminPassword(newPassword) {
  localStorage.setItem("pet_searchers_admin_password_v2", newPassword);
}

// --- APP INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  initFirebaseConnection();
  initLocationSelectors();
  initLeafletMap();
  initDatePicker();
  initFilterEvents();
  initModalEvents();
  initAdminEvents();
  preloadPopularStatesCities();

  // 1. Carrega do storage local primeiro para renderizar instantaneamente
  loadPetsFromStorage();
  runAutoPurgeEngine();
  renderApp();

  // 2. O listener em tempo real do Firebase (initFirebaseConnection -> listenToFirebasePets) 
  // atualiza automaticamente qualquer inserção ou exclusão em tempo real (< 300ms) sem necessidade de polling HTTP.

  // 4. Verifica geocodificação em segundo plano
  await retroactiveGeocodePets();
});

// --- DATE PICKER INITIALIZATION (FLATPICKR PT-BR - FORMATO DIA/MÊS/ANO) ---
function initDatePicker() {
  if (typeof flatpickr !== "undefined") {
    datePickerInstance = flatpickr("#iptDate", {
      locale: "pt",
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      altInputClass: "w-full px-3.5 py-2 rounded-xl border border-outline-variant bg-background text-sm focus:border-secondary outline-none font-medium cursor-pointer",
      maxDate: "today",
      allowInput: true,
      disableMobile: true
    });
  }
}

// --- GEOLOCALIZAÇÃO PRECISA E INTELIGENTE EM CASCATA ---
async function singleNominatimQuery(query, timeoutMs = 2200) {
  if (!query || query.trim().length < 3) return null;
  const headers = { 'Accept': 'application/json' };
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
        const latVal = parseFloat(data[0].lat);
        const lonVal = parseFloat(data[0].lon);
        if (Number.isFinite(latVal) && Number.isFinite(lonVal)) {
          return { lat: latVal, lng: lonVal };
        }
      }
    }
  } catch (e) {
    // Silencia timeout para permitir tentativa do próximo candidato
  }
  return null;
}

async function fetchGeocodeCoordinates(address = "", city = "", state = "") {
  const cleanState = (state || "").trim();
  const cleanCity = (city || "").trim();
  const rawAddress = (address || "").trim();

  if (rawAddress && cleanCity && cleanState) {
    // Limpeza inteligente de ruídos e prefixos de endereço
    const sanitized = rawAddress
      .replace(/próximo a[o]?|em frente a[o]?|altura do|altura nº|altura|nº|número|na rua|no bairro|perto d[oea]|esquina com|próximo|ao lado d[oea]|esquina/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const candidates = [];

    // 1. Endereço Limpo Completo na Cidade
    if (sanitized) {
      candidates.push(`${sanitized}, ${cleanCity}, ${cleanState}, Brasil`);
    }

    // 2. Fragmentos divididos por vírgula, traço ou barra (ex: "Rua X, Vila Mariana" -> tenta "Rua X", depois "Vila Mariana")
    const segments = rawAddress.split(/[,;\-\/]/).map(s => s.trim()).filter(s => s.length >= 3);
    for (let seg of segments) {
      const cleanSeg = seg.replace(/próximo a[o]?|em frente a[o]?|altura do|altura|nº|número/gi, "").trim();
      if (cleanSeg && cleanSeg.length >= 3) {
        candidates.push(`${cleanSeg}, ${cleanCity}, ${cleanState}, Brasil`);
      }
    }

    // 3. Apenas o nome da rua/avenida (removendo números da residência)
    const streetOnly = sanitized.replace(/\d+/g, "").trim();
    if (streetOnly && streetOnly.length >= 3 && streetOnly !== sanitized) {
      candidates.push(`${streetOnly}, ${cleanCity}, ${cleanState}, Brasil`);
    }

    // 4. Primeiras 3 palavras (ex: "Avenida Paulista altura do 1000" -> "Avenida Paulista")
    const words = sanitized.split(" ");
    if (words.length > 2) {
      const firstWords = words.slice(0, 3).join(" ").replace(/\d+/g, "").trim();
      if (firstWords.length >= 3) {
        candidates.push(`${firstWords}, ${cleanCity}, ${cleanState}, Brasil`);
      }
    }

    // Testa os candidatos únicos em ordem de prioridade (Rua -> Bairro -> Ponto de Referência)
    const uniqueCandidates = [...new Set(candidates)];
    for (let cand of uniqueCandidates) {
      const coords = await singleNominatimQuery(cand, 2000);
      if (coords) {
        return coords;
      }
    }
  }

  // 5. Fallback para o Centro da Cidade (Cidade + Estado)
  if (cleanCity && cleanState) {
    const cityCoords = await singleNominatimQuery(`${cleanCity}, ${cleanState}, Brasil`, 2500);
    if (cityCoords) {
      return cityCoords;
    }
  }

  // 6. Fallback final para a Capital / Estado (UF)
  const ufObj = BRAZIL_UFS.find(u => u.sigla === cleanState) || { lat: -23.5505, lng: -46.6333 };
  return { lat: ufObj.lat, lng: ufObj.lng };
}

async function retroactiveGeocodePets() {
  let updated = false;

  for (let pet of petsData) {
    const isDefaultSecoCoords = (pet.lat === -23.5505 && pet.lng === -46.6333);
    const cityChanged = !pet.geocodedCity || pet.geocodedCity !== pet.city;
    const addressChanged = !pet.geocodedAddress || pet.geocodedAddress !== pet.address;

    if (cityChanged || addressChanged || isDefaultSecoCoords) {
      const coords = await fetchGeocodeCoordinates(pet.address, pet.city, pet.state);
      if (coords && (coords.lat !== pet.lat || coords.lng !== pet.lng)) {
        pet.lat = coords.lat;
        pet.lng = coords.lng;
        pet.geocodedCity = pet.city;
        pet.geocodedAddress = pet.address;
        updated = true;
      }
    }
  }

  if (updated) {
    savePetsToStorage();
    renderApp();
    for (let p of petsData) {
      if (p.isLocalPending || (p.id && !p.id.startsWith("pet-100"))) {
        savePetToFirebase(p);
      }
    }
  }
}

// --- LOCALSTORAGE & GLOBAL CLOUD PERSISTENCE ---
function loadPetsFromStorage() {
  const saved = localStorage.getItem("pet_searchers_portal_data_v5");
  if (saved) {
    try {
      petsData = JSON.parse(saved);
    } catch (e) {
      petsData = [...INITIAL_PETS];
    }
  } else {
    petsData = [...INITIAL_PETS];
    savePetsToStorage();
  }
}

function savePetsToStorage() {
  try {
    localStorage.setItem("pet_searchers_portal_data_v5", JSON.stringify(petsData));
  } catch (e) {
    console.warn("⚠️ Cota do localStorage excedida. Otimizando fotos locais...", e);
    try {
      const sanitizedPets = petsData.map((p, idx) => {
        if (idx > 2 && p.photo && p.photo.startsWith("data:image/")) {
          return { ...p, photo: getRandomDefaultPhoto(p.species) };
        }
        return p;
      });
      localStorage.setItem("pet_searchers_portal_data_v5", JSON.stringify(sanitizedPets));
    } catch (e2) {
      console.error("Não foi possível salvar no localStorage:", e2);
    }
  }
}

function deduplicatePets(pets) {
  if (!Array.isArray(pets)) return [];
  const seenIds = new Set();
  const seenContentKeys = new Set();

  return pets.filter(pet => {
    if (!pet || !pet.id) return false;
    
    // 1. Desduplica por ID estrito
    if (seenIds.has(pet.id)) return false;

    // 2. Desduplica por conteúdo chave (Nome + Telefone + Endereço) para eliminar cadastros idênticos salvos com IDs diferentes
    const nameStr = (pet.name || '').toLowerCase().trim();
    const phoneStr = (pet.contactPhone || '').trim();
    const addrStr = (pet.address || '').toLowerCase().trim();
    const contentKey = `${nameStr}_${phoneStr}_${addrStr}`;

    if (nameStr.length > 1 && contentKey.length > 5 && seenContentKeys.has(contentKey)) {
      return false;
    }

    seenIds.add(pet.id);
    if (nameStr.length > 1 && contentKey.length > 5) {
      seenContentKeys.add(contentKey);
    }
    return true;
  });
}

function getDeletedPetIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem("pet_searchers_deleted_ids_v1") || "[]"));
  } catch (e) {
    return new Set();
  }
}

function markPetAsDeleted(petId) {
  const deletedSet = getDeletedPetIds();
  deletedSet.add(petId);
  localStorage.setItem("pet_searchers_deleted_ids_v1", JSON.stringify(Array.from(deletedSet)));
}

// --- FIREBASE FIRESTORE SYNC & PERSISTENCE ENGINE ---

// --- AUTOMATED 30-DAY EXPIRATION ENGINE ---
function runAutoPurgeEngine() {
  const now = new Date();
  const validPets = [];
  let purgedCount = 0;

  petsData.forEach(pet => {
    const refDate = pet.lastRenewedAt ? new Date(pet.lastRenewedAt) : new Date(pet.createdAt || now);
    const diffTime = Math.abs(now - refDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 30) {
      purgedCount++;
    } else {
      pet.daysActive = diffDays;
      pet.daysRemaining = Math.max(0, 30 - diffDays);
      pet.isRenewalWindow = diffDays >= 23 && diffDays <= 30;
      validPets.push(pet);
    }
  });

  if (purgedCount > 0) {
    petsData = validPets;
    purgedCountTotal += purgedCount;
    savePetsToStorage();
    savePetsToCloud();
  } else {
    petsData = validPets;
  }
}

// --- LOCATION DROPDOWN INITIALIZATION (TODOS OS ESTADOS E CIDADES DO BRASIL VIA IBGE) ---
function initLocationSelectors() {
  const filterState = document.getElementById("filterState");
  const filterCity = document.getElementById("filterCity");
  const iptState = document.getElementById("iptState");
  const iptCity = document.getElementById("iptCity");

  filterState.innerHTML = `<option value="">Todos os Estados do Brasil (27 UFs)</option>`;
  iptState.innerHTML = `<option value="">Selecione o Estado (UF)</option>`;

  BRAZIL_UFS.forEach(ufObj => {
    const optFilter = new Option(`${ufObj.nome} (${ufObj.sigla})`, ufObj.sigla);
    const optForm = new Option(`${ufObj.nome} (${ufObj.sigla})`, ufObj.sigla);
    filterState.add(optFilter);
    iptState.add(optForm);
  });

  filterState.addEventListener("change", async (e) => {
    const uf = e.target.value;
    currentActiveFilters.state = uf;
    currentActiveFilters.city = "";
    await loadCitiesForState(uf, filterCity, "Todas as Cidades do Brasil");
    renderApp();
  });

  filterCity.addEventListener("change", (e) => {
    currentActiveFilters.city = e.target.value;
    renderApp();
  });

  iptState.addEventListener("change", async (e) => {
    const uf = e.target.value;
    await loadCitiesForState(uf, iptCity, "Selecione a Cidade");
  });

  iptCity.addEventListener("focus", () => {
    if (!iptState.value) {
      iptState.focus();
      iptState.classList.add("ring-2", "ring-error");
      setTimeout(() => iptState.classList.remove("ring-2", "ring-error"), 1500);
    }
  });
}

function preloadPopularStatesCities() {
  const popularUFs = ["SP", "RJ", "MG", "PR", "RS", "SC", "BA", "PE", "DF"];
  popularUFs.forEach(uf => {
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
      .then(r => r.json())
      .then(data => {
        citiesCache[uf] = data.map(item => item.nome);
      })
      .catch(() => {});
  });
}

const STATE_CAPITALS_FALLBACK = {
  AC: ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira"],
  AL: ["Maceió", "Arapiraca", "Rio Largo"],
  AP: ["Macapá", "Santana", "Laranjal do Jari"],
  AM: ["Manaus", "Parintins", "Itacoatiara"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Juazeiro", "Ilhéus"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú", "Sobral"],
  DF: ["Brasília", "Ceilândia", "Taguatinga", "Samambaia", "Plano Piloto"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Cachoeiro de Itapemirim"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde"],
  MA: ["São Luís", "Imperatriz", "São José de Ribamar", "Caxias"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop"],
  MS: ["Campo Grande", "Dourados", "Três Lagoas", "Corumbá"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros"],
  PA: ["Belém", "Ananindeua", "Santarém", "Marabá"],
  PB: ["João Pessoa", "Campina Grande", "Santa Rita", "Patos"],
  PR: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru", "Petrolina"],
  PI: ["Teresina", "Parnaíba", "Picos"],
  RJ: ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Campos dos Goytacazes"],
  RN: ["Natal", "Mossoró", "Parnamirim"],
  RS: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Santa Maria", "Gravataí"],
  RO: ["Porto Velho", "Ji-Paraná", "Ariquemes"],
  RR: ["Boa Vista", "Rorainópolis"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó", "Criciúma"],
  SP: ["São Paulo", "Guarulhos", "Campinas", "São Bernardo do Campo", "Santo André", "Osasco", "Carapicuíba", "Sorocaba", "Ribeirão Preto", "Santos"],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Lagarto"],
  TO: ["Palmas", "Araguaína", "Gurupi"]
};

async function loadCitiesForState(uf, selectElem, defaultText) {
  selectElem.innerHTML = `<option value="">${defaultText}</option>`;
  if (!uf) return;

  if (citiesCache[uf]) {
    populateCityOptions(selectElem, citiesCache[uf], defaultText);
    return;
  }

  selectElem.innerHTML = `<option value="">⏳ Carregando cidades de ${uf}...</option>`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error("Erro ao buscar cidades no IBGE");
    const data = await res.json();
    const cityNames = data.map(item => item.nome);
    
    citiesCache[uf] = cityNames;
    populateCityOptions(selectElem, cityNames, defaultText);
  } catch (err) {
    console.warn("⚠️ API do IBGE indisponível ou lenta na rede móvel. Carregando lista de cidades de fallback para:", uf);
    const fallbackCities = STATE_CAPITALS_FALLBACK[uf] || ["Capital", "Outras Cidades"];
    citiesCache[uf] = fallbackCities;
    populateCityOptions(selectElem, fallbackCities, defaultText);
  }
}

function populateCityOptions(selectElem, cityList, defaultText) {
  selectElem.innerHTML = `<option value="">${defaultText} (${cityList.length} cidades disponíveis)</option>`;
  cityList.forEach(cityName => {
    selectElem.add(new Option(cityName, cityName));
  });
}

// --- LEAFLET INTERACTIVE MAP (GOOGLE MAPS BASE LAYER) ---
function initLeafletMap() {
  leafletMap = L.map('map', {
    center: [-14.2350, -51.9253],
    zoom: 4,
    zoomControl: true
  });

  // Camada oficial do Google Maps Roadmap (Visual limpo, atualizado e em Português-BR)
  L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>'
  }).addTo(leafletMap);

  document.getElementById("btnResetMap").addEventListener("click", () => {
    currentActiveFilters.status = "";
    syncStatusFilterUI();
    renderApp();
    leafletMap.setView([-14.2350, -51.9253], 4, { animate: true });
  });
}

function updateMapMarkers(filteredPets) {
  if (!leafletMap) return;

  Object.keys(mapMarkers).forEach(id => {
    leafletMap.removeLayer(mapMarkers[id]);
  });
  mapMarkers = {};

  const bounds = L.latLngBounds();

  filteredPets.forEach(pet => {
    if (!Number.isFinite(pet.lat) || !Number.isFinite(pet.lng)) return;

    // Ícones em Formato de Bolinha:
    // Vermelho (#E52E10) -> Procurado / Perdido
    // Cinza (#6B7280)    -> Avistado
    // Verde (#16A34A)   -> Reencontrado (Encontrado pelo dono / Dono encontrado)
    const isResolved = pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado";
    let circleClass = "marker-circle-sighted"; // Azul claro por padrão (Avistado)
    let badgeColor = "bg-sky-500";
    let badgeText = pet.type;

    if (pet.type === "Procurado") {
      circleClass = "marker-circle-lost"; // Vermelho (Procurado)
      badgeColor = "bg-[#E52421]";
    } else if (isResolved) {
      circleClass = "marker-circle-found"; // Verde (Reencontrado)
      badgeColor = "bg-green-600";
      badgeText = "Reencontrado 🎉";
    }

    const customIcon = L.divIcon({
      className: 'custom-leaflet-circle-pin',
      html: `<div class="custom-marker-circle ${circleClass}" title="${pet.name} (${badgeText})">
              <div class="marker-circle-inner"></div>
            </div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14]
    });

    const cleanPhone = (pet.contactPhone || '').replace(/\D/g, "");
    const waMsg = encodeURIComponent(`Olá ${pet.contactName}, vi o aviso de ${pet.name} no mapa do Pet Searchers!`);

    const popupHtml = `
      <div class="w-56 font-sans flex flex-col bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
        <!-- Imagem 1:1 no topo com object-contain e Fundo Branco -->
        <div class="w-full aspect-square shrink-0 relative overflow-hidden bg-white border-b border-gray-100 flex items-center justify-center p-1.5 cursor-pointer group" style="aspect-ratio: 1 / 1;" onclick="openImageLightbox('${pet.id}')" title="Clique para ampliar foto em tela cheia">
          <img src="${pet.photo}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-full h-full object-contain rounded-lg group-hover:scale-105 transition-transform duration-300"/>
          <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white ${badgeColor} shadow-md flex items-center gap-1">
            ${badgeText}
          </span>
          <span class="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 backdrop-blur-sm">
            <span class="material-symbols-outlined text-[11px]">zoom_in</span> Ampliar
          </span>
        </div>

        <!-- Conteúdo inferior ultra compacto (Nome, Dados do Pet e Botões) -->
        <div class="p-3 space-y-2 bg-white">
          <div>
            <div class="flex items-center justify-between gap-1">
              <h4 class="font-extrabold text-xs sm:text-sm text-primary leading-tight truncate">${pet.name}</h4>
              <span class="text-[9px] font-bold text-gray-500 uppercase flex-shrink-0">${pet.species}</span>
            </div>
            <p class="text-[11px] text-gray-600 font-medium truncate mt-0.5">${pet.breed} • ${pet.color} ${pet.age ? `(${pet.age})` : ''}</p>
          </div>

          <div class="grid grid-cols-2 gap-1.5 pt-1 border-t border-gray-100">
            <button onclick="openDetailModal('${pet.id}')" class="py-1.5 px-2 bg-primary hover:bg-primary-container text-white rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 shadow-sm">
              <span class="material-symbols-outlined text-xs">info</span> Detalhes
            </button>
            <a href="https://wa.me/55${cleanPhone}?text=${waMsg}" target="_blank" class="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 shadow-sm no-underline">
              <span class="material-symbols-outlined text-xs">chat</span> WhatsApp
            </a>
          </div>
        </div>
      </div>
    `;

    const marker = L.marker([pet.lat, pet.lng], { icon: customIcon })
      .addTo(leafletMap)
      .bindPopup(popupHtml);

    mapMarkers[pet.id] = marker;
    bounds.extend([pet.lat, pet.lng]);
  });

  if (bounds.isValid() && filteredPets.length > 0) {
    try {
      leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch (e) {
      console.warn("Aviso fitBounds:", e);
    }
  }
}

function focusPetOnMap(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (!pet || !leafletMap) return;

  // 1. Rola a tela suavemente até a seção do mapa
  const mapElement = document.getElementById("mapSection") || document.getElementById("map");
  if (mapElement) {
    mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // 2. Voo animado até a coordenada com zoom 16 e abertura do popup card
  if (Number.isFinite(pet.lat) && Number.isFinite(pet.lng)) {
    try {
      leafletMap.setView([pet.lat, pet.lng], 16, { animate: true });
    } catch (e) {
      console.warn("Aviso setView:", e);
    }
    
    const marker = mapMarkers[petId];
    if (marker) {
      setTimeout(() => {
        marker.openPopup();
        const markerEl = marker.getElement();
        if (markerEl) {
          const circleEl = markerEl.querySelector('.custom-marker-circle');
          if (circleEl) {
            circleEl.classList.add("map-pin-pulse");
            setTimeout(() => circleEl.classList.remove("map-pin-pulse"), 3600);
          }
        }
      }, 300);
    }
  }

  const cardElem = document.getElementById(`card-${petId}`);
  if (cardElem) {
    cardElem.classList.add("ring-2", "ring-primary");
    setTimeout(() => cardElem.classList.remove("ring-2", "ring-primary"), 2500);
  }
}


// --- FILTER EVENT LISTENERS ---
function initFilterEvents() {
  const filterSearch = document.getElementById("filterSearch");
  filterSearch.addEventListener("input", (e) => {
    currentActiveFilters.search = e.target.value.toLowerCase().trim();
    renderApp();
  });

  // Legend status filter buttons above map (Procurados, Avistados, Reencontrados)
  document.querySelectorAll(".legend-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const selectedStatus = btn.dataset.legendStatus;
      if (currentActiveFilters.status === selectedStatus) {
        currentActiveFilters.status = "";
      } else {
        currentActiveFilters.status = selectedStatus;
      }
      syncStatusFilterUI();
      renderApp();
    });
  });

  // Main filter bar status pills
  document.querySelectorAll(".filter-status-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentActiveFilters.status = btn.dataset.status;
      syncStatusFilterUI();
      renderApp();
    });
  });

  document.querySelectorAll(".filter-species-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-species-btn").forEach(b => {
        b.className = "filter-species-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-surface-container text-on-surface-variant hover:bg-surface-container-high";
      });
      btn.className = "filter-species-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-secondary text-on-primary";
      currentActiveFilters.species = btn.dataset.species;
      renderApp();
    });
  });

  document.getElementById("btnClearFilters").addEventListener("click", () => {
    currentActiveFilters = { search: "", state: "", city: "", status: "", species: "" };
    document.getElementById("filterSearch").value = "";
    document.getElementById("filterState").value = "";
    document.getElementById("filterCity").value = "";
    syncStatusFilterUI();
    renderApp();
  });
}

function syncStatusFilterUI() {
  const current = currentActiveFilters.status;

  // Legend Filter buttons next to Resetar Visão
  document.querySelectorAll(".legend-filter-btn").forEach(b => {
    const s = b.dataset.legendStatus;
    if (current === s) {
      b.classList.add("ring-2", "ring-primary", "bg-surface-container", "scale-105");
      b.classList.remove("border-transparent");
    } else {
      b.classList.remove("ring-2", "ring-primary", "bg-surface-container", "scale-105");
      b.classList.add("border-transparent");
    }
  });

  // Main Filter Pills
  document.querySelectorAll(".filter-status-btn").forEach(b => {
    const s = b.dataset.status;
    let isActive = false;
    if (!current && !s) isActive = true;
    else if (current === s) isActive = true;
    else if (current === "Reencontrado" && (s === "Encontrado pelo dono" || s === "Dono encontrado")) isActive = true;

    if (isActive) {
      b.className = "filter-status-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition-all bg-primary text-on-primary shadow-sm";
    } else {
      b.className = "filter-status-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-surface-container text-on-surface-variant hover:bg-surface-container-high";
    }
  });
}

// --- APP RENDERER ---
function renderApp() {
  runAutoPurgeEngine();

  const filteredPets = petsData.filter(pet => {
    if (currentActiveFilters.search) {
      const q = currentActiveFilters.search;
      const matchName = pet.name.toLowerCase().includes(q);
      const matchBreed = pet.breed.toLowerCase().includes(q);
      const matchColor = pet.color.toLowerCase().includes(q);
      const matchAddress = pet.address.toLowerCase().includes(q);
      const matchCity = pet.city.toLowerCase().includes(q);
      const matchDesc = pet.description.toLowerCase().includes(q);
      if (!matchName && !matchBreed && !matchColor && !matchAddress && !matchCity && !matchDesc) {
        return false;
      }
    }

    if (currentActiveFilters.state && pet.state !== currentActiveFilters.state) return false;
    if (currentActiveFilters.city && pet.city !== currentActiveFilters.city) return false;
    
    if (currentActiveFilters.status) {
      if (currentActiveFilters.status === "Reencontrado") {
        if (pet.type !== "Encontrado pelo dono" && pet.type !== "Dono encontrado") return false;
      } else {
        if (pet.type !== currentActiveFilters.status) return false;
      }
    }

    if (currentActiveFilters.species && pet.species !== currentActiveFilters.species) return false;

    return true;
  });

  const petsGrid = document.getElementById("petsGrid");
  const emptyState = document.getElementById("emptyState");
  document.getElementById("resultsCount").textContent = filteredPets.length;

  if (filteredPets.length === 0) {
    petsGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
    petsGrid.innerHTML = filteredPets.map(pet => createPetCardHtml(pet)).join("");
  }

  updateMapMarkers(filteredPets);

  if (isAdminAuthenticated) {
    renderAdminDashboardTable();
  }
}

// --- PET CARD HTML TEMPLATE (COM BOTÃO DETALHES COMPLETOS VISÍVEL) ---
function createPetCardHtml(pet) {
  const isFoundOwner = pet.type === "Encontrado pelo dono";
  const isFoundPet = pet.type === "Dono encontrado";
  const isResolved = isFoundOwner || isFoundPet;

  let badgeBg = "bg-sky-500 text-white font-bold";
  let statusIcon = "visibility";

  if (pet.type === "Procurado") {
    badgeBg = "bg-[#E52421] text-on-error";
    statusIcon = "warning";
  } else if (isResolved) {
    badgeBg = "bg-green-600 text-white font-bold";
    statusIcon = "task_alt";
  }

  const isRenewalWindow = pet.isRenewalWindow && !isResolved;
  const daysLeft = pet.daysRemaining !== undefined ? pet.daysRemaining : 30;

  return `
    <article id="card-${pet.id}" onclick="focusPetOnMap('${pet.id}')" class="pet-card bg-surface rounded-2xl border border-outline-variant/50 overflow-hidden shadow-sm flex flex-col group relative cursor-pointer hover:shadow-md hover:border-secondary transition-all h-full justify-between" title="Clique para ver este pet no mapa">
      
      <!-- Imagem 1:1 no topo com object-contain e Fundo Branco -->
      <div class="w-full aspect-square shrink-0 relative overflow-hidden bg-white border-b border-outline-variant/30 flex items-center justify-center p-1.5 cursor-pointer group/img" style="aspect-ratio: 1 / 1;" onclick="event.stopPropagation(); openImageLightbox('${pet.id}')" title="Clique para ampliar a foto deste pet em tela cheia">
        <img src="${pet.photo}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-full h-full object-contain rounded-lg group-hover/img:scale-105 transition-transform duration-500"/>
        
        <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm shadow-md group-hover/img:bg-primary transition-colors">
          <span class="material-symbols-outlined text-xs">zoom_in</span> Ampliar Foto
        </div>
        
        <div class="absolute top-3 left-3 ${badgeBg} px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">${statusIcon}</span> ${pet.type}
        </div>

        <div class="absolute top-3 right-3 bg-primary/95 text-on-primary backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-md flex items-center gap-1">
          <span class="material-symbols-outlined text-xs text-secondary-container">auto_awesome</span> ${isResolved ? '100% Finalizado' : (pet.matchConfidence || '95% Match')}
        </div>
      </div>

      <!-- Informações no rodapé do cartão (Todas as informações e botões 100% visíveis) -->
      <div class="p-5 flex flex-col flex-1 justify-between space-y-3 bg-surface">
        
        <div>
          <div class="flex items-center justify-between gap-1">
            <h3 class="font-extrabold text-lg text-primary group-hover:text-secondary transition-colors leading-snug">${pet.name}</h3>
            <span class="text-xs font-bold text-outline uppercase tracking-wider flex-shrink-0">${pet.species}</span>
          </div>
          <p class="text-xs font-medium text-on-surface-variant mt-0.5">${pet.breed} • ${pet.color} ${pet.age ? `(${pet.age})` : ''}</p>
        </div>

        <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed flex-1">
          ${pet.description || 'Sem detalhes adicionais fornecidos.'}
        </p>

        ${isResolved ? `
          <div class="bg-green-50 border border-green-300 rounded-xl px-3 py-2 flex items-center justify-between text-xs">
            <span class="text-green-800 flex items-center gap-1 font-bold">
              <span class="material-symbols-outlined text-base">task_alt</span> Caso Finalizado
            </span>
            <span class="text-green-700 font-extrabold">Reencontrado 🎉</span>
          </div>
        ` : (isRenewalWindow ? `
          <div class="bg-amber-50 border border-amber-300 rounded-xl p-2 flex items-center justify-between text-xs text-amber-900" onclick="event.stopPropagation()">
            <span class="font-bold flex items-center gap-1 text-amber-800">
              <span class="material-symbols-outlined text-base">warning</span> Faltam ${daysLeft} dias!
            </span>
            <button onclick="event.stopPropagation(); renewPetListing('${pet.id}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] transition-colors flex items-center gap-1 shadow-sm">
              <span class="material-symbols-outlined text-xs">update</span> Renovar +30d
            </button>
          </div>
        ` : `
          <div class="bg-surface-container/60 border border-outline-variant/40 rounded-xl px-3 py-1.5 flex items-center justify-between text-xs">
            <span class="text-outline flex items-center gap-1 font-medium text-[11px]">
              <span class="material-symbols-outlined text-sm">schedule</span> Válido por mais ${daysLeft} dias
            </span>
            <span class="text-secondary font-bold text-[11px]">Ativo</span>
          </div>
        `)}

        <div class="pt-3 border-t border-outline-variant/30 space-y-1.5 text-xs text-outline">
          <div class="flex items-center gap-1.5 truncate">
            <span class="material-symbols-outlined text-secondary text-base flex-shrink-0">location_on</span>
            <span class="truncate font-medium text-on-surface">${pet.address}, ${pet.city} - ${pet.state}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 font-medium text-[11px]">
              <span class="material-symbols-outlined text-sm">calendar_today</span> ${formatDate(pet.date)}
            </span>
            <span class="font-semibold text-primary text-[11px] truncate max-w-[130px]">${pet.contactName}</span>
          </div>
        </div>

        <!-- Botões de Ação do Card (Totalmente Visíveis) -->
        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="event.stopPropagation(); focusPetOnMap('${pet.id}')" class="py-2 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Visualizar a geolocalização no mapa">
            <span class="material-symbols-outlined text-sm">map</span> Ver no Mapa
          </button>
          
          <button onclick="event.stopPropagation(); openDetailModal('${pet.id}')" class="py-2 px-2.5 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Ver detalhes completos do cadastro">
            <span class="material-symbols-outlined text-sm">visibility</span> Detalhes Completos
          </button>
          
          ${pet.type === 'Procurado' ? `
            <button onclick="event.stopPropagation(); generatePosterModal('${pet.id}')" class="col-span-2 py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-[#E52421] font-bold text-xs transition-colors flex items-center justify-center gap-1 border border-red-200">
              <span class="material-symbols-outlined text-sm">print</span> Cartaz para Impressão PDF
            </button>
          ` : ''}
        </div>

      </div>

    </article>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return "Data recente";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getFormattedPosterDate(dateStr) {
  if (!dateStr) return "DESDE RECENTEMENTE";
  const parts = dateStr.split("-");
  if (parts.length < 3) return `DESDE ${dateStr}`;
  const [year, month, day] = parts;
  const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const weekDays = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];
  const weekName = weekDays[dateObj.getDay()] || "";
  return `DESDE ${weekName} ${day}/${month}`;
}

// --- RENOVAÇÃO DIRETA POR MAIS 30 DIAS ---
async function renewPetListing(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (pet) {
    pet.lastRenewedAt = new Date().toISOString();
    pet.isRenewalWindow = false;
    pet.daysActive = 0;
    pet.daysRemaining = 30;
    savePetsToStorage();
    await savePetToFirebase(pet);
    renderApp();
    alert(`🎉 O anúncio de "${pet.name}" foi renovado com sucesso por mais 30 dias!`);
  }
}

// --- MODAL DE AMPLIAR FOTO DO PET (LIGHTBOX TELA CHEIA) ---
function openImageLightbox(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (pet && pet.photo) {
    const lightboxImg = document.getElementById("lightboxImg");
    lightboxImg.onerror = () => { lightboxImg.src = getRandomDefaultPhoto(pet.species); };
    lightboxImg.src = pet.photo;
    document.getElementById("lightboxPetName").textContent = `📸 ${pet.name} (${pet.species}) - ${pet.city || ''}/${pet.state || ''}`;
    document.getElementById("imageLightboxModal").classList.remove("hidden");
  }
}

// --- FORMATADOR MÁSCARA TELEFONE BRASIL (XX) XXXXX-XXXX ---
function formatBrazilianPhone(val) {
  if (!val) return "";
  let digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// --- COMPRESSÃO DE IMAGEM HD (PRESERVA FOTOS EM ALTA NITIDEZ COM TAMANHO OTIMIZADO PARA DISPOSITIVOS MÓVEIS) ---
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.68) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return reject(new Error("Arquivo de imagem inválido."));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (canvasErr) {
          reject(canvasErr);
        }
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- MODALS & FORM MANAGEMENT ---
function initModalEvents() {
  const reportModal = document.getElementById("reportModal");
  const noticeModal = document.getElementById("notice30DaysModal");
  const posterModal = document.getElementById("posterModal");
  const detailModal = document.getElementById("detailModal");
  const lightboxModal = document.getElementById("imageLightboxModal");

  document.getElementById("btnCloseLightbox").addEventListener("click", () => {
    lightboxModal.classList.add("hidden");
  });
  lightboxModal.addEventListener("click", (e) => {
    if (e.target === lightboxModal) {
      lightboxModal.classList.add("hidden");
    }
  });

  document.getElementById("btnOpenReportLost").addEventListener("click", () => openReportModal("Procurado"));
  document.getElementById("btnOpenReportSighted").addEventListener("click", () => openReportModal("Avistado"));

  document.getElementById("tabReportLost").addEventListener("click", () => setReportFormType("Procurado"));
  document.getElementById("tabReportSighted").addEventListener("click", () => setReportFormType("Avistado"));

  document.querySelectorAll(".btnCloseModal").forEach(btn => {
    btn.addEventListener("click", () => reportModal.classList.add("hidden"));
  });
  document.querySelectorAll(".btnClosePosterModal").forEach(btn => {
    btn.addEventListener("click", () => posterModal.classList.add("hidden"));
  });
  document.querySelectorAll(".btnCloseDetailModal").forEach(btn => {
    btn.addEventListener("click", () => detailModal.classList.add("hidden"));
  });

  document.getElementById("btnAckNotice").addEventListener("click", () => {
    noticeModal.classList.add("hidden");
  });

  const filePhotoInput = document.getElementById("filePhotoInput");
  if (filePhotoInput) {
    filePhotoInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const compressedDataUrl = await compressImage(file, 800, 800, 0.68);
          document.getElementById("imgPreview").src = compressedDataUrl;
          document.getElementById("photoPlaceholder").classList.add("hidden");
          document.getElementById("photoPreviewContainer").classList.remove("hidden");
        } catch (err) {
          console.warn("Tentando compressão secundária ultra-compacta...", err);
          try {
            const ultraCompressed = await compressImage(file, 450, 450, 0.55);
            document.getElementById("imgPreview").src = ultraCompressed;
            document.getElementById("photoPlaceholder").classList.add("hidden");
            document.getElementById("photoPreviewContainer").classList.remove("hidden");
          } catch (err2) {
            console.error("Erro na compressão da foto:", err2);
            document.getElementById("imgPreview").src = getRandomDefaultPhoto("Cachorro");
            document.getElementById("photoPlaceholder").classList.add("hidden");
            document.getElementById("photoPreviewContainer").classList.remove("hidden");
          }
        }
      }
    });
  }

  const iptContactPhone = document.getElementById("iptContactPhone");
  if (iptContactPhone) {
    iptContactPhone.addEventListener("input", (e) => {
      e.target.value = formatBrazilianPhone(e.target.value);
    });
  }

  const petFormElem = document.getElementById("petForm");
  if (petFormElem) {
    petFormElem.removeEventListener("submit", handleFormSubmit);
    petFormElem.addEventListener("submit", handleFormSubmit);
  }

  document.getElementById("btnPrintPoster").addEventListener("click", () => {
    window.print();
  });

  const btnDownloadJPG = document.getElementById("btnDownloadPosterJPG");
  if (btnDownloadJPG) {
    btnDownloadJPG.addEventListener("click", downloadPosterJPG);
  }
}

function openReportModal(type, editPetId = null) {
  document.getElementById("formEditPetId").value = editPetId || "";
  setReportFormType(type);

  if (editPetId) {
    const pet = petsData.find(p => p.id === editPetId);
    if (pet) {
      document.getElementById("iptName").value = pet.name || "";
      document.getElementById("iptSpecies").value = pet.species || "Cachorro";
      document.getElementById("iptBreed").value = pet.breed || "";
      document.getElementById("iptColor").value = pet.color || "";
      document.getElementById("iptAge").value = pet.age || "";
      document.getElementById("iptGender").value = pet.gender || "Macho";
      
      if (datePickerInstance && pet.date) {
        datePickerInstance.setDate(pet.date, true);
      } else {
        document.getElementById("iptDate").value = pet.date || "";
      }

      document.getElementById("iptState").value = pet.state || "";
      document.getElementById("iptAddress").value = pet.address || "";
      document.getElementById("iptDescription").value = pet.description || "";
      document.getElementById("iptContactName").value = pet.contactName || "";
      document.getElementById("iptContactPhone").value = pet.contactPhone || "";

      if (pet.photo) {
        document.getElementById("imgPreview").src = pet.photo;
        document.getElementById("photoPlaceholder").classList.add("hidden");
        document.getElementById("photoPreviewContainer").classList.remove("hidden");
      }
    }
  } else {
    document.getElementById("petForm").reset();
    if (datePickerInstance) {
      datePickerInstance.setDate(new Date(), true);
    }
    document.getElementById("photoPlaceholder").classList.remove("hidden");
    document.getElementById("photoPreviewContainer").classList.add("hidden");
    document.getElementById("imgPreview").src = "";
  }

  const reportModal = document.getElementById("reportModal");
  reportModal.classList.remove("hidden");
  reportModal.scrollTop = 0;
}

function setReportFormType(type) {
  document.getElementById("formReportType").value = type;
  const tabLost = document.getElementById("tabReportLost");
  const tabSighted = document.getElementById("tabReportSighted");
  const lblPetName = document.getElementById("lblPetName");
  const lblEventDate = document.getElementById("lblEventDate");

  if (type === "Procurado") {
    tabLost.className = "py-2.5 rounded-lg text-sm font-bold transition-all bg-[#E52421] text-on-primary shadow-sm flex items-center justify-center gap-2";
    tabSighted.className = "py-2.5 rounded-lg text-sm font-bold transition-all text-on-surface-variant hover:text-primary flex items-center justify-center gap-2";
    lblPetName.textContent = "Nome do Pet *";
    lblEventDate.textContent = "Data do Desaparecimento *";
  } else {
    tabSighted.className = "py-2.5 rounded-lg text-sm font-bold transition-all bg-sky-500 text-white shadow-sm flex items-center justify-center gap-2";
    tabLost.className = "py-2.5 rounded-lg text-sm font-bold transition-all text-on-surface-variant hover:text-primary flex items-center justify-center gap-2";
    lblPetName.textContent = "Nome / Identificação no Avistamento *";
    lblEventDate.textContent = "Data do Avistamento *";
  }
}

let isFormSubmitting = false;

// --- SUBMISSÃO DE FORMULÁRIO COM PROTEÇÃO TRY/FINALLY E SINCRONIZAÇÃO EM NUVEM ---
async function handleFormSubmit(e) {
  e.preventDefault();
  if (isFormSubmitting) return;
  isFormSubmitting = true;

  const btnSubmit = document.getElementById("btnSubmitForm");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">sync</span> Publicando cadastro...`;

  try {
    const editPetId = document.getElementById("formEditPetId").value;
    const type = document.getElementById("formReportType").value || "Procurado";
    const name = (document.getElementById("iptName").value || "").trim();
    const species = document.getElementById("iptSpecies").value || "Cachorro";
    const breed = (document.getElementById("iptBreed").value || "").trim() || "Vira-lata (SRD)";
    const color = (document.getElementById("iptColor").value || "").trim();
    const age = (document.getElementById("iptAge").value || "").trim() || "Não informada";
    const gender = document.getElementById("iptGender").value || "Macho";
    
    let date = document.getElementById("iptDate").value;
    if (!date || date.trim() === "") {
      date = new Date().toISOString().split("T")[0];
    }
    
    const state = document.getElementById("iptState").value;
    const city = document.getElementById("iptCity").value;
    const address = (document.getElementById("iptAddress").value || "").trim();
    const description = (document.getElementById("iptDescription").value || "").trim();
    const contactName = (document.getElementById("iptContactName").value || "").trim();
    const contactPhone = (document.getElementById("iptContactPhone").value || "").trim();

    if (!name || !color || !state || !city || !address || !contactName || !contactPhone) {
      alert("Por favor, preencha todos os campos obrigatórios (*).");
      return;
    }

    const imgPreviewElem = document.getElementById("imgPreview");
    let photo = getRandomDefaultPhoto(species);
    if (imgPreviewElem) {
      const srcAttr = imgPreviewElem.getAttribute("src") || "";
      if (srcAttr.startsWith("data:image/") || (srcAttr.startsWith("http") && !srcAttr.includes(".html") && !srcAttr.endsWith("/"))) {
        photo = imgPreviewElem.src;
      }
    }

    // Geolocalização com tempo limite seguro de 2s para nunca travar a resposta
    let geoCoords = { lat: -23.5505, lng: -46.6333 };
    try {
      const resCoords = await fetchGeocodeCoordinates(address, city, state);
      if (resCoords && Number.isFinite(resCoords.lat) && Number.isFinite(resCoords.lng)) {
        geoCoords = resCoords;
      }
    } catch (e) {
      console.warn("Timeout de geocodificação no envio, utilizando fallback...", e);
    }

    let targetPet = null;
    if (editPetId) {
      targetPet = petsData.find(p => p.id === editPetId);
      if (targetPet) {
        Object.assign(targetPet, { name, type, species, breed, color, age, gender, date, state, city, address, description, contactName, contactPhone, photo, lat: geoCoords.lat, lng: geoCoords.lng, geocodedCity: city, geocodedAddress: address });
      }
    } else {
      targetPet = {
        id: "pet-" + Date.now(),
        isLocalPending: true,
        name,
        type,
        species,
        breed,
        color,
        age,
        gender,
        state,
        city,
        address,
        date,
        description,
        contactName,
        contactPhone,
        photo,
        matchConfidence: "97%",
        createdAt: new Date().toISOString(),
        lastRenewedAt: new Date().toISOString(),
        lat: geoCoords.lat,
        lng: geoCoords.lng,
        geocodedCity: city,
        geocodedAddress: address
      };
      petsData.unshift(targetPet);
    }

    // 1. Salva localmente e fecha modal/renderiza IMEDIATAMENTE
    savePetsToStorage();

    try {
      document.getElementById("petForm").reset();
      document.getElementById("photoPlaceholder").classList.remove("hidden");
      document.getElementById("photoPreviewContainer").classList.add("hidden");
      document.getElementById("imgPreview").src = "";
      document.getElementById("reportModal").classList.add("hidden");
    } catch (uiErr) {
      console.warn("Erro ao resetar modal:", uiErr);
    }

    try {
      renderApp();
    } catch (renderErr) {
      console.warn("Erro ao renderizar app pós-envio:", renderErr);
    }

    try {
      if (targetPet) {
        focusPetOnMap(targetPet.id);
      }
    } catch (mapErr) {
      console.warn("Erro ao focar pet no mapa pós-envio:", mapErr);
    }

    try {
      if (!editPetId && targetPet) {
        document.getElementById("notice30DaysModal").classList.remove("hidden");
        if (type === "Procurado") {
          const btnAck = document.getElementById("btnAckNotice");
          const targetId = targetPet.id;
          const ackHandler = () => {
            generatePosterModal(targetId);
            btnAck.removeEventListener("click", ackHandler);
          };
          btnAck.addEventListener("click", ackHandler);
        }
      }
    } catch (noticeErr) {
      console.warn("Erro ao exibir modal de aviso de 30 dias:", noticeErr);
    }

    // 2. Sincroniza com Firebase Firestore em segundo plano
    if (targetPet) {
      savePetToFirebase(targetPet).catch(err => {
        console.warn("Sincronização em nuvem concluída no banco local:", err);
      });
    }
  } catch (err) {
    console.error("Erro no processamento do formulário:", err);
    alert("⚠️ Não foi possível concluir o cadastro. Motivo: " + (err.message || err));
  } finally {
    isFormSubmitting = false;
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<span class="material-symbols-outlined text-lg">check_circle</span> Publicar Cadastro`;
  }
}

function getRandomDefaultPhoto(species) {
  if (species === "Gato") {
    return "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80";
  }
  return "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80";
}

// --- POSTER GENERATOR MODAL ---
function generatePosterModal(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (!pet) return;

  const posterImg = document.getElementById("posterImg");
  posterImg.onerror = () => { posterImg.src = getRandomDefaultPhoto(pet.species); };
  posterImg.src = pet.photo;
  document.getElementById("posterPetName").textContent = pet.name;
  document.getElementById("posterDateSubtext").textContent = getFormattedPosterDate(pet.date);
  document.getElementById("posterAge").textContent = pet.age || "Não informada";
  document.getElementById("posterColor").textContent = pet.color;
  document.getElementById("posterBreed").textContent = pet.breed;
  document.getElementById("posterMarkings").textContent = pet.description || "Possui características únicas e atende pelo nome.";
  
  document.getElementById("posterDesc").textContent = `${pet.name} foi visto pela última vez em ${pet.address}, ${pet.city} - ${pet.state}. Por favor, se tiver qualquer informação, entre em contato imediatamente!`;
  document.getElementById("posterContactPhone").textContent = pet.contactPhone;

  const posterModal = document.getElementById("posterModal");
  posterModal.classList.remove("hidden");
  posterModal.scrollTop = 0;
}

async function downloadPosterJPG() {
  const posterArea = document.getElementById("posterArea");
  const btnDownload = document.getElementById("btnDownloadPosterJPG");
  const petNameElem = document.getElementById("posterPetName");
  const petName = (petNameElem ? petNameElem.textContent.trim() : "pet").toLowerCase().replace(/\s+/g, "_");

  if (!posterArea) return;

  const originalContent = btnDownload ? btnDownload.innerHTML : "";
  if (btnDownload) {
    btnDownload.disabled = true;
    btnDownload.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Gerando JPG...`;
  }

  try {
    if (typeof html2canvas === "undefined") {
      throw new Error("Biblioteca html2canvas não foi carregada.");
    }
    const canvas = await html2canvas(posterArea, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false
    });

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const link = document.createElement("a");
    link.download = `cartaz_procura_se_${petName}.jpg`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.error("Erro ao gerar JPG do cartaz:", err);
    alert("⚠️ Não foi possível gerar a imagem em JPG automaticamente. Utilize a opção 'Imprimir Cartaz A4' para imprimir ou salvar como PDF.");
  } finally {
    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = originalContent;
    }
  }
}

// --- DETAIL MODAL ---
function openDetailModal(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (!pet) return;

  const detailImg = document.getElementById("detailImg");
  detailImg.onerror = () => { detailImg.src = getRandomDefaultPhoto(pet.species); };
  detailImg.src = pet.photo;

  const detailFrame = document.getElementById("detailImgFrame");
  if (detailFrame) {
    detailFrame.onclick = () => openImageLightbox(pet.id);
  }
  document.getElementById("detailName").textContent = pet.name;
  document.getElementById("detailSpecies").textContent = pet.species;
  document.getElementById("detailBreedColor").textContent = `${pet.breed} • ${pet.color} ${pet.age ? `(${pet.age})` : ''} - ${pet.gender}`;
  document.getElementById("detailAddress").textContent = `${pet.address}, ${pet.city} - ${pet.state}`;
  document.getElementById("detailDate").textContent = `Registrado em: ${formatDate(pet.date)}`;
  document.getElementById("detailContactName").textContent = `Responsável: ${pet.contactName} - ${pet.contactPhone}`;
  document.getElementById("detailDesc").textContent = pet.description || "Sem observações adicionais.";

  const badge = document.getElementById("detailBadge");
  if (pet.type === "Procurado") {
    badge.className = "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 bg-[#E52421]";
    badge.innerHTML = `<span class="material-symbols-outlined text-sm">warning</span> PROCURADO`;
  } else if (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado") {
    badge.className = "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 bg-green-600";
    badge.innerHTML = `<span class="material-symbols-outlined text-sm">task_alt</span> ${pet.type.toUpperCase()}`;
  } else {
    badge.className = "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 bg-sky-500";
    badge.innerHTML = `<span class="material-symbols-outlined text-sm">visibility</span> AVISTADO`;
  }

  const detailBox = document.getElementById("detailMaintenanceBox");
  if (pet.isRenewalWindow && pet.type !== "Encontrado pelo dono" && pet.type !== "Dono encontrado") {
    detailBox.classList.remove("hidden");
    document.getElementById("btnDetailRenewPet").onclick = () => {
      document.getElementById("detailModal").classList.add("hidden");
      renewPetListing(pet.id);
    };
  } else {
    detailBox.classList.add("hidden");
  }

  const cleanPhone = pet.contactPhone.replace(/\D/g, "");
  const waMsg = encodeURIComponent(`Olá ${pet.contactName}, vi o anúncio do pet ${pet.name} no portal Pet Searchers!`);
  document.getElementById("detailWhatsappLink").href = `https://wa.me/55${cleanPhone}?text=${waMsg}`;

  document.getElementById("btnDetailGeneratePoster").onclick = () => {
    document.getElementById("detailModal").classList.add("hidden");
    generatePosterModal(pet.id);
  };

  const detailModal = document.getElementById("detailModal");
  detailModal.classList.remove("hidden");
  detailModal.scrollTop = 0;
}

// --- ADMIN DASHBOARD EVENTS & SECURE PASSWORD CHANGE LOGIC ---
function initAdminEvents() {
  const btnOpenAdmin = document.getElementById("btnOpenAdmin");
  const adminLoginModal = document.getElementById("adminLoginModal");
  const adminDashboardModal = document.getElementById("adminDashboardModal");
  const adminChangePasswordModal = document.getElementById("adminChangePasswordModal");
  
  const btnCloseAdminLogin = document.getElementById("btnCloseAdminLogin");
  const btnCloseAdminDashboard = document.getElementById("btnCloseAdminDashboard");
  const btnAdminChangePassword = document.getElementById("btnAdminChangePassword");
  const btnCloseAdminChangePassword = document.getElementById("btnCloseAdminChangePassword");
  const btnCancelChangePassword = document.getElementById("btnCancelChangePassword");

  const adminLoginForm = document.getElementById("adminLoginForm");
  const adminChangePasswordForm = document.getElementById("adminChangePasswordForm");

  btnOpenAdmin.addEventListener("click", () => {
    if (isAdminAuthenticated) {
      openAdminDashboard();
    } else {
      adminLoginModal.classList.remove("hidden");
    }
  });

  btnCloseAdminLogin.addEventListener("click", () => adminLoginModal.classList.add("hidden"));
  btnCloseAdminDashboard.addEventListener("click", () => adminDashboardModal.classList.add("hidden"));

  btnAdminChangePassword.addEventListener("click", () => {
    adminChangePasswordForm.reset();
    adminChangePasswordModal.classList.remove("hidden");
  });

  btnCloseAdminChangePassword.addEventListener("click", () => adminChangePasswordModal.classList.add("hidden"));
  btnCancelChangePassword.addEventListener("click", () => adminChangePasswordModal.classList.add("hidden"));

  adminLoginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const enteredPassword = document.getElementById("iptAdminPassword").value;
    const currentMasterPassword = getAdminPassword();

    if (enteredPassword === currentMasterPassword) {
      isAdminAuthenticated = true;
      adminLoginModal.classList.add("hidden");
      document.getElementById("iptAdminPassword").value = "";
      openAdminDashboard();
    } else {
      alert("❌ Senha de administrador incorreta! Tente novamente.");
    }
  });

  adminChangePasswordForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentPwd = document.getElementById("iptCurrentAdminPassword").value;
    const newPwd = document.getElementById("iptNewAdminPassword").value;
    const confirmPwd = document.getElementById("iptConfirmAdminPassword").value;

    const storedMasterPwd = getAdminPassword();

    if (currentPwd !== storedMasterPwd) {
      alert("❌ A 'Senha Atual' informada está incorreta!");
      return;
    }

    if (newPwd !== confirmPwd) {
      alert("❌ A 'Nova Senha' e a 'Confirmação da Nova Senha' não coincidem!");
      return;
    }

    if (newPwd.length < 6) {
      alert("❌ A nova senha deve possuir no mínimo 6 caracteres!");
      return;
    }

    setAdminPassword(newPwd);
    adminChangePasswordForm.reset();
    adminChangePasswordModal.classList.add("hidden");

    alert("🔒 Senha de Administração alterada com sucesso!\nUtilize sua nova senha em próximos acessos.");
  });

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) {
      e.preventDefault();
      btnOpenAdmin.click();
    }
  });

  document.getElementById("adminSearchInput").addEventListener("input", renderAdminDashboardTable);
  document.getElementById("adminStatusFilter").addEventListener("change", renderAdminDashboardTable);

  document.getElementById("btnAdminExportJSON").addEventListener("click", exportBackupJSON);
  document.getElementById("btnAdminExportCSV").addEventListener("click", exportBackupCSV);
  document.getElementById("btnAdminRunPurge").addEventListener("click", async () => {
    const before = petsData.length;
    runAutoPurgeEngine();
    const after = petsData.length;
    const removed = before - after;
    await savePetsToCloud();
    renderApp();
    alert(`🧹 Limpeza efetuada! ${removed} registro(s) expirado(s) removido(s) com sucesso.`);
  });
}

function openAdminDashboard() {
  renderAdminDashboardTable();
  document.getElementById("adminDashboardModal").classList.remove("hidden");
}

function renderAdminDashboardTable() {
  runAutoPurgeEngine();

  const total = petsData.length;
  const lostCount = petsData.filter(p => p.type === "Procurado").length;
  const sightedCount = petsData.filter(p => p.type === "Avistado").length;
  const resolvedCount = petsData.filter(p => p.type === "Encontrado pelo dono" || p.type === "Dono encontrado").length;
  const expiringCount = petsData.filter(p => p.isRenewalWindow && p.type !== "Encontrado pelo dono" && p.type !== "Dono encontrado").length;

  document.getElementById("kpiTotalPets").textContent = total;
  document.getElementById("kpiLostPets").textContent = lostCount;
  document.getElementById("kpiSightedPets").textContent = sightedCount;
  document.getElementById("kpiResolvedPets").textContent = resolvedCount;
  document.getElementById("kpiExpiringPets").textContent = expiringCount;

  const searchQuery = document.getElementById("adminSearchInput").value.toLowerCase().trim();
  const statusFilter = document.getElementById("adminStatusFilter").value;

  const filtered = petsData.filter(pet => {
    if (searchQuery) {
      const match = pet.name.toLowerCase().includes(searchQuery) ||
                    pet.contactName.toLowerCase().includes(searchQuery) ||
                    pet.contactPhone.includes(searchQuery) ||
                    pet.city.toLowerCase().includes(searchQuery) ||
                    pet.breed.toLowerCase().includes(searchQuery);
      if (!match) return false;
    }

    if (statusFilter && pet.type !== statusFilter && !(statusFilter === "Expiring" && pet.isRenewalWindow)) {
      return false;
    }

    return true;
  });

  const tbody = document.getElementById("adminTableBody");
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(pet => {
    let statusPill = `<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">Avistado</span>`;
    
    if (pet.type === "Procurado") {
      statusPill = `<span class="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">Procurado</span>`;
    } else if (pet.type === "Encontrado pelo dono") {
      statusPill = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🟢 Encontrado pelo dono</span>`;
    } else if (pet.type === "Dono encontrado") {
      statusPill = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🟢 Dono encontrado</span>`;
    }

    let validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">🟢 Ativo (${pet.daysRemaining}d)</span>`;
    if (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado") {
      validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🎉 Reencontrado</span>`;
    } else if (pet.isRenewalWindow) {
      validityBadge = `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">⚠️ Requer Renovação (${pet.daysRemaining}d)</span>`;
    }

    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="p-3">
          <div class="flex items-center gap-2">
            <img src="${pet.photo}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-9 h-9 rounded-lg object-cover border"/>
            <div>
              <span class="font-bold text-primary block">${pet.name}</span>
              <span class="text-[10px] text-gray-500">${pet.species} • ${pet.breed}</span>
            </div>
          </div>
        </td>
        <td class="p-3">${statusPill}</td>
        <td class="p-3 font-medium">${pet.city} - ${pet.state}</td>
        <td class="p-3">
          <span class="block font-medium">${pet.contactName}</span>
          <span class="text-[10px] text-gray-500">${pet.contactPhone}</span>
        </td>
        <td class="p-3 text-[11px]">
          <div>Reg: ${formatDate(pet.date)}</div>
          <div class="text-gray-400 font-mono text-[10px]">${pet.daysActive || 0} dias ativo</div>
        </td>
        <td class="p-3">${validityBadge}</td>
        <td class="p-3 text-right">
          <div class="flex items-center justify-end gap-1">
            <select onchange="adminChangeStatus('${pet.id}', this.value)" class="px-2 py-1 rounded-lg text-[11px] font-bold border border-outline-variant bg-white text-primary outline-none cursor-pointer">
              <option value="Procurado" ${pet.type === 'Procurado' ? 'selected' : ''}>Procurado (Perdido)</option>
              <option value="Avistado" ${pet.type === 'Avistado' ? 'selected' : ''}>Avistado (Encontrado)</option>
              <option value="Encontrado pelo dono" ${pet.type === 'Encontrado pelo dono' ? 'selected' : ''}>🟢 Encontrado pelo dono</option>
              <option value="Dono encontrado" ${pet.type === 'Dono encontrado' ? 'selected' : ''}>🟢 Dono encontrado</option>
            </select>

            <button onclick="adminRenewPet('${pet.id}')" class="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs" title="Renovar +30 Dias">
              <span class="material-symbols-outlined text-sm">update</span>
            </button>
            <button onclick="adminEditPet('${pet.id}')" class="p-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-xs" title="Editar Registro">
              <span class="material-symbols-outlined text-sm">edit</span>
            </button>
            <button onclick="adminDeletePet('${pet.id}')" class="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs" title="Excluir Registro">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function adminChangeStatus(petId, newStatus) {
  const pet = petsData.find(p => p.id === petId);
  if (pet) {
    pet.type = newStatus;
    savePetsToStorage();
    await savePetToFirebase(pet);
    renderApp();
    alert(`🎉 O status de "${pet.name}" foi alterado com sucesso para: ${newStatus}!`);
  }
}

function adminRenewPet(petId) {
  renewPetListing(petId);
}

function adminEditPet(petId) {
  document.getElementById("adminDashboardModal").classList.add("hidden");
  const pet = petsData.find(p => p.id === petId);
  if (pet) {
    openReportModal(pet.type, petId);
  }
}

async function adminDeletePet(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (pet && confirm(`⚠️ Tem certeza que deseja excluir o cadastro de "${pet.name}"?`)) {
    markPetAsDeleted(petId);
    petsData = petsData.filter(p => p.id !== petId);
    savePetsToStorage();
    renderApp();
    await deletePetFromFirebase(petId);
  }
}

// --- EXPORT DATABASE BACKUP (JSON / CSV) ---
function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(petsData, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `pet_searchers_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(dlAnchor);
  dlAnchor.click();
  dlAnchor.remove();
}

function exportBackupCSV() {
  if (!petsData.length) return alert("Nenhum dado para exportar.");
  
  const headers = ["ID", "Nome", "StatusTipo", "Especie", "Raca", "Cor", "Idade", "Estado", "Cidade", "Endereco", "Data", "ContatoNome", "ContatoTelefone"];
  const rows = petsData.map(p => [
    p.id,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    p.type,
    p.species,
    `"${(p.breed || '').replace(/"/g, '""')}"`,
    `"${(p.color || '').replace(/"/g, '""')}"`,
    `"${(p.age || '').replace(/"/g, '""')}"`,
    p.state,
    `"${(p.city || '').replace(/"/g, '""')}"`,
    `"${(p.address || '').replace(/"/g, '""')}"`,
    p.date,
    `"${(p.contactName || '').replace(/"/g, '""')}"`,
    `"${(p.contactPhone || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `pet_searchers_backup_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Vinculações globais para manipuladores inline no HTML (onclick / onchange / onerror)
window.focusPetOnMap = focusPetOnMap;
window.openImageLightbox = openImageLightbox;
window.renewPetListing = renewPetListing;
window.openDetailModal = openDetailModal;
window.adminChangeStatus = adminChangeStatus;
window.adminRenewPet = adminRenewPet;
window.adminEditPet = adminEditPet;
window.adminDeletePet = adminDeletePet;
window.downloadPosterJPG = downloadPosterJPG;
window.getRandomDefaultPhoto = getRandomDefaultPhoto;
