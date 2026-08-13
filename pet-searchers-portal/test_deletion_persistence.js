const fs = require('fs');

console.log("--- TESTING DELETION PERSISTENCE LOGIC ---");

// Initial pets in Incognito mode before cloud pull
let incognitoLocalPets = [
  { id: "pet-100", name: "Negão" },
  { id: "pet-101", name: "Thor" },
  { id: "pet-102", name: "Desconhecido (Gato Amarelo)" }
];

// Cloud data after Normal Tab deleted Negão and Thor
let cloudPets = [
  { id: "pet-102", name: "Desconhecido (Gato Amarelo)" }
];

// Deduplicate helper
function deduplicatePets(pets) {
  const seen = new Set();
  return pets.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

// FIX: Only preserve pets that have isLocalPending === true
const cloudIdSet = new Set(cloudPets.map(p => p.id));
const pendingLocalPets = incognitoLocalPets.filter(p => p.isLocalPending === true && !cloudIdSet.has(p.id));

const mergedIncognitoPets = deduplicatePets([...pendingLocalPets, ...cloudPets]);

console.log("INCOGNITO RENDERED PETS:", mergedIncognitoPets.map(p => p.name));
// Expect ONLY: [ 'Desconhecido (Gato Amarelo)' ]
