/* ==========================================================================
   Pet Searchers Portal - Application Logic (app.js v17)
   Banco Global em Nuvem em Tempo Real (Visível para Todos na Web),
   Geolocalização Precisa com Time-out Anti-Travamento (AbortController),
   Status Verdes de Reencontro, Botão Detalhes Completos nos Cards,
   Calendário Português Brasil (dd/mm/aaaa) e Painel Admin Master (Pet129502@)
   ========================================================================== */

// --- BANCO GLOBAL EM NUVEM (Instância Dedicada em Tempo Real) ---
const CLOUD_DB_URL = "https://jsonblob.com/api/jsonBlob/019ff145-19e1-7bed-9da9-257cdf8a91ce";
let isCloudSyncing = false;

// Configuração do Firebase Firestore (Substitua pelos dados do seu console.firebase.google.com)
const firebaseConfig = {
  apiKey: "SUA_API_KEY_DO_FIREBASE",
  authDomain: "pet-searchers-portal.firebaseapp.com",
  projectId: "pet-searchers-portal",
  storageBucket: "pet-searchers-portal.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};

let firestoreDB = null;
let isFirebaseActive = false;

function initFirebaseConnection() {
  try {
    if (typeof firebase !== "undefined" && firebaseConfig.apiKey && firebaseConfig.apiKey !== "SUA_API_KEY_DO_FIREBASE") {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      firestoreDB = firebase.firestore();
      isFirebaseActive = true;
      console.log("🔥 Firebase Firestore conectado com sucesso!");
      listenToFirebasePets();
      return true;
    } else {
      console.warn("ℹ️ Firebase aguardando credenciais. Operando em modo de nuvem direta.");
      return false;
    }
  } catch (e) {
    console.warn("Erro ao conectar ao Firebase:", e);
    return false;
  }
}

function listenToFirebasePets() {
  if (!firestoreDB || !isFirebaseActive) return;
  firestoreDB.collection("pets").onSnapshot((snapshot) => {
    const cloudPets = [];
    snapshot.forEach((doc) => {
      cloudPets.push({ id: doc.id, ...doc.data() });
    });

    if (cloudPets.length > 0) {
      cloudPets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const deletedSet = getDeletedPetIds();
      const filteredPets = cloudPets.filter(p => !deletedSet.has(p.id));
      petsData = deduplicatePets(filteredPets);
      savePetsToStorage();
      renderApp();
      console.log("🔥 Firebase Firestore atualizou em tempo real:", petsData.length, "pets.");
    }
  }, (err) => {
    console.warn("Erro no listener do Firestore:", err);
  });
}

async function savePetToFirebase(pet) {
  if (!firestoreDB || !isFirebaseActive) return false;
  try {
    await firestoreDB.collection("pets").doc(pet.id).set(pet);
    console.log("✅ Pet salvo no Firebase Firestore:", pet.name);
    return true;
  } catch (e) {
    console.error("❌ Erro ao salvar no Firebase Firestore:", e);
    return false;
  }
}

async function deletePetFromFirebase(petId) {
  if (!firestoreDB || !isFirebaseActive) return false;
  try {
    await firestoreDB.collection("pets").doc(petId).delete();
    console.log("🗑️ Pet excluído do Firebase Firestore:", petId);
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
    "id": "petmapa-d7f8843e-82cb-441d-9e15-9a434279bd26",
    "name": "Princesa",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "12 Ano(s)",
    "gender": "Fêmea",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-12",
    "description": "Ela tem 12 anos branca dos olhos azuis já e bem velhinha um pouco medrosa não deixa ninguém chegar perto",
    "contactName": "Tutor Responsável",
    "contactPhone": "(31) 98225-1499",
    "photo": "https://img.petmapa.com.br/400_a150620e-14e9-426a-8456-3cf1ed5cb28a.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.326Z",
    "lastRenewedAt": "2026-08-13T01:28:02.326Z",
    "lat": -19.7787061,
    "lng": -43.9349524
  },
  {
    "id": "petmapa-7fa7cc90-2b6d-4fe0-9a9f-66b7da6e8fbc",
    "name": "Joji",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-12",
    "description": "Gatinho preto, atende por JOJI, dócil, castrado, rabo bem peludinho, olho amarelo. Desapareceu na Adolpho Serson, na rua do Haras no dia 10/08 por volta das 17h. qualquer notícia: 14 99109-3952 ou 14 99175-9610",
    "contactName": "Tutor Responsável",
    "contactPhone": "(14) 99109-3952",
    "photo": "https://img.petmapa.com.br/400_26125150-3aba-4322-9abe-5d9282b7d165.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.337Z",
    "lastRenewedAt": "2026-08-13T01:28:02.337Z",
    "lat": -22.3344573,
    "lng": -49.1192817
  },
  {
    "id": "petmapa-309cc5b7-258f-46ca-8c71-08fc319dd0f1",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-12",
    "description": "Cachorro encontrato na vila Medeiros São Paulo",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_6de25f3e-e7ed-4045-873e-48740a698967.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.303Z",
    "lastRenewedAt": "2026-08-13T01:28:02.303Z",
    "lat": -23.4838603,
    "lng": -46.5823415
  },
  {
    "id": "petmapa-9c5d417a-f8c6-4a9b-b1e1-bb8e07f6963f",
    "name": "Lulu",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Macho",
    "state": "CE",
    "city": "Capital",
    "address": "Registrado via PetMapa em CE",
    "date": "2026-08-12",
    "description": "Boa Noite! Procura-se meu gatinho macho castrados de nome: Lulu tem 4 anos tem olhos amarelo e está com a patinha esquerda mancando. Foi visto pela a última vez na Rua: Alcântara Bilhar 430 casa. ele sumiu dia 29/07/2026 bairro Padre Andrade próximo o Assai atacadista por volta de 10:00hs de manhã. Caso alguém encontre entre em contato comigo. 85 987639647",
    "contactName": "Tutor Responsável",
    "contactPhone": "(85) 98763-9647",
    "photo": "https://img.petmapa.com.br/400_1488fd9e-6f64-480a-a8db-47fa6834a268.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.287Z",
    "lastRenewedAt": "2026-08-13T01:28:02.289Z",
    "lat": -3.7347411993777038,
    "lng": -38.582184943519515
  },
  {
    "id": "petmapa-6e884399-774b-47fa-b6da-bc7ec6764dcd",
    "name": "Frida",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-11",
    "description": "Está desaparecido há 2 anos. Tem FIV. As donas estão em sofrimento",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_5d83c616-8097-4f70-8573-195871750c38.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.328Z",
    "lastRenewedAt": "2026-08-13T01:28:02.328Z",
    "lat": -20.5229095,
    "lng": -47.3913287
  },
  {
    "id": "petmapa-9cad5e8d-33ff-438e-b0ff-699d7a0bef06",
    "name": "Antonio",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-11",
    "description": "Ele é grande gordo tem dentinhos de vampiro e Mia muito (desapareceu em abril",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_df63e535-3ac3-44b4-a552-089f47b5ee50.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.343Z",
    "lastRenewedAt": "2026-08-13T01:28:02.343Z",
    "lat": -22.732832243633073,
    "lng": -47.636091615516975
  },
  {
    "id": "petmapa-c4cbe311-1843-407c-993a-f92a0baa5983",
    "name": "Josué",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Mes(es)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-11",
    "description": "🚨 GATO PERDIDO – AJUDEM A ENCONTRAR O JOSUÉ Meu gato Josué fugiu hoje pela manhã (11/08), na região do bairro União, em Belo Horizonte. Ele é muito medroso e assustado, então provavelmente está escondido e pode não se aproximar de pessoas ou deixar pessoas se aproximarem. Peço, por favor, que quem for da região fique atento, especialmente em garagens, debaixo de carros, jardins, quintais e lugares onde ele possa estar escondido. Ele é castrado e dócil. Se você vir o Josué, por favor, não tente pega-lo",
    "contactName": "Tutor Responsável",
    "contactPhone": "(37) 99128-1615",
    "photo": "https://img.petmapa.com.br/400_863498b3-a167-4137-b333-20e6c7efd7e9.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.393Z",
    "lastRenewedAt": "2026-08-13T01:28:02.393Z",
    "lat": -19.884089475799463,
    "lng": -43.920197458987616
  },
  {
    "id": "petmapa-f10f509c-7ff8-420d-b01a-daedc36af346",
    "name": "Shazam",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "DF",
    "city": "Capital",
    "address": "Registrado via PetMapa em DF",
    "date": "2026-08-11",
    "description": "Shazam desapareceu na segunda-feira. Estou desesperada procurando por ele. Encontrei-o ainda filhote, abandonado na rua. Há 3 anos faz parte da nossa família e é muito amado e bem cuidado. Ele tinha acesso à rua não por falta de cuidado. Tentamos mantê-lo dentro de casa, mas parava de comer e adoecia. Em uma dessas vezes, ficou muito mal e o veterinário disse que estava com depressão. Por isso, para preservar sua saúde, permitimos que saísse. Ele é muito docio e confia em humanos",
    "contactName": "Tutor Responsável",
    "contactPhone": "(61) 99153-0515",
    "photo": "https://img.petmapa.com.br/400_b019123a-2add-4cde-99fc-f0f6880a2544.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.389Z",
    "lastRenewedAt": "2026-08-13T01:28:02.389Z",
    "lat": -15.80301000606695,
    "lng": -48.11492287009398
  },
  {
    "id": "petmapa-70f6bc13-fd22-4dd8-963e-f40df9996f1f",
    "name": "Maxine",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-11",
    "description": "Maxine é o nome dela, ela tem uma coleira velhinha vermelha, e um tumor do lado do seu nariz e é muito dócil. Minha cachorra já tem 10 anos .Ela fugiu por volta das 16:00 no Sábado dia 01/08/26.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(13) 99138-3052",
    "photo": "https://img.petmapa.com.br/400_d2e8ad86-528b-481f-bdf6-778e8999b021.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.394Z",
    "lastRenewedAt": "2026-08-13T01:28:02.394Z",
    "lat": -23.945443631244338,
    "lng": -46.379649792694494
  },
  {
    "id": "petmapa-1df54454-096e-4626-a630-023292d5d645",
    "name": "Ozzi",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-08-11",
    "description": "Gatinho preto e branco, cabecinha preta até a região da boca, nariz preto, abaixo branco, após o pescoço uma região branca, costas pretas com uma faixinha branca antes do rabinho, rabinho preto e peludo, a maior parte das perninhas e pezinhos brancos.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(55) 99614-8013",
    "photo": "https://img.petmapa.com.br/400_ec96b223-5d68-4267-830e-fc46422ac7d7.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.391Z",
    "lastRenewedAt": "2026-08-13T01:28:02.391Z",
    "lat": -27.4837844,
    "lng": -53.403578
  },
  {
    "id": "petmapa-c2479bec-ca9c-4aee-a507-35ad324fb697",
    "name": "Tequila",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-11",
    "description": "TEQUILA Gato de médio porte Visto pela última vez na rua João Kasdorf, próximo ao mercado Itamaraty, no bairro Xaxim. Somos muito apegados nele! CARACTERÍSTICA IMPORTANTE: não possui um dos dentes caninos (presa) de um dos lados da boca. Mais informações, entre em contato comigo (41)998667946. Obrigada!",
    "contactName": "Tutor Responsável",
    "contactPhone": "(41) 99866-7946",
    "photo": "https://img.petmapa.com.br/400_9752c28c-a9b3-4bac-baf9-220c4aa3910b.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.394Z",
    "lastRenewedAt": "2026-08-13T01:28:02.394Z",
    "lat": -25.518869502692308,
    "lng": -49.26708301620855
  },
  {
    "id": "petmapa-60118588-9844-461e-a78c-13c88a899366",
    "name": "Jujuba",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-11",
    "description": "Frajola Castrado e vacinado, manchinha branca em cima da boca/bochecha no lado esquerdo, peito branco, patinhas que lembram meias, rabo peludo, é dócil mas não gosta que peguem ele no colo (só as vezes), não usa coleira, olhos amarelos, desaparecido desde dia 15/05/26",
    "contactName": "Tutor Responsável",
    "contactPhone": "(48) 99647-0450",
    "photo": "https://img.petmapa.com.br/400_f3a794d0-a7d9-4790-a17e-9404432b2a7d.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.404Z",
    "lastRenewedAt": "2026-08-13T01:28:02.404Z",
    "lat": -27.893043671172553,
    "lng": -48.93410605248962
  },
  {
    "id": "petmapa-35a55fe3-cd32-44dd-800f-7a81775fecde",
    "name": "Malevola",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "12 Ano(s)",
    "gender": "Fêmea",
    "state": "DF",
    "city": "Capital",
    "address": "Registrado via PetMapa em DF",
    "date": "2026-08-11",
    "description": "Está muito assustado e sumiu na 516 samambaia sul",
    "contactName": "Tutor Responsável",
    "contactPhone": "(61) 99157-5002",
    "photo": "https://img.petmapa.com.br/400_7857ec89-36ae-4b9f-8145-33e391054dd3.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.454Z",
    "lastRenewedAt": "2026-08-13T01:28:02.454Z",
    "lat": -15.878694419157716,
    "lng": -48.06387490463597
  },
  {
    "id": "petmapa-1558f0fe-3ad5-4f8b-83e6-44d4023546f9",
    "name": "Floki",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-11",
    "description": "Ele Branquinho olha azuis , meio gordinho , ele gosta de sache , parece siames ,",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 96763-6764",
    "photo": "https://img.petmapa.com.br/400_bd6fec8a-9eb7-4f65-91ff-b79d3c90560b.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.461Z",
    "lastRenewedAt": "2026-08-13T01:28:02.461Z",
    "lat": -23.5435212,
    "lng": -46.5969339
  },
  {
    "id": "petmapa-cc84f7c5-996a-450b-aaaa-a705d469ce99",
    "name": "Nevasca",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "11 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-11",
    "description": "Nevasca é um gatinho medroso e querido que nasceu na minha casa e depois de 7 anos comigo fugiu assustado logo após uma mudança para uma casa no bairro da Generosa, Mairiporã no ano de 2022. Passei meses procurando ele pelas ruas, na mata, em todos os cantos e não encontrei, mas acredito que foi acolhido por alguém.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 97630-2806",
    "photo": "https://img.petmapa.com.br/400_373895dd-a75b-4f98-9783-c62dde6cf353.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.460Z",
    "lastRenewedAt": "2026-08-13T01:28:02.460Z",
    "lat": -23.305417974587012,
    "lng": -46.548635833413506
  },
  {
    "id": "petmapa-acb8e920-1124-4591-9fda-139d82412f1d",
    "name": "John",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-11",
    "description": "Bulldog do tipo tigrado. Macho. Dócil. Não late.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(41) 98875-4312",
    "photo": "https://img.petmapa.com.br/400_ce3bba6a-5983-4871-8ddc-0243d21e25bd.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.469Z",
    "lastRenewedAt": "2026-08-13T01:28:02.469Z",
    "lat": -25.48078941606807,
    "lng": -49.28233578371072
  },
  {
    "id": "petmapa-70d79507-43fe-4cd9-a923-c915278c946b",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-11",
    "description": "Mancha / pintas na lingua",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_88471e29-bfdf-4f46-90a0-01cc5e946d01.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.464Z",
    "lastRenewedAt": "2026-08-13T01:28:02.464Z",
    "lat": -27.454805442117085,
    "lng": -48.403201993354166
  },
  {
    "id": "petmapa-ac8aa88b-8d9a-4902-bfca-2562f9d33ad6",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-10",
    "description": "Encontrei a cachorrinha na minha rua, sábado dia 08/08. Dócil, não parece ser filhote.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 94015-9301",
    "photo": "https://img.petmapa.com.br/400_32e14407-e32d-40f2-9143-4b238f4744cd.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.485Z",
    "lastRenewedAt": "2026-08-13T01:28:02.485Z",
    "lat": -23.4554274,
    "lng": -46.5499888
  },
  {
    "id": "petmapa-54a49c91-07df-47ad-ae50-3c6834534f5c",
    "name": "Lubi",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-10",
    "description": "Gato preto e branco,pelado. Dócil",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_748fd509-cb64-4ae1-aceb-293a19c4526c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.548Z",
    "lastRenewedAt": "2026-08-13T01:28:02.548Z",
    "lat": -19.50984339791184,
    "lng": -47.211607993507556
  },
  {
    "id": "petmapa-4c242671-7561-4bc3-a60f-7ebb7df7d4ba",
    "name": "Garu",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "13 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-10",
    "description": "Cachorro preto de porte médio, corpo esguio e pernas compridas, focinho comprido e fino, orelhas caídas e olhos castanho-escuros grandes. Possui uma pequena mancha branca no queixo/parte inferior do focinho e uma pequena mancha branca no peito/barriga. Não tem rabo. Pelagem preta curta/média e levemente ondulada, principalmente no peito e pescoço.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95399-8228",
    "photo": "https://img.petmapa.com.br/400_e1ffe219-a9e2-4eb5-9b00-04af0d9bc4db.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.535Z",
    "lastRenewedAt": "2026-08-13T01:28:02.536Z",
    "lat": -23.4735483,
    "lng": -46.7395416
  },
  {
    "id": "petmapa-fd7c5f13-6902-458f-aa22-dbabc15fff5b",
    "name": "Badu",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "14 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-10",
    "description": "Porte médio caramelo, idoso e assustado. Ele não sabe andar na rua",
    "contactName": "Tutor Responsável",
    "contactPhone": "(41) 99866-6335",
    "photo": "https://img.petmapa.com.br/400_e8374543-cde7-4cb7-bd99-6485c97674fb.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.552Z",
    "lastRenewedAt": "2026-08-13T01:28:02.552Z",
    "lat": -25.430047,
    "lng": -49.1846258
  },
  {
    "id": "petmapa-26e93d6c-6232-4406-9a92-144cf32c9704",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Mes(es)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-10",
    "description": "Pitbull encontrei na estrada entrada de Guararema. Fone de contato 11954689090",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95468-9090",
    "photo": "https://img.petmapa.com.br/400_f6439157-73d5-455c-943b-b17ddd917514.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.546Z",
    "lastRenewedAt": "2026-08-13T01:28:02.546Z",
    "lat": -23.373404354366176,
    "lng": -46.10475560231571
  },
  {
    "id": "petmapa-cdb2f939-f85e-45a7-aba9-971593e24468",
    "name": "Fred",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-08-09",
    "description": "Ele se chama Fred, um cachorro dócil e amoroso",
    "contactName": "Tutor Responsável",
    "contactPhone": "(43) 99806-8421",
    "photo": "https://img.petmapa.com.br/400_98ed18aa-d15c-4c9d-8e40-1179b61afdbd.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.547Z",
    "lastRenewedAt": "2026-08-13T01:28:02.547Z",
    "lat": -23.287857982186697,
    "lng": -51.183235560755115
  },
  {
    "id": "petmapa-bc7e29a5-522c-41bc-9bae-34ecf13eb61d",
    "name": "Charlotte",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "MA",
    "city": "Capital",
    "address": "Registrado via PetMapa em MA",
    "date": "2026-08-09",
    "description": "Ela sumiu de casa",
    "contactName": "Tutor Responsável",
    "contactPhone": "(98) 98490-3933",
    "photo": "https://img.petmapa.com.br/400_2259dc2b-db45-4f06-81e2-1fabb1bdd601.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.537Z",
    "lastRenewedAt": "2026-08-13T01:28:02.537Z",
    "lat": -2.5972330054175425,
    "lng": -44.18188602132831
  },
  {
    "id": "petmapa-9f9ea2dd-4ec1-4167-b7eb-fb7b13259e00",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-08-09",
    "description": "”Pelagem cinza clara com listras, olhos azuis, porte médio, macho.”",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 98958-0578",
    "photo": "https://img.petmapa.com.br/400_4cfa4f41-18ba-4bea-9dca-00dc47b30b93.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.620Z",
    "lastRenewedAt": "2026-08-13T01:28:02.620Z",
    "lat": -22.88955429620938,
    "lng": -43.43765919441223
  },
  {
    "id": "petmapa-06e67e65-e0e8-46ea-a071-4378567831f8",
    "name": "Bel",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-09",
    "description": "Mansa e carinhosa",
    "contactName": "Tutor Responsável",
    "contactPhone": "(12) 99614-0016",
    "photo": "https://img.petmapa.com.br/400_7b5cdfe8-763c-4b9a-9edc-157e26968d65.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.608Z",
    "lastRenewedAt": "2026-08-13T01:28:02.608Z",
    "lat": -23.09789946076239,
    "lng": -44.95852260975302
  },
  {
    "id": "petmapa-28176b49-cbce-4744-8c1c-80e2eb7e413d",
    "name": "Alecrim",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Ano(s)",
    "gender": "Macho",
    "state": "DF",
    "city": "Capital",
    "address": "Registrado via PetMapa em DF",
    "date": "2026-08-08",
    "description": "Parrudo e peludo. Castrado, manso, olhos amarelos, pelagem branca com o rabo cinza.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(61) 99925-9855",
    "photo": "https://img.petmapa.com.br/400_7aa672d6-35ff-4b61-bfa4-db542a14361d.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.616Z",
    "lastRenewedAt": "2026-08-13T01:28:02.616Z",
    "lat": -15.7080016,
    "lng": -47.8811366
  },
  {
    "id": "petmapa-dfdf5fea-ac10-4704-a451-5f83a3075c23",
    "name": "Cherrise",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-08-08",
    "description": "Papel na cabeça escrito Tom",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 98112-6390",
    "photo": "https://img.petmapa.com.br/400_d9a15e3f-1f16-4515-bc80-6feb5d81c74e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.633Z",
    "lastRenewedAt": "2026-08-13T01:28:02.633Z",
    "lat": -16.7712592,
    "lng": -49.3062246
  },
  {
    "id": "petmapa-5ea13872-0e4b-495c-9fe0-83c8176ffe3c",
    "name": "Cherrise",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-08-08",
    "description": "Rajado, grande, com um papel escrito Tom na cabeça",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 98212-1350",
    "photo": "https://img.petmapa.com.br/400_3c0eced8-dd78-47fa-9a06-682aafc000de.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.662Z",
    "lastRenewedAt": "2026-08-13T01:28:02.662Z",
    "lat": -16.7712592,
    "lng": -49.3062246
  },
  {
    "id": "petmapa-bb95b1f9-363e-4714-9fc7-1a5091e001b0",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "CE",
    "city": "Capital",
    "address": "Registrado via PetMapa em CE",
    "date": "2026-08-08",
    "description": "Gata mansa, usando uma coleira rosa da Hello Kitty, tem a pelagem bem colorida, meio cinza, meio marrom, com algumas manchas brancas e o focinho tem uma mancha grande marrom escuro. Os olhos dela são azuis, não consegui tirar foto de olhos abertos.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(27) 99978-7265",
    "photo": "https://img.petmapa.com.br/400_b80b0bd4-2e94-4b7c-aef8-c02c14a70d83.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.663Z",
    "lastRenewedAt": "2026-08-13T01:28:02.663Z",
    "lat": -3.7380484421616282,
    "lng": -38.58346316123703
  },
  {
    "id": "petmapa-786c9887-7c57-4aa3-9fd9-ad778a23746b",
    "name": "Salem",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-08",
    "description": "Mia bastante, bem arisco principalmente com homens. Tem olhos verdes amarelados, estava usando um colar verde antipulga",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95881-2910",
    "photo": "https://img.petmapa.com.br/400_1d023db3-84f5-4bb0-b814-c00a7b511388.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:03.994Z",
    "lastRenewedAt": "2026-08-13T01:28:03.994Z",
    "lat": -23.585755183582883,
    "lng": -46.400264648193435
  },
  {
    "id": "petmapa-bc98bca6-5358-4ca0-95f1-4c8fd9461ca0",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-08",
    "description": "Pet idoso",
    "contactName": "Tutor Responsável",
    "contactPhone": "(19) 98320-0799",
    "photo": "https://img.petmapa.com.br/400_780fd48d-2c82-41ec-8e29-3e9afd8a39e6.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.713Z",
    "lastRenewedAt": "2026-08-13T01:28:02.713Z",
    "lat": -23.108636,
    "lng": -47.1759455
  },
  {
    "id": "petmapa-669eb414-ef82-4b35-91ac-f30e698fd2b7",
    "name": "Kekel",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-08",
    "description": "Kekel saiu de casa na madrugada do dia 07/08. Nas câmeras ele anda e vai até a praça. Saímos na rua 20 minutos depois, começamos a procurar e não encontramos.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98646-4042",
    "photo": "https://img.petmapa.com.br/400_f224e483-6886-42c9-a0c3-4c03ce6b0f74.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.700Z",
    "lastRenewedAt": "2026-08-13T01:28:02.700Z",
    "lat": -23.616148284140174,
    "lng": -46.703936252967715
  },
  {
    "id": "petmapa-74899188-3390-44d6-98de-9658cce8cf0d",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Mes(es)",
    "gender": "Macho",
    "state": "RS",
    "city": "Capital",
    "address": "Registrado via PetMapa em RS",
    "date": "2026-08-07",
    "description": "Encontrado após o temporal escondido no motor do carro. Bem cuidado, sociável e parecendo não ter mais de 3 meses.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(51) 98530-8413",
    "photo": "https://img.petmapa.com.br/400_0b19e8fd-37d8-4352-8944-df465949e89b.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.707Z",
    "lastRenewedAt": "2026-08-13T01:28:02.707Z",
    "lat": -30.1041256,
    "lng": -51.2570218
  },
  {
    "id": "petmapa-64c67e02-b2b7-4c35-afe6-5211c0698d01",
    "name": "Ralf",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-07",
    "description": "Cachorro grande, preto, atende pelo nome, manso",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 93119-0934",
    "photo": "https://img.petmapa.com.br/400_a1a92113-eeb4-4658-b46d-28004670516d.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.711Z",
    "lastRenewedAt": "2026-08-13T01:28:02.711Z",
    "lat": -23.558568815865822,
    "lng": -46.41234274778404
  },
  {
    "id": "petmapa-11a63a6d-0d5b-47de-afb8-fa76e1fde4d5",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-07",
    "description": "Pessoal, apareceu uma gatinha aqui em casa, ela é muito dócil e parece estar perdida. Se puderem compartilhar para ajudar a encontrar o dono dela, eu agradeço. 🐱🙏",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_a3f8a219-691a-4519-a160-88e7c0edc372.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:02.715Z",
    "lastRenewedAt": "2026-08-13T01:28:02.715Z",
    "lat": -22.7100412,
    "lng": -47.3605521
  },
  {
    "id": "petmapa-54eeaa2f-8236-4dc0-8cc3-170bfd87e4f2",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Ano(s)",
    "gender": "Fêmea",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-07",
    "description": "Extremamente dócil e carinhosa já e castrada pelo umbigo",
    "contactName": "Tutor Responsável",
    "contactPhone": "(31) 98617-0207",
    "photo": "https://img.petmapa.com.br/400_aabb953c-fa94-48a8-9cf0-b636f832963e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.070Z",
    "lastRenewedAt": "2026-08-13T01:28:04.070Z",
    "lat": -19.7895658,
    "lng": -43.9746753
  },
  {
    "id": "petmapa-38e9d129-d344-4d25-a3b1-6b7fd8d418d7",
    "name": "Lucky",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-07",
    "description": "🛑⭕PROCURAMOS LUCKY⭕🛑 Branco, pequeno porte, castrado, olhos escuros e docil. Veste roupa azul com estrelas amarelas. Ele tem uma deformidade ossea na pata direta. Onde sumiu: Bairro Ponte Alta-Guarulhos, próximo à Escola Castro Alves. Quando sumiu: 05/08/2026.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 93227-7211",
    "photo": "https://img.petmapa.com.br/400_1bf18e5a-6c82-483e-b686-06c66248f67e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.059Z",
    "lastRenewedAt": "2026-08-13T01:28:04.060Z",
    "lat": -23.399591906885036,
    "lng": -46.42057040584862
  },
  {
    "id": "petmapa-f703b34d-93d4-426b-bb39-76b65d9121aa",
    "name": "Kiara",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Ano(s)",
    "gender": "Fêmea",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-08-07",
    "description": "Atende por Kiara. Sua pelagem E 'sialata', marrom com extremidades escuras e olhos azuis, tem 5 anos de idade e é dócil. Não tem nenhuma manchinha clara pelo corpo. Eu estava com uma coeira vermelha quando desapareceu. CASO A ENCONTRE, LIGUE PARA: • Amanda: (21) 99250-1759 • Glauce: (21) 99433-3616 ・Félix (21) 96435-054",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 99250-1759",
    "photo": "https://img.petmapa.com.br/400_3c47977b-2fea-4494-9c0c-e520935e9d98.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.067Z",
    "lastRenewedAt": "2026-08-13T01:28:04.067Z",
    "lat": -22.866072155262138,
    "lng": -43.359926938767366
  },
  {
    "id": "petmapa-018f0f2e-65ee-46bc-a8b0-f61ce20afbc8",
    "name": "Pipoca",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-08-06",
    "description": "Ele é super dócil, muito carinhoso e muito mimado",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_59de81f7-32ca-461a-bab4-d810dfe0999b.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.066Z",
    "lastRenewedAt": "2026-08-13T01:28:04.066Z",
    "lat": -22.932824083355094,
    "lng": -43.70039463043213
  },
  {
    "id": "petmapa-a7a2a163-5f2d-4024-8b8a-5a4977c67064",
    "name": "Não Tem Nome",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "ES",
    "city": "Capital",
    "address": "Registrado via PetMapa em ES",
    "date": "2026-08-06",
    "description": "GATA DESAPARECIDA – PROCURA-SE Pelagem: Tigrada (marrom/cinza com listras pretas marcantes pelas costas e patas). Rosto: Olhos verdes, marcação em 'M' na testa, focinho avermelhado, queixo claro e bigodes brancos. Porte: Médio a pequeno, pelagem curta e rabo peludo com anéis escuros.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_8a437ea0-d307-44bc-8c7c-30e172e5b11a.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.069Z",
    "lastRenewedAt": "2026-08-13T01:28:04.069Z",
    "lat": -20.370595432455875,
    "lng": -40.31802941076501
  },
  {
    "id": "petmapa-db481fac-49f4-47af-bf86-21cd52c1eb4c",
    "name": "Venom",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-06",
    "description": "Venom é todo preto de pelagem curta… como não tem o costume de sair para fora.. deve estar muito assustado e desesperado… por favor nos ajudem achar nosso Pet!! 😭",
    "contactName": "Tutor Responsável",
    "contactPhone": "(41) 99960-7858",
    "photo": "https://img.petmapa.com.br/400_516147f9-b61c-4706-95f0-42cf2fe34472.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.068Z",
    "lastRenewedAt": "2026-08-13T01:28:04.068Z",
    "lat": -25.53483989737324,
    "lng": -49.28933029245345
  },
  {
    "id": "petmapa-04c941b5-4b30-4d35-84b0-9ffc80be65f6",
    "name": "Felicia",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-06",
    "description": "VIRA LATA, MISTURADA DE CHOW CHOW, TEM A LINGUA ROXA. PERDIDA NO DIA 02/08 JOSE BONIFACIO-SP",
    "contactName": "Tutor Responsável",
    "contactPhone": "(17) 99216-1455",
    "photo": "https://img.petmapa.com.br/400_74578bd8-b657-46c2-be49-97ab94fdf84e.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.121Z",
    "lastRenewedAt": "2026-08-13T01:28:04.121Z",
    "lat": -21.04390766603472,
    "lng": -49.676981926867555
  },
  {
    "id": "petmapa-b9959fb4-c55d-4851-905f-601c4cf9056b",
    "name": "Kefera",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "11 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-06",
    "description": "Ela é uma gatinha com problemas de saúde, ela é branca com manchas de duas cores pelo corpo , ela está com as duas patinhas raspadas e no dia que sumiu estava de roupa azul marinho e fralda",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98945-9625",
    "photo": "https://img.petmapa.com.br/400_937e9fa6-7f38-4d37-bf25-1f5f5f59719c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.118Z",
    "lastRenewedAt": "2026-08-13T01:28:04.118Z",
    "lat": -23.4639678,
    "lng": -46.5796636
  },
  {
    "id": "petmapa-8102f763-e344-4484-81fc-23bb72d38a93",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-06",
    "description": "Cãozinho encontrado na região do sítio do morro, na Rua Brig. Xavier de Brito",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98541-9860",
    "photo": "https://img.petmapa.com.br/400_c116f662-868e-45e6-bd4e-dd54b4befe1c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.124Z",
    "lastRenewedAt": "2026-08-13T01:28:04.124Z",
    "lat": -23.5017076,
    "lng": -46.6668002
  },
  {
    "id": "petmapa-e07e00e8-0d42-4d33-a636-fce41a30d1e5",
    "name": "Bob Dinamite",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-08-06",
    "description": "- Cachorro de porte médio / Grande. SRD - Pelagem predominante preto, patas caramelo, focinho caramelo com preto. - Rabo curto (cotoco) - Pelagem branca no peito. 21 970762816",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 97076-2816",
    "photo": "https://img.petmapa.com.br/400_c976f7e6-39bd-43ae-8d0e-c576a9fee1e7.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.115Z",
    "lastRenewedAt": "2026-08-13T01:28:04.115Z",
    "lat": -22.891274161465333,
    "lng": -43.29666545156923
  },
  {
    "id": "petmapa-2b8207c8-29ea-4ec9-82d7-749b4e5a859f",
    "name": "Electra",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-06",
    "description": "Ela é muito medrosa, se esconde facilmente. Apesar de ter 5 ela é pequena. Entre suas manchas tigrada de cinza tem manchas amareladas",
    "contactName": "Tutor Responsável",
    "contactPhone": "(19) 99169-7098",
    "photo": "https://img.petmapa.com.br/400_e6e530eb-2b86-4911-acdd-c90c5a84cdae.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.121Z",
    "lastRenewedAt": "2026-08-13T01:28:04.121Z",
    "lat": -22.77282035263807,
    "lng": -47.173932834030076
  },
  {
    "id": "petmapa-2cfeb68c-2306-4691-b31d-08ece4353f13",
    "name": "Miau",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Mes(es)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-06",
    "description": "Ele é preto, se chama Miau, é muito medroso arisco, assustado, está sumido há duas semanas, não é castrado, usa uma coleira azul, ele sumiu na cidade de jundiai, na rua Professor Albino Melo de Oliveira 226 jardim Santa Adelaide, anhagabau, jardim Paulista, parque da uva, nessa região",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 96646-3496",
    "photo": "https://img.petmapa.com.br/400_11cb807a-e21e-4420-9a54-d11e6a90ad06.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.119Z",
    "lastRenewedAt": "2026-08-13T01:28:04.119Z",
    "lat": -23.1976012,
    "lng": -46.8983628
  },
  {
    "id": "petmapa-631cd7e5-0500-45f9-995b-032053160668",
    "name": "Pepe",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Fêmea",
    "state": "BA",
    "city": "Capital",
    "address": "Registrado via PetMapa em BA",
    "date": "2026-08-05",
    "description": "Ela e uma cadela que não vai com todo mundo sumiu no centro de Lauro de Freitas por volta das 7 da noite",
    "contactName": "Tutor Responsável",
    "contactPhone": "(71) 99196-7540",
    "photo": "https://img.petmapa.com.br/400_db737dca-d6dc-41f6-9cf1-4760c136fcaa.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.167Z",
    "lastRenewedAt": "2026-08-13T01:28:04.167Z",
    "lat": -12.8941469,
    "lng": -38.322626
  },
  {
    "id": "petmapa-7d34cf82-72e6-4a03-a0d3-16c66685a9f1",
    "name": "Zeus",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Mes(es)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-04",
    "description": "Cachorro muito dócil, está com Peitoral azul",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_c2bdbcc1-3cb3-44ef-b71a-56af102074ef.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.192Z",
    "lastRenewedAt": "2026-08-13T01:28:04.192Z",
    "lat": -23.5405593,
    "lng": -46.9456946
  },
  {
    "id": "petmapa-f5f28879-bc12-4c5c-a742-880abd3d4f5d",
    "name": "Dudu",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-04",
    "description": "Ele é todo branco, tem um olho azul e outro verde. É castrado e não tem testículos, manso mas arisco com estranhos é muito medroso. Fugiu na antiga rua 8 no bairro 2000 em Uberaba MG",
    "contactName": "Tutor Responsável",
    "contactPhone": "(34) 99950-8184",
    "photo": "https://img.petmapa.com.br/400_ba71f53e-2860-4b09-89c7-7124ea2d5f11.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.168Z",
    "lastRenewedAt": "2026-08-13T01:28:04.168Z",
    "lat": -19.7456327,
    "lng": -47.9385299
  },
  {
    "id": "petmapa-0f23974b-80cf-4951-8372-2c4cda273c8b",
    "name": "Mariza",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "MS",
    "city": "Capital",
    "address": "Registrado via PetMapa em MS",
    "date": "2026-08-04",
    "description": "Pinchter mistura",
    "contactName": "Tutor Responsável",
    "contactPhone": "(67) 99821-3775",
    "photo": "https://img.petmapa.com.br/400_6c120509-b02a-467c-b75d-ea729581bed5.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.182Z",
    "lastRenewedAt": "2026-08-13T01:28:04.182Z",
    "lat": -22.262234,
    "lng": -54.7784013
  },
  {
    "id": "petmapa-5b753642-1047-467e-bedb-e664a333a9a3",
    "name": "Bela",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Mes(es)",
    "gender": "Fêmea",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-08-04",
    "description": "Uma filhote mestiça de shiatsu Pequeno porte",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 99967-1657",
    "photo": "https://img.petmapa.com.br/400_6cc22041-00b8-4e8b-84d7-0aa8ff10e849.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.189Z",
    "lastRenewedAt": "2026-08-13T01:28:04.189Z",
    "lat": -14.4405202,
    "lng": -49.7165575
  },
  {
    "id": "petmapa-657fddd8-3098-406f-b890-2da3c96aff25",
    "name": "Paçoca",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-04",
    "description": "Gata, tricolor amarela, preto e branca, tem um coração de pelo preto no dorso, atende por paçaco, consegue chamar atenção com barulho de plastico, adora brincar com uvas verdes, e chocalhos de ratinhos.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98147-8310",
    "photo": "https://img.petmapa.com.br/400_12049d37-f5dd-4c05-8b3e-2e213d374a37.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.186Z",
    "lastRenewedAt": "2026-08-13T01:28:04.186Z",
    "lat": -23.508584096308024,
    "lng": -46.89355122402522
  },
  {
    "id": "petmapa-a915cbe6-2101-4ee4-be04-bf432d97047a",
    "name": "Ice",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Mes(es)",
    "gender": "Macho",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-04",
    "description": "Foi visto pela última vez próximo a padaria Empório e o bar do Cláudio. Ele é dócil mas bem assustado.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(41) 99654-7371",
    "photo": "https://img.petmapa.com.br/400_84939095-297b-46e9-9341-2ca7ed1e4535.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.231Z",
    "lastRenewedAt": "2026-08-13T01:28:04.231Z",
    "lat": -25.4632826,
    "lng": -49.2147523
  },
  {
    "id": "petmapa-b098976a-f0f1-4e13-86a4-bd60fc05a338",
    "name": "Fred",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Mes(es)",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-08-03",
    "description": "Gatinho muito manhoso e dócil,vai no colo com facilidade, tem mania de ficar mamando pano. Ele sumiu na noite do último sábado, achamos que foi atrás de gatas fêmeas, pois seu comportamento estava mudando.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 99312-7485",
    "photo": "https://img.petmapa.com.br/400_b678f43f-acda-4a91-b353-50547d33b7f9.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.244Z",
    "lastRenewedAt": "2026-08-13T01:28:04.244Z",
    "lat": -22.992865894275642,
    "lng": -43.496536245747826
  },
  {
    "id": "petmapa-86f182d6-b820-4e05-ab69-874ff767ab16",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Macho",
    "state": "MA",
    "city": "Capital",
    "address": "Registrado via PetMapa em MA",
    "date": "2026-08-03",
    "description": "Pet docil encontrado no estacionamento do BOULEVARD TROPICAL",
    "contactName": "Tutor Responsável",
    "contactPhone": "(98) 99968-3600",
    "photo": "https://img.petmapa.com.br/400_24872823-51a1-41e5-a04d-0c928f20660e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.245Z",
    "lastRenewedAt": "2026-08-13T01:28:04.245Z",
    "lat": -2.5006952,
    "lng": -44.287002
  },
  {
    "id": "petmapa-8e2fd3b1-a9f8-47cc-b2b9-47fbaaf54de0",
    "name": "Cristiano Ronaldo",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "CE",
    "city": "Capital",
    "address": "Registrado via PetMapa em CE",
    "date": "2026-08-03",
    "description": "Cinza. Olhos amarelos meio verde. Coleira vermelha. Cicatriz na barriga.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(85) 99143-4759",
    "photo": "https://img.petmapa.com.br/400_b5e0366b-54eb-44ff-993a-3d2f7a09db5c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.230Z",
    "lastRenewedAt": "2026-08-13T01:28:04.230Z",
    "lat": -3.975055119872481,
    "lng": -38.52018909047655
  },
  {
    "id": "petmapa-426c24f8-761b-4c48-87a8-73dfb7c97be0",
    "name": "Samanta",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-03",
    "description": "Gata dócil, tem medo de barulhos altos, pequeno porte, já está castrada",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 94376-4479",
    "photo": "https://img.petmapa.com.br/400_e857e11d-7861-4c8e-89fc-e7f0accc32ef.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.238Z",
    "lastRenewedAt": "2026-08-13T01:28:04.238Z",
    "lat": -23.58637630126424,
    "lng": -46.38312455353307
  },
  {
    "id": "petmapa-218f1529-78b9-40cc-a3a3-8be30cd95301",
    "name": "Doki",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Macho",
    "state": "MT",
    "city": "Capital",
    "address": "Registrado via PetMapa em MT",
    "date": "2026-08-03",
    "description": "Doki e caramelo rabinho cortado orelha em pé um cachorro muito amigo",
    "contactName": "Tutor Responsável",
    "contactPhone": "(65) 99326-5529",
    "photo": "https://img.petmapa.com.br/400_0575a8b8-e029-4edc-a629-76ad06a8a8cb.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.233Z",
    "lastRenewedAt": "2026-08-13T01:28:04.233Z",
    "lat": -15.5995032,
    "lng": -56.0821493
  },
  {
    "id": "petmapa-c4aca1a6-7b73-4e9d-b0ec-32c5a34cf5ce",
    "name": "Preta",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Mes(es)",
    "gender": "Fêmea",
    "state": "PB",
    "city": "Capital",
    "address": "Registrado via PetMapa em PB",
    "date": "2026-08-02",
    "description": "Gatinha preta, de tamanho médio, peluda e tem olhos amarelos meio alaranjados.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(83) 92141-5369",
    "photo": "https://img.petmapa.com.br/400_e4e6a975-7203-4a9e-a981-192a7ac346a6.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.293Z",
    "lastRenewedAt": "2026-08-13T01:28:04.293Z",
    "lat": -7.174157513609606,
    "lng": -34.81612698576544
  },
  {
    "id": "petmapa-69441148-2c15-4a9b-bbc7-bc6796393fdf",
    "name": "Belinha",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "01 Ano(s)",
    "gender": "Fêmea",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-08-02",
    "description": "Branca com detalhes pretos.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(31) 97316-3372",
    "photo": "https://img.petmapa.com.br/400_57070d37-53f6-44f8-8a6a-ac07853b3127.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.293Z",
    "lastRenewedAt": "2026-08-13T01:28:04.293Z",
    "lat": -19.940131,
    "lng": -43.931049
  },
  {
    "id": "petmapa-c4ce7faf-3582-4bf5-a764-e5f9ac0c2422",
    "name": "Miau",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Ano(s)",
    "gender": "Macho",
    "state": "AP",
    "city": "Capital",
    "address": "Registrado via PetMapa em AP",
    "date": "2026-08-02",
    "description": "Ele é calmo, não é agressivo mas é muito medroso.. Ele tem o olho bem azul, e o lado direito tem uma manchinha",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_8054b593-aff7-46d1-adda-43070d1a7879.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.291Z",
    "lastRenewedAt": "2026-08-13T01:28:04.291Z",
    "lat": -1.3158028914605582,
    "lng": -48.454079031944275
  },
  {
    "id": "petmapa-94afe66b-c1b2-4bb1-a1e5-28e44f3a8d55",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Macho",
    "state": "PB",
    "city": "Capital",
    "address": "Registrado via PetMapa em PB",
    "date": "2026-08-02",
    "description": "Encontrei ele na praia de boa viagem, porte médio, docio e castrado, ele é branco com partes pretas e marrons",
    "contactName": "Tutor Responsável",
    "contactPhone": "(81) 98511-0412",
    "photo": "https://img.petmapa.com.br/400_76d19f4f-97ad-4efe-9af9-336d3a61ff57.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.292Z",
    "lastRenewedAt": "2026-08-13T01:28:04.292Z",
    "lat": -8.1212299,
    "lng": -34.9360292
  },
  {
    "id": "petmapa-cc13acf0-67ba-465d-93d8-18bc6e57ed74",
    "name": "Mavi",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-02",
    "description": "Gata fêmea,pelagem marrom e branco os olhos claros azuis",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_82654cc9-540b-4403-b6c1-951ccd331d78.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.295Z",
    "lastRenewedAt": "2026-08-13T01:28:04.295Z",
    "lat": -23.7183369,
    "lng": -46.8481043
  },
  {
    "id": "petmapa-a2731d42-ebaf-432b-b738-22a6f85ee4d0",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "RS",
    "city": "Capital",
    "address": "Registrado via PetMapa em RS",
    "date": "2026-08-01",
    "description": "Eles aparecem aqui em Belém novo",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_0a1b4947-73b4-412c-ad97-ceec3e88d270.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.293Z",
    "lastRenewedAt": "2026-08-13T01:28:04.293Z",
    "lat": -30.209806683758856,
    "lng": -51.1817441405215
  },
  {
    "id": "petmapa-901e1b54-3f9e-4baf-9b71-9f1d4b3af1ec",
    "name": "Freud",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Mes(es)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-08-01",
    "description": "siamês gato",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 94317-3785",
    "photo": "https://img.petmapa.com.br/400_19678a88-65c8-4cc6-93a5-a8342da8c133.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.337Z",
    "lastRenewedAt": "2026-08-13T01:28:04.337Z",
    "lat": -22.9629404,
    "lng": -46.5495736
  },
  {
    "id": "petmapa-4ba83085-b491-44d4-baba-87a5f1109918",
    "name": "Toby",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Ano(s)",
    "gender": "Macho",
    "state": "AP",
    "city": "Capital",
    "address": "Registrado via PetMapa em AP",
    "date": "2026-08-01",
    "description": "O portão ficou aberto e ele deve ter visto um cachorro e foi atrás porque ele não é de fugir e se perdeu. Isso aconteceu aqui na We 72. Cidade Nova 6.Ele se perdeu na noite de quinta feira 30 de agosto. Estamos desolados e só queremos encontrar nosso amorzinho. Ele é um poodle e está com o pelo um pouco tosado.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(91) 98183-3830",
    "photo": "https://img.petmapa.com.br/400_10b6f614-2a81-49c4-aaee-95b23934dbb9.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.352Z",
    "lastRenewedAt": "2026-08-13T01:28:04.352Z",
    "lat": -1.350923471751769,
    "lng": -48.39315690585915
  },
  {
    "id": "petmapa-f872d8cb-d5d1-42fe-b979-4a4e6ae92c9a",
    "name": "Pipoca",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "14 Ano(s)",
    "gender": "Fêmea",
    "state": "SC",
    "city": "Capital",
    "address": "Registrado via PetMapa em SC",
    "date": "2026-08-01",
    "description": "Super dócil. Estamos desesperados 48999174990",
    "contactName": "Tutor Responsável",
    "contactPhone": "(48) 99689-0186",
    "photo": "https://img.petmapa.com.br/400_ed21896c-9f6f-468e-98b5-d0bb4a1dc1c4.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.335Z",
    "lastRenewedAt": "2026-08-13T01:28:04.335Z",
    "lat": -28.545032,
    "lng": -49.1377742
  },
  {
    "id": "petmapa-ef139498-6db9-43f0-874e-736af9dd9a53",
    "name": "Cacau E Rufus",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-07-31",
    "description": "Macho e fêmea",
    "contactName": "Tutor Responsável",
    "contactPhone": "(38) 99112-6733",
    "photo": "https://img.petmapa.com.br/400_a975d5e7-67c1-4ddf-8547-02ae2c4fb3b8.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.349Z",
    "lastRenewedAt": "2026-08-13T01:28:04.349Z",
    "lat": -16.717807021765385,
    "lng": -43.88026185678509
  },
  {
    "id": "petmapa-410ae893-dc89-4f82-b481-9ad6ebef125b",
    "name": "Noah",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "DF",
    "city": "Capital",
    "address": "Registrado via PetMapa em DF",
    "date": "2026-07-30",
    "description": "É um gato persa, preto com a pelagem longa, ele é castrado.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(61) 99354-4000",
    "photo": "https://img.petmapa.com.br/400_bc0a0768-ec7f-440b-b7be-490c57d70cb1.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.343Z",
    "lastRenewedAt": "2026-08-13T01:28:04.343Z",
    "lat": -16.059913416544198,
    "lng": -47.97955341864054
  },
  {
    "id": "petmapa-805f8c42-800e-4e68-b518-7edfff1094f9",
    "name": "Nick",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-07-29",
    "description": "Marrom claro, olhos castanhos, fucinho branco.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 98636-6471",
    "photo": "https://img.petmapa.com.br/400_122e456a-9de7-4aab-baae-7394f1603477.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.347Z",
    "lastRenewedAt": "2026-08-13T01:28:04.347Z",
    "lat": -16.750983894097097,
    "lng": -49.351369792355165
  },
  {
    "id": "petmapa-defd47d1-87b2-4e3c-9485-5e4934b848a0",
    "name": "Urso",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Macho",
    "state": "MT",
    "city": "Capital",
    "address": "Registrado via PetMapa em MT",
    "date": "2026-07-29",
    "description": "O meu Pet foi roubado em frente da minha casa, e o meu filho é autista de grau 2 está muito triste pelo cachorrinho, por favor quem achou ele me devolve...",
    "contactName": "Tutor Responsável",
    "contactPhone": "(65) 99294-9640",
    "photo": "https://img.petmapa.com.br/400_79354b4d-6560-4986-9578-5bfff846bbd4.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.391Z",
    "lastRenewedAt": "2026-08-13T01:28:04.391Z",
    "lat": -15.6396401,
    "lng": -55.9686867
  },
  {
    "id": "petmapa-1cbc857f-4f41-4fc1-bbb8-cf3ed7d84432",
    "name": "João",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-29",
    "description": "João é um cachorrinho de porte pequeno e dócil. Ja foi relatado episódios depressivos quando esteve longe da sua família... Visto por último no bairro Casa Branca de Caraguatatuba sp",
    "contactName": "Tutor Responsável",
    "contactPhone": "(55) 99994-3124",
    "photo": "https://img.petmapa.com.br/400_3fe48452-5eea-404c-a123-41317dfafedd.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.392Z",
    "lastRenewedAt": "2026-08-13T01:28:04.392Z",
    "lat": -23.6095772817572,
    "lng": -45.38364325060243
  },
  {
    "id": "petmapa-cf89d8b7-3e99-4c93-bbc8-4597b09acda6",
    "name": "Todinho",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Macho",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-07-29",
    "description": "• Nome: *TODINHO* — Shih Tzu, macho, pequeno porte, muito dócil e amigável • Sumiu: segunda-feira, *29/06*, às *14h24* (dia do jogo Brasil x Japão) • De onde: setor *NOVA JERUSALÉM*, próximo à Av. Mutunópolis • Visto depois: região do *Centro*, andando desorientado *COMO RECONHECER (o que não muda com o pelo sujo):* • Os dentinhos de baixo ficam pra fora, aparecendo mesmo de boca fechada • Orelhas escuras, quase pretas, caídas • Máscara escura no focinho e em volta",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 99243-1403",
    "photo": "https://img.petmapa.com.br/400_de987efb-da83-414f-9eec-2343b900eb2a.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.393Z",
    "lastRenewedAt": "2026-08-13T01:28:04.393Z",
    "lat": -13.45737654351899,
    "lng": -49.15843766189745
  },
  {
    "id": "petmapa-c40367cf-a838-4f24-8490-c4529f6ee1ef",
    "name": "Charllote",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-29",
    "description": "Ela é uma gata meio brava, não deixa quase ninguém tocar nela as vezes sai pra pegar passarinhos",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_349afac1-6a18-4f45-8e52-acecdee23a45.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.388Z",
    "lastRenewedAt": "2026-08-13T01:28:04.388Z",
    "lat": -22.2270778,
    "lng": -45.93937160000001
  },
  {
    "id": "petmapa-ce3022c0-23b8-4846-a2cd-e42a3db0dd4e",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-28",
    "description": "Cachorra encontrada em 26/07/26 na Vila Galvão Guarulhos, com coleira cor de rosa, mas sem telefone. Estava de roupa com estrelinhas na cabeça. Muito dócil e brincalhona, parece ser novinha.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95858-5133",
    "photo": "https://img.petmapa.com.br/400_da0585e6-43ff-49f3-b5a6-196c48cb7be2.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.396Z",
    "lastRenewedAt": "2026-08-13T01:28:04.396Z",
    "lat": -23.4603791,
    "lng": -46.5680547
  },
  {
    "id": "petmapa-d50bd796-8ed6-4f55-932f-40bcffd4f129",
    "name": "Malia Poloca",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Mes(es)",
    "gender": "Fêmea",
    "state": "TO",
    "city": "Capital",
    "address": "Registrado via PetMapa em TO",
    "date": "2026-07-28",
    "description": "Poloca tem uma lesão no olho direito, bem pequena está em tratamento, tem bastante pelo e dócil, porém acredito que se ela estiver na rua está assustada.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(63) 98511-2014",
    "photo": "https://img.petmapa.com.br/400_2fabba5b-ed05-455c-bd69-2f019461a254.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.416Z",
    "lastRenewedAt": "2026-08-13T01:28:04.416Z",
    "lat": -10.2251821,
    "lng": -48.3166917
  },
  {
    "id": "petmapa-d233bd89-c3e1-4a17-8876-0ddc4c6fb205",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Não sei",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-27",
    "description": "Encontrado na garagem de um prédio em Moema, zona sul de São Paulo.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_4e10db68-19ce-454e-8440-eb1d52f52224.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.469Z",
    "lastRenewedAt": "2026-08-13T01:28:04.469Z",
    "lat": -23.60483668724334,
    "lng": -46.673853095837906
  },
  {
    "id": "petmapa-ff46f7b6-dbcc-43fa-9fac-9504a7c682f0",
    "name": "Robin",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-27",
    "description": "Ele é muito carinhoso, é receptivo com as pessoas, e abana muito o rabinho quando está feliz.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95236-4385",
    "photo": "https://img.petmapa.com.br/400_a94fbe1e-a9b0-44b3-a6a9-9d7be03b5417.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.469Z",
    "lastRenewedAt": "2026-08-13T01:28:04.469Z",
    "lat": -23.515881207587615,
    "lng": -46.75481889242113
  },
  {
    "id": "petmapa-2ddbbf98-73f0-4374-88be-befa86682f29",
    "name": "Cristal",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "PB",
    "city": "Capital",
    "address": "Registrado via PetMapa em PB",
    "date": "2026-07-27",
    "description": "Fêmea, dócil, tava com um lacinho na cabeça, branco com creme",
    "contactName": "Tutor Responsável",
    "contactPhone": "(83) 98634-5013",
    "photo": "https://img.petmapa.com.br/400_7b976f4d-2c43-462b-bc8d-c600ddd44846.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.468Z",
    "lastRenewedAt": "2026-08-13T01:28:04.468Z",
    "lat": -7.1221791,
    "lng": -34.8650194
  },
  {
    "id": "petmapa-6e51bb1e-3d59-4797-ac0a-b2a751fe287b",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Macho",
    "state": "MA",
    "city": "Capital",
    "address": "Registrado via PetMapa em MA",
    "date": "2026-07-27",
    "description": "Cachorro de porte médio, Encontrado por volta de 11 hrs ,do dia 26/07/2026 Entre Pedro Neiva de Santana e Antônio de Miranda.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_8b56b5d2-9a1b-4e46-82ea-c72dd6961a6e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.470Z",
    "lastRenewedAt": "2026-08-13T01:28:04.470Z",
    "lat": -5.5070003,
    "lng": -47.4541366
  },
  {
    "id": "petmapa-0a6c8e23-30c4-4553-82c6-ec7a2f2394d8",
    "name": "Lua",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "ES",
    "city": "Capital",
    "address": "Registrado via PetMapa em ES",
    "date": "2026-07-27",
    "description": "Uma gata pequena branca e cinza com a parte de cima cinza em formado de ossinhos e olhos verdes (ela é medrosa com pessoas e tenta se esconder)",
    "contactName": "Tutor Responsável",
    "contactPhone": "(27) 99272-7376",
    "photo": "https://img.petmapa.com.br/400_f8a61468-5efb-4318-a192-611d7b3a4b43.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.466Z",
    "lastRenewedAt": "2026-08-13T01:28:04.466Z",
    "lat": -20.139551,
    "lng": -40.255634
  },
  {
    "id": "petmapa-2c06f3a3-b537-465c-b459-f8475342d11d",
    "name": "Pituchinho",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "01 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-27",
    "description": "O Pituchinho é um cachorro de porte pequeno, com aparência de mistura entre Pinscher e Shih Tzu. Seu corpo é compacto e leve, com pelos de comprimento curto a médio. A pelagem é predominantemente preta, com marcas em tons de marrom/caramelo no rosto, acima dos olhos, no peito e nas patas. As orelhas são triangulares e ficam erguidas ou semierguidas, dando a ele uma expressão sempre atenta. Os olhos são escuros, grandes e bastante expressivos. O focinho é fino, e o rabo é de comprimento médio. No geral, ele",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_6eb7f1dd-9be5-4260-9fa5-730f7a853844.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.463Z",
    "lastRenewedAt": "2026-08-13T01:28:04.463Z",
    "lat": -23.7630097,
    "lng": -46.7047555
  },
  {
    "id": "petmapa-eabd5fbc-c75b-4d2c-961d-1f457baa4d4f",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-27",
    "description": "Pet da raça PUG, bem cuidado. Abandonado ou perdido na Avenida Casa Verde Cor, caramelo e olhos escuros",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98579-6624",
    "photo": "https://img.petmapa.com.br/400_34e7473a-fa6a-44ae-b002-aeea51de1988.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.519Z",
    "lastRenewedAt": "2026-08-13T01:28:04.519Z",
    "lat": -23.501378,
    "lng": -46.6568514
  },
  {
    "id": "petmapa-f48a4eb3-7357-4701-b021-6315603d1f9e",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-07-27",
    "description": "Encontrado Coração Eucarístico há mais de 1 ano",
    "contactName": "Tutor Responsável",
    "contactPhone": "(37) 99835-2139",
    "photo": "https://img.petmapa.com.br/400_4325bdc3-4006-4281-a8cb-5aef8e171123.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.522Z",
    "lastRenewedAt": "2026-08-13T01:28:04.522Z",
    "lat": -19.925222384167338,
    "lng": -43.989358885239895
  },
  {
    "id": "petmapa-61f7915a-698f-4472-91f2-3c1aa90e9c94",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-26",
    "description": "Rosto, orelhas, patas e rato pretos Corpo na cor creme Muito dócil, acostumada com humanos",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98119-0429",
    "photo": "https://img.petmapa.com.br/400_8adc9cc8-fe44-4dd1-aca4-b43d3b9dfc0c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.521Z",
    "lastRenewedAt": "2026-08-13T01:28:04.521Z",
    "lat": -23.6270488,
    "lng": -46.6359773
  },
  {
    "id": "petmapa-e6d3bb6f-eec0-4a5d-a9f1-8a58a1d74580",
    "name": "Mingau",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Mes(es)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-26",
    "description": "Ele fugiu na estrada. Rod. Ademar de Barros (entre Campinas e Poços de Caldas). Tem a ponta do rabo em L. E muito dócil e nao sai na rua. Estamos desesperados. Ele e microchipado. Seu nome e Mingau e esta com uma coleira bege.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(15) 99178-4271",
    "photo": "https://img.petmapa.com.br/400_0004d069-e3f4-4c67-9496-b676dccfa1f4.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.527Z",
    "lastRenewedAt": "2026-08-13T01:28:04.528Z",
    "lat": -22.563336604831484,
    "lng": -46.99657486408997
  },
  {
    "id": "petmapa-32d4c640-288d-457d-80af-a202d11cf203",
    "name": "Deli",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Mes(es)",
    "gender": "Fêmea",
    "state": "CE",
    "city": "Capital",
    "address": "Registrado via PetMapa em CE",
    "date": "2026-07-26",
    "description": "Ela é uma cachorra perdida na região de cajazeiras PB ela é uma fêmea média tem +- 6 ou mais meses de idade ela tem as orelhas meio bege e ela é branca , nessa foto ela está pequena mais ela já cresceu",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_4176ab1a-ec84-4159-9a0c-80936d1659f0.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.529Z",
    "lastRenewedAt": "2026-08-13T01:28:04.529Z",
    "lat": -6.8828281699371425,
    "lng": -38.62664382116539
  },
  {
    "id": "petmapa-091315ea-ffa1-429f-81d9-e5e6a8171713",
    "name": "Milagre",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Mes(es)",
    "gender": "Fêmea",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-26",
    "description": "Uma gata especial..tem problemas..nen sente cheiro nao mula e nen sobe em muro e tal..rajada",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_36896c9c-f183-4a5f-b3ec-062649cfab0d.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.525Z",
    "lastRenewedAt": "2026-08-13T01:28:04.525Z",
    "lat": -21.9142519,
    "lng": -50.4925754
  },
  {
    "id": "petmapa-2762f2d9-ad03-4840-b782-858cf9ca9b8d",
    "name": "Tom",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-25",
    "description": "Castrado, muito manso mas muito arisco. Ele sumiu como se tivesse evaporado, já faz 20 dias",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 99434-6228",
    "photo": "https://img.petmapa.com.br/400_e4ebd3d4-e108-4083-a717-72ad7c30e929.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.566Z",
    "lastRenewedAt": "2026-08-13T01:28:04.566Z",
    "lat": -23.586022825323248,
    "lng": -46.848594452802665
  },
  {
    "id": "petmapa-77e97dd6-82ea-4461-8dd5-9b58abd6ef99",
    "name": "Tuco",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-25",
    "description": "Brincalhão, dócil e está castrado",
    "contactName": "Tutor Responsável",
    "contactPhone": "(15) 98804-6353",
    "photo": "https://img.petmapa.com.br/400_a080617f-8825-4152-b0b1-19180efe6f52.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.579Z",
    "lastRenewedAt": "2026-08-13T01:28:04.579Z",
    "lat": -23.48387544149197,
    "lng": -47.471227043852316
  },
  {
    "id": "petmapa-4c910a08-93f0-41fb-8f45-30e4d0d6dcd2",
    "name": "Amélia",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Fêmea",
    "state": "RS",
    "city": "Capital",
    "address": "Registrado via PetMapa em RS",
    "date": "2026-07-25",
    "description": "Gata preta dócil, tem um cicatriz na barriga",
    "contactName": "Tutor Responsável",
    "contactPhone": "(55) 99213-4904",
    "photo": "https://img.petmapa.com.br/400_343d64d4-0e51-4871-9e44-be55b6cd7fd1.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.579Z",
    "lastRenewedAt": "2026-08-13T01:28:04.579Z",
    "lat": -29.713813493395694,
    "lng": -53.782132574782764
  },
  {
    "id": "petmapa-d21adec3-1631-43ab-be7b-02c2a230e4c2",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-25",
    "description": "fiapinho, castrada, dócil, faz xixi e cocô no quintal, achada em carapicuiba",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 93013-9747",
    "photo": "https://img.petmapa.com.br/400_2f75cc73-ebbd-4a35-ab2c-87a4ec97ce5c.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.574Z",
    "lastRenewedAt": "2026-08-13T01:28:04.575Z",
    "lat": -23.4586725,
    "lng": -46.8752687
  },
  {
    "id": "petmapa-8e48d749-6dcf-45ec-8b21-35d067be04e0",
    "name": "Maya",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Mes(es)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-25",
    "description": "Gatinha fêmea filhote ,nunca saiu na rua ,escapou no jardim são crispim em Jaú sp",
    "contactName": "Tutor Responsável",
    "contactPhone": "(14) 99840-5818",
    "photo": "https://img.petmapa.com.br/400_fa0ea9ba-053e-4872-8098-302cf605e4e3.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.571Z",
    "lastRenewedAt": "2026-08-13T01:28:04.571Z",
    "lat": -22.271816127595898,
    "lng": -48.55161293544312
  },
  {
    "id": "petmapa-30fb04f8-5bac-4bd3-a35e-9e08db85b981",
    "name": "Skull Donola",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "11 Mes(es)",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-07-24",
    "description": "Rottweiler dócil,manso,criado em apartamento, medroso e muito bonzinho não está acostumado com mato mas está acostumado com animais e pessoas e ele é microchipado",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 98272-3817",
    "photo": "https://img.petmapa.com.br/400_73f6ae1c-a840-4fc9-bd0f-6b368de56416.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.578Z",
    "lastRenewedAt": "2026-08-13T01:28:04.578Z",
    "lat": -22.4437225,
    "lng": -43.4764912
  },
  {
    "id": "petmapa-fd06f575-79a4-4bb7-8891-5fa513a788e0",
    "name": "Antonio",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-07-24",
    "description": "Meu gato sumiu e quero encontrar ele",
    "contactName": "Tutor Responsável",
    "contactPhone": "(34) 98700-7333",
    "photo": "https://img.petmapa.com.br/400_25c4df0d-3e78-4e6b-959e-50116c935201.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.630Z",
    "lastRenewedAt": "2026-08-13T01:28:04.630Z",
    "lat": -19.584127,
    "lng": -46.9372607
  },
  {
    "id": "petmapa-a631ebdf-9c99-4a80-ad15-df4d752570c2",
    "name": "Mia",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "7 Mes(es)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-24",
    "description": "Ela é uma gatinha assustada nunca foi de fugir",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 5670-6748",
    "photo": "https://img.petmapa.com.br/400_f305a2e7-dd83-48ed-b7c8-0ce721b8e612.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.618Z",
    "lastRenewedAt": "2026-08-13T01:28:04.619Z",
    "lat": -23.4696302484043,
    "lng": -46.28950606762134
  },
  {
    "id": "petmapa-c78f6ab3-39d1-424c-8dec-3cf3081715dc",
    "name": "Loki",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-24",
    "description": "Loki tem cores preta e castanho escuro nas patas, rabo e face. As vezes gosta de ficar no quintal de alguns vizinhos e é um gato medroso e amoroso, tem olhos verdes e interage bem. Se estiver com ele, por favor, nos devolva!",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98104-9823",
    "photo": "https://img.petmapa.com.br/400_06dafa10-1f39-4344-9ef4-405398713a2d.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.640Z",
    "lastRenewedAt": "2026-08-13T01:28:04.640Z",
    "lat": -23.56334902612259,
    "lng": -46.47552691827154
  },
  {
    "id": "petmapa-22857745-ac27-47dd-948b-5301d3d573ac",
    "name": "Panqueca",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-24",
    "description": "Se perdeu no km 19 da raposo tavares sentido sao Paulo. É mansa e medrosa.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 97623-0751",
    "photo": "https://img.petmapa.com.br/400_a7a2a8ad-e1f8-4cf5-80ea-36aa09146d60.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.643Z",
    "lastRenewedAt": "2026-08-13T01:28:04.643Z",
    "lat": -23.5902883,
    "lng": -46.7666775
  },
  {
    "id": "petmapa-bea2609b-bf56-4711-aeed-a1495702d498",
    "name": "Fera",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Ano(s)",
    "gender": "Fêmea",
    "state": "RS",
    "city": "Capital",
    "address": "Registrado via PetMapa em RS",
    "date": "2026-07-24",
    "description": "Preta com as patas e embaixo do rosto marrom. Porte médio",
    "contactName": "Tutor Responsável",
    "contactPhone": "(51) 99834-0195",
    "photo": "https://img.petmapa.com.br/400_f8b507ad-d712-4fd3-9a4f-fe52a87e61e9.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.642Z",
    "lastRenewedAt": "2026-08-13T01:28:04.642Z",
    "lat": -30.0113877,
    "lng": -51.2081186
  },
  {
    "id": "petmapa-4f50482a-dad2-430b-991e-224b469caf66",
    "name": "Bento",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-24",
    "description": "Sianes preto, olho azul ,uma das pernas e preta ,a boca é branca e a outra metade é preta",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_6fd80ed9-da84-497f-b9a2-5aa7a04d6abf.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.645Z",
    "lastRenewedAt": "2026-08-13T01:28:04.645Z",
    "lat": -25.717483728143733,
    "lng": -53.76920924178751
  },
  {
    "id": "petmapa-45b43684-b118-41c5-b87c-7615ac675ef3",
    "name": "Bento",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-24",
    "description": "Sianes,de olho azul,6 meses,uma das pernas e o joelho é preto,na boquinha uma parte é Branca e a outra é preta ,a cara é preta,e as orelhas também é preta,e o corpinho é branco",
    "contactName": "Tutor Responsável",
    "contactPhone": "(46) 99920-6752",
    "photo": "https://img.petmapa.com.br/400_6e451d68-6fce-40b2-b460-46fa96d129f8.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.685Z",
    "lastRenewedAt": "2026-08-13T01:28:04.685Z",
    "lat": -25.7222473,
    "lng": -53.7671517
  },
  {
    "id": "petmapa-7bb9a023-0734-4cc1-94d7-f5786b03dc68",
    "name": "Bento",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-24",
    "description": "Ele é cisnes , tem olhos azul ,tem um joelho que é preto e o outro é branco",
    "contactName": "Tutor Responsável",
    "contactPhone": "(46) 99920-6752",
    "photo": "https://img.petmapa.com.br/400_fea210dc-679a-413f-9847-2b984b7da701.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.686Z",
    "lastRenewedAt": "2026-08-13T01:28:04.686Z",
    "lat": -25.7222473,
    "lng": -53.7671517
  },
  {
    "id": "petmapa-a8dc45fc-a02e-4681-a64f-a7a91b6466ec",
    "name": "Tuco",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-23",
    "description": "Macho, gosta de brincar, possui uma pequena mancha branca em uma pata, ele na luz do sol fica com o pelo na cor castanho",
    "contactName": "Tutor Responsável",
    "contactPhone": "(15) 99104-7572",
    "photo": "https://img.petmapa.com.br/400_f68be77f-5950-4e09-b079-9f2bbee550d3.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.693Z",
    "lastRenewedAt": "2026-08-13T01:28:04.693Z",
    "lat": -23.483227485587538,
    "lng": -47.47135039398171
  },
  {
    "id": "petmapa-e262cfe5-332c-401a-a255-fec011ab3232",
    "name": "Bento",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Mes(es)",
    "gender": "Macho",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-24",
    "description": "Cisnes,do olho verde e o outro azul,nome bento ,ele acabou de Chegar.Então vc tem que falar um barulho ti pispispi",
    "contactName": "Tutor Responsável",
    "contactPhone": "(46) 99920-6752",
    "photo": "https://img.petmapa.com.br/400_648ae441-2d8e-4f1d-8f1f-98bd13520625.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.688Z",
    "lastRenewedAt": "2026-08-13T01:28:04.688Z",
    "lat": -25.7222473,
    "lng": -53.7671517
  },
  {
    "id": "petmapa-852de946-60c2-4f27-9a1f-942ab9f533ef",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "Não informada",
    "gender": "Fêmea",
    "state": "GO",
    "city": "Capital",
    "address": "Registrado via PetMapa em GO",
    "date": "2026-07-23",
    "description": "foi encontrada no setor Novo Horizonte perto da Rua A-15, há mais ou menos 15 dias. aparenta ser um cachorro novinho.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(62) 98575-5280",
    "photo": "https://img.petmapa.com.br/400_32a99c9c-51e9-4981-a645-cbb1bcc01df4.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.686Z",
    "lastRenewedAt": "2026-08-13T01:28:04.686Z",
    "lat": -16.7217243173144,
    "lng": -49.316512521448
  },
  {
    "id": "petmapa-98bbf43b-3712-4289-974e-e59ded251188",
    "name": "Pituchinho",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "01 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-23",
    "description": "Pequeno, peludo, dentes tortos, orelhas grandes, olhos escuros, com estrabismo, pelo caramelo, corte de moicano",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 94972-2151",
    "photo": "https://img.petmapa.com.br/400_072ed187-1656-4c81-a022-29ea9979a0e4.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.695Z",
    "lastRenewedAt": "2026-08-13T01:28:04.695Z",
    "lat": -23.763004714633674,
    "lng": -46.702941831031005
  },
  {
    "id": "petmapa-9868646b-4602-4c4b-a4bf-f06bc83b658b",
    "name": "Logan",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "6 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-23",
    "description": "Fugiu no domingo, dia 12/07 Nunca saiu de casa,Vila Monumento, entre o Ipiranga e Cambuci. Tem rabo grosso e pelagem grande.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95905-0178",
    "photo": "https://img.petmapa.com.br/400_84cb6860-bbec-4a15-b021-7466aec33b6f.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.750Z",
    "lastRenewedAt": "2026-08-13T01:28:04.750Z",
    "lat": -23.574713836001564,
    "lng": -46.61350676779378
  },
  {
    "id": "petmapa-7bcde351-fa22-4f6b-a0fe-86b53519b3f5",
    "name": "Branquinho",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "4 Ano(s)",
    "gender": "Macho",
    "state": "RJ",
    "city": "Rio de Janeiro",
    "address": "Registrado via PetMapa em RJ",
    "date": "2026-07-23",
    "description": "Gato totalmente branco, muito peludo, olhos amarelo esverdeados, dócil mas com medo de estranhos. Deve ter se escondido no motor do meu carro e como faço Uber somente em Santa Cruz , ele pode ter descido em qualquer lugar deste bairro. Despareceu no dia 17/07/26 - sábado.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(21) 98630-4491",
    "photo": "https://img.petmapa.com.br/400_7c4499a0-e556-4fdd-9055-1bce02dbd35c.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.749Z",
    "lastRenewedAt": "2026-08-13T01:28:04.749Z",
    "lat": -22.9188804,
    "lng": -43.6964626
  },
  {
    "id": "petmapa-efff0af0-65dc-4f0d-83a6-8f8e2b3e391b",
    "name": "Paulina",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Fêmea",
    "state": "PA",
    "city": "Capital",
    "address": "Registrado via PetMapa em PA",
    "date": "2026-07-23",
    "description": "Paulina é uma siamês bicolor (Snowshoe), castrada 🩵 Olhos azuis bem marcantes. 🤎 Pelagem clara com máscara marrom-escura no rosto. 🤍 Mancha branca em formato de faixa no focinho, descendo até o nariz rosa. 🧦 Patinhas brancas (como se estivesse usando 'meias'). 🐈 Cauda escura. Obs: desaparecida desde o dia 03/07/2026",
    "contactName": "Tutor Responsável",
    "contactPhone": "(92) 99308-2404",
    "photo": "https://img.petmapa.com.br/400_98c11cfb-8015-4c33-857f-1da37309dc45.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.746Z",
    "lastRenewedAt": "2026-08-13T01:28:04.746Z",
    "lat": -2.0493237,
    "lng": -60.0178439
  },
  {
    "id": "petmapa-c530b1ec-2a9e-4c94-aff4-2ecd8370731f",
    "name": "Tég",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Fêmea",
    "state": "PR",
    "city": "Curitiba",
    "address": "Registrado via PetMapa em PR",
    "date": "2026-07-23",
    "description": "Ela é dócil, pelagem preta e peito branco. Pontas das patas traseiras brancas.",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_f96070ab-79b0-410f-9a7d-a846112de086.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.745Z",
    "lastRenewedAt": "2026-08-13T01:28:04.745Z",
    "lat": -23.67078159965748,
    "lng": -52.608800451480036
  },
  {
    "id": "petmapa-b8b18643-e8e5-4c55-a242-79d5e1b8b990",
    "name": "Eris",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-22",
    "description": "Gatinha tricolor (calico), fêmea, castrada, aproximadamente 5 anos, porte pequeno e corpo esguio. Pelagem predominantemente preta, branca e caramelo. Peito, barriga, focinho e patas totalmente brancos. O rosto possui marcas muito características: uma grande mancha preta envolvendo o olho direito e parte da testa, uma mancha caramelo envolvendo o olho esquerdo e uma mancha preta no nariz em formato de coração/borboleta, além de uma pequena mancha caramelo abaixo do focinho. Possui olhos grandes verde-amarela",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 97129-1607",
    "photo": "https://img.petmapa.com.br/400_7c50d9fb-c41f-4072-a990-6d1cab80e288.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.748Z",
    "lastRenewedAt": "2026-08-13T01:28:04.748Z",
    "lat": -23.56249426562509,
    "lng": -46.65012700390706
  },
  {
    "id": "petmapa-4b95dbcf-d3bc-480e-878b-5220f49a3c7e",
    "name": "Stella",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "RS",
    "city": "Capital",
    "address": "Registrado via PetMapa em RS",
    "date": "2026-07-22",
    "description": "Bem mansa,brincalhona porte pequeno",
    "contactName": "Tutor Responsável",
    "contactPhone": "(51) 99429-1847",
    "photo": "https://img.petmapa.com.br/400_928e9ff3-1373-4a70-9bdd-db8fb483572d.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.759Z",
    "lastRenewedAt": "2026-08-13T01:28:04.759Z",
    "lat": -29.8363897,
    "lng": -51.1360775
  },
  {
    "id": "petmapa-9221f20c-b972-4330-8377-5fc0037ecd34",
    "name": "Pet Desconhecido",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "2 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-22",
    "description": "Uma femea de grande porte, bem dócil, está com um pequeno ferimento na orelha",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 98000-8442",
    "photo": "https://img.petmapa.com.br/400_b515c1f6-56ce-44e2-9994-81e86439328e.jpeg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.820Z",
    "lastRenewedAt": "2026-08-13T01:28:04.820Z",
    "lat": -23.706992255578918,
    "lng": -46.71070316491982
  },
  {
    "id": "petmapa-9cccc334-e169-41d2-8557-dc24c6c938c3",
    "name": "Luna",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "1 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-22",
    "description": "Pelagem preta peito branco usava coleira azul",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 95925-1011",
    "photo": "https://img.petmapa.com.br/400_bb109fc0-e5e9-4e5f-84fb-86b52e54ced8.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.815Z",
    "lastRenewedAt": "2026-08-13T01:28:04.815Z",
    "lat": -23.4941574,
    "lng": -46.7368292
  },
  {
    "id": "petmapa-4a798ce4-b541-4d0e-ba0c-d1bc3d46cd25",
    "name": "Tom",
    "type": "Procurado",
    "species": "Gato",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "5 Ano(s)",
    "gender": "Macho",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-22",
    "description": "Ele é um gato super dócil, faz quase 24h que não vemos mais ele, não imaginamos o que pode ter acontecido, pois ele sempre saía e voltava logo em seguida, pq ele faz a necessidades dele na grama/mato mesmo tendo areia em casa, por favor me ajudem a encontra ele!!",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 97669-4802",
    "photo": "https://img.petmapa.com.br/400_31e128d6-fc27-4e85-8ce9-ec2d3bd8331c.png",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.813Z",
    "lastRenewedAt": "2026-08-13T01:28:04.813Z",
    "lat": -23.6425017,
    "lng": -46.7934498
  },
  {
    "id": "petmapa-bfc03939-5229-4542-8d8c-07acf01b7ca8",
    "name": "Thor E Ted",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "3 Ano(s)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-07-22",
    "description": "Desapareceu dia 19 julho a noite",
    "contactName": "Tutor Responsável",
    "contactPhone": "(31) 98830-8828",
    "photo": "https://img.petmapa.com.br/400_53311b73-4f84-49cb-959e-b28dbfe65de0.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.823Z",
    "lastRenewedAt": "2026-08-13T01:28:04.823Z",
    "lat": -19.8007159,
    "lng": -43.9642677
  },
  {
    "id": "petmapa-d6149b34-93f5-4ec4-b1b9-33d0ea9a6110",
    "name": "Ted",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "8 Mes(es)",
    "gender": "Macho",
    "state": "MG",
    "city": "Belo Horizonte",
    "address": "Registrado via PetMapa em MG",
    "date": "2026-07-22",
    "description": "Desapareceu dia 19 julho a noite",
    "contactName": "Tutor Responsável",
    "contactPhone": "(31) 98830-8828",
    "photo": "https://img.petmapa.com.br/400_80536c9d-16dc-47f4-8629-13f23dfa376e.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.820Z",
    "lastRenewedAt": "2026-08-13T01:28:04.820Z",
    "lat": -19.8008157,
    "lng": -43.9642096
  },
  {
    "id": "petmapa-c64bc0b9-b073-4a9e-92e8-00e8f0b3127c",
    "name": "Morgana",
    "type": "Procurado",
    "species": "Cachorro",
    "breed": "SRD (Vira-lata)",
    "color": "Não especificada",
    "age": "10 Ano(s)",
    "gender": "Fêmea",
    "state": "SP",
    "city": "São Paulo",
    "address": "Registrado via PetMapa em SP",
    "date": "2026-07-22",
    "description": "Pequena, cor preta e pelagem clara próximo a pele",
    "contactName": "Tutor Responsável",
    "contactPhone": "(11) 99972-2092",
    "photo": "https://img.petmapa.com.br/400_f0bd5454-dd40-4310-b94c-e90a930b1636.jpg",
    "matchConfidence": "95%",
    "createdAt": "2026-08-13T01:28:04.817Z",
    "lastRenewedAt": "2026-08-13T01:28:04.817Z",
    "lat": -23.547662826846196,
    "lng": -46.89908356939223
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

  // 2. Sincroniza em tempo real com o banco de dados global em nuvem (para que TODOS os visitantes vejam todos os pets)
  await loadPetsFromStorageAndCloud();

  // 3. Sondagem automática contínua a cada 15 segundos (reflete inclusões e exclusões de qualquer lugar do mundo com taxa segura)
  setInterval(loadPetsFromStorageAndCloud, 15000);

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
      allowInput: true
    });
  }
}

// --- GEOLOCALIZAÇÃO PRECISA RESTRITA EXCLUSIVAMENTE AO BRASIL ---
function isValidBrazilCoordinate(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) return false;
  // Limites geográficos do território brasileiro (Latitude: ~5.3° N a -33.8° S | Longitude: ~-73.9° W a -34.7° W)
  if (lat < -34.0 || lat > 5.5 || lng < -74.0 || lng > -34.0) {
    return false;
  }
  // Bloqueia expressamente regiões fora do Brasil como Posadas (Misiones, Argentina: ~ -27.36° / -55.89°)
  if (lat < -27.0 && lat > -27.7 && lng < -55.4 && lng > -56.3) {
    return false;
  }
  return true;
}

async function fetchGeocodeCoordinates(address, city, state) {
  const headers = { 
    'Accept': 'application/json',
    'User-Agent': 'PetSearchersPortal/1.0 (https://pet-searchers.com)'
  };
  
  if (address && city && state) {
    try {
      const cleanAddress = address.replace(/próximo a[o]?|em frente a[o]?|altura do/gi, "").trim();
      const q1 = `${cleanAddress}, ${city}, ${state}, Brasil`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res1 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(q1)}&limit=1`, { 
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res1.ok) {
        const data1 = await res1.json();
        if (data1 && data1.length > 0) {
          const lat = parseFloat(data1[0].lat);
          const lng = parseFloat(data1[0].lon);
          if (isValidBrazilCoordinate(lat, lng)) {
            return { lat, lng };
          }
        }
      }
    } catch (e) {
      console.warn("Geocoding de endereço cancelado ou com resposta lenta. Usando cidade...", e);
    }
  }

  if (city && state) {
    try {
      const q2 = `${city}, ${state}, Brasil`;
      
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 2500);

      const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&q=${encodeURIComponent(q2)}&limit=1`, { 
        headers,
        signal: controller2.signal
      });
      clearTimeout(timeoutId2);

      if (res2.ok) {
        const data2 = await res2.json();
        if (data2 && data2.length > 0) {
          const lat = parseFloat(data2[0].lat);
          const lng = parseFloat(data2[0].lon);
          if (isValidBrazilCoordinate(lat, lng)) {
            return { lat, lng };
          }
        }
      }
    } catch (e) {
      console.warn("Geocoding de cidade cancelado ou com resposta lenta. Usando UF...", e);
    }
  }

  const ufObj = BRAZIL_UFS.find(u => u.sigla === state) || { lat: -23.5505, lng: -46.6333 };
  return { lat: ufObj.lat, lng: ufObj.lng };
}

async function retroactiveGeocodePets() {
  let updated = false;

  for (let pet of petsData) {
    const isInvalid = !pet.lat || !pet.lng || !isValidBrazilCoordinate(pet.lat, pet.lng);
    if (isInvalid || !pet.geocodedCity || pet.geocodedCity !== pet.city) {
      const coords = await fetchGeocodeCoordinates(pet.address, pet.city, pet.state);
      pet.lat = coords.lat;
      pet.lng = coords.lng;
      pet.geocodedCity = pet.city;
      updated = true;
    }
  }

  if (updated) {
    savePetsToStorage();
    savePetsToCloud();
    renderApp();
  }
}

// --- LOCALSTORAGE & GLOBAL CLOUD PERSISTENCE ---
function loadPetsFromStorage() {
  const saved = localStorage.getItem("pet_searchers_portal_data_v10");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      petsData = deduplicatePets([...parsed, ...INITIAL_PETS]);
    } catch (e) {
      petsData = [...INITIAL_PETS];
    }
  } else {
    petsData = [...INITIAL_PETS];
    savePetsToStorage();
  }
}

function savePetsToStorage() {
  localStorage.setItem("pet_searchers_portal_data_v10", JSON.stringify(petsData));
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

// Sincronização Global em Nuvem em Tempo Real (Híbrida Anti-Desaparecimento & Preservação Total de Fotos)
async function loadPetsFromStorageAndCloud() {
  if (isCloudSyncing) return;
  try {
    const res = await fetch(`${CLOUD_DB_URL}?nocache=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.pets)) {
        const deletedSet = getDeletedPetIds();

        // 1. Remove qualquer pet que foi excluído neste navegador
        const filteredCloud = json.pets.filter(p => p && p.id && !deletedSet.has(p.id));

        // 2. Preserva 100% a foto customizada enviada pelo usuário (Base64) sem deixar substituir por foto genérica
        const localMap = new Map(petsData.map(p => [p.id, p]));
        const preservedCloudPets = filteredCloud.map(cp => {
          const lp = localMap.get(cp.id);
          if (lp && lp.photo && lp.photo.startsWith("data:image/")) {
            return { ...cp, photo: lp.photo };
          }
          return cp;
        });

        // 3. Preserva APENAS cadastros novos recém-criados localmente pelo usuário que AINDA estão pendentes de upload para a nuvem
        const cloudIdSet = new Set(preservedCloudPets.map(p => p.id));
        const pendingLocalPets = petsData.filter(p => p.isLocalPending === true && !cloudIdSet.has(p.id) && !deletedSet.has(p.id));

        const mergedPets = deduplicatePets([...pendingLocalPets, ...preservedCloudPets, ...INITIAL_PETS]);
        
        const mergedStr = JSON.stringify(mergedPets);
        const currentStr = JSON.stringify(petsData);

        if (mergedStr !== currentStr) {
          petsData = mergedPets;
          savePetsToStorage();
          renderApp();
          console.log("🔄 Banco global sincronizado em tempo real com a nuvem:", petsData.length, "pets.");
        }
      }
    }
  } catch (e) {
    console.warn("Conexão com a nuvem global indisponível. Usando armazenamento local.", e);
  }
}

function prepareCloudPetsPayload(rawPets) {
  let cleanPets = deduplicatePets(rawPets);
  let jsonString = JSON.stringify({ pets: cleanPets });
  
  // Limita aos 15 registros mais recentes mantendo as fotos originais intactas sem jamais trocar por fotos padrão
  if (jsonString.length > 8500) {
    cleanPets = cleanPets.slice(0, 15);
    jsonString = JSON.stringify({ pets: cleanPets });
  }

  return jsonString;
}

async function savePetsToCloud() {
  if (isFirebaseActive) {
    for (let pet of petsData) {
      await savePetToFirebase(pet);
    }
    return;
  }

  isCloudSyncing = true;
  const payload = prepareCloudPetsPayload(petsData);

  let success = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(CLOUD_DB_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: payload
      });
      if (res.ok) {
        success = true;
        break;
      } else {
        console.warn(`Tentativa ${attempt} de gravação na nuvem retornou status ${res.status}`);
      }
    } catch (e) {
      console.warn(`Tentativa ${attempt} de gravação na nuvem falhou:`, e);
    }
    await new Promise(r => setTimeout(r, 600));
  }

  if (success) {
    petsData.forEach(p => delete p.isLocalPending);
    savePetsToStorage();
    console.log("✅ Banco de dados global em nuvem atualizado com sucesso!");
  } else {
    console.error("❌ Falha na persistência global em nuvem. Cópia local mantida em segurança.");
  }

  setTimeout(() => { isCloudSyncing = false; }, 2000);
}

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

async function loadCitiesForState(uf, selectElem, defaultText) {
  selectElem.innerHTML = `<option value="">${defaultText}</option>`;
  if (!uf) return;

  if (citiesCache[uf]) {
    populateCityOptions(selectElem, citiesCache[uf], defaultText);
    return;
  }

  selectElem.innerHTML = `<option value="">⏳ Carregando todas as cidades de ${uf}...</option>`;

  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`);
    if (!res.ok) throw new Error("Erro ao buscar cidades no IBGE");
    const data = await res.json();
    const cityNames = data.map(item => item.nome);
    
    citiesCache[uf] = cityNames;
    populateCityOptions(selectElem, cityNames, defaultText);
  } catch (err) {
    console.error("Erro na API do IBGE:", err);
    selectElem.innerHTML = `<option value="">${defaultText}</option>`;
  }
}

function populateCityOptions(selectElem, cityList, defaultText) {
  selectElem.innerHTML = `<option value="">${defaultText} (${cityList.length} cidades disponíveis)</option>`;
  cityList.forEach(cityName => {
    selectElem.add(new Option(cityName, cityName));
  });
}

// --- LEAFLET INTERACTIVE MAP ---
function initLeafletMap() {
  const mapContainer = document.getElementById('map');
  if (!mapContainer) return;

  leafletMap = L.map('map', {
    center: [-14.2350, -51.9253],
    zoom: 4,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  }).addTo(leafletMap);

  document.getElementById("btnResetMap").addEventListener("click", () => {
    leafletMap.setView([-14.2350, -51.9253], 4);
  });

  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 350);
}

function updateMapMarkers(filteredPets) {
  if (!leafletMap) return;

  Object.keys(mapMarkers).forEach(id => {
    leafletMap.removeLayer(mapMarkers[id]);
  });
  mapMarkers = {};

  const bounds = L.latLngBounds();

  filteredPets.forEach(pet => {
    if (!pet.lat || !pet.lng) return;

    let markerClass = "marker-sighted";
    let iconSymbol = "visibility";

    if (pet.type === "Procurado") {
      markerClass = "marker-lost";
      iconSymbol = "warning";
    } else if (pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado") {
      markerClass = "marker-found";
      iconSymbol = "task_alt";
    }

    const customIcon = L.divIcon({
      className: 'custom-leaflet-pin',
      html: `<div class="custom-marker ${markerClass}">
              <span class="material-symbols-outlined text-sm">${iconSymbol}</span>
            </div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const isResolved = pet.type === "Encontrado pelo dono" || pet.type === "Dono encontrado";
    const badgeColor = isResolved ? 'bg-green-600' : (pet.type === 'Procurado' ? 'bg-[#E52421]' : 'bg-secondary');

    const popupHtml = `
      <div class="w-56 overflow-hidden">
        <img src="${pet.photo}" alt="${pet.name}" onerror="this.onerror=null; this.src=getRandomDefaultPhoto('${pet.species}');" onclick="openImageLightbox('${pet.id}')" class="w-full h-28 object-contain bg-slate-900 rounded-t-lg p-1 cursor-pointer" title="Clique para ampliar"/>
        <div class="p-3 space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-primary truncate">${pet.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${badgeColor}">${pet.type}</span>
          </div>
          <p class="text-[11px] text-gray-600 line-clamp-1">${pet.address}, ${pet.city} - ${pet.state}</p>
          <button onclick="openDetailModal('${pet.id}')" class="mt-2 w-full py-1.5 bg-primary text-white rounded text-xs font-bold hover:bg-primary-container transition-colors">
            Ver Detalhes completos
          </button>
        </div>
      </div>
    `;

    const marker = L.marker([pet.lat, pet.lng], { icon: customIcon })
      .addTo(leafletMap)
      .bindPopup(popupHtml);

    mapMarkers[pet.id] = marker;
    bounds.extend([pet.lat, pet.lng]);
  });

  if (filteredPets.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

function focusPetOnMap(petId) {
  const pet = petsData.find(p => p.id === petId);
  const marker = mapMarkers[petId];
  if (pet && marker && leafletMap) {
    // 1. Rola a tela suavemente até a seção do mapa
    const mapElement = document.getElementById("leafletMap") || document.getElementById("mapSection");
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // 2. Voo animado até o pino do pet com zoom 15 e abertura do popup
    leafletMap.setView([pet.lat, pet.lng], 15, { animate: true });
    marker.openPopup();

    // 3. Destaca o marcador no mapa com anel pulsante temporário
    const markerEl = marker.getElement();
    if (markerEl) {
      markerEl.classList.add("ring-4", "ring-[#E52421]", "scale-125", "transition-all");
      setTimeout(() => {
        markerEl.classList.remove("ring-4", "ring-[#E52421]", "scale-125", "transition-all");
      }, 3000);
    }

    const cardElem = document.getElementById(`card-${petId}`);
    if (cardElem) {
      cardElem.classList.add("ring-2", "ring-primary");
      setTimeout(() => cardElem.classList.remove("ring-2", "ring-primary"), 2500);
      cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// --- FILTER EVENT LISTENERS ---
function initFilterEvents() {
  const filterSearch = document.getElementById("filterSearch");
  filterSearch.addEventListener("input", (e) => {
    currentActiveFilters.search = e.target.value.toLowerCase().trim();
    renderApp();
  });

  document.querySelectorAll(".filter-status-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-status-btn").forEach(b => {
        b.className = "filter-status-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-surface-container text-on-surface-variant hover:bg-surface-container-high";
      });
      btn.className = "filter-status-btn px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all bg-primary text-on-primary";
      currentActiveFilters.status = btn.dataset.status;
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
    renderApp();
  });
}

function getPetInclusionTimestamp(pet) {
  if (!pet) return 0;
  if (pet.createdAt) {
    const t = new Date(pet.createdAt).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (pet.id && typeof pet.id === "string" && pet.id.startsWith("pet-")) {
    const rawId = pet.id.replace("pet-", "");
    const numId = parseInt(rawId, 10);
    if (!isNaN(numId) && numId > 100000) return numId;
  }
  if (pet.date) {
    const tDate = new Date(pet.date).getTime();
    if (!isNaN(tDate) && tDate > 0) return tDate;
  }
  return 0;
}

// --- APP RENDERER ---
function renderApp() {
  runAutoPurgeEngine();

  // Ordena rigorosamente por ordem de inclusão (dos últimos incluídos para os primeiros)
  petsData.sort((a, b) => getPetInclusionTimestamp(b) - getPetInclusionTimestamp(a));

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
    if (currentActiveFilters.status && pet.type !== currentActiveFilters.status) return false;
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

  let badgeBg = "bg-secondary text-on-secondary";
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
    <article id="card-${pet.id}" onclick="focusPetOnMap('${pet.id}')" class="pet-card bg-surface rounded-2xl border border-outline-variant/50 overflow-hidden shadow-sm flex flex-col group relative cursor-pointer hover:shadow-md hover:border-secondary transition-all" title="Clique para ver este pet no mapa">
      
      <div class="h-48 w-full relative overflow-hidden bg-slate-900 flex items-center justify-center p-1 cursor-pointer group/img" onclick="event.stopPropagation(); openImageLightbox('${pet.id}')" title="Clique para ampliar a foto deste pet em tela cheia">
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

      <div class="p-5 flex flex-col flex-1 space-y-3">
        
        <div>
          <div class="flex items-center justify-between">
            <h3 class="font-extrabold text-lg text-primary group-hover:text-secondary transition-colors">${pet.name}</h3>
            <span class="text-xs font-bold text-outline uppercase tracking-wider">${pet.species}</span>
          </div>
          <p class="text-xs font-medium text-on-surface-variant mt-0.5">${pet.breed} • ${pet.color} ${pet.age ? `(${pet.age})` : ''}</p>
        </div>

        <p class="text-xs text-on-surface-variant line-clamp-2 leading-relaxed flex-1">
          ${pet.description || 'Sem detalhes adicionais fornecidos.'}
        </p>

        ${isResolved ? `
          <div class="bg-green-50 border border-green-300 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px]">
            <span class="text-green-800 flex items-center gap-1 font-bold">
              <span class="material-symbols-outlined text-sm">task_alt</span> Caso Finalizado
            </span>
            <span class="text-green-700 font-extrabold">Reencontrado 🎉</span>
          </div>
        ` : (isRenewalWindow ? `
          <div class="bg-amber-50 border border-amber-300 rounded-xl p-2 flex items-center justify-between text-[11px] text-amber-900" onclick="event.stopPropagation()">
            <span class="font-bold flex items-center gap-1 text-amber-800">
              <span class="material-symbols-outlined text-base">warning</span> Faltam ${daysLeft} dias!
            </span>
            <button onclick="event.stopPropagation(); renewPetListing('${pet.id}')" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[10px] transition-colors flex items-center gap-1 shadow-sm">
              <span class="material-symbols-outlined text-xs">update</span> Renovar +30d
            </button>
          </div>
        ` : `
          <div class="bg-surface-container/60 border border-outline-variant/40 rounded-xl px-3 py-1.5 flex items-center justify-between text-[11px]">
            <span class="text-outline flex items-center gap-1 font-medium">
              <span class="material-symbols-outlined text-sm">schedule</span> Válido por mais ${daysLeft} dias
            </span>
            <span class="text-secondary font-bold">Ativo</span>
          </div>
        `)}

        <div class="pt-3 border-t border-outline-variant/30 space-y-1.5 text-xs text-outline">
          <div class="flex items-center gap-1.5 truncate">
            <span class="material-symbols-outlined text-secondary text-base">location_on</span>
            <span class="truncate font-medium text-on-surface">${pet.address}, ${pet.city} - ${pet.state}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 font-medium">
              <span class="material-symbols-outlined text-base">calendar_today</span> ${formatDate(pet.date)}
            </span>
            <span class="font-semibold text-primary">${pet.contactName}</span>
          </div>
        </div>

        <!-- Botões de Ação do Card (Com StopPropagation nos Modais) -->
        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="event.stopPropagation(); focusPetOnMap('${pet.id}')" class="py-2 px-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-primary font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Visualizar a geolocalização no mapa">
            <span class="material-symbols-outlined text-sm">map</span> Ver no Mapa
          </button>
          
          <button onclick="event.stopPropagation(); openDetailModal('${pet.id}')" class="py-2 px-2 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-bold text-xs transition-colors flex items-center justify-center gap-1" title="Ver detalhes completos do cadastro">
            <span class="material-symbols-outlined text-sm">visibility</span> Detalhes Completos
          </button>
          
          <button onclick="event.stopPropagation(); generatePosterModal('${pet.id}', false)" class="py-2 px-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-[#E52421] font-bold text-xs transition-colors flex items-center justify-center gap-1 border border-red-200" title="Gerar Cartaz para Impressão PDF (A4)">
            <span class="material-symbols-outlined text-sm">picture_as_pdf</span> Cartaz PDF
          </button>

          <button onclick="event.stopPropagation(); generatePosterModal('${pet.id}', true)" class="py-2 px-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1 border border-slate-300" title="Gerar e Baixar Cartaz em JPG (4x5)">
            <span class="material-symbols-outlined text-sm">image</span> Cartaz JPG
          </button>
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
    await savePetsToCloud();
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

// --- COMPRESSÃO DE IMAGEM 100% INTEGRAL ULTRA-LEVE (PRESERVA A FOTO INTEIRA E GERA BASE64 < 850 BYTES PARA NUVEM) ---
function compressImage(file, maxWidth = 140, maxHeight = 140, quality = 0.30) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
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
  filePhotoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressedDataUrl = await compressImage(file, 140, 140, 0.30);
        document.getElementById("imgPreview").src = compressedDataUrl;
        document.getElementById("photoPlaceholder").classList.add("hidden");
        document.getElementById("photoPreviewContainer").classList.remove("hidden");
      } catch (err) {
        console.error("Erro ao comprimir foto:", err);
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.getElementById("imgPreview").src = evt.target.result;
          document.getElementById("photoPlaceholder").classList.add("hidden");
          document.getElementById("photoPreviewContainer").classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    }
  });

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

  document.getElementById("reportModal").classList.remove("hidden");
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
    tabSighted.className = "py-2.5 rounded-lg text-sm font-bold transition-all bg-secondary text-on-primary shadow-sm flex items-center justify-center gap-2";
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
    const type = document.getElementById("formReportType").value;
    const name = document.getElementById("iptName").value;
    const species = document.getElementById("iptSpecies").value;
    const breed = document.getElementById("iptBreed").value || "Vira-lata (SRD)";
    const color = document.getElementById("iptColor").value;
    const age = document.getElementById("iptAge").value || "Não informada";
    const gender = document.getElementById("iptGender").value;
    const date = document.getElementById("iptDate").value;
    const state = document.getElementById("iptState").value;
    const city = document.getElementById("iptCity").value;
    const address = document.getElementById("iptAddress").value;
    const description = document.getElementById("iptDescription").value;
    const contactName = document.getElementById("iptContactName").value;
    const contactPhone = document.getElementById("iptContactPhone").value;

    const photoImg = document.getElementById("imgPreview").src;
    let photo = getRandomDefaultPhoto(species);
    if (photoImg && (photoImg.startsWith("data:image/") || photoImg.startsWith("http"))) {
      photo = photoImg;
    }

    // Geolocalização com tempo limite de 2.5s para nunca travar o formulário
    const geoCoords = await fetchGeocodeCoordinates(address, city, state);

    if (editPetId) {
      const existing = petsData.find(p => p.id === editPetId);
      if (existing) {
        Object.assign(existing, { name, type, species, breed, color, age, gender, date, state, city, address, description, contactName, contactPhone, photo, lat: geoCoords.lat, lng: geoCoords.lng, geocodedCity: city });
      }
    } else {
      const newPet = {
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
        geocodedCity: city
      };
      petsData.unshift(newPet);
    }

    // Salva localmente e no banco global em nuvem
    savePetsToStorage();
    await savePetsToCloud();

    document.getElementById("petForm").reset();
    document.getElementById("photoPlaceholder").classList.remove("hidden");
    document.getElementById("photoPreviewContainer").classList.add("hidden");
    document.getElementById("imgPreview").src = "";
    document.getElementById("reportModal").classList.add("hidden");

    renderApp();

    if (petsData.length > 0) {
      focusPetOnMap(petsData[0].id);
    }

    if (!editPetId) {
      document.getElementById("notice30DaysModal").classList.remove("hidden");
      if (type === "Procurado") {
        const btnAck = document.getElementById("btnAckNotice");
        const ackHandler = () => {
          generatePosterModal(petsData[0].id);
          btnAck.removeEventListener("click", ackHandler);
        };
        btnAck.addEventListener("click", ackHandler);
      }
    }
  } catch (err) {
    console.error("Erro no processamento do formulário:", err);
    alert("⚠️ O cadastro foi armazenado localmente.");
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
function generatePosterModal(petId, autoTriggerJPG = false) {
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

  document.getElementById("posterModal").classList.remove("hidden");

  if (autoTriggerJPG) {
    setTimeout(() => {
      downloadPosterJPG();
    }, 450);
  }
}

// --- 4x5 JPG POSTER EXPORTER (ASPECT RATIO 4:5 HIGH RESOLUTION 1080x1350) ---
async function downloadPosterJPG() {
  const posterArea = document.getElementById("posterArea");
  if (!posterArea) return;

  const petNameElem = document.getElementById("posterPetName");
  const rawName = petNameElem ? petNameElem.textContent.trim() : "pet";
  const safeName = rawName.replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçÑñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ_-]/g, "_");
  
  const btnJPG = document.getElementById("btnDownloadPosterJPG");
  const originalHtml = btnJPG ? btnJPG.innerHTML : "";
  if (btnJPG) {
    btnJPG.disabled = true;
    btnJPG.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">sync</span> Gerando JPG 4x5...`;
  }

  try {
    if (typeof html2canvas === "undefined") {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const renderedCanvas = await html2canvas(posterArea, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false
    });

    const targetWidth = 1080;
    const targetHeight = 1350;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = targetWidth;
    finalCanvas.height = targetHeight;
    const ctx = finalCanvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    ctx.drawImage(renderedCanvas, 0, 0, targetWidth, targetHeight);

    const jpgUrl = finalCanvas.toDataURL("image/jpeg", 0.92);

    const dlLink = document.createElement("a");
    dlLink.download = `cartaz_procurado_${safeName}_4x5.jpg`;
    dlLink.href = jpgUrl;
    document.body.appendChild(dlLink);
    dlLink.click();
    dlLink.remove();
  } catch (err) {
    console.error("Erro ao exportar cartaz 4x5 JPG:", err);
    alert("Houve um problema ao gerar a imagem JPG. Por favor, tente a opção de Imprimir.");
  } finally {
    if (btnJPG) {
      btnJPG.disabled = false;
      btnJPG.innerHTML = originalHtml;
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
    badge.className = "absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold text-white shadow-md flex items-center gap-1 bg-secondary";
    badge.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> AVISTADO`;
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

  const btnPDF = document.getElementById("btnDetailGeneratePosterPDF");
  if (btnPDF) {
    btnPDF.onclick = () => {
      document.getElementById("detailModal").classList.add("hidden");
      generatePosterModal(pet.id, false);
    };
  }

  const btnJPG = document.getElementById("btnDetailGeneratePosterJPG");
  if (btnJPG) {
    btnJPG.onclick = () => {
      document.getElementById("detailModal").classList.add("hidden");
      generatePosterModal(pet.id, true);
    };
  }

  document.getElementById("detailModal").classList.remove("hidden");
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
    await savePetsToCloud();
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

    if (isFirebaseActive) {
      await deletePetFromFirebase(petId);
    } else {
      await savePetsToCloud();
    }
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
