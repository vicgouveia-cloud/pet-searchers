console.log("✅ Pet Searchers app.js BUILD v107 carregado - geocodificação por cidade sem fallback incorreto para capital");
/* ==========================================================================
   Pet Searchers Portal - Application Logic (app.js v60)
   Banco Global em Nuvem em Tempo Real (Visível para Todos na Web),
   Geolocalização Precisa com Time-out Anti-Travamento (AbortController),
   Status Verdes de Reencontro, Botão Detalhes Completos nos Cards,
   Calendário Português Brasil (dd/mm/aaaa) e Painel Admin Master (Pet129502@)
   ========================================================================== */

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

let db = null;
let firestoreSDK = null;

// Fotos alteradas no painel ficam protegidas em memória até o Firestore
// confirmar a mesma versão. Isso evita que um snapshot antigo reverta a foto.
const pendingEditedPhotos = new Map();

// Base de dados inicial opcional.
// A versão anterior referenciava INITIAL_PETS sem declarar a variável,
// causando "ReferenceError: INITIAL_PETS is not defined" durante a inicialização.
// Os dados reais continuam vindo do localStorage/Firebase quando disponíveis.
const INITIAL_PETS = [];

async function initFirebaseConnection() {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    firestoreSDK = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    
    const app = initializeApp(firebaseConfig);
    db = firestoreSDK.getFirestore(app);
    console.log("🔥 Firebase Firestore Modular inicializado no projeto:", firebaseConfig.projectId);
    listenToFirebasePets();
    return true;
  } catch (e) {
    console.warn("⚠️ Firebase em nuvem indisponível no momento. O app funcionará localmente:", e);
    return false;
  }
}
// --- MAPEAMENTO OFICIAL DE CAPITAIS DOS 27 ESTADOS DO BRASIL ---
const STATE_CAPITALS = {
  AC: "Rio Branco", AL: "Maceió", AP: "Macapá", AM: "Manaus", BA: "Salvador",
  CE: "Fortaleza", DF: "Brasília", ES: "Vitória", GO: "Goiânia", MA: "São Luís",
  MT: "Cuiabá", MS: "Campo Grande", MG: "Belo Horizonte", PA: "Belém", PB: "João Pessoa",
  PR: "Curitiba", PE: "Recife", PI: "Teresina", RJ: "Rio de Janeiro", RN: "Natal",
  RS: "Porto Alegre", RO: "Porto Velho", RR: "Boa Vista", SC: "Florianópolis", SP: "São Paulo",
  SE: "Aracaju", TO: "Palmas"
};

function getCapitalCityForState(uf) {
  if (!uf) return "São Paulo";
  const cleanUf = String(uf).trim().toUpperCase();
  return STATE_CAPITALS[cleanUf] || "São Paulo";
}

// --- PERSISTÊNCIA INVIOLÁVEL DE EDIÇÕES DO ADMINISTRADOR ---
function sanitizePetForLocalStorage(pet) {
  if (!pet || typeof pet !== "object") return pet;

  const copy = { ...pet };

  // Fotos enviadas pelo formulário chegam como data:image/... (Base64).
  // Elas podem ocupar centenas de KB ou vários MB e não devem ser duplicadas no localStorage.
  // A foto completa permanece no objeto em memória e é enviada ao Firebase separadamente.
  if (typeof copy.photo === "string" && copy.photo.startsWith("data:image/")) {
    delete copy.photo;
  }

  return copy;
}

function getEditedPetsMap() {
  try {
    const parsed = JSON.parse(localStorage.getItem("pet_searchers_edited_pets_v1") || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    console.warn("Cache de edições locais inválido; iniciando mapa de edições vazio.", e);
    return {};
  }
}

function compactEditedPetsMap(map) {
  const compact = {};
  Object.entries(map || {}).forEach(([id, pet]) => {
    if (!pet || typeof pet !== "object") return;
    compact[id] = sanitizePetForLocalStorage(pet);
  });
  return compact;
}

function persistEditedPetsMap(map) {
  const compact = compactEditedPetsMap(map);

  try {
    localStorage.setItem("pet_searchers_edited_pets_v1", JSON.stringify(compact));
    return true;
  } catch (e) {
    console.warn("⚠️ Cache local de edições excedeu a cota. Tentando compactação adicional...", e);

    try {
      // Segunda tentativa: mantém somente os campos realmente necessários para preservar
      // edições locais até a sincronização com o Firebase.
      const minimal = {};
      Object.entries(compact).forEach(([id, pet]) => {
        minimal[id] = {
          id: pet.id || id,
          name: pet.name,
          type: pet.type,
          species: pet.species,
          breed: pet.breed,
          color: pet.color,
          age: pet.age,
          gender: pet.gender,
          state: pet.state,
          city: pet.city,
          address: pet.address,
          date: pet.date,
          description: pet.description,
          contactName: pet.contactName,
          contactPhone: pet.contactPhone,
          lat: pet.lat,
          lng: pet.lng,
          geocodedCity: pet.geocodedCity,
          geocodedAddress: pet.geocodedAddress,
          createdAt: pet.createdAt,
          lastRenewedAt: pet.lastRenewedAt,
          lastModifiedAt: pet.lastModifiedAt,
          isLocalPending: pet.isLocalPending
        };
      });

      localStorage.setItem("pet_searchers_edited_pets_v1", JSON.stringify(minimal));
      return true;
    } catch (e2) {
      // O cadastro não deve falhar só porque o cache do navegador está cheio.
      console.warn("Não foi possível atualizar o cache local de edições. O Firebase continuará sendo a fonte principal.", e2);
      return false;
    }
  }
}

function migrateOversizedLocalStorage() {
  try {
    const editedMap = getEditedPetsMap();
    persistEditedPetsMap(editedMap);

    const savedPets = localStorage.getItem("pet_searchers_portal_data_v8");
    if (savedPets) {
      try {
        const parsedPets = JSON.parse(savedPets);
        if (Array.isArray(parsedPets)) {
          const compactPets = parsedPets.map(sanitizePetForLocalStorage);
          try {
            localStorage.setItem("pet_searchers_portal_data_v8", JSON.stringify(compactPets));
          } catch (e) {
            console.warn("Cache geral de pets continua grande; removendo somente esse cache local para reconstrução pelo Firebase.", e);
            localStorage.removeItem("pet_searchers_portal_data_v8");
          }
        }
      } catch (e) {
        localStorage.removeItem("pet_searchers_portal_data_v8");
      }
    }
  } catch (e) {
    console.warn("Não foi possível compactar o armazenamento local automaticamente:", e);
  }
}


async function compressDataUrlForFirestore(dataUrl, maxBytes = 700000) {
  if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  // Já está em tamanho seguro.
  if (dataUrl.length <= maxBytes) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxDimension = 1400;

        if (width > maxDimension || height > maxDimension) {
          const scale = Math.min(maxDimension / width, maxDimension / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });

        const attempts = [
          { scale: 1.00, quality: 0.84 },
          { scale: 0.92, quality: 0.78 },
          { scale: 0.84, quality: 0.72 },
          { scale: 0.76, quality: 0.66 },
          { scale: 0.68, quality: 0.60 },
          { scale: 0.60, quality: 0.55 }
        ];

        let best = dataUrl;

        for (const attempt of attempts) {
          const w = Math.max(1, Math.round(width * attempt.scale));
          const h = Math.max(1, Math.round(height * attempt.scale));
          canvas.width = w;
          canvas.height = h;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const candidate = canvas.toDataURL("image/jpeg", attempt.quality);
          best = candidate;

          if (candidate.length <= maxBytes) {
            resolve(candidate);
            return;
          }
        }

        resolve(best);
      } catch (err) {
        console.warn("Não foi possível otimizar a foto para o Firestore:", err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function protectPendingEditedPhoto(pet) {
  if (!pet || !pet.id) return;
  if (typeof pet.photo === "string" && pet.photo) {
    pendingEditedPhotos.set(pet.id, pet.photo);
  }
}

function saveEditedPet(pet) {
  if (!pet || !pet.id) return false;

  pet.lastModifiedAt = new Date().toISOString();
  protectPendingEditedPhoto(pet);

  const map = getEditedPetsMap();
  const previous = map[pet.id] || {};
  const localPet = sanitizePetForLocalStorage(pet);

  // Importante: como localPet não contém Base64, uma foto antiga em Base64 também
  // não pode sobreviver no objeto anterior.
  map[pet.id] = sanitizePetForLocalStorage({ ...previous, ...localPet });

  const savedLocally = persistEditedPetsMap(map);

  // Atualiza a constante INITIAL_PETS em memória para evitar reversão local.
  // Aqui podemos manter o objeto completo em memória, inclusive a foto.
  if (typeof INITIAL_PETS !== "undefined" && Array.isArray(INITIAL_PETS)) {
    const initIdx = INITIAL_PETS.findIndex(p => p.id === pet.id);
    if (initIdx !== -1) {
      INITIAL_PETS[initIdx] = { ...INITIAL_PETS[initIdx], ...pet };
    }
  }

  return savedLocally;
}

function removeEditedPet(petId) {
  if (!petId) return;
  const map = getEditedPetsMap();
  delete map[petId];
  persistEditedPetsMap(map);
}

function listenToFirebasePets() {
  if (!db || !firestoreSDK) return;
  try {
    firestoreSDK.onSnapshot(firestoreSDK.collection(db, "pets"), (snapshot) => {
      const cloudPets = [];
      snapshot.forEach((docSnap) => {
        cloudPets.push({ id: docSnap.id, ...docSnap.data() });
      });

      const deletedSet = getDeletedPetIds();
      const filteredPets = cloudPets.filter(p => !deletedSet.has(p.id));

      const editedMap = getEditedPetsMap();

      const mergedCloudPets = filteredPets.map(cloudPet => {
        const localEdit = editedMap[cloudPet.id];
        let merged = localEdit ? { ...cloudPet, ...localEdit } : { ...cloudPet };

        const pendingPhoto = pendingEditedPhotos.get(cloudPet.id);
        if (pendingPhoto) {
          // Enquanto o snapshot da nuvem ainda não trouxer a foto nova,
          // mantemos a alteração do administrador na tela.
          if (cloudPet.photo === pendingPhoto) {
            pendingEditedPhotos.delete(cloudPet.id);
          } else {
            merged.photo = pendingPhoto;
          }
        }

        return merged;
      });

      // O registro mesclado já incorpora a edição local e preserva fotos pendentes.
      // Ele deve ter prioridade sobre caches antigos.
      petsData = deduplicatePets([...mergedCloudPets, ...petsData, ...INITIAL_PETS]).map(sanitizePetObject);
      savePetsToStorage();
      renderApp();
      console.log("🔥 Sincronizado em tempo real com Firebase Firestore:", petsData.length, "pets.");
    }, (err) => {
      if (err && (err.code === "permission-denied" || (err.message && err.message.includes("permission-denied")))) {
        console.info("ℹ️ Firestore aguardando permissão no Firebase Console.");
      } else {
        console.warn("Aviso no listener do Firestore:", err.message || err);
      }
    });
  } catch (e) {
    console.warn("Erro ao iniciar escuta do Firestore:", e);
  }
}

async function savePetToFirebase(pet)
{
  if (!db || !firestoreSDK || !pet || !pet.id) return false;

  try {
    let petToSave = { ...pet };

    if (petToSave.photo && typeof petToSave.photo === "string" && petToSave.photo.startsWith("data:image/")) {
      petToSave.photo = await compressDataUrlForFirestore(petToSave.photo, 700000);

      // Mantém a mesma versão em memória e protegida até o snapshot confirmar.
      pet.photo = petToSave.photo;
      pendingEditedPhotos.set(pet.id, petToSave.photo);
    }

    await firestoreSDK.setDoc(
      firestoreSDK.doc(db, "pets", petToSave.id),
      petToSave,
      { merge: true }
    );

    console.log("✅ Pet gravado no Firebase Firestore com sucesso:", petToSave.name);
    return true;
  } catch (e) {
    console.error("❌ Erro ao gravar no Firebase Firestore:", e);
    return false;
  }
}

async function deletePetFromFirebase(petId) {
  if (!db || !firestoreSDK) return false;
  try {
    await firestoreSDK.deleteDoc(firestoreSDK.doc(db, "pets", petId));
    console.log("🗑️ Pet excluído do Firebase Firestore com sucesso:", petId);
    return true;
  } catch (e) {
    console.error("❌ Erro ao excluir do Firebase Firestore:", e);
    return false;
  }
}

function savePetsToCloud() {
  if (!petsData || !Array.isArray(petsData)) return;

  petsData.forEach(async (p) => {
    try {
      await savePetToFirebase(p); // usa apenas o Firebase
      console.log("✅ Pet sincronizado com Firebase:", p.name);
    } catch (e) {
      console.error("❌ Falha ao salvar no Firebase:", p.name, e);
    }
  });
}  // <-- fecha a função aqui corretamente

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

// --- GLOBAL STATE ---
let petsData = [];
let leafletMap = null;
let mapMarkers = {};
let currentActiveFilters = {
  search: "",
  state: "",
  city: "",
  status: "",
  species: "",
  nearby: false,
  nearbyRadiusKm: 10,
  sort: "newest"
};

let currentUserPosition = null;
let currentPosterPetId = null;
let userMapLocationLayer = null;
let userMapLocationAccuracyLayer = null;

// Admin State
let isAdminAuthenticated = false;
let purgedCountTotal = 0;
let datePickerInstance = null;

// --- GERENCIAMENTO DE SENHA ADMIN ---
function getAdminPassword() {
  return localStorage.getItem("pet_searchers_admin_password_v2") || "Pet129502@";
}

function setAdminPassword(newPassword) {
  localStorage.setItem("pet_searchers_admin_password_v2", newPassword);
}

// --- APP INITIALIZATION ---
async function startApp() {
  try {
    initFirebaseConnection();
    initLocationSelectors();
    initLeafletMap();
    initDatePicker();
    initFilterEvents();
    initEnhancedPetUI();
    initModalEvents();
    initAdminEvents();
    preloadPopularStatesCities();

    // Limpa automaticamente fotos Base64 de caches antigos antes de qualquer novo cadastro.
    migrateOversizedLocalStorage();
    loadPetsFromStorage();
    runAutoPurgeEngine();
    renderApp();

    await retroactiveGeocodePets();
  } catch (err) {
    console.error("Erro durante a inicialização da aplicação:", err);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

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
// --- DICIOMÁRIO LOCAL DE EMERGÊNCIA DE COORDENADAS POR CIDADE ---
const POPULAR_CITY_COORDINATES = {
  // Rio de Janeiro
  "petropolis": { lat: -22.5050, lng: -43.1788 },
  "pedro do rio": { lat: -22.3421, lng: -43.1317 },
  "itaipava": { lat: -22.3833, lng: -43.1333 },
  "posse": { lat: -22.3089, lng: -43.0531 },
  "niteroi": { lat: -22.8833, lng: -43.1036 },
  "volta redonda": { lat: -22.5231, lng: -44.1042 },
  "teresopolis": { lat: -22.4122, lng: -42.9656 },
  "nova friburgo": { lat: -22.2819, lng: -42.5311 },
  "cabo frio": { lat: -22.8794, lng: -42.0186 },
  "macae": { lat: -22.3708, lng: -41.7869 },
  "campos dos goytacazes": { lat: -21.7544, lng: -41.3244 },
  "angra dos reis": { lat: -23.0067, lng: -44.3181 },
  "duque de caxias": { lat: -22.7856, lng: -43.3117 },
  "nova iguacu": { lat: -22.7592, lng: -43.4511 },
  "sao goncalo": { lat: -22.8269, lng: -43.0539 },
  "marica": { lat: -22.9192, lng: -42.8186 },
  "araruama": { lat: -22.8728, lng: -42.3428 },
  "resende": { lat: -22.4689, lng: -44.4469 },
  "barra mansa": { lat: -22.5442, lng: -44.1714 },
  "armacao dos buzios": { lat: -22.7469, lng: -41.8817 },
  "buzios": { lat: -22.7469, lng: -41.8817 },
  "rio das ostras": { lat: -22.5269, lng: -41.9486 },
  "nilopolis": { lat: -22.8089, lng: -43.4136 },
  "itaborai": { lat: -22.7444, lng: -42.8594 },
  "mage": { lat: -22.6528, lng: -43.0408 },
  "saquarema": { lat: -22.9344, lng: -42.5103 },
  "itaguai": { lat: -22.8683, lng: -43.7758 },
  "valenca": { lat: -22.2464, lng: -43.7028 },
  "tres rios": { lat: -22.1167, lng: -43.2089 },
  "paraiba do sul": { lat: -22.1611, lng: -43.2928 },
  // São Paulo
  "sao paulo": { lat: -23.5505, lng: -46.6333 },
  "campinas": { lat: -22.9099, lng: -47.0626 },
  "santos": { lat: -23.9608, lng: -46.3339 },
  "sorocaba": { lat: -23.5015, lng: -47.4581 },
  "ribeirao preto": { lat: -21.1704, lng: -47.8103 },
  "sao jose dos campos": { lat: -23.1896, lng: -45.8841 },
  "guarulhos": { lat: -23.4628, lng: -46.5333 },
  "sao bernardo do campo": { lat: -23.6944, lng: -46.5654 },
  "santo andre": { lat: -23.6639, lng: -46.5383 },
  "osasco": { lat: -23.5325, lng: -46.7917 },
  "bauru": { lat: -22.3147, lng: -49.0587 },
  "piracicaba": { lat: -22.7253, lng: -47.6492 },
  "jundiai": { lat: -23.1857, lng: -46.8978 },
  "sao jose do rio preto": { lat: -20.8114, lng: -49.3758 },
  "mogi das cruzes": { lat: -23.5206, lng: -46.1853 },
  "franca": { lat: -20.5386, lng: -47.4008 },
  "itaquaquecetuba": { lat: -23.4864, lng: -46.3483 },
  "sao carlos": { lat: -22.0175, lng: -47.8908 },
  "taubate": { lat: -23.0264, lng: -45.5553 },
  "praia grande": { lat: -24.0058, lng: -46.4028 },
  "barueri": { lat: -23.5111, lng: -46.8761 },
  "limeira": { lat: -22.5647, lng: -47.4017 },
  "suzano": { lat: -23.5414, lng: -46.3108 },
  "sumare": { lat: -22.8216, lng: -47.2669 },
  "hortolandia": { lat: -22.8583, lng: -47.2200 },
  "americana": { lat: -22.7392, lng: -47.3314 },
  "nova odessa": { lat: -22.7775, lng: -47.2958 },
  "paulinia": { lat: -22.7611, lng: -47.1542 },
  // Minas Gerais
  "belo horizonte": { lat: -19.9167, lng: -43.9345 },
  "juiz de fora": { lat: -21.7665, lng: -43.3496 },
  "uberlandia": { lat: -18.9186, lng: -48.2772 },
  "contagem": { lat: -19.9317, lng: -44.0536 },
  "betim": { lat: -19.9678, lng: -44.1983 },
  "montes claros": { lat: -16.7281, lng: -43.8644 },
  "uberaba": { lat: -19.7483, lng: -47.9319 },
  "pouso alegre": { lat: -22.2300, lng: -45.9364 },
  "pocos de caldas": { lat: -21.7878, lng: -46.5614 },
  "governador valadares": { lat: -18.8511, lng: -41.9481 },
  "ipatinga": { lat: -19.4686, lng: -42.5364 },
  "sete lagoas": { lat: -19.4661, lng: -44.2467 },
  "divinopolis": { lat: -20.1431, lng: -44.8872 },
  "varginha": { lat: -21.5544, lng: -45.4322 },
  "patos de minas": { lat: -18.5789, lng: -46.5181 },
  "barbacena": { lat: -21.2258, lng: -43.7736 },
  // Paraná
  "curitiba": { lat: -25.4284, lng: -49.2733 },
  "londrina": { lat: -23.3045, lng: -51.1696 },
  "maringa": { lat: -23.4210, lng: -51.9331 },
  "ponta grossa": { lat: -25.0950, lng: -50.1619 },
  "cascavel": { lat: -24.9578, lng: -53.4594 },
  "sao jose dos pinhais": { lat: -25.5347, lng: -49.2064 },
  "foz do iguacu": { lat: -25.5469, lng: -54.5882 },
  "colombo": { lat: -25.2917, lng: -49.2242 },
  "guarapuava": { lat: -25.3953, lng: -51.4625 },
  "paranagua": { lat: -25.5206, lng: -48.5092 },
  "toledo": { lat: -24.7136, lng: -53.7431 },
  "apucarana": { lat: -23.5511, lng: -51.4614 },
  // Rio Grande do Sul
  "porto alegre": { lat: -30.0346, lng: -51.2177 },
  "caxias do sul": { lat: -29.1678, lng: -51.1794 },
  "canoas": { lat: -29.9178, lng: -51.1836 },
  "pelotas": { lat: -31.7654, lng: -52.3376 },
  "santa maria": { lat: -29.6842, lng: -53.8069 },
  "gravatai": { lat: -29.9439, lng: -50.9922 },
  "viamao": { lat: -30.0811, lng: -51.0233 },
  "novo hamburgo": { lat: -29.6783, lng: -51.1308 },
  "sao leopoldo": { lat: -29.7606, lng: -51.1472 },
  "rio grande": { lat: -32.0350, lng: -52.0986 },
  "passo fundo": { lat: -28.2611, lng: -52.4083 },
  // Santa Catarina
  "florianopolis": { lat: -27.5954, lng: -48.5480 },
  "joinville": { lat: -26.3044, lng: -48.8464 },
  "blumenau": { lat: -26.9194, lng: -49.0661 },
  "sao jose": { lat: -27.6136, lng: -48.6367 },
  "chapeco": { lat: -27.1004, lng: -52.6152 },
  "criciuma": { lat: -28.6775, lng: -49.3703 },
  "itajai": { lat: -26.9078, lng: -48.6619 },
  "jaragua do sul": { lat: -26.4853, lng: -49.0803 },
  "balneario camboriu": { lat: -26.9928, lng: -48.6353 },
  "lages": { lat: -27.8161, lng: -50.3261 },
  // Bahia
  "salvador": { lat: -12.9777, lng: -38.5016 },
  "feira de santana": { lat: -12.2664, lng: -38.9669 },
  "vitoria da conquista": { lat: -14.8661, lng: -40.8394 },
  "camacari": { lat: -12.6975, lng: -38.3242 },
  "juazeiro": { lat: -9.4164, lng: -40.5033 },
  "lauro de freitas": { lat: -12.8944, lng: -38.3275 },
  "itabuna": { lat: -14.7858, lng: -39.2803 },
  "ilheus": { lat: -14.7889, lng: -39.0494 },
  "porto seguro": { lat: -16.4497, lng: -39.0647 },
  "barreiras": { lat: -12.1528, lng: -44.9900 },
  // Pernambuco
  "recife": { lat: -8.0476, lng: -34.8770 },
  "jaboatao dos guararapes": { lat: -8.1131, lng: -35.0153 },
  "olinda": { lat: -8.0089, lng: -34.8553 },
  "caruaru": { lat: -8.2839, lng: -35.9761 },
  "petrolina": { lat: -9.3889, lng: -40.5008 },
  "paulista": { lat: -7.9408, lng: -34.8728 },
  "cabo de santo agostinho": { lat: -8.2864, lng: -35.0353 },
  // Ceará
  "fortaleza": { lat: -3.7319, lng: -38.5267 },
  "caucaia": { lat: -3.7361, lng: -38.6531 },
  "juazeiro do norte": { lat: -7.2131, lng: -39.3153 },
  "maracanau": { lat: -3.8767, lng: -38.6256 },
  "sobral": { lat: -3.6858, lng: -40.3497 },
  "crato": { lat: -7.2339, lng: -39.4097 },
  // Goiás & DF
  "goiania": { lat: -16.6869, lng: -49.2648 },
  "aparecida de goiania": { lat: -16.8231, lng: -49.2439 },
  "anapolis": { lat: -16.3286, lng: -48.9534 },
  "rio verde": { lat: -17.7919, lng: -50.9256 },
  "luziania": { lat: -16.2525, lng: -47.9500 },
  "aguas lindas de goias": { lat: -15.7619, lng: -48.2817 },
  "brasilia": { lat: -15.7975, lng: -47.8919 },
  "ceilandia": { lat: -15.8197, lng: -48.1103 },
  "taguatinga": { lat: -15.8336, lng: -48.0567 },
  "samambaia": { lat: -15.8778, lng: -48.0847 },
  // Espírito Santo
  "vitoria": { lat: -20.3155, lng: -40.3128 },
  "vila velha": { lat: -20.3297, lng: -40.2925 },
  "serra": { lat: -20.1286, lng: -40.3078 },
  "cariacica": { lat: -20.2639, lng: -40.4189 },
  "cachoeiro de itapemirim": { lat: -20.8489, lng: -41.1128 },
  "linhares": { lat: -19.3911, lng: -40.0722 },
  "guarapari": { lat: -20.6728, lng: -40.4981 },
  // Maranhão & Pará
  "sao luis": { lat: -2.5307, lng: -44.3068 },
  "imperatriz": { lat: -5.5264, lng: -47.4775 },
  "sao jose de ribamar": { lat: -2.5619, lng: -44.0542 },
  "belem": { lat: -1.4558, lng: -48.4902 },
  "ananindeua": { lat: -1.3658, lng: -48.3725 },
  "santarem": { lat: -2.4431, lng: -54.7083 },
  "maraba": { lat: -5.3686, lng: -49.1178 },
  // Mato Grosso & MS
  "cuiaba": { lat: -15.6010, lng: -56.0974 },
  "varzea grande": { lat: -15.6469, lng: -56.1325 },
  "rondonopolis": { lat: -16.4678, lng: -54.6361 },
  "sinop": { lat: -11.8603, lng: -55.5094 },
  "campo grande": { lat: -20.4697, lng: -54.6201 },
  "dourados": { lat: -22.2231, lng: -54.8064 },
  "tres lagoas": { lat: -20.7847, lng: -51.7008 },
  // Paraíba, RN, Alagoas, Sergipe, Piauí
  "joao pessoa": { lat: -7.1195, lng: -34.8450 },
  "campina grande": { lat: -7.2306, lng: -35.8811 },
  "natal": { lat: -5.7945, lng: -36.5090 },
  "mossoro": { lat: -5.1878, lng: -37.3442 },
  "maceio": { lat: -9.6658, lng: -35.7353 },
  "arapiraca": { lat: -9.7525, lng: -36.6608 },
  "aracaju": { lat: -10.9472, lng: -37.0731 },
  "nossa senhora do socorro": { lat: -10.8547, lng: -37.1264 },
  "teresina": { lat: -5.0920, lng: -42.8038 },
  "parnaiba": { lat: -2.9047, lng: -41.7767 },
  // Amazonas, Rondônia, Amapá, Acre, Roraima, Tocantins
  "manaus": { lat: -3.1190, lng: -60.0217 },
  "parintins": { lat: -2.6286, lng: -56.7358 },
  "macapa": { lat: 0.0350, lng: -51.0705 },
  "rio branco": { lat: -9.9754, lng: -67.8249 },
  "porto velho": { lat: -8.7619, lng: -63.9039 },
  "ji-parana": { lat: -10.8828, lng: -61.9519 },
  "boa vista": { lat: 2.8235, lng: -60.6758 },
  "palmas": { lat: -10.2491, lng: -48.3242 },
  "araguaina": { lat: -7.1911, lng: -48.2072 }
};

function getLocalCityCoords(cityName) {
  if (!cityName) return null;
  const normalized = cityName.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  return POPULAR_CITY_COORDINATES[normalized] || null;
}

// --- VALIDAÇÃO GEOGRÁFICA DOS RESULTADOS DE GEOCODIFICAÇÃO ---
function normalizeGeoText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function distanceKmBetweenCoords(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) *
      Math.cos(toRad(Number(lat2))) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isNearStateCapitalCoords(lat, lng, state, toleranceKm = 18) {
  const ufObj = BRAZIL_UFS.find(u => u.sigla === String(state || "").trim().toUpperCase());
  if (!ufObj || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return false;
  return distanceKmBetweenCoords(lat, lng, ufObj.lat, ufObj.lng) <= toleranceKm;
}

function isCoordinatesPlausibleForCity(coords, city, state) {
  if (!coords || !Number.isFinite(Number(coords.lat)) || !Number.isFinite(Number(coords.lng))) {
    return false;
  }

  const normalizedCity = normalizeGeoText(city);
  const normalizedState = String(state || "").trim().toUpperCase();
  if (!normalizedCity) return true;

  // Quando a cidade existe no dicionário local, rejeita resultados muito distantes.
  // 60 km permite bairros/distritos/regiões rurais sem aceitar outra metrópole.
  const localCity = getLocalCityCoords(city);
  if (localCity) {
    const distanceFromCity = distanceKmBetweenCoords(
      coords.lat, coords.lng, localCity.lat, localCity.lng
    );
    if (distanceFromCity > 60) return false;
  }

  // Nunca aceita silenciosamente a capital para uma cidade explicitamente diferente.
  const capitalName = normalizeGeoText(getCapitalCityForState(normalizedState));
  if (
    normalizedCity !== capitalName &&
    isNearStateCapitalCoords(coords.lat, coords.lng, normalizedState, 18)
  ) {
    return false;
  }

  return true;
}

// --- CONSULTA SEGURA AO NOMINATIM ---
async function singleNominatimQuery(query, timeoutMs = 3500) {
  if (!query) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&addressdetails=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (Array.isArray(data) && data.length && data[0].lat && data[0].lon) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
    return null;
  } catch (e) {
    if (e && e.name !== 'AbortError') console.warn('Nominatim indisponível:', e.message || e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGeocodeCoordinates(address = "", city = "", state = "") {
  let cleanState = (state || "").trim().toUpperCase();
  let cleanCity = (city || "").trim();

  if (!cleanCity || cleanCity.toLowerCase() === "capital") {
    cleanCity = getCapitalCityForState(cleanState);
  }
  const rawAddress = (address || "").trim();

  if (rawAddress && cleanCity && cleanState) {
    const candidates = [];

    // Limpeza profunda de anotações entre parênteses, prefixos, sufixos e ruídos
    let cleanAddress = rawAddress
      .replace(/\(.*?\)/g, " ") // remove tudo entre parênteses ex: "(ao lado da Casa de Festas JM)"
      .replace(/,\s*[A-Z]{2}\b/gi, "")
      .replace(/-\s*[A-Z]{2}\b/gi, "")
      .replace(new RegExp(cleanCity, "gi"), "")
      .replace(/próximo a[o]?|em frente a[o]?|altura do|altura nº|altura|nº|número|na rua|no bairro|perto d[oea]|esquina com|próximo|ao lado d[oea]|esquina/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 1. Endereço Limpo Completo na Cidade
    if (cleanAddress && cleanAddress.length >= 3) {
      candidates.push(`${cleanAddress}, ${cleanCity}, ${cleanState}, Brasil`);
    }

    // 2. Tenta segmentos e bairros/distritos contidos na string de endereço original
    const rawNoParens = rawAddress.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
    const segments = rawNoParens.split(/[,;\-\/]/).map(s => s.trim()).filter(s => s.length >= 3);
    
    for (let seg of segments) {
      const cleanSeg = seg
        .replace(/,\s*[A-Z]{2}\b/gi, "")
        .replace(/-\s*[A-Z]{2}\b/gi, "")
        .replace(new RegExp(cleanCity, "gi"), "")
        .replace(/próximo a[o]?|em frente a[o]?|altura do|altura|nº|número|ao lado d[oea]/gi, "")
        .trim();

      if (cleanSeg && cleanSeg.length >= 3 && cleanSeg.toLowerCase() !== cleanCity.toLowerCase()) {
        candidates.push(`${cleanSeg}, ${cleanCity}, ${cleanState}, Brasil`);
      }
    }

    // 3. Apenas o nome da rua (removendo números)
    const streetOnly = cleanAddress.replace(/\d+/g, "").trim();
    if (streetOnly && streetOnly.length >= 3 && streetOnly !== cleanAddress) {
      candidates.push(`${streetOnly}, ${cleanCity}, ${cleanState}, Brasil`);
    }

    // 4. Primeiras 3 palavras
    const words = cleanAddress.split(" ");
    if (words.length > 2) {
      const firstWords = words.slice(0, 3).join(" ").replace(/\d+/g, "").trim();
      if (firstWords.length >= 3) {
        candidates.push(`${firstWords}, ${cleanCity}, ${cleanState}, Brasil`);
      }
    }

    // Testa os candidatos únicos em ordem de prioridade
    const uniqueCandidates = [...new Set(candidates)];
    for (let cand of uniqueCandidates) {
      const coords = await singleNominatimQuery(cand, 2400);
      if (coords && isCoordinatesPlausibleForCity(coords, cleanCity, cleanState)) {
        return coords;
      }
    }

    // 5. Verifica se algum segmento do endereço é um distrito ou bairro conhecido (ex: Pedro do Rio, Itaipava, etc.)
    for (let seg of segments) {
      const distCoords = getLocalCityCoords(seg);
      if (distCoords) {
        return distCoords;
      }
    }
  }

  // 5b. Fallback para o Centro da Cidade (via Nominatim)
  if (cleanCity && cleanState) {
    const cityCoords = await singleNominatimQuery(`${cleanCity}, ${cleanState}, Brasil`, 2500);
    if (cityCoords && isCoordinatesPlausibleForCity(cityCoords, cleanCity, cleanState)) {
      return cityCoords;
    }
  }

  // 5c. Fallback para dicionário local de coordenadas por cidade se a API do Nominatim oscilar ou falhar
  const localCityCoords = getLocalCityCoords(cleanCity);
  if (localCityCoords) {
    return localCityCoords;
  }

  // 6. Não usa mais a capital do estado como fallback para uma cidade diferente.
  // Uma coordenada ausente é preferível a exibir o pet em uma cidade errada.
  console.warn(`⚠️ Geocodificação sem resultado confiável para: ${cleanCity}/${cleanState}`, rawAddress);
  return null;
}

async function retroactiveGeocodePets() {
  let updated = false;
  const petsNeedingPreciseGeocode = [];

  // v107: correção imediata de registros antigos posicionados na capital.
  // Ex.: um pet de Sumaré/SP salvo anteriormente em São Paulo/SP.
  for (const pet of petsData) {
    const cityCenter = getLocalCityCoords(pet.city);
    const normalizedPetCity = normalizeGeoText(pet.city);
    const normalizedCapital = normalizeGeoText(getCapitalCityForState(pet.state));

    if (
      cityCenter &&
      normalizedPetCity &&
      normalizedPetCity !== normalizedCapital &&
      isNearStateCapitalCoords(Number(pet.lat), Number(pet.lng), pet.state, 18)
    ) {
      console.warn(
        `📍 Corrigindo posição antiga de ${pet.name || "pet"}:`,
        `${pet.city}/${pet.state}`,
        "estava nas coordenadas da capital."
      );
      pet.lat = cityCenter.lat;
      pet.lng = cityCenter.lng;
      pet.geocodedCity = pet.city || "";
      pet.geocodedAddress = "";
      updated = true;

      try {
        if (pet.id && typeof saveEditedPet === "function") saveEditedPet(pet);
      } catch (_) {}
    }
  }

  // Primeiro: garante que TODOS os pets tenham uma posição utilizável no mapa.
  // Isso não bloqueia a abertura do portal esperando dezenas de consultas externas.
  for (const pet of petsData) {
    if (pet.city && pet.city.trim().toLowerCase() === "capital") {
      pet.city = getCapitalCityForState(pet.state);
      updated = true;
    }

    const validCoords = Number.isFinite(Number(pet.lat)) && Number.isFinite(Number(pet.lng)) &&
      Math.abs(Number(pet.lat)) <= 90 && Math.abs(Number(pet.lng)) <= 180;

    const normalizedPetCity = normalizeGeoText(pet.city);
    const normalizedCapital = normalizeGeoText(getCapitalCityForState(pet.state));
    const isWrongCapitalPosition =
      validCoords &&
      normalizedPetCity &&
      normalizedPetCity !== normalizedCapital &&
      isNearStateCapitalCoords(Number(pet.lat), Number(pet.lng), pet.state, 18);

    if (!validCoords || isWrongCapitalPosition) {
      // Prioriza o centro conhecido da cidade. Nunca substitui automaticamente
      // por coordenadas da capital do estado.
      const cityCoords = getLocalCityCoords(pet.city);
      if (cityCoords) {
        pet.lat = cityCoords.lat;
        pet.lng = cityCoords.lng;
        pet.geocodedCity = pet.city || "";
        pet.geocodedAddress = "";
        updated = true;
      }

      // Mesmo após aplicar o centro local, tenta obter o endereço mais preciso.
      if (!petsNeedingPreciseGeocode.includes(pet)) {
        petsNeedingPreciseGeocode.push(pet);
      }
    }

    const cityChanged = !pet.geocodedCity || pet.geocodedCity !== pet.city;
    const addressChanged = !pet.geocodedAddress || pet.geocodedAddress !== pet.address;
    if ((cityChanged || addressChanged) && !petsNeedingPreciseGeocode.includes(pet)) {
      petsNeedingPreciseGeocode.push(pet);
    }
  }

  if (updated) {
    savePetsToStorage();
    renderApp();
  }

  // Depois, tenta melhorar a precisão em segundo plano, sem impedir o mapa de aparecer.
  for (const pet of petsNeedingPreciseGeocode) {
    try {
      const coords = await fetchGeocodeCoordinates(pet.address, pet.city, pet.state);
      if (
        coords &&
        isCoordinatesPlausibleForCity(coords, pet.city, pet.state) &&
        (coords.lat !== pet.lat || coords.lng !== pet.lng)
      ) {
        pet.lat = coords.lat;
        pet.lng = coords.lng;
        pet.geocodedCity = pet.city || "";
        pet.geocodedAddress = pet.address || "";

        // Persiste também no mapa de edições para impedir que um snapshot antigo
        // do Firebase/localStorage reverta a correção no próximo carregamento.
        try {
          if (pet.id && typeof saveEditedPet === "function") saveEditedPet(pet);
        } catch (_) {}

        savePetsToStorage();
        renderApp();
        if (db && firestoreSDK) await savePetToFirebase(pet);
      }
      // Respeita a política de uso do Nominatim e evita disparar muitas requisições.
      await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (e) {
      console.warn("Geocodificação retroativa ignorada para", pet.name, e);
    }
  }
}

// --- LOCALSTORAGE & GLOBAL CLOUD PERSISTENCE ---
function sanitizePetObject(pet) {
  if (!pet) return pet;

  if (pet.city && (pet.city.trim().toLowerCase() === "capital" || pet.city.trim() === "")) {
    pet.city = getCapitalCityForState(pet.state);
  }

  if (pet.address && pet.address.toLowerCase().includes("petmapa")) {
    pet.address = pet.address.replace(/Registrado via PetMapa em [A-Z]{2}/gi, "")
                             .replace(/Registrado via PetMapa/gi, "")
                             .replace(/Localização registrada via mapa PetMapa/gi, "")
                             .replace(/Localização registrada no PetMapa/gi, "")
                             .replace(/ via PetMapa/gi, "")
                             .trim() || "Centro";
  }
  if (pet.contactName && pet.contactName.toLowerCase().includes("petmapa")) {
    pet.contactName = "Tutor Responsável";
  }
  if (pet.description && pet.description.toLowerCase().includes("petmapa")) {
    pet.description = pet.description.replace(/PetMapa/gi, "Comunidade");
  }
  return pet;
}

function loadPetsFromStorage() {
  const saved = localStorage.getItem("pet_searchers_portal_data_v8");
  const editedMap = getEditedPetsMap();
  const editedList = Object.values(editedMap);

  if (saved) {
    try {
      const localPets = JSON.parse(saved);
      petsData = deduplicatePets([...editedList, ...localPets, ...INITIAL_PETS]).map(sanitizePetObject);
    } catch (e) {
      petsData = deduplicatePets([...editedList, ...INITIAL_PETS]).map(sanitizePetObject);
    }
  } else {
    petsData = deduplicatePets([...editedList, ...INITIAL_PETS]).map(sanitizePetObject);
  }
  savePetsToStorage();
}

function savePetsToStorage() {
  try {
    // O cache local guarda apenas dados leves. Fotos Base64 ficam fora do localStorage.
    const sanitized = petsData
      .map(sanitizePetObject)
      .map(sanitizePetForLocalStorage);

    localStorage.setItem("pet_searchers_portal_data_v8", JSON.stringify(sanitized));
  } catch (e) {
    console.warn("Não foi possível atualizar o cache local dos pets; mantendo os dados no Firebase:", e);

    // Se um cache antigo já estiver ocupando a cota, ele pode ser removido com segurança:
    // o Firestore reconstruirá a lista na próxima sincronização.
    try {
      localStorage.removeItem("pet_searchers_portal_data_v8");
    } catch (_) {}
  }
}

// --- UTILITÁRIOS DE PERSISTÊNCIA E EXCLUSÃO ---
function deduplicatePets(pets) {
  if (!Array.isArray(pets)) return [];
  const seenIds = new Set();
  const seenContentKeys = new Set();

  return pets.filter(pet => {
    if (!pet || !pet.id) return false;
    if (seenIds.has(pet.id)) return false;

    const nameStr = String(pet.name || "").toLowerCase().trim();
    const phoneStr = String(pet.contactPhone || "").trim();
    const addrStr = String(pet.address || "").toLowerCase().trim();
    const contentKey = `${nameStr}_${phoneStr}_${addrStr}`;

    // Não remove registros diferentes apenas porque compartilham nome/endereço
    // quando não há telefone suficiente para identificar um duplicado.
    if (nameStr.length > 1 && phoneStr.length > 3 && addrStr.length > 2 && seenContentKeys.has(contentKey)) {
      return false;
    }

    seenIds.add(pet.id);
    if (nameStr.length > 1 && phoneStr.length > 3 && addrStr.length > 2) {
      seenContentKeys.add(contentKey);
    }
    return true;
  });
}

function getDeletedPetIds() {
  try {
    const raw = localStorage.getItem("pet_searchers_deleted_ids_v1");
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch (e) {
    console.warn("Não foi possível ler a lista de pets excluídos; usando lista vazia.", e);
    return new Set();
  }
}

function markPetAsDeleted(petId) {
  if (!petId) return;
  const deletedSet = getDeletedPetIds();
  deletedSet.add(petId);
  try {
    localStorage.setItem("pet_searchers_deleted_ids_v1", JSON.stringify([...deletedSet]));
  } catch (e) {
    console.warn("Não foi possível registrar exclusão local.", e);
  }
}

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

function initLocationSelectors() {
  const filterState = document.getElementById("filterState");
  const filterCity = document.getElementById("filterCity");
  const iptState = document.getElementById("iptState");
  const iptCity = document.getElementById("iptCity");

  if (!filterState || !filterCity || !iptState || !iptCity) return;

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
    center: [-16.0, -50.5],
    zoom: 5,
    zoomControl: true
  });

  L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=pt-BR&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Map data &copy; <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer">Google Maps</a>'
  }).addTo(leafletMap);

  document.getElementById("btnResetMap").addEventListener("click", () => {
    currentActiveFilters.status = "";
    syncStatusFilterUI();
    renderApp();
    leafletMap.setView([-16.0, -50.5], 5, { animate: true });
  });
}

function getPetMapCoordinates(pet) {
  const lat = Number(pet && pet.lat);
  const lng = Number(pet && pet.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -74 && lng <= -30) {
    return { lat, lng };
  }

  const cityCoords = getLocalCityCoords(pet && pet.city);
  if (cityCoords) return cityCoords;

  const uf = String((pet && pet.state) || '').trim().toUpperCase();
  const stateCoords = BRAZIL_UFS.find(u => u.sigla === uf);
  if (stateCoords && Number.isFinite(Number(stateCoords.lat)) && Number.isFinite(Number(stateCoords.lng))) {
    return { lat: Number(stateCoords.lat), lng: Number(stateCoords.lng) };
  }

  return null;
}

function getPetPhoto(pet) {
  return (pet && typeof pet.photo === 'string' && pet.photo.trim())
    ? pet.photo
    : getRandomDefaultPhoto(pet && pet.species);
}


function getDisplayStatusLabel(type) {
  if (type === "Encontrado pelo dono") return "Pet Encontrado";
  if (type === "Dono encontrado") return "Dono encontrado";
  return type || "Avistado";
}

function isResolvedPet(pet) {
  return pet && (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado");
}

function escapePetHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPetSortTimestamp(pet) {
  const candidates = [pet && pet.createdAt, pet && pet.lastModifiedAt, pet && pet.date];
  for (const value of candidates) {
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (Number.isFinite(ts)) return ts;
  }
  const idMatch = String((pet && pet.id) || "").match(/(\d{10,})/);
  if (idMatch) {
    const n = Number(idMatch[1]);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function replaceResolvedLabelsInUI() {
  document.querySelectorAll('option[value="Encontrado pelo dono"]').forEach(opt => {
    opt.textContent = "🟢 Pet Encontrado";
  });

  document.querySelectorAll(".filter-status-btn").forEach(btn => {
    if (btn.dataset.status === "Encontrado pelo dono") {
      const nodes = Array.from(btn.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
      if (nodes.length) {
        nodes.forEach(n => n.textContent = n.textContent.replace(/Encontrado pelo dono/g, "Pet Encontrado"));
      } else if ((btn.textContent || "").includes("Encontrado pelo dono")) {
        btn.textContent = (btn.textContent || "").replace(/Encontrado pelo dono/g, "Pet Encontrado");
      }
    }
  });
}

function enhanceMapLayout() {
  const map = document.getElementById("map");
  if (!map) return;

  // Mobile: aproximadamente 30% mais baixo que os 460px anteriores,
  // preservando 100% da largura disponível.
  const isMobile = window.innerWidth < 768;
  const h = isMobile ? "322px" : "540px";

  map.style.width = "100%";
  map.style.maxWidth = "100%";
  map.style.height = h;
  map.style.minHeight = h;
  map.style.maxHeight = h;

  setTimeout(() => {
    try { leafletMap?.invalidateSize(); } catch (_) {}
  }, 100);
}

function clearAllPetFilters() {
  currentActiveFilters = {
    search: "",
    state: "",
    city: "",
    status: "",
    species: "",
    nearby: false,
    nearbyRadiusKm: 10,
    sort: "newest"
  };
  currentUserPosition = null;

  const fs = document.getElementById("filterSearch");
  const fst = document.getElementById("filterState");
  const fc = document.getElementById("filterCity");
  const sortSelect = document.getElementById("petSortOrder");
  const nearbyRadiusSelect = document.getElementById("nearbyRadiusSelect");

  if (fs) fs.value = "";
  if (fst) fst.value = "";
  if (fc) {
    fc.innerHTML = '<option value="">Todas as Cidades do Brasil</option>';
    fc.value = "";
  }
  if (sortSelect) sortSelect.value = "newest";
  if (nearbyRadiusSelect) nearbyRadiusSelect.value = "10";

  document.querySelectorAll(".filter-species-btn").forEach(b => {
    const active = !b.dataset.species;
    b.className = active
      ? "filter-species-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition-all bg-secondary text-on-primary"
      : "filter-species-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-surface-container text-on-surface-variant hover:bg-surface-container-high";
  });

  const nearbyBtn = document.getElementById("btnNearbyPets");
  if (nearbyBtn) {
    nearbyBtn.classList.remove("ring-2", "ring-primary", "bg-primary", "text-white");
    nearbyBtn.classList.add("bg-surface-container", "text-primary");
    nearbyBtn.setAttribute("aria-pressed", "false");
  }

  syncStatusFilterUI();
  renderApp();
}


function openNearbyRadiusDropdown() {
  const select = document.getElementById("nearbyRadiusSelect");
  if (!select) return;

  try {
    select.focus({ preventScroll: true });
  } catch (_) {
    select.focus();
  }

  // Chromium/Edge modernos suportam showPicker() em selects.
  // Se não estiver disponível, o foco já deixa o controle pronto para uso.
  try {
    if (typeof select.showPicker === "function") {
      select.showPicker();
    }
  } catch (_) {}
}

function activateNearbyFilter() {
  const btn = document.getElementById("btnNearbyPets");

  if (currentActiveFilters.nearby) {
    currentActiveFilters.nearby = false;
    currentUserPosition = null;
    if (btn) {
      btn.setAttribute("aria-pressed", "false");
      btn.classList.remove("ring-2", "ring-primary", "bg-primary", "text-white");
      btn.classList.add("bg-surface-container", "text-primary");
    }
    renderApp();
    return;
  }

  if (!navigator.geolocation) {
    alert("Seu navegador não disponibiliza geolocalização.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Localizando...';
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      currentUserPosition = {
        lat: Number(pos.coords.latitude),
        lng: Number(pos.coords.longitude)
      };
      currentActiveFilters.nearby = true;

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span> Próximos a mim';
        btn.setAttribute("aria-pressed", "true");
        btn.classList.remove("bg-surface-container", "text-primary");
        btn.classList.add("ring-2", "ring-primary", "bg-primary", "text-white");
      }
      renderApp();
      setTimeout(openNearbyRadiusDropdown, 120);
    },
    err => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span> Próximos a mim';
      }
      alert(err && err.code === 1
        ? "Permita o acesso à sua localização no navegador para usar o filtro Próximos a mim."
        : "Não foi possível obter sua localização neste momento.");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

function ensureAdvancedFilterControls() {
  if (document.getElementById("petAdvancedControls")) return;

  const filterSearch = document.getElementById("filterSearch");
  if (!filterSearch) return;

  const host = filterSearch.parentElement?.parentElement?.parentElement || filterSearch.parentElement;
  if (!host) return;

  const row = document.createElement("div");
  row.id = "petAdvancedControls";
  row.className = "mt-3 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center gap-2 justify-between";
  row.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center gap-1.5">
        <button id="btnNearbyPets" type="button" aria-pressed="false"
          class="px-3.5 py-2 rounded-xl bg-surface-container text-primary hover:bg-surface-container-high font-bold text-xs transition-all flex items-center gap-1.5 border border-outline-variant/40">
          <span class="material-symbols-outlined text-sm">my_location</span> Próximos a mim
        </button>

        <select id="nearbyRadiusSelect"
          class="px-2.5 py-2 rounded-xl border border-outline-variant bg-white text-primary text-xs font-bold outline-none cursor-pointer"
          title="Raio de proximidade">
          <option value="1">1 km</option>
          <option value="3">3 km</option>
          <option value="5">5 km</option>
          <option value="10" selected>10 km</option>
          <option value="15">15 km</option>
          <option value="20">20 km</option>
          <option value="35">35 km</option>
        </select>
      </div>
      <button id="btnClearAllPetFilters" type="button"
        class="px-3.5 py-2 rounded-xl bg-white text-primary hover:bg-surface-container font-bold text-xs transition-all flex items-center gap-1.5 border border-outline-variant">
        <span class="material-symbols-outlined text-sm">filter_alt_off</span> Limpar filtros
      </button>
    </div>
    <label class="flex items-center gap-2 text-xs font-bold text-primary">
      <span class="material-symbols-outlined text-sm">sort</span>
      Ordenar:
      <select id="petSortOrder"
        class="px-3 py-2 rounded-xl border border-outline-variant bg-white text-primary text-xs font-semibold outline-none cursor-pointer">
        <option value="newest">Mais recentes primeiro</option>
        <option value="oldest">Mais antigos primeiro</option>
      </select>
    </label>
  `;

  host.appendChild(row);

  document.getElementById("btnNearbyPets")?.addEventListener("click", activateNearbyFilter);

  document.getElementById("nearbyRadiusSelect")?.addEventListener("change", e => {
    const allowed = [1, 3, 5, 10, 15, 20, 35];
    const selected = Number(e.target.value);
    currentActiveFilters.nearbyRadiusKm = allowed.includes(selected) ? selected : 10;

    const btn = document.getElementById("btnNearbyPets");
    if (btn) {
      btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span> Próximos a mim';
    }

    // Se o filtro já estiver ativo, reaplica imediatamente com o novo raio.
    if (currentActiveFilters.nearby && currentUserPosition) {
      renderApp();
    }
  });

  document.getElementById("btnClearAllPetFilters")?.addEventListener("click", clearAllPetFilters);
  document.getElementById("petSortOrder")?.addEventListener("change", e => {
    currentActiveFilters.sort = e.target.value === "oldest" ? "oldest" : "newest";
    renderApp();
  });
}

function initEnhancedPetUI() {
  ensureMobileResponsiveStyles();
  optimizeMobileTopHeader();
  ensureAdvancedFilterControls();
  replaceResolvedLabelsInUI();
  enhanceMapLayout();
  window.addEventListener("resize", enhanceMapLayout);
  window.clearAllPetFilters = clearAllPetFilters;
  window.activateNearbyFilter = activateNearbyFilter;
  window.applyStatusFilterFromLegend = applyStatusFilterFromLegend;
  window.locateUserOnMap = locateUserOnMap;
}

function updateMapMarkers(filteredPets) {
  if (!leafletMap) return;

  Object.keys(mapMarkers).forEach(id => {
    try { leafletMap.removeLayer(mapMarkers[id]); } catch (e) {}
  });
  mapMarkers = {};

  const bounds = L.latLngBounds();

  filteredPets.forEach(pet => {
    const mapCoords = getPetMapCoordinates(pet);
    if (!mapCoords) return;

    const mapLat = Number(mapCoords.lat);
    const mapLng = Number(mapCoords.lng);
    if (!Number.isFinite(mapLat) || !Number.isFinite(mapLng)) return;

    const isResolved = isResolvedPet(pet);
    let markerColor = "#0EA5E9"; // Avistado
    let badgeColor = "bg-sky-500";
    let badgeText = getDisplayStatusLabel(pet.type);

    let markerIconName = "visibility"; // Avistado

    if (pet.type === "Procurado") {
      markerColor = "#E52421";
      badgeColor = "bg-[#E52421]";
      markerIconName = "warning";
    } else if (isResolved) {
      markerColor = "#16A34A";
      badgeColor = "bg-green-600";
      badgeText = "Reencontrado 🎉";
      markerIconName = "check_circle";
    }

    const cleanPhone = (pet.contactPhone || '').replace(/\D/g, "");
    const waMsg = encodeURIComponent(`Olá ${pet.contactName || ''}, vi o aviso de ${pet.name || 'pet'} no mapa do Pet Searchers!`);

    const popupHtml = `
      <div class="w-44 font-sans bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
        <div class="w-full h-28 bg-white flex items-center justify-center overflow-hidden p-1.5">
          <img
            src="${getPetPhoto(pet)}"
            alt="${pet.name || 'Pet'}"
            onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species || 'Cachorro'}');"
            class="w-full h-full object-contain rounded-lg"
          />
        </div>

        <div class="px-2.5 pt-2 pb-2.5 bg-white">
          <h4 class="font-extrabold text-sm text-primary leading-tight text-center truncate mb-2">
            ${pet.name || 'Pet sem nome'}
          </h4>

          <div class="grid grid-cols-2 gap-1.5">
            <button
              onclick="openDetailModal('${pet.id}')"
              class="py-1.5 px-2 bg-primary hover:bg-primary-container text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1">
              <span class="material-symbols-outlined text-[12px]">info</span>
              Detalhes
            </button>

            <a
              href="https://wa.me/55${cleanPhone}?text=${waMsg}"
              target="_blank"
              rel="noopener noreferrer"
              class="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1 no-underline">
              <span class="material-symbols-outlined text-[12px]">chat</span>
              WhatsApp
            </a>
          </div>
        </div>
      </div>`;

    // Marcador com ícone semântico:
    // Procurado = aviso; Avistado = olho; Reencontrado = confirmação.
    const markerIcon = L.divIcon({
      className: "pet-map-icon-wrapper",
      html: `
        <div class="pet-map-status-icon" style="background:${markerColor}" aria-hidden="true">
          <span class="material-symbols-outlined">${markerIconName}</span>
        </div>
      `,
      iconSize: [25, 25],
      iconAnchor: [12.5, 12.5],
      popupAnchor: [0, -14]
    });

    const marker = L.marker([mapLat, mapLng], {
      icon: markerIcon,
      bubblingMouseEvents: true,
      riseOnHover: true,
      zIndexOffset: pet.type === "Procurado" ? 300 : (isResolved ? 100 : 200)
    })
      .addTo(leafletMap)
      .bindPopup(popupHtml, { maxWidth: 190, minWidth: 176, autoPan: true, autoPanPadding: [22, 55], keepInView: true, closeButton: false });

    marker.bindTooltip(`${pet.name || 'Pet'} • ${badgeText}`, {
      direction: 'top',
      offset: [0, -8],
      opacity: 0.9
    });
    let popupCloseTimer = null;

    const cancelPopupClose = () => {
      if (popupCloseTimer) {
        clearTimeout(popupCloseTimer);
        popupCloseTimer = null;
      }
    };

    const schedulePopupClose = () => {
      cancelPopupClose();
      popupCloseTimer = setTimeout(() => {
        try { marker.closePopup(); } catch (_) {}
      }, 220);
    };

    marker.on("mouseover", () => {
      cancelPopupClose();
      try { marker.openPopup(); } catch (_) {}
    });

    marker.on("mouseout", schedulePopupClose);

    // Mantém o pequeno cartão aberto enquanto o mouse estiver sobre ele,
    // permitindo clicar em "Detalhes" ou "WhatsApp". Ao sair do cartão, fecha.
    marker.on("popupopen", (event) => {
      const popupEl = event.popup && event.popup.getElement ? event.popup.getElement() : null;
      if (!popupEl) return;

      popupEl.addEventListener("mouseenter", cancelPopupClose);
      popupEl.addEventListener("mouseleave", schedulePopupClose);
    });

    marker.on("popupclose", cancelPopupClose);

    mapMarkers[pet.id] = marker;
    bounds.extend([mapLat, mapLng]);
  });

  const markerCount = Object.keys(mapMarkers).length;
  console.log(`🗺️ Mapa: ${markerCount} de ${filteredPets.length} pets com marcador SVG visível.`);

  if (bounds.isValid() && markerCount > 0) {
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
  const mapCoords = getPetMapCoordinates(pet);
  if (!mapCoords) return;

  const mapElement = document.getElementById("mapSection") || document.getElementById("map");
  if (mapElement) {
    mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 2. Centraliza no pet e abre o popup. Funciona também para coordenadas de fallback.
  try {
    leafletMap.setView([mapCoords.lat, mapCoords.lng], 15, { animate: true });
  } catch (e) {
    console.warn("Aviso setView:", e);
  }

  const marker = mapMarkers[petId];
  if (marker) {
    setTimeout(() => {
      try {
        if (typeof marker.bringToFront === "function") marker.bringToFront();
        marker.openPopup();
      } catch (e) {
        console.warn("Aviso ao abrir marcador:", e);
      }
    }, 300);
  }

  const cardElem = document.getElementById(`card-${petId}`);
  if (cardElem) {
    cardElem.classList.add("ring-2", "ring-primary");
    setTimeout(() => cardElem.classList.remove("ring-2", "ring-primary"), 2500);
  }
}

function getMapLegendFilterElements() {
  const statusByLabel = {
    "procurado": "Procurado",
    "avistado": "Avistado",
    "reencontrado": "Reencontrado",
    "reencontrado 🎉": "Reencontrado"
  };

  const results = [];
  const seen = new Set();

  document.querySelectorAll(".legend-filter-btn").forEach(el => {
    const status = el.dataset.legendStatus || statusByLabel[(el.textContent || "").trim().toLowerCase()];
    if (status && !seen.has(el)) {
      el.dataset.legendStatus = status;
      results.push(el);
      seen.add(el);
    }
  });

  document.querySelectorAll("button, a, [role='button'], span, div").forEach(el => {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const status = statusByLabel[label];
    if (!status) return;

    const childText = Array.from(el.children || [])
      .map(c => (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);
    if (childText.some(t => statusByLabel[t])) return;

    if (!seen.has(el)) {
      el.dataset.legendStatus = status;
      el.classList.add("legend-filter-btn");
      el.style.cursor = "pointer";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Filtrar mapa por ${status}`);
      results.push(el);
      seen.add(el);
    }
  });

  return results;
}

function applyStatusFilterFromLegend(status) {
  currentActiveFilters.status =
    currentActiveFilters.status === status ? "" : status;

  syncStatusFilterUI();
  renderApp();
}

function getMapLegendResetElement() {
  const candidates = document.querySelectorAll("button, a, [role='button'], span, div");
  for (const el of candidates) {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (label !== "resetar visão") continue;

    const childLabels = Array.from(el.children || [])
      .map(c => (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);

    if (childLabels.some(t => t === "resetar visão")) continue;
    return el;
  }
  return null;
}

function getSmallestCommonAncestor(elements) {
  const valid = elements.filter(Boolean);
  if (!valid.length) return null;

  let node = valid[0];
  while (node && node !== document.body) {
    if (valid.every(el => node.contains(el))) return node;
    node = node.parentElement;
  }
  return null;
}

function ensureMapLegendControlStyles() {
  if (document.getElementById("petSearchersMapLegendStyles")) return;

  const style = document.createElement("style");
  style.id = "petSearchersMapLegendStyles";
  style.textContent = `
    .ps-map-legend-layout {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
    }

    .ps-map-legend-status-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      align-items: center;
      box-sizing: border-box;
    }

    .ps-map-legend-action-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-items: stretch;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, .28);
      box-sizing: border-box;
    }

    .ps-map-legend-layout .legend-filter-btn {
      min-width: 0;
      min-height: 34px;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 6px 8px !important;
      border-radius: 10px !important;
      white-space: nowrap;
      box-sizing: border-box;
      transition: background-color .18s ease, transform .18s ease, box-shadow .18s ease;
    }

    .ps-map-legend-reset,
    .ps-map-locate-btn {
      min-width: 0;
      min-height: 36px;
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 7px 10px;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }

    .ps-map-legend-reset {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #dbe2ea;
    }

    .ps-map-locate-btn {
      background: #eaf4ff;
      color: #0b5cab;
      border: 1px solid #bdd9f5;
    }

    .ps-map-legend-reset:hover,
    .ps-map-locate-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 7px rgba(15, 23, 42, .08);
    }

    .ps-map-locate-btn[aria-busy="true"] {
      opacity: .72;
      cursor: wait;
    }

    .ps-map-legend-status-row-direct {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .ps-map-legend-action-row-direct {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .ps-map-legend-action-row-direct > * {
      min-width: 0 !important;
    }

    .ps-map-location-actions-v83 {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      box-sizing: border-box !important;
    }

    @media (max-width: 520px) {
      .ps-map-location-actions-v83 {
        gap: 6px !important;
      }

      .ps-map-location-actions-v83 .ps-map-legend-reset,
      .ps-map-location-actions-v83 .ps-map-locate-btn {
        min-height: 32px !important;
        font-size: 10px !important;
        padding: 5px 6px !important;
      }

      .ps-map-legend-layout {
        gap: 8px;
      }

      .ps-map-legend-status-row {
        gap: 4px;
      }

      .ps-map-legend-layout .legend-filter-btn {
        min-height: 32px;
        padding: 5px 4px !important;
        font-size: 10px !important;
      }

      .ps-map-legend-action-row {
        gap: 6px;
        padding-top: 7px;
      }

      .ps-map-legend-reset,
      .ps-map-locate-btn {
        min-height: 34px;
        padding: 6px 6px;
        font-size: 10.5px;
      }
    }
  `;
  document.head.appendChild(style);
}

function clearUserMapLocationIndicator() {
  if (!leafletMap) return;

  if (userMapLocationLayer) {
    try { leafletMap.removeLayer(userMapLocationLayer); } catch (_) {}
    userMapLocationLayer = null;
  }

  if (userMapLocationAccuracyLayer) {
    try { leafletMap.removeLayer(userMapLocationAccuracyLayer); } catch (_) {}
    userMapLocationAccuracyLayer = null;
  }
}

function getMapZoomForAccuracy(accuracy) {
  const value = Number(accuracy) || 3000;
  if (value <= 80) return 16;
  if (value <= 250) return 15;
  if (value <= 700) return 14;
  if (value <= 2000) return 13;
  if (value <= 5000) return 12;
  return 11;
}

function locateUserOnMap() {
  const btn = document.getElementById("btnMapLocateMe");

  if (!navigator.geolocation) {
    alert("Seu navegador não disponibiliza geolocalização.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Localizando...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Math.max(20, Number(position.coords.accuracy) || 1000);

      currentUserPosition = { lat, lng };

      if (leafletMap && Number.isFinite(lat) && Number.isFinite(lng)) {
        clearUserMapLocationIndicator();

        try {
          userMapLocationAccuracyLayer = L.circle([lat, lng], {
            radius: accuracy,
            color: "#6667AB",
            weight: 1,
            opacity: 0.65,
            fillColor: "#8B8CC7",
            fillOpacity: 0.11,
            interactive: false
          }).addTo(leafletMap);

          const userPersonIcon = L.divIcon({
            className: "user-map-icon-wrapper",
            html: `
              <div class="user-map-person-icon" aria-hidden="true">
                <span class="material-symbols-outlined">person</span>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          userMapLocationLayer = L.marker([lat, lng], {
            icon: userPersonIcon,
            interactive: true,
            zIndexOffset: 2000
          }).addTo(leafletMap);

          userMapLocationLayer.bindTooltip("Sua localização aproximada", {
            direction: "top",
            offset: [0, -15],
            opacity: 0.95
          });

          leafletMap.setView([lat, lng], getMapZoomForAccuracy(accuracy), { animate: true });
          setTimeout(() => {
            try { leafletMap.invalidateSize(); } catch (_) {}
          }, 100);
        } catch (err) {
          console.warn("Não foi possível posicionar a localização do usuário no mapa:", err);
        }
      }

      if (btn) {
        btn.disabled = false;
        btn.setAttribute("aria-busy", "false");
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span><span>Minha localização</span>';
      }
    },
    error => {
      if (btn) {
        btn.disabled = false;
        btn.setAttribute("aria-busy", "false");
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span><span>Minha localização</span>';
      }

      let message = "Não foi possível obter sua localização neste momento.";
      if (error?.code === 1) {
        message = "Permita o acesso à localização no navegador para usar o botão Minha localização.";
      } else if (error?.code === 3) {
        message = "A localização demorou mais do que o esperado. Tente novamente.";
      }
      alert(message);
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

function getLegendControlWrapper(el, stopAt = null) {
  if (!el) return null;

  let current = el;
  const ownText = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

  while (current.parentElement && current.parentElement !== stopAt && current.parentElement !== document.body) {
    const parent = current.parentElement;
    const parentText = (parent.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

    if (parentText !== ownText) break;
    if (parent.querySelectorAll("button, a, [role='button']").length > 1) break;

    current = parent;
  }

  return current;
}

function bindMapLegendFilters() {
  const statusButtons = [
    ["legendFilterLost", "Procurado"],
    ["legendFilterSighted", "Avistado"],
    ["legendFilterFound", "Reencontrado"]
  ];

  statusButtons.forEach(([id, status]) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.dataset.legendStatus = status;
    btn.classList.add("legend-filter-btn");

    if (btn.dataset.statusFilterBound !== "1") {
      btn.dataset.statusFilterBound = "1";
      btn.addEventListener("click", () => {
        applyStatusFilterFromLegend(status);
      });
    }
  });

  const locationBtn = document.getElementById("btnMapLocateMe");
  if (locationBtn && locationBtn.dataset.locationBound !== "1") {
    locationBtn.dataset.locationBound = "1";
    locationBtn.addEventListener("click", locateUserOnMap);
  }

  syncStatusFilterUI();
}

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    optimizeMobileTopHeader();
    enhanceMapLayout();
    const reportModal = document.getElementById("reportModal");
    if (reportModal && !reportModal.classList.contains("hidden")) {
      prepareReportModalForViewport({ restoreScroll: false });
    }
  }, 180);
});

window.addEventListener("resize", () => {
  optimizeMobileTopHeader();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    const reportModal = document.getElementById("reportModal");
    if (reportModal && !reportModal.classList.contains("hidden")) {
      ensureMobileResponsiveStyles();
    }
  });
}


// --- FILTROS DA LEGENDA DO MAPA (PROCURADO / AVISTADO / REENCONTRADO) ---
// Funciona mesmo quando o HTML da legenda não possui a classe .legend-filter-btn.
function getMapLegendFilterElements() {
  const statusByLabel = {
    "procurado": "Procurado",
    "avistado": "Avistado",
    "reencontrado": "Reencontrado",
    "reencontrado 🎉": "Reencontrado"
  };

  const results = [];
  const seen = new Set();

  // 1) Elementos que já usam a classe/dataset esperados.
  document.querySelectorAll(".legend-filter-btn").forEach(el => {
    const status = el.dataset.legendStatus || statusByLabel[(el.textContent || "").trim().toLowerCase()];
    if (status && !seen.has(el)) {
      el.dataset.legendStatus = status;
      results.push(el);
      seen.add(el);
    }
  });

  // 2) Fallback: encontra os três rótulos visíveis da legenda pelo texto.
  // Os filtros inferiores são "Procurados"/"Avistados", portanto não colidem
  // com os textos singulares da legenda superior.
  document.querySelectorAll("button, a, [role='button'], span, div").forEach(el => {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    const status = statusByLabel[label];
    if (!status) return;

    // Preferir o menor elemento que contenha exatamente o texto da legenda.
    // Ignora containers que englobam outros controles/textos.
    const childText = Array.from(el.children || [])
      .map(c => (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);
    if (childText.some(t => statusByLabel[t])) return;

    if (!seen.has(el)) {
      el.dataset.legendStatus = status;
      el.classList.add("legend-filter-btn");
      el.style.cursor = "pointer";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Filtrar mapa por ${status}`);
      results.push(el);
      seen.add(el);
    }
  });

  return results;
}

function applyStatusFilterFromLegend(status) {
  currentActiveFilters.status =
    currentActiveFilters.status === status ? "" : status;

  syncStatusFilterUI();
  renderApp();
}


function getMapLegendResetElement() {
  const candidates = document.querySelectorAll("button, a, [role='button'], span, div");
  for (const el of candidates) {
    const label = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (label !== "resetar visão") continue;

    const childLabels = Array.from(el.children || [])
      .map(c => (c.textContent || "").replace(/\s+/g, " ").trim().toLowerCase())
      .filter(Boolean);

    if (childLabels.some(t => t === "resetar visão")) continue;
    return el;
  }
  return null;
}

function getSmallestCommonAncestor(elements) {
  const valid = elements.filter(Boolean);
  if (!valid.length) return null;

  let node = valid[0];
  while (node && node !== document.body) {
    if (valid.every(el => node.contains(el))) return node;
    node = node.parentElement;
  }
  return null;
}

function ensureMapLegendControlStyles() {
  if (document.getElementById("petSearchersMapLegendStyles")) return;

  const style = document.createElement("style");
  style.id = "petSearchersMapLegendStyles";
  style.textContent = `
    .ps-map-legend-layout {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-sizing: border-box;
    }

    .ps-map-legend-status-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      align-items: center;
      box-sizing: border-box;
    }

    .ps-map-legend-action-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      align-items: stretch;
      padding-top: 9px;
      border-top: 1px solid rgba(148, 163, 184, .28);
      box-sizing: border-box;
    }

    .ps-map-legend-layout .legend-filter-btn {
      min-width: 0;
      min-height: 34px;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 5px !important;
      padding: 6px 8px !important;
      border-radius: 10px !important;
      white-space: nowrap;
      box-sizing: border-box;
      transition: background-color .18s ease, transform .18s ease, box-shadow .18s ease;
    }

    .ps-map-legend-reset,
    .ps-map-locate-btn {
      min-width: 0;
      min-height: 36px;
      width: 100%;
      border: 0;
      border-radius: 10px;
      padding: 7px 10px;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      box-sizing: border-box;
      transition: background-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }

    .ps-map-legend-reset {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #dbe2ea;
    }

    .ps-map-locate-btn {
      background: #eaf4ff;
      color: #0b5cab;
      border: 1px solid #bdd9f5;
    }

    .ps-map-legend-reset:hover,
    .ps-map-locate-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 7px rgba(15, 23, 42, .08);
    }

    .ps-map-locate-btn[aria-busy="true"] {
      opacity: .72;
      cursor: wait;
    }

    .ps-map-legend-status-row-direct {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .ps-map-legend-action-row-direct {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .ps-map-legend-action-row-direct > * {
      min-width: 0 !important;
    }

    .ps-map-location-actions-v83 {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
      align-items: center !important;
      box-sizing: border-box !important;
    }

    @media (max-width: 520px) {
      .ps-map-location-actions-v83 {
        gap: 6px !important;
      }

      .ps-map-location-actions-v83 .ps-map-legend-reset,
      .ps-map-location-actions-v83 .ps-map-locate-btn {
        min-height: 32px !important;
        font-size: 10px !important;
        padding: 5px 6px !important;
      }

      .ps-map-legend-layout {
        gap: 8px;
      }

      .ps-map-legend-status-row {
        gap: 4px;
      }

      .ps-map-legend-layout .legend-filter-btn {
        min-height: 32px;
        padding: 5px 4px !important;
        font-size: 10px !important;
      }

      .ps-map-legend-action-row {
        gap: 6px;
        padding-top: 7px;
      }

      .ps-map-legend-reset,
      .ps-map-locate-btn {
        min-height: 34px;
        padding: 6px 6px;
        font-size: 10.5px;
      }
    }
  `;
  document.head.appendChild(style);
}

function clearUserMapLocationIndicator() {
  if (!leafletMap) return;

  if (userMapLocationLayer) {
    try { leafletMap.removeLayer(userMapLocationLayer); } catch (_) {}
    userMapLocationLayer = null;
  }

  if (userMapLocationAccuracyLayer) {
    try { leafletMap.removeLayer(userMapLocationAccuracyLayer); } catch (_) {}
    userMapLocationAccuracyLayer = null;
  }
}

function getMapZoomForAccuracy(accuracy) {
  const value = Number(accuracy) || 3000;
  if (value <= 80) return 16;
  if (value <= 250) return 15;
  if (value <= 700) return 14;
  if (value <= 2000) return 13;
  if (value <= 5000) return 12;
  return 11;
}

function locateUserOnMap() {
  const btn = document.getElementById("btnMapLocateMe");

  if (!navigator.geolocation) {
    alert("Seu navegador não disponibiliza geolocalização.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span><span>Localizando...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = Number(position.coords.latitude);
      const lng = Number(position.coords.longitude);
      const accuracy = Math.max(20, Number(position.coords.accuracy) || 1000);

      currentUserPosition = { lat, lng };

      if (leafletMap && Number.isFinite(lat) && Number.isFinite(lng)) {
        clearUserMapLocationIndicator();

        try {
          userMapLocationAccuracyLayer = L.circle([lat, lng], {
            radius: accuracy,
            color: "#6667AB",
            weight: 1,
            opacity: 0.65,
            fillColor: "#8B8CC7",
            fillOpacity: 0.11,
            interactive: false
          }).addTo(leafletMap);

          const userPersonIcon = L.divIcon({
            className: "user-map-icon-wrapper",
            html: `
              <div class="user-map-person-icon" aria-hidden="true">
                <span class="material-symbols-outlined">person</span>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          userMapLocationLayer = L.marker([lat, lng], {
            icon: userPersonIcon,
            interactive: true,
            zIndexOffset: 2000
          }).addTo(leafletMap);

          userMapLocationLayer.bindTooltip("Sua localização aproximada", {
            direction: "top",
            offset: [0, -15],
            opacity: 0.95
          });

          leafletMap.setView([lat, lng], getMapZoomForAccuracy(accuracy), { animate: true });
          setTimeout(() => {
            try { leafletMap.invalidateSize(); } catch (_) {}
          }, 100);
        } catch (err) {
          console.warn("Não foi possível posicionar a localização do usuário no mapa:", err);
        }
      }

      if (btn) {
        btn.disabled = false;
        btn.setAttribute("aria-busy", "false");
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span><span>Minha localização</span>';
      }
    },
    error => {
      if (btn) {
        btn.disabled = false;
        btn.setAttribute("aria-busy", "false");
        btn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span><span>Minha localização</span>';
      }

      let message = "Não foi possível obter sua localização neste momento.";
      if (error?.code === 1) {
        message = "Permita o acesso à localização no navegador para usar o botão Minha localização.";
      } else if (error?.code === 3) {
        message = "A localização demorou mais do que o esperado. Tente novamente.";
      }
      alert(message);
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

function getLegendControlWrapper(el, stopAt = null) {
  if (!el) return null;

  let current = el;
  const ownText = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

  // Sobe apenas enquanto o pai representar o mesmo controle textual.
  while (current.parentElement && current.parentElement !== stopAt && current.parentElement !== document.body) {
    const parent = current.parentElement;
    const parentText = (parent.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();

    if (parentText !== ownText) break;
    if (parent.querySelectorAll("button, a, [role='button']").length > 1) break;

    current = parent;
  }

  return current;
}

function ensureMapLegendLayout() {
  ensureMapLegendControlStyles();

  const statusButtons = getMapLegendFilterElements();
  const resetTextEl = getMapLegendResetElement();
  if (statusButtons.length < 3 || !resetTextEl) {
    console.warn("⚠️ Não foi possível localizar completamente a legenda do mapa.", {
      statusButtons: statusButtons.length,
      resetFound: Boolean(resetTextEl)
    });
    return;
  }

  const resetControl = getLegendControlWrapper(resetTextEl);
  if (!resetControl) return;

  // O menor ancestral comum dos três status + Resetar Visão é o próprio
  // cartão branco da legenda. A partir dele criamos explicitamente a linha
  // inferior, em vez de depender da estrutura interna original.
  const legendCard = getSmallestCommonAncestor([...statusButtons, resetControl]);
  if (!legendCard || legendCard === document.body) {
    console.warn("⚠️ Quadro da legenda não localizado.");
    return;
  }

  legendCard.style.boxSizing = "border-box";
  legendCard.style.overflow = "visible";

  // Mantém os três status juntos e bem distribuídos.
  const statusRow = getSmallestCommonAncestor(statusButtons);
  if (statusRow && statusRow !== legendCard && !statusRow.contains(resetControl)) {
    statusRow.classList.add("ps-map-legend-status-row-direct");
  }

  // Cria uma linha dedicada DENTRO do mesmo quadro branco.
  let actionRow = legendCard.querySelector(".ps-map-location-actions-v83");
  if (!actionRow) {
    actionRow = document.createElement("div");
    actionRow.className = "ps-map-location-actions-v83";
    actionRow.style.width = "100%";
    actionRow.style.display = "grid";
    actionRow.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    actionRow.style.gap = "8px";
    actionRow.style.alignItems = "center";
    actionRow.style.borderTop = "1px solid rgba(148,163,184,.30)";
    actionRow.style.paddingTop = "8px";
    actionRow.style.marginTop = "8px";
    actionRow.style.boxSizing = "border-box";
    legendCard.appendChild(actionRow);
  }

  // Move o controle existente de Resetar Visão para a nova linha.
  if (resetControl.parentElement !== actionRow) {
    actionRow.appendChild(resetControl);
  }
  resetControl.classList.add("ps-map-legend-reset");
  resetControl.style.width = "100%";
  resetControl.style.minWidth = "0";
  resetControl.style.display = "flex";
  resetControl.style.alignItems = "center";
  resetControl.style.justifyContent = "center";
  resetControl.style.boxSizing = "border-box";

  let locateBtn = document.getElementById("btnMapLocateMe");
  if (!locateBtn) {
    locateBtn = document.createElement("button");
    locateBtn.id = "btnMapLocateMe";
    locateBtn.type = "button";
    locateBtn.className = "ps-map-locate-btn";
    locateBtn.setAttribute("aria-label", "Posicionar o mapa na minha localização aproximada");
    locateBtn.innerHTML = '<span class="material-symbols-outlined text-sm">my_location</span><span>Minha localização</span>';
    locateBtn.addEventListener("click", locateUserOnMap);
  }

  locateBtn.style.display = "flex";
  locateBtn.style.visibility = "visible";
  locateBtn.style.opacity = "1";
  locateBtn.style.width = "100%";
  locateBtn.style.minWidth = "0";
  locateBtn.style.position = "relative";
  locateBtn.style.zIndex = "2";

  if (locateBtn.parentElement !== actionRow) {
    actionRow.appendChild(locateBtn);
  }

  console.log("📍 v83: Me localize visível dentro do mesmo quadro da legenda.");
}


function forceInsertMapLocateButton() {
  if (document.getElementById("btnMapLocateMe")) return true;

  const all = Array.from(document.querySelectorAll("button, a, [role='button'], span, div"));
  const resetText = all.find(el => {
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    return txt === "resetar visão";
  });
  if (!resetText) return false;

  // Usa o elemento clicável existente ou o menor wrapper que contém somente Resetar Visão.
  let resetControl = resetText.closest("button, a, [role='button']") || resetText;
  if (resetControl === resetText && resetText.parentElement) {
    const ptxt = (resetText.parentElement.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (ptxt === "resetar visão") resetControl = resetText.parentElement;
  }

  const row = resetControl.parentElement;
  if (!row) return false;

  // Mantém a linha original e apenas acrescenta o novo botão imediatamente depois.
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.flexWrap = "wrap";
  row.style.gap = "8px";
  row.style.overflow = "visible";

  const btn = document.createElement("button");
  btn.id = "btnMapLocateMe";
  btn.type = "button";
  btn.title = "Posicionar o mapa na minha localização aproximada";
  btn.setAttribute("aria-label", "Me localize");
  btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:15px;line-height:1">my_location</span><span>Minha localização</span>';
  btn.style.cssText = [
    "display:inline-flex !important",
    "visibility:visible !important",
    "opacity:1 !important",
    "position:relative !important",
    "z-index:999 !important",
    "align-items:center !important",
    "justify-content:center !important",
    "gap:5px !important",
    "min-height:30px !important",
    "padding:5px 10px !important",
    "margin:0 !important",
    "border:1px solid #bfdbfe !important",
    "border-radius:8px !important",
    "background:#eff6ff !important",
    "color:#075985 !important",
    "font-size:11px !important",
    "font-weight:700 !important",
    "line-height:1.2 !important",
    "white-space:nowrap !important",
    "cursor:pointer !important",
    "width:auto !important",
    "height:auto !important"
  ].join(";");
  btn.addEventListener("click", locateUserOnMap);

  resetControl.insertAdjacentElement("afterend", btn);
  console.log("📍 v84: botão Me localize inserido diretamente ao lado de Resetar Visão.");
  return true;
}

function installMapLocateButtonObserver() {
  if (forceInsertMapLocateButton()) return;
  if (window.__petSearchersLocateObserver) return;

  const observer = new MutationObserver(() => {
    if (forceInsertMapLocateButton()) {
      observer.disconnect();
      window.__petSearchersLocateObserver = null;
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.__petSearchersLocateObserver = observer;

  // Garantias extras para páginas que montam a legenda após o carregamento inicial.
  [100, 300, 800, 1500, 3000].forEach(ms => setTimeout(forceInsertMapLocateButton, ms));
}

function resetMapLegendAndViewFinal() {
  currentActiveFilters.status = "";
  syncStatusFilterUI();
  renderApp();

  if (leafletMap) {
    try {
      leafletMap.setView([-16.0, -50.5], 5, { animate: true });
    } catch (_) {}
  }
}

function getSmallestCommonAncestorFinal(elements) {
  const valid = elements.filter(Boolean);
  if (!valid.length) return null;

  let node = valid[0];
  while (node && node !== document.body) {
    if (valid.every(el => node.contains(el))) return node;
    node = node.parentElement;
  }
  return null;
}

function findMapLegendCardFinal() {
  const reset = document.getElementById("btnResetMap");
  if (!reset) return null;

  // O botão Resetar Visão existe no HTML original e é a âncora mais confiável.
  // Procuramos o primeiro ancestral que corresponde ao pequeno cartão branco
  // no canto superior direito.
  let node = reset;
  let fallback = reset.parentElement;

  while (node && node.parentElement && node.parentElement !== document.body) {
    node = node.parentElement;
    const rect = node.getBoundingClientRect();

    if (
      rect.width >= 300 &&
      rect.width <= 650 &&
      rect.height >= 55 &&
      rect.height <= 180
    ) {
      return node;
    }

    if (rect.width >= 260 && rect.width <= 760 && rect.height <= 220) {
      fallback = node;
    }
  }

  return fallback;
}

function ensureFinalMapLegendStyles() {
  if (document.getElementById("ps-final-map-legend-style")) return;

  const style = document.createElement("style");
  style.id = "ps-final-map-legend-style";
  style.textContent = `
    .ps-final-map-legend {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 18px;
      padding: 20px 24px;
      box-sizing: border-box;
    }

    .ps-final-map-status-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      align-items: center;
      justify-items: center;
    }

    .ps-final-map-actions-row {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(2, minmax(165px, 1fr));
      gap: 20px;
      justify-content: center;
      align-items: center;
    }

    .ps-final-status-btn {
      border: 0;
      background: transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 34px;
      padding: 5px 8px;
      font: inherit;
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      border-radius: 9px;
    }

    .ps-final-status-btn:hover {
      background: #f8fafc;
    }

    .ps-final-status-dot {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      flex: 0 0 14px;
    }

    .ps-final-action-btn {
      width: 100%;
      min-height: 52px;
      padding: 10px 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 12px;
      font: inherit;
      font-size: 15px;
      font-weight: 700;
      white-space: nowrap;
      cursor: pointer;
      box-sizing: border-box;
      transition: transform .15s ease, box-shadow .15s ease, background-color .15s ease;
    }

    .ps-final-action-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(15,23,42,.07);
    }

    .ps-final-reset-btn {
      color: #475569;
      background: #ffffff;
      border: 1px solid #d8dee7;
    }

    .ps-final-location-btn {
      color: #6D45E8;
      background: #F7F3FF;
      border: 1px solid #CBB8FF;
    }

    .ps-final-location-btn:hover {
      background: #EFE8FF;
      border-color: #7C4DFF;
    }

    .ps-final-leaflet-locate {
      border: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      margin-top: 10px !important;
    }

    .ps-final-leaflet-locate a {
      width: 38px !important;
      height: 38px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      border-radius: 50% !important;
      background: #7C4DFF !important;
      color: #fff !important;
      text-decoration: none !important;
      box-shadow: 0 3px 9px rgba(124,77,255,.35) !important;
      font-size: 20px !important;
      border: 3px solid rgba(255,255,255,.82) !important;
    }

    /* Aproxima a composição da referência aprovada. */
    #map {
      min-height: 610px !important;
      border-radius: 18px !important;
    }

    @media (min-width: 900px) {
      .ps-final-map-legend {
        min-width: 500px;
      }
    }

    @media (max-width: 900px) {
      #map {
        min-height: 500px !important;
      }
    }

    @media (max-width: 520px) {
      .ps-final-map-legend {
        gap: 9px;
        padding: 10px;
      }

      .ps-final-map-status-row {
        gap: 4px;
      }

      .ps-final-status-btn {
        gap: 4px;
        padding: 3px 2px;
        font-size: 10px;
      }

      .ps-final-status-dot {
        width: 9px;
        height: 9px;
        flex-basis: 9px;
      }

      .ps-final-map-actions-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .ps-final-action-btn {
        min-height: 36px;
        padding: 6px 5px;
        font-size: 10px;
      }

      #map {
        min-height: 390px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function installSingleLeafletLocationControlFinal() {
  if (!leafletMap || typeof L === "undefined") return false;
  if (document.getElementById("psFinalLeafletLocate")) return true;

  // Remove qualquer controle de localização residual criado por versões anteriores.
  document.querySelectorAll(
    "#psMapLocateFallbackV87, #btnMapLocateMeV85, #btnCenterUserLocationV87, #btnUserPositionV86"
  ).forEach(el => {
    try { el.remove(); } catch (_) {}
  });

  const LocateControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: function() {
      const div = L.DomUtil.create("div", "leaflet-control ps-final-leaflet-locate");
      div.id = "psFinalLeafletLocate";
      div.innerHTML = '<a href="#" title="Minha localização" aria-label="Minha localização"><span class="material-symbols-outlined" style="font-size:19px">my_location</span></a>';
      const link = div.querySelector("a");
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(link, "click", function(e) {
        L.DomEvent.preventDefault(e);
        locateUserOnMap();
      });
      return div;
    }
  });

  try {
    leafletMap.addControl(new LocateControl());
    return true;
  } catch (_) {
    return false;
  }
}

function buildFinalMapLegend() {
  ensureFinalMapLegendStyles();

  const card = findMapLegendCardFinal();
  if (!card) return false;
  if (card.dataset.finalLegendBuilt === "1") return true;

  // Substitui o conteúdo do cartão antigo em vez de adicionar elementos a ele.
  card.innerHTML = "";
  card.dataset.finalLegendBuilt = "1";
  card.style.setProperty("box-sizing", "border-box", "important");
  card.style.setProperty("height", "auto", "important");
  card.style.setProperty("min-height", "0", "important");
  card.style.setProperty("overflow", "visible", "important");
  card.style.setProperty("padding", "0", "important");
  card.style.setProperty("border-radius", "16px", "important");
  card.style.setProperty("background", "#ffffff", "important");
  card.style.setProperty("border", "1px solid #dce2ea", "important");
  card.style.setProperty("box-shadow", "0 3px 12px rgba(15,23,42,.06)", "important");

  const shell = document.createElement("div");
  shell.className = "ps-final-map-legend";

  const statusRow = document.createElement("div");
  statusRow.className = "ps-final-map-status-row";

  const statusSpecs = [
    { status: "Procurado", label: "Procurado", color: "#EF2222" },
    { status: "Avistado", label: "Avistado", color: "#159BD3" },
    { status: "Reencontrado", label: "Reencontrado 🎉", color: "#169C48" }
  ];

  statusSpecs.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ps-final-status-btn";
    btn.style.color = item.color;
    btn.innerHTML = `<span class="ps-final-status-dot" style="background:${item.color}"></span><span>${item.label}</span>`;
    btn.addEventListener("click", () => applyStatusFilterFromLegend(item.status));
    statusRow.appendChild(btn);
  });

  const actionsRow = document.createElement("div");
  actionsRow.className = "ps-final-map-actions-row";

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "ps-final-action-btn ps-final-reset-btn";
  resetBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">restart_alt</span><span>Resetar Visão</span>';
  resetBtn.addEventListener("click", resetMapLegendAndViewFinal);

  const locationBtn = document.createElement("button");
  locationBtn.id = "btnMapLocateMe";
  locationBtn.type = "button";
  locationBtn.className = "ps-final-action-btn ps-final-location-btn";
  locationBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:22px">location_on</span><span>Minha localização</span>';
  locationBtn.addEventListener("click", locateUserOnMap);

  actionsRow.append(resetBtn, locationBtn);
  shell.append(statusRow, actionsRow);
  card.appendChild(shell);

  installSingleLeafletLocationControlFinal();

  // Depois de alterar a altura do mapa, força o Leaflet a recalcular o viewport.
  setTimeout(() => {
    try {
      leafletMap?.invalidateSize();
      if (!currentUserPosition) {
        leafletMap?.setView([-16.0, -50.5], 5, { animate: false });
      }
    } catch (_) {}
  }, 120);

  console.log("🎯 v94: menu superior substituído e distribuído conforme a referência aprovada.");
  return true;
}

function bindMapLegendFilters() {
  // O menu é estrutural no index.html. Aqui apenas ligamos os controles
  // às funções de filtro já existentes, sem reconstruir ou duplicar elementos.

  const statusButtons = [
    ["legendFilterLost", "Procurado"],
    ["legendFilterSighted", "Avistado"],
    ["legendFilterFound", "Reencontrado"]
  ];

  statusButtons.forEach(([id, status]) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.dataset.legendStatus = status;
    btn.classList.add("legend-filter-btn");

    if (btn.dataset.statusFilterBound !== "1") {
      btn.dataset.statusFilterBound = "1";
      btn.addEventListener("click", () => {
        applyStatusFilterFromLegend(status);
      });
    }
  });

  const locationBtn = document.getElementById("btnMapLocateMe");
  if (locationBtn && locationBtn.dataset.locationBound !== "1") {
    locationBtn.dataset.locationBound = "1";
    locationBtn.addEventListener("click", locateUserOnMap);
  }

  // Garante que a aparência dos filtros superiores acompanhe o filtro ativo.
  syncStatusFilterUI();
}

window.addEventListener("orientationchange", () => {
  setTimeout(() => {
    optimizeMobileTopHeader();
    enhanceMapLayout();
    const reportModal = document.getElementById("reportModal");
    if (reportModal && !reportModal.classList.contains("hidden")) {
      prepareReportModalForViewport({ restoreScroll: false });
    }
  }, 180);
});

window.addEventListener("resize", () => {
  optimizeMobileTopHeader();
});

if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", () => {
    // O teclado do iOS altera visualViewport várias vezes.
    // Preservamos o scroll atual e apenas mantemos o modal dentro da viewport.
    const reportModal = document.getElementById("reportModal");
    if (reportModal && !reportModal.classList.contains("hidden")) {
      ensureMobileResponsiveStyles();
    }
  });
}

// --- FILTER EVENT LISTENERS ---
function initFilterEvents() {
  const filterSearch = document.getElementById("filterSearch");
  filterSearch?.addEventListener("input", (e) => {
    currentActiveFilters.search = e.target.value.toLowerCase().trim();
    renderApp();
  });

  // Filtros da legenda superior do mapa
  bindMapLegendFilters();

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

  document.getElementById("btnClearFilters")?.addEventListener("click", clearAllPetFilters);
}

function syncStatusFilterUI() {
  const current = currentActiveFilters.status;

  // Filtros superiores do mapa:
  // apenas um fundo leve da própria cor indica o botão selecionado.
  getMapLegendFilterElements().forEach(b => {
    const s = b.dataset.legendStatus;
    const isActive = current === s;

    b.classList.toggle("is-active", isActive);
    b.setAttribute("aria-pressed", isActive ? "true" : "false");

    // Remove qualquer resíduo visual das versões anteriores/Tailwind.
    b.classList.remove(
      "ring-2",
      "ring-primary",
      "bg-surface-container",
      "scale-105",
      "border-transparent",
      "opacity-60"
    );

    b.style.outline = "none";
    b.style.boxShadow = "none";
  });

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

function renderApp() {
  runAutoPurgeEngine();

  let filteredPets = petsData.filter(pet => {
    if (currentActiveFilters.search) {
      const q = currentActiveFilters.search;
      const matchName = String(pet.name || "").toLowerCase().includes(q);
      const matchBreed = String(pet.breed || "").toLowerCase().includes(q);
      const matchColor = String(pet.color || "").toLowerCase().includes(q);
      const matchAddress = String(pet.address || "").toLowerCase().includes(q);
      const matchCity = String(pet.city || "").toLowerCase().includes(q);
      const matchDesc = String(pet.description || "").toLowerCase().includes(q);
      if (!matchName && !matchBreed && !matchColor && !matchAddress && !matchCity && !matchDesc) return false;
    }

    if (currentActiveFilters.state && pet.state !== currentActiveFilters.state) return false;
    if (currentActiveFilters.city && pet.city !== currentActiveFilters.city) return false;

    if (currentActiveFilters.status) {
      if (currentActiveFilters.status === "Reencontrado") {
        if (!isResolvedPet(pet)) return false;
      } else if (pet.type !== currentActiveFilters.status) {
        return false;
      }
    }

    if (currentActiveFilters.species && pet.species !== currentActiveFilters.species) return false;

    if (currentActiveFilters.nearby) {
      if (!currentUserPosition) return false;
      const coords = getPetMapCoordinates(pet);
      if (!coords) return false;
      const distance = haversineDistanceKm(
        currentUserPosition.lat,
        currentUserPosition.lng,
        Number(coords.lat),
        Number(coords.lng)
      );
      if (!Number.isFinite(distance) || distance > Number(currentActiveFilters.nearbyRadiusKm || 10)) return false;
    }

    return true;
  });

  filteredPets = [...filteredPets].sort((a, b) => {
    const ta = getPetSortTimestamp(a);
    const tb = getPetSortTimestamp(b);
    return currentActiveFilters.sort === "oldest" ? ta - tb : tb - ta;
  });

  const petsGrid = document.getElementById("petsGrid");
  const emptyState = document.getElementById("emptyState");
  const resultsCount = document.getElementById("resultsCount");
  if (resultsCount) resultsCount.textContent = filteredPets.length;

  if (petsGrid && emptyState) {
    if (filteredPets.length === 0) {
      petsGrid.innerHTML = "";
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      petsGrid.innerHTML = filteredPets.map(pet => createPetCardHtml(pet)).join("");
    }
  }

  updateMapMarkers(filteredPets);
  replaceResolvedLabelsInUI();

  if (isAdminAuthenticated) renderAdminDashboardTable();
}

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
      
      <div class="w-full aspect-square shrink-0 relative overflow-hidden bg-white border-b border-outline-variant/30 flex items-center justify-center p-1.5 cursor-pointer group/img" style="aspect-ratio: 1 / 1;" onclick="event.stopPropagation(); openImageLightbox('${pet.id}')" title="Clique para ampliar a foto deste pet em tela cheia">
        <img src="${getPetPhoto(pet)}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-full h-full object-contain rounded-lg group-hover/img:scale-105 transition-transform duration-500"/>
        
        <div class="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 backdrop-blur-sm shadow-md group-hover/img:bg-primary transition-colors">
          <span class="material-symbols-outlined text-xs">zoom_in</span> Ampliar Foto
        </div>
        
        <div class="absolute top-3 left-3 ${badgeBg} px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">${statusIcon}</span> ${getDisplayStatusLabel(pet.type)}
        </div>

        <div class="absolute top-3 right-3 bg-primary/95 text-on-primary backdrop-blur-md px-2.5 py-1 rounded-lg text-[11px] font-bold shadow-md flex items-center gap-1">
          <span class="material-symbols-outlined text-xs text-secondary-container">auto_awesome</span> ${isResolved ? '100% Finalizado' : (pet.matchConfidence || '95% Match')}
        </div>
      </div>

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
            <button type="button" onclick="event.stopPropagation(); applyStatusFilterFromLegend('Reencontrado')" class="text-green-700 font-extrabold hover:underline cursor-pointer" title="Filtrar todos os pets reencontrados">Reencontrado 🎉</button>
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

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="event.stopPropagation(); focusPetOnMap('${pet.id}')" class="py-2 px-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Visualizar a geolocalização no mapa">
            <span class="material-symbols-outlined text-sm">map</span> Ver no Mapa
          </button>
          
          <button onclick="event.stopPropagation(); openDetailModal('${pet.id}')" class="py-2 px-2.5 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Ver detalhes completos do cadastro">
            <span class="material-symbols-outlined text-sm">visibility</span> Detalhes Completos
          </button>
          
          ${pet.type === 'Procurado' ? `
            <button onclick="event.stopPropagation(); generatePosterModal('${pet.id}')" class="col-span-2 py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-[#E52421] font-bold text-xs transition-colors flex items-center justify-center gap-1 border border-red-200">
              <span class="material-symbols-outlined text-sm">print</span> Cartaz para compartilhamento
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

    const coords = await fetchGeocodeCoordinates(
      `${pet.address || ""}, ${pet.city || ""}, ${pet.state || ""}, Brasil`
    );

    if (coords) {
      pet.lat = coords.lat;
      pet.lng = coords.lng;
    }

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
    lightboxImg.src = getPetPhoto(pet);
    document.getElementById("lightboxPetName").textContent = `📸 ${pet.name} (${pet.species}) - ${pet.city || ''}/${pet.state || ''}`;
    document.getElementById("imageLightboxModal").classList.remove("hidden");
  }
}

function formatBrazilianPhone(val) {
  if (!val) return "";
  let digits = val.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

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


function ensureMobileResponsiveStyles() {
  if (document.getElementById("petSearchersMobileResponsiveStyles")) return;

  const style = document.createElement("style");
  style.id = "petSearchersMobileResponsiveStyles";
  style.textContent = `
    @media (max-width: 767px) {
      html, body {
        max-width: 100%;
        overflow-x: hidden;
      }

      /* CABEÇALHO MOBILE
         Organiza a marca em uma linha e as três ações em outra,
         evitando qualquer estouro horizontal em iPhone/Android. */
      .ps-mobile-header {
        width: 100% !important;
        max-width: 100% !important;
        min-height: 0 !important;
        height: auto !important;
        box-sizing: border-box !important;
        overflow: visible !important;
        padding-top: max(4px, env(safe-area-inset-top)) !important;
      }

      .ps-mobile-header-inner {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: center !important;
        gap: 8px !important;
        padding: 10px 10px 8px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
      }

      .ps-mobile-brand {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        gap: 8px !important;
        padding-top: 3px !important;
        padding-bottom: 2px !important;
        margin: 0 !important;
        box-sizing: border-box !important;
        overflow: visible !important;
        position: relative !important;
        top: 0 !important;
        transform: none !important;
      }

      .ps-mobile-brand > * {
        position: static !important;
        top: auto !important;
        transform: none !important;
      }

      .ps-mobile-brand > div,
      .ps-mobile-brand > section,
      .ps-mobile-brand > a {
        min-width: 0 !important;
        padding-top: 2px !important;
        overflow: visible !important;
      }

      .ps-mobile-brand img {
        width: 38px !important;
        height: 38px !important;
        max-width: 38px !important;
        max-height: 38px !important;
        flex: 0 0 38px !important;
        object-fit: contain !important;
      }

      .ps-mobile-brand * {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      .ps-mobile-brand h1,
      .ps-mobile-brand h2,
      .ps-mobile-brand h3,
      .ps-mobile-brand .text-xl,
      .ps-mobile-brand .text-2xl,
      .ps-mobile-brand .text-3xl {
        font-size: 16px !important;
        line-height: 1.25 !important;
        min-height: 20px !important;
        padding-top: 1px !important;
        padding-bottom: 1px !important;
        margin: 0 !important;
        overflow: visible !important;
        position: static !important;
        transform: none !important;
      }

      .ps-mobile-brand p,
      .ps-mobile-brand span {
        line-height: 1.25 !important;
        overflow: visible !important;
      }

      .ps-mobile-nav-actions {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        display: grid !important;
        grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 6px !important;
        align-items: stretch !important;
        box-sizing: border-box !important;
      }

      #btnOpenAdmin,
      #btnOpenReportLost,
      #btnOpenReportSighted {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        min-height: 42px !important;
        height: 42px !important;
        padding: 6px 7px !important;
        margin: 0 !important;
        border-radius: 12px !important;
        font-size: 11px !important;
        line-height: 1.1 !important;
        white-space: normal !important;
        text-align: center !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 4px !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
      }

      #btnOpenAdmin {
        padding-left: 4px !important;
        padding-right: 4px !important;
      }

      #btnOpenAdmin .material-symbols-outlined,
      #btnOpenReportLost .material-symbols-outlined,
      #btnOpenReportSighted .material-symbols-outlined {
        font-size: 17px !important;
        flex: 0 0 auto !important;
      }

      #map {
        width: 100% !important;
        height: 322px !important;
        min-height: 322px !important;
        max-height: 322px !important;
        border-radius: 16px !important;
      }

      /* Modal de cadastro/edição: nunca centralizar um formulário maior que a tela.
         Isso evita o corte dos primeiros campos (inclusive foto) no iPhone/Safari. */
      #reportModal {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        box-sizing: border-box !important;
        align-items: flex-start !important;
        justify-content: center !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        padding:
          max(8px, env(safe-area-inset-top))
          8px
          max(12px, env(safe-area-inset-bottom)) !important;
      }

      #reportModal > div {
        width: min(100%, 720px) !important;
        max-width: calc(100vw - 16px) !important;
        min-width: 0 !important;
        max-height: none !important;
        height: auto !important;
        margin: 0 auto !important;
        border-radius: 18px !important;
        overflow: visible !important;
        box-sizing: border-box !important;
      }

      #reportModal form,
      #petForm {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        box-sizing: border-box !important;
      }

      #reportModal input,
      #reportModal select,
      #reportModal textarea,
      #reportModal button {
        max-width: 100%;
        box-sizing: border-box;
      }

      #reportModal input,
      #reportModal select,
      #reportModal textarea {
        font-size: 16px !important; /* evita zoom automático do Safari */
      }

      #reportModal textarea {
        min-height: 110px;
        resize: vertical;
      }

      /* PRÉ-VISUALIZAÇÃO DO CARTAZ
         O pop-up inteiro fica dentro da viewport real do celular, incluindo
         safe-area, título, botões e o início do cartaz. */
      #posterModal {
        position: fixed !important;
        inset: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: center !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
        overscroll-behavior: contain !important;
        box-sizing: border-box !important;
        padding:
          max(10px, env(safe-area-inset-top))
          8px
          max(12px, env(safe-area-inset-bottom)) !important;
      }

      #posterModal.hidden {
        display: none !important;
      }

      #posterModal > div {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        transform: none !important;
        width: min(100%, 720px) !important;
        max-width: calc(100vw - 16px) !important;
        max-height: calc(100dvh - max(20px, env(safe-area-inset-top)) - max(20px, env(safe-area-inset-bottom))) !important;
        height: auto !important;
        min-height: 0 !important;
        margin: 0 auto !important;
        border-radius: 18px !important;
        box-sizing: border-box !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch !important;
      }

      #posterModal > div > * {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      #posterModal #posterArea {
        transform-origin: top center !important;
      }

      #photoPlaceholder,
      #photoPreviewContainer {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }

      #photoPreviewContainer img,
      #imgPreview {
        max-width: 100% !important;
        height: auto !important;
        object-fit: contain !important;
      }

      /* Campos e blocos internos com respiro mais uniforme no mobile. */
      #reportModal .grid {
        gap: 14px !important;
      }

      #reportModal label {
        line-height: 1.3;
      }

      /* Filtros e controles ficam mais fluidos em telas estreitas. */
      #petAdvancedControls {
        gap: 8px !important;
      }

      #petAdvancedControls > * {
        min-width: 0 !important;
      }

      #btnNearbyPets,
      #btnClearAllPetFilters,
      #nearbyRadiusSelect,
      #petSortOrder {
        min-height: 40px;
      }

      /* Cartões: evita estouro lateral e mantém espaçamento harmonioso. */
      #petsGrid {
        width: 100%;
        max-width: 100%;
      }

      #petsGrid > * {
        min-width: 0;
      }
    }

    @media (max-width: 390px) {
      .ps-mobile-header {
        padding-top: max(5px, env(safe-area-inset-top)) !important;
      }

      .ps-mobile-brand {
        padding-top: 4px !important;
      }

      .ps-mobile-brand h1,
      .ps-mobile-brand h2,
      .ps-mobile-brand h3,
      .ps-mobile-brand .text-xl,
      .ps-mobile-brand .text-2xl,
      .ps-mobile-brand .text-3xl {
        font-size: 15px !important;
        line-height: 1.28 !important;
        min-height: 20px !important;
      }
    }

    @media (max-width: 430px) {
      .ps-mobile-header-inner {
        padding: 10px 8px 7px !important;
        gap: 7px !important;
      }

      .ps-mobile-brand img {
        width: 34px !important;
        height: 34px !important;
        max-width: 34px !important;
        max-height: 34px !important;
        flex-basis: 34px !important;
      }

      .ps-mobile-brand h1,
      .ps-mobile-brand h2,
      .ps-mobile-brand h3,
      .ps-mobile-brand .text-xl,
      .ps-mobile-brand .text-2xl,
      .ps-mobile-brand .text-3xl {
        font-size: 15px !important;
      }

      .ps-mobile-nav-actions {
        grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr) !important;
        gap: 5px !important;
      }

      #btnOpenAdmin,
      #btnOpenReportLost,
      #btnOpenReportSighted {
        height: 40px !important;
        min-height: 40px !important;
        font-size: 10.5px !important;
        padding: 5px 6px !important;
        border-radius: 11px !important;
      }

      #reportModal {
        padding-left: 6px !important;
        padding-right: 6px !important;
      }

      #reportModal > div {
        max-width: calc(100vw - 12px) !important;
        border-radius: 16px !important;
      }

      #posterModal {
        padding-left: 6px !important;
        padding-right: 6px !important;
        padding-top: max(12px, env(safe-area-inset-top)) !important;
      }

      #posterModal > div {
        max-width: calc(100vw - 12px) !important;
        border-radius: 16px !important;
      }

      #map {
        border-radius: 14px !important;
      }
    }
  `;
  document.head.appendChild(style);
}


function optimizeMobileTopHeader() {
  const adminBtn = document.getElementById("btnOpenAdmin");
  const lostBtn = document.getElementById("btnOpenReportLost");
  const sightedBtn = document.getElementById("btnOpenReportSighted");

  if (!adminBtn || !lostBtn || !sightedBtn) return;

  const buttons = [adminBtn, lostBtn, sightedBtn];

  // Menor ancestral que contém os três botões.
  let actions = adminBtn.parentElement;
  while (
    actions &&
    actions !== document.body &&
    !buttons.every(btn => actions.contains(btn))
  ) {
    actions = actions.parentElement;
  }

  if (!actions || actions === document.body) return;
  actions.classList.add("ps-mobile-nav-actions");

  // Preferimos o <header>; se não houver, sobe até encontrar um container
  // que também contenha a marca/logo.
  let header = actions.closest("header");
  if (!header) {
    let node = actions.parentElement;
    while (node && node !== document.body) {
      if (node.querySelector("img") && node.contains(actions)) {
        header = node;
        break;
      }
      node = node.parentElement;
    }
  }

  if (!header) return;
  header.classList.add("ps-mobile-header");

  // Container interno principal do cabeçalho.
  let inner = actions.parentElement;
  while (
    inner &&
    inner !== header &&
    !(inner.querySelector("img") && inner.contains(actions))
  ) {
    inner = inner.parentElement;
  }
  if (!inner || inner === document.body) inner = header;
  inner.classList.add("ps-mobile-header-inner");

  // Bloco da marca: o ancestral do primeiro logo que seja irmão/parte do
  // mesmo container interno, sem englobar os botões.
  const logo = inner.querySelector("img");
  if (logo) {
    let brand = logo.parentElement;
    while (
      brand &&
      brand.parentElement &&
      brand.parentElement !== inner &&
      !brand.contains(actions)
    ) {
      brand = brand.parentElement;
    }

    if (brand && !brand.contains(actions)) {
      brand.classList.add("ps-mobile-brand");
    }
  }
}

let reportModalScrollBound = false;
const REPORT_MODAL_SCROLL_KEY = "pet_searchers_report_modal_scroll_v1";

function getSavedReportModalScroll() {
  try {
    const value = Number(sessionStorage.getItem(REPORT_MODAL_SCROLL_KEY) || "0");
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch (_) {
    return 0;
  }
}

function saveReportModalScroll() {
  const reportModal = document.getElementById("reportModal");
  if (!reportModal) return;

  try {
    sessionStorage.setItem(REPORT_MODAL_SCROLL_KEY, String(Math.max(0, reportModal.scrollTop || 0)));
  } catch (_) {}
}

function bindReportModalScrollPersistence() {
  const reportModal = document.getElementById("reportModal");
  if (!reportModal || reportModalScrollBound) return;

  reportModalScrollBound = true;

  // Salva continuamente a posição real escolhida pelo usuário.
  reportModal.addEventListener("scroll", () => {
    saveReportModalScroll();
  }, { passive: true });

  // Mantém a posição mesmo ao sair da página e voltar pelo histórico do navegador.
  window.addEventListener("pagehide", saveReportModalScroll);
  window.addEventListener("beforeunload", saveReportModalScroll);
}

function prepareReportModalForViewport(options = {}) {
  const reportModal = document.getElementById("reportModal");
  if (!reportModal) return;

  ensureMobileResponsiveStyles();
  bindReportModalScrollPersistence();

  const restoreScroll = options.restoreScroll !== false;

  // Importante no iOS:
  // NÃO reposicionamos o formulário quando o teclado abre/fecha ou quando
  // o usuário altera um campo. Só restauramos a posição ao abrir o modal.
  if (restoreScroll) {
    const savedTop = getSavedReportModalScroll();

    requestAnimationFrame(() => {
      try {
        reportModal.scrollTo({ top: savedTop, left: 0, behavior: "auto" });
      } catch (_) {
        reportModal.scrollTop = savedTop;
      }
    });
  }

  setTimeout(() => {
    try { leafletMap?.invalidateSize(); } catch (_) {}
  }, 120);
}

// --- MODALS & FORM MANAGEMENT ---
function initModalEvents() {
  const reportModal = document.getElementById("reportModal");
  const noticeModal = document.getElementById("notice30DaysModal");
  const posterModal = document.getElementById("posterModal");
  const detailModal = document.getElementById("detailModal");
  const lightboxModal = document.getElementById("imageLightboxModal");

  document.getElementById("btnCloseLightbox")?.addEventListener("click", () => {
    lightboxModal?.classList.add("hidden");
  });
  lightboxModal?.addEventListener("click", (e) => {
    if (e.target === lightboxModal) {
      lightboxModal.classList.add("hidden");
    }
  });

  document.getElementById("btnOpenReportLost")?.addEventListener("click", () => openReportModal("Procurado"));
  document.getElementById("btnOpenReportSighted")?.addEventListener("click", () => openReportModal("Avistado"));

  document.getElementById("tabReportLost")?.addEventListener("click", () => setReportFormType("Procurado"));
  document.getElementById("tabReportSighted")?.addEventListener("click", () => setReportFormType("Avistado"));

  document.querySelectorAll(".btnCloseModal").forEach(btn => {
    btn.addEventListener("click", () => {
      saveReportModalScroll();
      reportModal?.classList.add("hidden");
      setTimeout(() => {
        enhanceMapLayout();
        try { leafletMap?.invalidateSize(); } catch (_) {}
      }, 80);
    });
  });
  document.querySelectorAll(".btnClosePosterModal").forEach(btn => {
    btn.addEventListener("click", () => posterModal?.classList.add("hidden"));
  });
  document.querySelectorAll(".btnCloseDetailModal").forEach(btn => {
    btn.addEventListener("click", () => detailModal?.classList.add("hidden"));
  });

  document.getElementById("btnAckNotice")?.addEventListener("click", () => {
    noticeModal?.classList.add("hidden");
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

  const btnDownloadPDF = document.getElementById("btnPrintPoster");
  if (btnDownloadPDF) {
    btnDownloadPDF.addEventListener("click", downloadPosterPDF);

    // Mantém o ID existente para não exigir alteração do index.html,
    // mas o botão agora faz download do PDF A4 diretamente.
    const textNode = Array.from(btnDownloadPDF.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.nodeValue = textNode.nodeValue
        .replace(/Imprimir\s*Cartaz\s*A4/gi, "Baixar Cartaz PDF A4")
        .replace(/Imprimir/gi, "Baixar PDF");
    } else if ((btnDownloadPDF.textContent || "").match(/Imprimir/i)) {
      btnDownloadPDF.innerHTML = btnDownloadPDF.innerHTML
        .replace(/Imprimir\s*Cartaz\s*A4/gi, "Baixar Cartaz PDF A4")
        .replace(/Imprimir/gi, "Baixar PDF");
    }
  }

  const btnDownloadJPG = document.getElementById("btnDownloadPosterJPG");
  if (btnDownloadJPG) {
    btnDownloadJPG.addEventListener("click", downloadPosterJPG);

    // Em celular o JPG abre a folha nativa para salvar em Fotos ou compartilhar.
    if (isMobileShareEnvironment()) {
      btnDownloadJPG.setAttribute("title", "Salvar na galeria ou compartilhar imagem");
      btnDownloadJPG.setAttribute("aria-label", "Salvar ou compartilhar cartaz JPG");
      const jpgLabel = (btnDownloadJPG.textContent || "").trim();
      if (/Baixar\s+Cartaz\s+JPG/i.test(jpgLabel)) {
        btnDownloadJPG.innerHTML = btnDownloadJPG.innerHTML.replace(
          /Baixar\s+Cartaz\s+JPG\s*\(4×5\)|Baixar\s+Cartaz\s+JPG\s*\(4x5\)|Baixar\s+Cartaz\s+JPG/gi,
          "Salvar / Compartilhar JPG"
        );
      }
    }
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

  // No mobile, o formulário é alinhado pelo topo e todo o conteúdo
  // fica acessível por rolagem, incluindo o campo da foto.
  prepareReportModalForViewport({ restoreScroll: true });
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
        Object.assign(targetPet, { name, type, species, breed, color, age, gender, date, state, city, address, description, contactName, contactPhone, photo, lat: geoCoords.lat, lng: geoCoords.lng, geocodedCity: city, geocodedAddress: address, lastModifiedAt: new Date().toISOString() });
        saveEditedPet(targetPet);
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
        lastModifiedAt: new Date().toISOString(),
        lat: geoCoords.lat,
        lng: geoCoords.lng,
        geocodedCity: city,
        geocodedAddress: address
      };
      saveEditedPet(targetPet);
      petsData.unshift(targetPet);
    }

    savePetsToStorage();

    try {
      document.getElementById("petForm").reset();
      document.getElementById("photoPlaceholder").classList.remove("hidden");
      document.getElementById("photoPreviewContainer").classList.add("hidden");
      document.getElementById("imgPreview").src = "";
      saveReportModalScroll();
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


function replacePosterLabelText(root, fromText, toText) {
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    if (node.nodeValue && node.nodeValue.toLowerCase().includes(fromText.toLowerCase())) {
      node.nodeValue = node.nodeValue.replace(new RegExp(fromText, "gi"), toText);
    }
  });
}

function getCommonAncestor(elements) {
  const list = elements.filter(Boolean);
  if (!list.length) return null;

  let node = list[0];
  while (node && node !== document.body) {
    if (list.every(el => node.contains(el))) return node;
    node = node.parentElement;
  }
  return null;
}


function findPosterElementByText(root, needle) {
  if (!root || !needle) return null;
  const target = String(needle).trim().toLowerCase();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = String(node.nodeValue || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (value && value.includes(target)) {
      return node.parentElement || null;
    }
  }
  return null;
}

function findNearestAncestorContaining(parentStart, requiredElement, stopAt) {
  let node = parentStart;
  while (node && node !== stopAt && node !== document.body) {
    if (requiredElement && node.contains(requiredElement)) return node;
    node = node.parentElement;
  }
  return null;
}


function getPosterLogoSource() {
  const candidates = [
    document.querySelector("#posterArea img[src*='logo' i]"),
    document.querySelector("img[alt*='Pet Searchers' i]"),
    document.querySelector("img[src*='pet-searchers' i]"),
    document.querySelector("header img"),
    document.querySelector("nav img")
  ].filter(Boolean);

  return candidates.length ? candidates[0].src : "";
}


function ensureUnifiedPosterStyles() {
  if (document.getElementById("petSearchersUnifiedPosterStyles")) return;

  const style = document.createElement("style");
  style.id = "petSearchersUnifiedPosterStyles";
  style.textContent = `
    #posterArea.ps-social-poster,
    #posterArea.ps-a4-poster {
      box-sizing: border-box !important;
      margin: 0 auto !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #ffffff !important;
      color: #111827 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      display: grid !important;
      border: 0 !important;
      box-shadow: none !important;
    }

    /* JPG para compartilhamento: proporção exata 4:5 */
    #posterArea.ps-social-poster {
      width: 800px !important;
      height: 1000px !important;
      min-width: 800px !important;
      max-width: 800px !important;
      min-height: 1000px !important;
      grid-template-rows: 17% 66% 17% !important;
    }

    /* PDF para impressão: uma página A4 */
    #posterArea.ps-a4-poster {
      width: 794px !important;
      height: 1123px !important;
      min-width: 794px !important;
      max-width: 794px !important;
      min-height: 1123px !important;
      grid-template-rows: 17% 66% 17% !important;
    }

    #posterArea .ps-poster-header {
      background: #ef1717;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 20px 30px 18px;
      box-sizing: border-box;
    }

    #posterArea .ps-poster-title {
      position: relative;
      z-index: 2;
      display: block;
      font-size: 60px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: .3px;
      margin: 0;
      padding: 0;
      text-transform: uppercase;
      background: #ef1717;
    }

    #posterArea .ps-poster-date {
      position: relative;
      z-index: 1;
      width: 66%;
      margin-top: 14px;
      padding: 7px 12px;
      border-top: 2px solid rgba(255,255,255,.95);
      border-bottom: 2px solid rgba(255,255,255,.95);
      font-size: 17px;
      line-height: 1.25;
      font-weight: 900;
      letter-spacing: .6px;
      text-transform: uppercase;
      box-sizing: border-box;
    }

    #posterArea .ps-poster-body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      padding: 28px 34px 24px;
      box-sizing: border-box;
    }

    #posterArea .ps-poster-center {
      width: 94%;
      display: grid;
      grid-template-columns: minmax(0, 64%) minmax(0, 36%);
      gap: 26px;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    /* Moldura 35% maior que o padrão anterior, sem invadir o painel lateral. */
    #posterArea .ps-photo-shell {
      width: 100%;
      aspect-ratio: 4 / 5;
      border: 2px solid #d1d5db;
      border-radius: 14px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 2px 7px rgba(0,0,0,.09);
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
    }

    #posterArea .ps-photo-shell img {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      object-fit: contain !important;
      object-position: center !important;
      background: #ffffff !important;
      display: block !important;
    }

    #posterArea .ps-info-column {
      min-width: 0;
      width: 100%;
      padding-left: 2px;
      box-sizing: border-box;
    }

    #posterArea .ps-pet-name {
      color: #ef1717;
      font-size: 34px;
      line-height: 1;
      font-weight: 900;
      margin: 0 0 14px;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    #posterArea .ps-info-box {
      width: 100%;
      background: #f5f6f7;
      border: 1px solid #d7dbe0;
      border-radius: 10px;
      padding: 9px 10px 8px;
      margin-bottom: 8px;
      box-sizing: border-box;
    }

    #posterArea .ps-info-label {
      color: #ef1717;
      font-size: 10px;
      line-height: 1.1;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    #posterArea .ps-info-value {
      color: #111827;
      font-size: 13px;
      line-height: 1.28;
      font-weight: 700;
      overflow-wrap: anywhere;
    }

    #posterArea .ps-observation {
      background: #fff7f5;
      border: 1.5px solid #ef6c63;
    }

    #posterArea .ps-observation .ps-info-value {
      font-weight: 500;
    }

    #posterArea .ps-last-seen {
      border-top: 4px solid #ef1717;
      margin-top: 10px;
      padding-top: 12px;
    }

    #posterArea .ps-last-title {
      color: #374151;
      font-size: 11px;
      line-height: 1.1;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 7px;
    }

    #posterArea .ps-last-text {
      color: #111827;
      font-size: 12.5px;
      line-height: 1.4;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    #posterArea .ps-poster-footer {
      background: #ef1717;
      color: #ffffff;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      padding: 12px 28px 12px;
      box-sizing: border-box;
    }

    #posterArea .ps-footer-call {
      font-size: 14px;
      line-height: 1.2;
      font-weight: 900;
      text-transform: uppercase;
      margin-bottom: 7px;
    }

    #posterArea .ps-footer-divider {
      width: 76%;
      height: 2px;
      background: rgba(255,255,255,.94);
      margin: 0 auto 9px;
    }

    #posterArea .ps-footer-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 18px;
      width: 100%;
      min-height: 52px;
    }

    #posterArea .ps-footer-logo {
      width: 54px !important;
      height: 54px !important;
      object-fit: contain !important;
      border-radius: 8px;
      background: #ffffff;
      padding: 3px;
      box-sizing: border-box;
      flex: 0 0 auto;
    }

    #posterArea .ps-footer-phone-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-width: 0;
      min-height: 46px;
      box-sizing: border-box;
    }

    #posterArea .ps-wa {
      width: 42px;
      height: 42px;
      border: 3px solid #ffffff;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      flex: 0 0 42px;
      padding: 0;
      margin: 0;
      line-height: 0;
    }

    #posterArea .ps-wa svg {
      width: 23px;
      height: 23px;
      display: block;
      flex: 0 0 auto;
    }

    #posterArea .ps-footer-phone {
      color: #ffffff;
      font-size: 30px;
      line-height: 42px;
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      font-weight: 900;
      letter-spacing: .3px;
      white-space: nowrap;
      margin: 0;
      padding: 0;
    }

    #posterArea .ps-footer-bottom {
      font-size: 14px;
      line-height: 1.15;
      font-weight: 900;
      margin-top: 7px;
      text-transform: uppercase;
    }


    #posterArea .ps-poster-title,
    #posterArea .ps-poster-title * {
      text-decoration: none !important;
      border-top: 0 !important;
      border-bottom: 0 !important;
      box-shadow: none !important;
    }

    #posterArea .ps-poster-title::before,
    #posterArea .ps-poster-title::after {
      content: none !important;
      display: none !important;
    }


    /* ================================================================
       v101 — JPG 4:5 oficial (desktop e mobile usam a mesma matriz 800x1000)
       Layout reproduz a referência aprovada, sem depender da escala da prévia.
       ================================================================ */
    #posterArea .ps-header-line {
      display: block;
      width: 76%;
      height: 2px;
      min-height: 2px;
      flex: 0 0 2px;
      background: rgba(255,255,255,.96);
      margin: 0 auto;
      padding: 0;
      border: 0;
      box-shadow: none;
      box-sizing: border-box;
    }

    #posterArea .ps-poster-date {
      border: 0 !important;
    }

    #posterArea.ps-social-poster {
      width: 800px !important;
      height: 1000px !important;
      min-width: 800px !important;
      max-width: 800px !important;
      min-height: 1000px !important;
      max-height: 1000px !important;
      grid-template-rows: 17.5% 65% 17.5% !important;
    }

    #posterArea.ps-social-poster .ps-poster-header {
      padding: 24px 34px 17px !important;
      justify-content: center !important;
      overflow: hidden !important;
    }

    #posterArea.ps-social-poster .ps-poster-title {
      font-size: 61px !important;
      line-height: .98 !important;
      margin: 0 0 10px !important;
      padding: 0 !important;
      transform: none !important;
      position: relative !important;
      z-index: 3 !important;
    }

    #posterArea.ps-social-poster .ps-poster-date {
      width: auto !important;
      margin: 7px 0 !important;
      padding: 0 14px !important;
      font-size: 17px !important;
      line-height: 1.15 !important;
      letter-spacing: .65px !important;
      position: relative !important;
      z-index: 3 !important;
      background: #ef1717 !important;
    }

    #posterArea.ps-social-poster .ps-poster-body {
      padding: 28px 30px 24px !important;
      align-items: center !important;
      justify-content: center !important;
    }

    #posterArea.ps-social-poster .ps-poster-center {
      width: 100% !important;
      max-width: 740px !important;
      grid-template-columns: minmax(0, 57%) minmax(0, 39%) !important;
      column-gap: 26px !important;
      align-items: center !important;
      justify-content: center !important;
    }

    #posterArea.ps-social-poster .ps-photo-shell {
      width: 100% !important;
      aspect-ratio: 4 / 5 !important;
      border-radius: 13px !important;
      border: 2px solid #d5d8de !important;
      box-shadow: none !important;
    }

    #posterArea.ps-social-poster .ps-info-column {
      width: 100% !important;
      padding-left: 0 !important;
      align-self: center !important;
    }

    #posterArea.ps-social-poster .ps-pet-name {
      font-size: 31px !important;
      line-height: 1.02 !important;
      margin: 0 0 12px !important;
    }

    #posterArea.ps-social-poster .ps-info-box {
      border-radius: 10px !important;
      padding: 8px 10px 7px !important;
      margin-bottom: 8px !important;
    }

    #posterArea.ps-social-poster .ps-info-label {
      font-size: 10px !important;
      margin-bottom: 4px !important;
    }

    #posterArea.ps-social-poster .ps-info-value {
      font-size: 13px !important;
      line-height: 1.25 !important;
    }

    #posterArea.ps-social-poster .ps-last-seen {
      border-top-width: 4px !important;
      margin-top: 10px !important;
      padding-top: 12px !important;
    }

    #posterArea.ps-social-poster .ps-last-title {
      font-size: 11px !important;
      margin-bottom: 7px !important;
    }

    #posterArea.ps-social-poster .ps-last-text {
      font-size: 12.4px !important;
      line-height: 1.38 !important;
    }

    #posterArea.ps-social-poster .ps-poster-footer {
      padding: 13px 28px 12px !important;
      justify-content: center !important;
    }

    #posterArea.ps-social-poster .ps-footer-call {
      font-size: 13.5px !important;
      margin-bottom: 7px !important;
    }

    #posterArea.ps-social-poster .ps-footer-divider {
      width: 76% !important;
      margin-bottom: 9px !important;
    }

    #posterArea.ps-social-poster .ps-footer-row {
      gap: 18px !important;
      min-height: 54px !important;
    }

    #posterArea.ps-social-poster .ps-footer-logo {
      width: 55px !important;
      height: 55px !important;
    }

    #posterArea.ps-social-poster .ps-footer-phone-wrap {
      gap: 12px !important;
      min-height: 44px !important;
    }

    #posterArea.ps-social-poster .ps-wa {
      width: 43px !important;
      height: 43px !important;
      flex-basis: 43px !important;
    }

    #posterArea.ps-social-poster .ps-wa svg {
      width: 24px !important;
      height: 24px !important;
    }

    #posterArea.ps-social-poster .ps-footer-phone {
      font-size: 29px !important;
      line-height: 43px !important;
      min-height: 43px !important;
    }

    #posterArea.ps-social-poster .ps-footer-bottom {
      font-size: 13.5px !important;
      margin-top: 7px !important;
    }


    /* ================================================================
       v102 — JPG 4:5 final, alinhado à referência visual aprovada.
       A matriz social é sempre 800x1000, em desktop e mobile.
       ================================================================ */

    #posterArea.ps-social-poster {
      width: 800px !important;
      height: 1000px !important;
      min-width: 800px !important;
      max-width: 800px !important;
      min-height: 1000px !important;
      max-height: 1000px !important;
      grid-template-rows: 175px 625px 200px !important;
    }

    /* Cabeçalho determinístico: nada depende de line-height/flex no mobile. */
    #posterArea.ps-social-poster .ps-poster-header {
      position: relative !important;
      display: block !important;
      height: 175px !important;
      min-height: 175px !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #ef1717 !important;
    }

    #posterArea.ps-social-poster .ps-poster-title {
      position: absolute !important;
      z-index: 5 !important;
      left: 0 !important;
      right: 0 !important;
      top: 31px !important;
      height: 64px !important;
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #ffffff !important;
      background: #ef1717 !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      font-size: 62px !important;
      line-height: 64px !important;
      font-weight: 900 !important;
      letter-spacing: .2px !important;
      text-transform: uppercase !important;
      transform: none !important;
    }

    /* Primeira linha fica fisicamente ABAIXO do título. */
    #posterArea.ps-social-poster .ps-header-line {
      position: absolute !important;
      left: 12% !important;
      width: 76% !important;
      height: 2px !important;
      min-height: 2px !important;
      margin: 0 !important;
      padding: 0 !important;
      background: rgba(255,255,255,.98) !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      transform: none !important;
    }

    #posterArea.ps-social-poster .ps-header-line:nth-of-type(1) {
      top: 112px !important;
    }

    #posterArea.ps-social-poster .ps-poster-date {
      position: absolute !important;
      z-index: 5 !important;
      left: 12% !important;
      width: 76% !important;
      top: 119px !important;
      height: 27px !important;
      margin: 0 !important;
      padding: 0 10px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #ffffff !important;
      background: #ef1717 !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      font-size: 17px !important;
      line-height: 27px !important;
      font-weight: 900 !important;
      letter-spacing: .55px !important;
      text-transform: uppercase !important;
      box-sizing: border-box !important;
      transform: none !important;
    }

    #posterArea.ps-social-poster .ps-header-line:nth-of-type(2) {
      top: 151px !important;
    }

    #posterArea.ps-social-poster .ps-poster-title::before,
    #posterArea.ps-social-poster .ps-poster-title::after,
    #posterArea.ps-social-poster .ps-poster-date::before,
    #posterArea.ps-social-poster .ps-poster-date::after {
      content: none !important;
      display: none !important;
    }

    /* Corpo: foto maior e mais próxima do cabeçalho, como na referência. */
    #posterArea.ps-social-poster .ps-poster-body {
      height: 625px !important;
      min-height: 625px !important;
      padding: 28px 20px 22px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-poster-center {
      width: 760px !important;
      max-width: 760px !important;
      height: 575px !important;
      display: grid !important;
      grid-template-columns: 456px 276px !important;
      column-gap: 28px !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-photo-shell {
      width: 456px !important;
      height: 570px !important;
      aspect-ratio: auto !important;
      border: 2px solid #d5d8de !important;
      border-radius: 13px !important;
      overflow: hidden !important;
      background: #ffffff !important;
      box-shadow: none !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-photo-shell img {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      object-fit: contain !important;
      object-position: center center !important;
      background: #ffffff !important;
      display: block !important;
    }

    /* Coluna começa mais alto, como na referência; não fica verticalmente centrada. */
    #posterArea.ps-social-poster .ps-info-column {
      width: 276px !important;
      min-width: 0 !important;
      align-self: start !important;
      padding: 46px 0 0 !important;
      margin: 0 !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-pet-name {
      font-size: 31px !important;
      line-height: 1.01 !important;
      margin: 0 0 12px !important;
      color: #ef1717 !important;
      font-weight: 900 !important;
      overflow-wrap: anywhere !important;
    }

    #posterArea.ps-social-poster .ps-info-box {
      width: 100% !important;
      padding: 8px 10px 7px !important;
      margin: 0 0 8px !important;
      border-radius: 10px !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-info-label {
      font-size: 10px !important;
      line-height: 1.1 !important;
      margin-bottom: 4px !important;
    }

    #posterArea.ps-social-poster .ps-info-value {
      font-size: 13px !important;
      line-height: 1.28 !important;
    }

    #posterArea.ps-social-poster .ps-observation {
      padding-top: 10px !important;
      padding-bottom: 10px !important;
    }

    #posterArea.ps-social-poster .ps-last-seen {
      margin-top: 10px !important;
      padding-top: 13px !important;
      border-top: 4px solid #ef1717 !important;
    }

    #posterArea.ps-social-poster .ps-last-title {
      font-size: 11px !important;
      margin-bottom: 7px !important;
    }

    #posterArea.ps-social-poster .ps-last-text {
      font-size: 12.5px !important;
      line-height: 1.42 !important;
    }

    /* Rodapé mais alto e com hierarquia equivalente à referência. */
    #posterArea.ps-social-poster .ps-poster-footer {
      height: 200px !important;
      min-height: 200px !important;
      padding: 21px 28px 17px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: center !important;
      align-items: center !important;
      background: #ef1717 !important;
      box-sizing: border-box !important;
    }

    #posterArea.ps-social-poster .ps-footer-call {
      font-size: 14px !important;
      line-height: 1.15 !important;
      font-weight: 900 !important;
      margin: 0 0 8px !important;
    }

    #posterArea.ps-social-poster .ps-footer-divider {
      width: 76% !important;
      height: 2px !important;
      margin: 0 auto 12px !important;
    }

    #posterArea.ps-social-poster .ps-footer-row {
      width: 100% !important;
      min-height: 62px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 20px !important;
    }

    #posterArea.ps-social-poster .ps-footer-logo {
      width: 61px !important;
      height: 61px !important;
      padding: 3px !important;
      border-radius: 8px !important;
      flex: 0 0 61px !important;
    }

    #posterArea.ps-social-poster .ps-footer-phone-wrap {
      min-height: 52px !important;
      gap: 13px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    #posterArea.ps-social-poster .ps-wa {
      width: 49px !important;
      height: 49px !important;
      flex: 0 0 49px !important;
      border-width: 3px !important;
    }

    #posterArea.ps-social-poster .ps-wa svg {
      width: 27px !important;
      height: 27px !important;
    }

    #posterArea.ps-social-poster .ps-footer-phone {
      min-height: 49px !important;
      font-size: 32px !important;
      line-height: 49px !important;
      font-weight: 900 !important;
    }

    #posterArea.ps-social-poster .ps-footer-bottom {
      font-size: 14px !important;
      line-height: 1.15 !important;
      margin-top: 9px !important;
      font-weight: 900 !important;
    }



    /* ================================================================
       v103 — JPG 4:5 final
       - sem linhas no cabeçalho
       - cantos externos arredondados
       - visual igual à referência aprovada
       ================================================================ */

    #posterArea.ps-social-poster {
      border-radius: 26px !important;
      overflow: hidden !important;
      background: #ffffff !important;
      box-shadow: none !important;
    }

    #posterArea.ps-social-poster .ps-poster-header {
      height: 175px !important;
      min-height: 175px !important;
      position: relative !important;
      display: block !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #ef1717 !important;
      border-top-left-radius: 26px !important;
      border-top-right-radius: 26px !important;
    }

    #posterArea.ps-social-poster .ps-poster-title {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      top: 34px !important;
      height: 66px !important;
      margin: 0 !important;
      padding: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #ef1717 !important;
      color: #ffffff !important;
      font-size: 62px !important;
      line-height: 66px !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: .15px !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      transform: none !important;
      z-index: 4 !important;
    }

    #posterArea.ps-social-poster .ps-poster-date {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      top: 110px !important;
      width: 100% !important;
      height: 31px !important;
      margin: 0 !important;
      padding: 0 20px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #ef1717 !important;
      color: #ffffff !important;
      font-size: 18px !important;
      line-height: 31px !important;
      font-weight: 900 !important;
      letter-spacing: .55px !important;
      text-transform: uppercase !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      box-sizing: border-box !important;
      transform: none !important;
      z-index: 4 !important;
    }

    /* Remove completamente quaisquer linhas herdadas do v101/v102. */
    #posterArea.ps-social-poster .ps-header-line {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    #posterArea.ps-social-poster .ps-poster-title::before,
    #posterArea.ps-social-poster .ps-poster-title::after,
    #posterArea.ps-social-poster .ps-poster-date::before,
    #posterArea.ps-social-poster .ps-poster-date::after {
      content: none !important;
      display: none !important;
    }

    #posterArea.ps-social-poster .ps-poster-body {
      background: #ffffff !important;
    }

    #posterArea.ps-social-poster .ps-photo-shell {
      border-radius: 18px !important;
      overflow: hidden !important;
    }

    #posterArea.ps-social-poster .ps-poster-footer {
      border-bottom-left-radius: 26px !important;
      border-bottom-right-radius: 26px !important;
      overflow: hidden !important;
    }

    /* A pré-visualização também respeita os cantos arredondados. */
    #posterArea.ps-social-poster,
    #posterArea.ps-social-poster * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }



    /* ================================================================
       v104 — Correção Safari iPhone SE / html2canvas
       Evita corte na parte inferior de "PROCURA-SE".
       ================================================================ */

    #posterArea.ps-social-poster .ps-poster-title {
      top: 27px !important;
      height: 82px !important;
      min-height: 82px !important;
      line-height: 1.08 !important;
      padding: 5px 0 9px !important;
      box-sizing: border-box !important;
      overflow: visible !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 60px !important;
      font-family: Arial, Helvetica, sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: geometricPrecision !important;
    }

    #posterArea.ps-social-poster .ps-poster-date {
      top: 116px !important;
      height: 31px !important;
      line-height: 31px !important;
    }

    /* Evita clipping imposto por wrappers durante a captura do canvas. */
    #posterArea.ps-social-poster .ps-poster-header {
      overflow: hidden !important;
    }

    #posterArea.ps-social-poster .ps-poster-title span,
    #posterArea.ps-social-poster .ps-poster-title strong {
      line-height: inherit !important;
      padding-bottom: 3px !important;
    }

    /* Safari mobile costuma calcular bounding boxes de texto com 1–3 px a menos.
       Este transform óptico move o texto levemente para cima sem alterar o layout. */
    @supports (-webkit-touch-callout: none) {
      #posterArea.ps-social-poster .ps-poster-title {
        padding-bottom: 12px !important;
      }
    }


    /* Pequenos ajustes proporcionais para o A4, mantendo exatamente a mesma aparência. */
    #posterArea.ps-a4-poster .ps-poster-body {
      padding-top: 32px;
      padding-bottom: 28px;
    }

    #posterArea.ps-a4-poster .ps-poster-center {
      grid-template-columns: minmax(0, 64%) minmax(0, 36%);
      gap: 28px;
    }

    #posterArea.ps-a4-poster .ps-photo-shell {
      width: 100%;
    }

    #posterArea.ps-a4-poster .ps-pet-name {
      font-size: 35px;
    }


    /* ================================================================
       v105 — PDF A4
       Cabeçalho limpo + nome do pet sempre em uma linha.
       Estas regras NÃO alteram o JPG social.
       ================================================================ */

    #posterArea.ps-a4-poster .ps-poster-header {
      position: relative !important;
      display: block !important;
      overflow: hidden !important;
      padding: 0 !important;
      background: #ef1717 !important;
    }

    #posterArea.ps-a4-poster .ps-poster-title {
      position: absolute !important;
      z-index: 5 !important;
      left: 0 !important;
      right: 0 !important;
      top: 38px !important;
      height: 82px !important;
      min-height: 82px !important;
      margin: 0 !important;
      padding: 5px 0 9px !important;
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #ffffff !important;
      background: #ef1717 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 60px !important;
      line-height: 1.08 !important;
      font-weight: 900 !important;
      letter-spacing: .2px !important;
      text-transform: uppercase !important;
      white-space: nowrap !important;
      overflow: visible !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      transform: none !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: geometricPrecision !important;
    }

    #posterArea.ps-a4-poster .ps-poster-date {
      position: absolute !important;
      z-index: 5 !important;
      left: 0 !important;
      right: 0 !important;
      top: 126px !important;
      width: 100% !important;
      height: 32px !important;
      min-height: 32px !important;
      margin: 0 !important;
      padding: 0 18px !important;
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #ffffff !important;
      background: #ef1717 !important;
      font-family: Arial, Helvetica, sans-serif !important;
      font-size: 17px !important;
      line-height: 32px !important;
      font-weight: 900 !important;
      letter-spacing: .55px !important;
      text-transform: uppercase !important;
      white-space: nowrap !important;
      border: 0 !important;
      border-top: 0 !important;
      border-bottom: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      text-decoration: none !important;
      transform: none !important;
    }

    /* Nenhuma linha decorativa no cabeçalho do PDF. */
    #posterArea.ps-a4-poster .ps-header-line {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    #posterArea.ps-a4-poster .ps-poster-title::before,
    #posterArea.ps-a4-poster .ps-poster-title::after,
    #posterArea.ps-a4-poster .ps-poster-date::before,
    #posterArea.ps-a4-poster .ps-poster-date::after {
      content: none !important;
      display: none !important;
    }

    #posterArea.ps-a4-poster .ps-pet-name {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
      white-space: nowrap !important;
      overflow: visible !important;
      overflow-wrap: normal !important;
      word-break: normal !important;
      hyphens: none !important;
      text-overflow: clip !important;
      font-family: Arial, Helvetica, sans-serif !important;
      line-height: 1.05 !important;
    }



    /* ================================================================
       v106 — Coluna de informações +2pt
       Aplicado ao JPG 4:5 e ao PDF A4.
       ================================================================ */

    #posterArea .ps-info-label {
      font-size: 12px !important;
    }

    #posterArea .ps-info-value {
      font-size: 15px !important;
    }

    #posterArea .ps-observation,
    #posterArea .ps-observation .ps-info-value {
      font-size: 15px !important;
      line-height: 1.30 !important;
    }

    #posterArea .ps-last-title {
      font-size: 13px !important;
    }

    #posterArea .ps-last-text {
      font-size: 14.5px !important;
      line-height: 1.42 !important;
    }

    /* No A4, mantém o mesmo ganho visual de aproximadamente 2pt. */
    #posterArea.ps-a4-poster .ps-info-label {
      font-size: 13px !important;
    }

    #posterArea.ps-a4-poster .ps-info-value {
      font-size: 16px !important;
    }

    #posterArea.ps-a4-poster .ps-observation,
    #posterArea.ps-a4-poster .ps-observation .ps-info-value {
      font-size: 16px !important;
      line-height: 1.30 !important;
    }

    #posterArea.ps-a4-poster .ps-last-title {
      font-size: 14px !important;
    }

    #posterArea.ps-a4-poster .ps-last-text {
      font-size: 15.5px !important;
      line-height: 1.42 !important;
    }


    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }

      html, body {
        width: 210mm !important;
        height: 297mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }

      body * {
        visibility: hidden !important;
      }

      #posterArea,
      #posterArea * {
        visibility: visible !important;
      }

      #posterArea.ps-a4-poster {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        max-width: none !important;
        min-width: 0 !important;
        min-height: 0 !important;
        margin: 0 !important;
        transform: none !important;
        page-break-after: avoid !important;
        break-after: avoid-page !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  `;
  document.head.appendChild(style);
}

function buildUnifiedPoster(pet, format = "social") {
  const posterArea = document.getElementById("posterArea");
  if (!posterArea || !pet) return;

  ensureUnifiedPosterStyles();

  const photo = getPetPhoto(pet);
  const logoSrc = getPosterLogoSource();
  const name = escapePetHtml(pet.name || "PET");
  const age = escapePetHtml(pet.age || "Não informada");
  const color = escapePetHtml(pet.color || "Não especificada");
  const breed = escapePetHtml(pet.breed || "Não informada");
  const observations = escapePetHtml(pet.description || "Sem observações adicionais.");
  const addressText = [pet.address, pet.city, pet.state].filter(Boolean).join(", ");
  const lastSeen = escapePetHtml(
    `${pet.name || "O pet"} foi visto pela última vez em ${addressText || "local não informado"}. Por favor, se tiver qualquer informação, entre em contato imediatamente!`
  );
  const phone = escapePetHtml(pet.contactPhone || "Telefone não informado");
  const dateText = escapePetHtml(getFormattedPosterDate(pet.date));

  const normalizedFormat = format === "a4" ? "a4" : "social";
  posterArea.dataset.posterFormat = normalizedFormat;
  posterArea.className = normalizedFormat === "a4" ? "ps-a4-poster" : "ps-social-poster";

  posterArea.innerHTML = `
    <section class="ps-poster-header">
      <div class="ps-poster-title">PROCURA-SE</div>
      <div class="ps-header-line" aria-hidden="true"></div>
      <div class="ps-poster-date">${dateText}</div>
      <div class="ps-header-line" aria-hidden="true"></div>
    </section>

    <section class="ps-poster-body">
      <div class="ps-poster-center">
        <div class="ps-photo-shell">
          <img id="posterImg"
               src="${escapePetHtml(photo)}"
               alt="${name}"
               onerror="this.onerror=null;this.src=getRandomDefaultPhoto('${escapePetHtml(pet.species || "Cachorro")}');">
        </div>

        <div class="ps-info-column">
          <h2 id="posterPetName" class="ps-pet-name">${name}</h2>

          <div class="ps-info-box">
            <div class="ps-info-label">Idade</div>
            <div id="posterAge" class="ps-info-value">${age}</div>
          </div>

          <div class="ps-info-box">
            <div class="ps-info-label">Cor predominante</div>
            <div id="posterColor" class="ps-info-value">${color}</div>
          </div>

          <div class="ps-info-box">
            <div class="ps-info-label">Raça / Porte</div>
            <div id="posterBreed" class="ps-info-value">${breed}</div>
          </div>

          <div class="ps-info-box ps-observation">
            <div class="ps-info-value">⚠️ <strong style="color:#ef1717">Observações:</strong> <span id="posterMarkings">${observations}</span></div>
          </div>

          <div class="ps-last-seen">
            <div class="ps-last-title">Último local avistado:</div>
            <div id="posterDesc" class="ps-last-text">${lastSeen}</div>
          </div>
        </div>
      </div>
    </section>

    <footer class="ps-poster-footer">
      <div class="ps-footer-call">Se viu ou tem qualquer informação, entre em contato imediatamente:</div>
      <div class="ps-footer-divider"></div>
      <div class="ps-footer-row">
        ${logoSrc ? `<img class="ps-footer-logo" src="${escapePetHtml(logoSrc)}" alt="Pet Searchers">` : ""}
        <div class="ps-footer-phone-wrap">
          <span class="ps-wa" aria-hidden="true">
            <svg viewBox="0 0 24 24" role="img" focusable="false">
              <path fill="#ffffff" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2Z"/>
            </svg>
          </span>
          <span id="posterContactPhone" class="ps-footer-phone">${phone}</span>
        </div>
      </div>
      <div class="ps-footer-bottom">A sua informação pode fazer toda a diferença! 🐾</div>
    </footer>
  `;

  // Mantém nomes longos em uma linha também na pré-visualização.
  requestAnimationFrame(() => fitPosterPetNameSingleLine(posterArea, normalizedFormat));
}

function applyPosterLayoutAdjustments() {
  const pet = petsData.find(p => p.id === currentPosterPetId);
  if (pet) buildUnifiedPoster(pet, "social");
}


function resetPosterPreviewScale() {
  const posterArea = document.getElementById("posterArea");
  if (!posterArea) return;
  posterArea.style.zoom = "1";
  posterArea.style.marginLeft = "auto";
  posterArea.style.marginRight = "auto";
}

function fitPosterPreviewInModal() {
  const posterArea = document.getElementById("posterArea");
  const posterModal = document.getElementById("posterModal");
  if (!posterArea || !posterModal) return;

  const modalCard = posterModal.firstElementChild || posterModal;
  const isA4 = posterArea.dataset.posterFormat === "a4";
  const baseWidth = isA4 ? 794 : 800;
  const baseHeight = isA4 ? 1123 : 1000;

  posterArea.style.zoom = "1";
  posterArea.style.marginLeft = "auto";
  posterArea.style.marginRight = "auto";

  requestAnimationFrame(() => {
    const vv = window.visualViewport;
    const viewportWidth = vv?.width || window.innerWidth || 390;
    const viewportHeight = vv?.height || window.innerHeight || 700;

    const cardRect = modalCard.getBoundingClientRect();
    const posterRect = posterArea.getBoundingClientRect();

    const sideSafe = viewportWidth <= 430 ? 22 : 36;
    const availableWidth = Math.max(
      220,
      Math.min(
        viewportWidth - sideSafe,
        (modalCard.clientWidth || cardRect.width || viewportWidth) - 24
      )
    );

    const controlsHeight = Math.max(0, posterRect.top - cardRect.top);
    const availableHeight = Math.max(
      240,
      viewportHeight
        - Math.max(cardRect.top, 0)
        - controlsHeight
        - Math.max(24, vv?.offsetTop || 0)
        - 24
    );

    const scaleByWidth = availableWidth / baseWidth;
    const scaleByHeight = availableHeight / baseHeight;
    const scale = Math.max(0.18, Math.min(1, scaleByWidth, scaleByHeight));

    posterArea.style.zoom = String(scale);
    posterArea.style.marginLeft = "auto";
    posterArea.style.marginRight = "auto";

    if (posterArea.parentElement) {
      posterArea.parentElement.style.width = "100%";
      posterArea.parentElement.style.maxWidth = "100%";
      posterArea.parentElement.style.overflow = "hidden";
      posterArea.parentElement.style.textAlign = "center";
      posterArea.parentElement.style.boxSizing = "border-box";
    }

    try {
      modalCard.scrollTo({ top: 0, left: 0, behavior: "auto" });
      posterModal.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (_) {
      modalCard.scrollTop = 0;
      posterModal.scrollTop = 0;
    }
  });
}

function generatePosterModal(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (!pet) return;

  currentPosterPetId = petId;
  buildUnifiedPoster(pet, "social");

  const posterModal = document.getElementById("posterModal");
  if (posterModal) {
    posterModal.classList.remove("hidden");
    try {
      posterModal.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (_) {
      posterModal.scrollTop = 0;
    }
    setTimeout(fitPosterPreviewInModal, 90);
  }
}

window.addEventListener("resize", () => {
  const posterModal = document.getElementById("posterModal");
  if (posterModal && !posterModal.classList.contains("hidden")) {
    fitPosterPreviewInModal();
  }
});


function sanitizePosterFileName(name) {
  return String(name || "pet")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "pet";
}

function getCurrentPosterFileBase() {
  const pet = petsData.find(p => p.id === currentPosterPetId);
  const petName = pet?.name || document.getElementById("posterPetName")?.textContent || "pet";
  return `cartaz_procura_se_${sanitizePosterFileName(petName)}`;
}


function createPosterExportClone(format = "social") {
  const posterArea = document.getElementById("posterArea");
  if (!posterArea) return null;

  const isA4 = format === "a4";
  const width = isA4 ? 794 : 800;
  const height = isA4 ? 1123 : 1000;

  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.position = "fixed";
  holder.style.left = "-10000px";
  holder.style.top = "0";
  holder.style.width = `${width}px`;
  holder.style.height = `${height}px`;
  holder.style.overflow = "hidden";
  holder.style.pointerEvents = "none";
  holder.style.opacity = "0";
  holder.style.zIndex = "-1";
  holder.style.background = "#ffffff";

  const clone = posterArea.cloneNode(true);
  clone.removeAttribute("style");
  clone.style.zoom = "1";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.minHeight = `${height}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";

  holder.appendChild(clone);
  document.body.appendChild(holder);

  return {
    element: clone,
    width,
    height,
    cleanup: () => holder.remove()
  };
}


function fitPosterPetNameSingleLine(root, format = "social") {
  const nameEl = root?.querySelector("#posterPetName");
  if (!nameEl) return;

  const isA4 = format === "a4";
  const startSize = isA4 ? 35 : 31;
  const minSize = isA4 ? 18 : 17;

  nameEl.style.setProperty("white-space", "nowrap", "important");
  nameEl.style.setProperty("overflow-wrap", "normal", "important");
  nameEl.style.setProperty("word-break", "normal", "important");
  nameEl.style.setProperty("hyphens", "none", "important");
  nameEl.style.setProperty("width", "100%", "important");
  nameEl.style.setProperty("max-width", "100%", "important");
  nameEl.style.setProperty("font-size", `${startSize}px`, "important");

  // Force layout before measuring.
  void nameEl.offsetWidth;

  let size = startSize;
  const available = Math.max(1, nameEl.clientWidth - 2);

  while (size > minSize && nameEl.scrollWidth > available) {
    size -= 1;
    nameEl.style.setProperty("font-size", `${size}px`, "important");
    void nameEl.offsetWidth;
  }

  // Last safety margin for Safari/Chrome PDF rasterization.
  if (nameEl.scrollWidth > available && size > minSize) {
    size = minSize;
    nameEl.style.setProperty("font-size", `${size}px`, "important");
  }
}

async function lockPosterPhotoAspectRatioForExport(root) {
  const img = root?.querySelector("#posterImg");
  const shell = img?.closest(".ps-photo-shell");
  if (!img || !shell) return;

  // Aguarda a dimensão natural real da fotografia.
  if (!img.complete || !img.naturalWidth || !img.naturalHeight) {
    await new Promise(resolve => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      setTimeout(done, 1800);
    });
  }

  const naturalWidth = img.naturalWidth || 1;
  const naturalHeight = img.naturalHeight || 1;
  const shellWidth = shell.clientWidth || shell.getBoundingClientRect().width || 1;
  const shellHeight = shell.clientHeight || shell.getBoundingClientRect().height || 1;

  // Matemática de contain: encosta primeiro na borda mais próxima,
  // sem recortar, esticar ou alterar a proporção original.
  const containScale = Math.min(shellWidth / naturalWidth, shellHeight / naturalHeight);
  const fittedWidth = Math.max(1, naturalWidth * containScale);
  const fittedHeight = Math.max(1, naturalHeight * containScale);

  shell.style.display = "flex";
  shell.style.alignItems = "center";
  shell.style.justifyContent = "center";
  shell.style.overflow = "hidden";
  shell.style.background = "#ffffff";

  // Dimensões explícitas são usadas na exportação para que o html2canvas
  // não precise interpretar object-fit. Isso elimina a distorção no JPG/PDF.
  img.style.setProperty("width", `${fittedWidth}px`, "important");
  img.style.setProperty("height", `${fittedHeight}px`, "important");
  img.style.setProperty("max-width", "none", "important");
  img.style.setProperty("max-height", "none", "important");
  img.style.setProperty("min-width", "0", "important");
  img.style.setProperty("min-height", "0", "important");
  img.style.setProperty("object-fit", "fill", "important");
  img.style.setProperty("object-position", "center", "important");
  img.style.setProperty("flex", "0 0 auto", "important");
  img.style.setProperty("display", "block", "important");
  img.style.setProperty("margin", "0", "important");
  img.style.setProperty("transform", "none", "important");
}

async function renderPosterExportCanvas(format = "social") {
  if (typeof html2canvas === "undefined") {
    throw new Error("Biblioteca html2canvas não foi carregada.");
  }

  const pet = petsData.find(p => p.id === currentPosterPetId);
  if (!pet) throw new Error("Pet do cartaz não encontrado.");

  const posterArea = document.getElementById("posterArea");
  const previousFormat = posterArea?.dataset.posterFormat === "a4" ? "a4" : "social";

  // Monta o formato solicitado, clona e imediatamente devolve a prévia ao formato anterior.
  buildUnifiedPoster(pet, format);
  const exportClone = createPosterExportClone(format);
  buildUnifiedPoster(pet, previousFormat);

  if (!exportClone) throw new Error("Área do cartaz não encontrada.");

  try {
    const images = Array.from(exportClone.element.querySelectorAll("img"));
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 1200);
      });
    }));

    // Ajusta nomes longos para permanecerem em uma única linha.
    fitPosterPetNameSingleLine(exportClone.element, format);

    // Trava a fotografia nas proporções originais antes da captura.
    await lockPosterPhotoAspectRatioForExport(exportClone.element);

    const isA4 = format === "a4";
    const scale = isA4 ? 2 : 1.35; // social: 800x1000 -> 1080x1350 exatos

    return await html2canvas(exportClone.element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: exportClone.width,
      height: exportClone.height,
      windowWidth: exportClone.width,
      windowHeight: exportClone.height
    });
  } finally {
    exportClone.cleanup();
  }
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Safari precisa que a URL continue válida por alguns segundos
  // enquanto exibe a confirmação nativa de download.
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function isMobileShareEnvironment() {
  const ua = navigator.userAgent || "";
  const mobileUA = /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
  const narrowViewport = Math.min(window.innerWidth || 9999, window.screen?.width || 9999) <= 820;
  return mobileUA || narrowViewport;
}

async function shareOrSavePosterImage(blob, filename) {
  const file = new File([blob], filename, { type: "image/jpeg" });

  // Em iOS/Android, a Web Share API abre a folha nativa do sistema.
  // No iPhone, ela oferece ações como "Salvar Imagem" (Fotos) e
  // compartilhamento para WhatsApp, Mensagens, Mail, AirDrop etc.
  if (
    isMobileShareEnvironment() &&
    navigator.share &&
    (!navigator.canShare || navigator.canShare({ files: [file] }))
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "Cartaz Pet Searchers",
        text: "Cartaz de busca do Pet Searchers"
      });
      return { shared: true, downloaded: false };
    } catch (err) {
      // AbortError = usuário fechou a folha de compartilhamento.
      // Nesse caso não forçamos outro download por cima.
      if (err && err.name === "AbortError") {
        return { shared: false, downloaded: false, cancelled: true };
      }

      console.warn("Compartilhamento nativo indisponível; usando download convencional.", err);
    }
  }

  triggerBlobDownload(blob, filename);
  return { shared: false, downloaded: true };
}


function asciiBytes(value) {
  return new TextEncoder().encode(String(value));
}

function concatUint8Arrays(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach(part => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

async function canvasToJpegBytes(canvas, quality = 0.94) {
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Não foi possível criar a imagem JPEG do PDF.")),
      "image/jpeg",
      quality
    );
  });

  return new Uint8Array(await blob.arrayBuffer());
}

function buildSinglePageA4Pdf(jpegBytes, imageWidth, imageHeight) {
  // A4 em points: 210 × 297 mm.
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const objects = [];

  objects[1] = [
    asciiBytes("1 0 obj\n"),
    asciiBytes("<< /Type /Catalog /Pages 2 0 R >>\n"),
    asciiBytes("endobj\n")
  ];

  objects[2] = [
    asciiBytes("2 0 obj\n"),
    asciiBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n"),
    asciiBytes("endobj\n")
  ];

  objects[3] = [
    asciiBytes("3 0 obj\n"),
    asciiBytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\n`
    ),
    asciiBytes("endobj\n")
  ];

  objects[4] = [
    asciiBytes("4 0 obj\n"),
    asciiBytes(
      `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\n`
    ),
    asciiBytes("stream\n"),
    jpegBytes,
    asciiBytes("\nendstream\nendobj\n")
  ];

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = asciiBytes(content);

  objects[5] = [
    asciiBytes("5 0 obj\n"),
    asciiBytes(`<< /Length ${contentBytes.length} >>\n`),
    asciiBytes("stream\n"),
    contentBytes,
    asciiBytes("endstream\nendobj\n")
  ];

  const header = concatUint8Arrays([
    asciiBytes("%PDF-1.4\n"),
    new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])
  ]);

  const assembled = [header];
  const offsets = [0];
  let byteOffset = header.length;

  for (let i = 1; i <= 5; i++) {
    offsets[i] = byteOffset;
    const objBytes = concatUint8Arrays(objects[i]);
    assembled.push(objBytes);
    byteOffset += objBytes.length;
  }

  const xrefOffset = byteOffset;
  let xref = "xref\n0 6\n";
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  const trailer =
    `${xref}` +
    `trailer\n<< /Size 6 /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;

  assembled.push(asciiBytes(trailer));

  return new Blob(assembled, { type: "application/pdf" });
}

async function downloadPosterPDF() {
  const btn = document.getElementById("btnPrintPoster");
  const originalContent = btn ? btn.innerHTML : "";

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Gerando PDF...';
  }

  try {
    const canvas = await renderPosterExportCanvas("a4");
    const jpegBytes = await canvasToJpegBytes(canvas, 0.94);

    // O PDF é criado localmente, sem CDN e sem jsPDF.
    // Há somente UM objeto /Page e uma única imagem A4.
    const pdfBlob = buildSinglePageA4Pdf(
      jpegBytes,
      canvas.width,
      canvas.height
    );

    triggerBlobDownload(
      pdfBlob,
      `${getCurrentPosterFileBase()}.pdf`
    );
  } catch (err) {
    console.error("Erro ao gerar PDF A4:", err);
    alert("⚠️ Não foi possível gerar o PDF A4. Atualize a página e tente novamente.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalContent;
    }
    setTimeout(fitPosterPreviewInModal, 30);
  }
}

async function downloadPosterJPG() {
  const btnDownload = document.getElementById("btnDownloadPosterJPG");
  const originalContent = btnDownload ? btnDownload.innerHTML : "";

  if (btnDownload) {
    btnDownload.disabled = true;
    btnDownload.innerHTML = '<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> Gerando JPG...';
  }

  try {
    const canvas = await renderPosterExportCanvas("social");

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        result => result ? resolve(result) : reject(new Error("Falha ao criar JPG.")),
        "image/jpeg",
        0.94
      );
    });

    await shareOrSavePosterImage(
      blob,
      `${getCurrentPosterFileBase()}.jpg`
    );
  } catch (err) {
    console.error("Erro ao gerar JPG do cartaz:", err);
    alert("⚠️ Não foi possível gerar a imagem JPG automaticamente.");
  } finally {
    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = originalContent;
    }

    // A prévia nunca é ampliada durante o download, mas recalculamos
    // por segurança em casos de mudança de viewport no Safari.
    setTimeout(fitPosterPreviewInModal, 30);
  }
}

window.addEventListener("beforeprint", () => {
  const pet = petsData.find(p => p.id === currentPosterPetId);
  if (pet) buildUnifiedPoster(pet);
  resetPosterPreviewScale();
});

window.addEventListener("afterprint", () => {
  const pet = petsData.find(p => p.id === currentPosterPetId);
  if (pet) buildUnifiedPoster(pet, "social");
  setTimeout(fitPosterPreviewInModal, 30);
});

// --- DETAIL MODAL ---
function closePetFullDetailModal() {
  const overlay = document.getElementById("petFullDetailOverlay");
  if (overlay) overlay.remove();
}

function openDetailModal(petId) {
  const pet = petsData.find(p => p.id === petId);
  if (!pet) return;

  closePetFullDetailModal();

  const cleanPhone = String(pet.contactPhone || "").replace(/\D/g, "");
  const waMsg = encodeURIComponent(`Olá ${pet.contactName || ""}, vi o anúncio do pet ${pet.name || "pet"} no portal Pet Searchers!`);
  const statusLabel = getDisplayStatusLabel(pet.type);
  const resolved = isResolvedPet(pet);

  const overlay = document.createElement("div");
  overlay.id = "petFullDetailOverlay";
  overlay.className = "fixed inset-0 z-[99999] bg-black/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto";
  overlay.innerHTML = `
    <div class="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden my-auto" role="dialog" aria-modal="true">
      <button type="button" id="btnClosePetFullDetail"
        class="absolute top-3 right-3 z-20 w-10 h-10 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center shadow-lg"
        aria-label="Fechar detalhes">
        <span class="material-symbols-outlined">close</span>
      </button>

      <div class="grid md:grid-cols-[42%_58%]">
        <div class="bg-gray-50 flex items-center justify-center p-3 md:p-5 min-h-[280px]">
          <img src="${escapePetHtml(getPetPhoto(pet))}" alt="${escapePetHtml(pet.name || "Pet")}"
            onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${escapePetHtml(pet.species || "Cachorro")}');"
            class="w-full max-h-[520px] object-contain rounded-2xl bg-white shadow-sm border border-gray-100"/>
        </div>

        <div class="p-5 sm:p-7 overflow-y-auto max-h-[86vh]">
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <span class="px-3 py-1 rounded-full text-xs font-extrabold text-white ${pet.type === "Procurado" ? "bg-[#E52421]" : (resolved ? "bg-green-600" : "bg-sky-500")}">${escapePetHtml(statusLabel)}</span>
            ${resolved ? '<span class="px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Reencontrado 🎉</span>' : ''}
          </div>

          <h2 class="text-2xl sm:text-3xl font-extrabold text-primary leading-tight">${escapePetHtml(pet.name || "Pet sem nome")}</h2>
          <p class="mt-1 text-sm text-gray-600 font-semibold">${escapePetHtml(pet.species || "")} • ${escapePetHtml(pet.breed || "Raça não informada")}</p>

          <div class="grid sm:grid-cols-2 gap-3 mt-5 text-sm">
            <div class="rounded-2xl bg-gray-50 p-3 border border-gray-100"><b>Cor:</b><br>${escapePetHtml(pet.color || "Não informada")}</div>
            <div class="rounded-2xl bg-gray-50 p-3 border border-gray-100"><b>Idade:</b><br>${escapePetHtml(pet.age || "Não informada")}</div>
            <div class="rounded-2xl bg-gray-50 p-3 border border-gray-100"><b>Sexo:</b><br>${escapePetHtml(pet.gender || "Não informado")}</div>
            <div class="rounded-2xl bg-gray-50 p-3 border border-gray-100"><b>Data do registro:</b><br>${escapePetHtml(formatDate(pet.date))}</div>
          </div>

          <div class="mt-4 rounded-2xl bg-blue-50/60 p-4 border border-blue-100 text-sm">
            <div class="font-extrabold text-primary flex items-center gap-1"><span class="material-symbols-outlined text-base">location_on</span> Localização</div>
            <div class="mt-1">${escapePetHtml(pet.address || "Endereço não informado")}</div>
            <div>${escapePetHtml(pet.city || "")}${pet.city && pet.state ? " - " : ""}${escapePetHtml(pet.state || "")}</div>
          </div>

          <div class="mt-4">
            <div class="font-extrabold text-primary text-sm">Descrição / características</div>
            <p class="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapePetHtml(pet.description || "Sem observações adicionais.")}</p>
          </div>

          <div class="mt-4 rounded-2xl bg-emerald-50/70 p-4 border border-emerald-100 text-sm">
            <div><b>Responsável:</b> ${escapePetHtml(pet.contactName || "Não informado")}</div>
            <div class="mt-1"><b>Telefone:</b> ${escapePetHtml(pet.contactPhone || "Não informado")}</div>
          </div>

          <div class="grid sm:grid-cols-3 gap-2 mt-5">
            <button type="button" onclick="closePetFullDetailModal(); focusPetOnMap('${escapePetHtml(pet.id)}')" class="py-3 px-4 rounded-xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-base">map</span> Ver no mapa
            </button>
            <a href="https://wa.me/55${cleanPhone}?text=${waMsg}" target="_blank" rel="noopener noreferrer" class="py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-1.5 no-underline">
              <span class="material-symbols-outlined text-base">chat</span> WhatsApp
            </a>
            ${pet.type === "Procurado" ? `
              <button type="button" onclick="closePetFullDetailModal(); generatePosterModal('${escapePetHtml(pet.id)}')" class="py-3 px-4 rounded-xl bg-red-50 text-[#E52421] border border-red-200 font-bold text-sm flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-base">print</span> Cartaz
              </button>` : `
              <button type="button" onclick="applyStatusFilterFromLegend('Reencontrado'); closePetFullDetailModal();" class="py-3 px-4 rounded-xl bg-green-50 text-green-700 border border-green-200 font-bold text-sm flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-base">filter_alt</span> Reencontrados
              </button>`}
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById("btnClosePetFullDetail")?.addEventListener("click", closePetFullDetailModal);
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closePetFullDetailModal();
  });
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closePetFullDetailModal();
});

window.openDetailModal = openDetailModal;
window.closePetFullDetailModal = closePetFullDetailModal;

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

  btnOpenAdmin?.addEventListener("click", () => {
    if (isAdminAuthenticated) {
      openAdminDashboard();
    } else {
      adminLoginModal?.classList.remove("hidden");
    }
  });

  btnCloseAdminLogin?.addEventListener("click", () => adminLoginModal?.classList.add("hidden"));
  btnCloseAdminDashboard?.addEventListener("click", () => adminDashboardModal?.classList.add("hidden"));

  btnAdminChangePassword?.addEventListener("click", () => {
    adminChangePasswordForm?.reset();
    adminChangePasswordModal?.classList.remove("hidden");
  });

  btnCloseAdminChangePassword?.addEventListener("click", () => adminChangePasswordModal?.classList.add("hidden"));
  btnCancelChangePassword?.addEventListener("click", () => adminChangePasswordModal?.classList.add("hidden"));

  adminLoginForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const enteredPassword = document.getElementById("iptAdminPassword")?.value;
    const currentMasterPassword = getAdminPassword();

    if (enteredPassword === currentMasterPassword) {
      isAdminAuthenticated = true;
      adminLoginModal?.classList.add("hidden");
      const iptP = document.getElementById("iptAdminPassword");
      if (iptP) iptP.value = "";
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

  const kpiTotal = document.getElementById("kpiTotalPets");
  if (kpiTotal) kpiTotal.textContent = total;
  const kpiLost = document.getElementById("kpiLostPets");
  if (kpiLost) kpiLost.textContent = lostCount;
  const kpiSighted = document.getElementById("kpiSightedPets");
  if (kpiSighted) kpiSighted.textContent = sightedCount;
  const kpiResolved = document.getElementById("kpiResolvedPets");
  if (kpiResolved) kpiResolved.textContent = resolvedCount;
  const kpiExpiring = document.getElementById("kpiExpiringPets");
  if (kpiExpiring) kpiExpiring.textContent = expiringCount;

  const searchInput = document.getElementById("adminSearchInput");
  const statusSelect = document.getElementById("adminStatusFilter");
  const searchQuery = searchInput ? (searchInput.value || "").toLowerCase().trim() : "";
  const statusFilter = statusSelect ? (statusSelect.value || "") : "";

  const filtered = petsData.filter(pet => {
    if (!pet) return false;
    if (searchQuery) {
      const nameStr = (pet.name || "").toLowerCase();
      const contactNameStr = (pet.contactName || "").toLowerCase();
      const phoneStr = (pet.contactPhone || "").toLowerCase();
      const cityStr = (pet.city || "").toLowerCase();
      const breedStr = (pet.breed || "").toLowerCase();
      const colorStr = (pet.color || "").toLowerCase();
      const descStr = (pet.description || "").toLowerCase();

      const match = nameStr.includes(searchQuery) ||
                    contactNameStr.includes(searchQuery) ||
                    phoneStr.includes(searchQuery) ||
                    cityStr.includes(searchQuery) ||
                    breedStr.includes(searchQuery) ||
                    colorStr.includes(searchQuery) ||
                    descStr.includes(searchQuery);
      if (!match) return false;
    }

    if (statusFilter && pet.type !== statusFilter && !(statusFilter === "Expiring" && pet.isRenewalWindow)) {
      return false;
    }

    return true;
  });

  const tbody = document.getElementById("adminTableBody");
  const mobileList = document.getElementById("adminMobileList");

  if (filtered.length === 0) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-gray-500 font-medium">Nenhum registro encontrado.</td></tr>`;
    if (mobileList) mobileList.innerHTML = `<div class="p-6 text-center text-gray-500 font-medium text-xs">Nenhum registro encontrado.</div>`;
    return;
  }

  if (tbody) {
    tbody.innerHTML = filtered.map(pet => createAdminTableRowHtml(pet)).join("");
  }

  if (mobileList) {
    mobileList.innerHTML = filtered.map(pet => createAdminMobileCardHtml(pet)).join("");
  }
}

function createAdminTableRowHtml(pet) {
  let statusPill = `<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">Avistado</span>`;
  
  if (pet.type === "Procurado") {
    statusPill = `<span class="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">Procurado</span>`;
  } else if (pet.type === "Encontrado pelo dono") {
    statusPill = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🟢 Pet Encontrado</span>`;
  } else if (pet.type === "Dono encontrado") {
    statusPill = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🟢 Dono encontrado</span>`;
  }

  let validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">🟢 Ativo (${pet.daysRemaining !== undefined ? pet.daysRemaining : 30}d)</span>`;
  if (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado") {
    validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold">🎉 Reencontrado</span>`;
  } else if (pet.isRenewalWindow) {
    validityBadge = `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">⚠️ Requer Renovação (${pet.daysRemaining !== undefined ? pet.daysRemaining : 30}d)</span>`;
  }

  return `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="p-3">
        <div class="flex items-center gap-2">
          <img src="${getPetPhoto(pet)}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-9 h-9 rounded-lg object-cover border"/>
          <div>
            <span class="font-bold text-primary block">${pet.name}</span>
            <span class="text-[10px] text-gray-500">${pet.species} • ${pet.breed}</span>
          </div>
        </div>
      </td>
      <td class="p-3">${statusPill}</td>
      <td class="p-3 font-medium">${pet.city || ''} - ${pet.state || ''}</td>
      <td class="p-3">
        <span class="block font-medium">${pet.contactName || ''}</span>
        <span class="text-[10px] text-gray-500">${pet.contactPhone || ''}</span>
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
            <option value="Encontrado pelo dono" ${pet.type === 'Encontrado pelo dono' ? 'selected' : ''}>🟢 Pet Encontrado</option>
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
}

function createAdminMobileCardHtml(pet) {
  let validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold text-[10px]">🟢 Ativo (${pet.daysRemaining !== undefined ? pet.daysRemaining : 30}d)</span>`;
  if (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado") {
    validityBadge = `<span class="px-2 py-0.5 rounded bg-green-100 text-green-800 font-bold text-[10px]">🎉 Reencontrado</span>`;
  } else if (pet.isRenewalWindow) {
    validityBadge = `<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px]">⚠️ Requer Renovação (${pet.daysRemaining !== undefined ? pet.daysRemaining : 30}d)</span>`;
  }

  return `
    <div class="bg-surface rounded-xl p-3.5 border border-outline-variant/50 shadow-sm space-y-3 text-xs">
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/30">
        <div class="flex items-center gap-2.5">
          <img src="${getPetPhoto(pet)}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" class="w-11 h-11 rounded-xl object-cover border border-outline-variant/40 shrink-0"/>
          <div>
            <h4 class="font-extrabold text-sm text-primary leading-tight">${pet.name}</h4>
            <span class="text-[10px] text-outline font-semibold">${pet.species} • ${pet.breed}</span>
          </div>
        </div>
        <div>${validityBadge}</div>
      </div>

      <div class="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
        <div>
          <span class="text-outline font-bold block text-[10px] uppercase">Localização</span>
          <span class="font-medium text-on-surface">${pet.city || ''} - ${pet.state || ''}</span>
        </div>
        <div>
          <span class="text-outline font-bold block text-[10px] uppercase">Contato</span>
          <span class="font-medium text-on-surface truncate block">${pet.contactName || ''}</span>
          <span class="text-[10px] text-outline">${pet.contactPhone || ''}</span>
        </div>
      </div>

      <div class="pt-2 border-t border-outline-variant/30 space-y-2">
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-bold text-primary">Alterar Status:</span>
          <select onchange="adminChangeStatus('${pet.id}', this.value)" class="w-full px-2 py-2 rounded-lg text-xs font-bold border border-outline-variant bg-white text-primary outline-none shadow-sm">
            <option value="Procurado" ${pet.type === 'Procurado' ? 'selected' : ''}>Procurado (Perdido)</option>
            <option value="Avistado" ${pet.type === 'Avistado' ? 'selected' : ''}>Avistado (Encontrado)</option>
            <option value="Encontrado pelo dono" ${pet.type === 'Encontrado pelo dono' ? 'selected' : ''}>🟢 Pet Encontrado</option>
            <option value="Dono encontrado" ${pet.type === 'Dono encontrado' ? 'selected' : ''}>🟢 Dono encontrado</option>
          </select>
        </div>

        <div class="flex items-center justify-end gap-1.5 pt-1">
          <button onclick="adminRenewPet('${pet.id}')" class="flex-1 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-sm">update</span> Renovar
          </button>
          <button onclick="adminEditPet('${pet.id}')" class="flex-1 py-1.5 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold text-xs flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-sm">edit</span> Editar
          </button>
          <button onclick="adminDeletePet('${pet.id}')" class="flex-1 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-sm">delete</span> Excluir
          </button>
        </div>
      </div>
    </div>
  `;
}

async function adminChangeStatus(petId, newStatus) {
  const pet = petsData.find(p => p.id === petId);
  if (pet) {
    pet.type = newStatus;
    pet.lastModifiedAt = new Date().toISOString();
    saveEditedPet(pet);
    savePetsToStorage();
const coords = await fetchGeocodeCoordinates(`${pet.address}, ${pet.city}, ${pet.state}, Brasil`);
if (coords) {
  pet.lat = coords.lat;
  pet.lng = coords.lng;
}
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
    removeEditedPet(petId);
    petsData = petsData.filter(p => p.id !== petId);
    savePetsToStorage();
    renderApp();
    await deletePetFromFirebase(petId);
  }
}

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

window.focusPetOnMap = focusPetOnMap;
window.openImageLightbox = openImageLightbox;
window.renewPetListing = renewPetListing;
window.openDetailModal = openDetailModal;
window.adminChangeStatus = adminChangeStatus;
window.adminRenewPet = adminRenewPet;
window.adminEditPet = adminEditPet;
window.adminDeletePet = adminDeletePet;
window.downloadPosterJPG = downloadPosterJPG;
window.downloadPosterPDF = downloadPosterPDF;
window.getRandomDefaultPhoto = getRandomDefaultPhoto;


// v95: o menu 3+2 é estrutural no index.html.
(() => {
  const boot = () => {
    bindMapLegendFilters();
    installSingleLeafletLocationControlFinal();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  [300, 900, 1800].forEach(ms => setTimeout(boot, ms));
})();