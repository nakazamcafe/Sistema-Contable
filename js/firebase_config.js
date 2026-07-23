/**
 * Configuración y Conector de Firebase Cloud Firestore
 * Sincroniza usuarios, empresas, catálogos y pólizas en tiempo real 24/7.
 */

// Reemplaza los siguientes valores con tu proyecto gratuito de Firebase (Console -> Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyCZx7R8yCk4ZBwnl9pQPrWyfFZzjrsjp6w",
  authDomain: "sistema-contable-712cd.firebaseapp.com",
  projectId: "sistema-contable-712cd",
  storageBucket: "sistema-contable-712cd.firebasestorage.app",
  messagingSenderId: "359183140598",
  appId: "1:359183140598:web:e93eb4df25cf3aa6e3ced7",
  measurementId: "G-9QGMTTF9QX"
};

let db = null;

// Inicializar Firebase si el SDK está disponible
if (typeof firebase !== 'undefined') {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    console.log("🔥 Google Firebase Firestore conectado exitosamente.");
  } catch (err) {
    console.warn("⚠️ Firebase no inicializado. Usando modo local (localStorage).", err);
  }
}

// --- HELPERS DE SINCRONIZACIÓN EN LA NUBE ---

let lastSeenUsers = null;
let lastSeenCompanies = null;
const lastSeenAccounts = {};
const lastSeenPolizas = {};

function areUsersEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));
  const s2 = [...arr2].sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));
  for (let i = 0; i < s1.length; i++) {
    if (String(s1[i].username || "").trim() !== String(s2[i].username || "").trim() || 
        String(s1[i].fullName || "").trim() !== String(s2[i].fullName || "").trim() || 
        String(s1[i].role || "").trim() !== String(s2[i].role || "").trim()) {
      return false;
    }
  }
  return true;
}

function areCompaniesEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  const s2 = [...arr2].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  for (let i = 0; i < s1.length; i++) {
    if (String(s1[i].id || "").trim() !== String(s2[i].id || "").trim() || 
        String(s1[i].name || "").trim() !== String(s2[i].name || "").trim() || 
        String(s1[i].rfc || "").trim() !== String(s2[i].rfc || "").trim()) {
      return false;
    }
  }
  return true;
}

function areAccountsEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  const s2 = [...arr2].sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));
  for (let i = 0; i < s1.length; i++) {
    const a = s1[i];
    const b = s2[i];
    if (String(a.code || "").trim() !== String(b.code || "").trim() ||
        String(a.name || "").trim() !== String(b.name || "").trim() ||
        String(a.type || "").trim() !== String(b.type || "").trim() ||
        Number(a.level || 0) !== Number(b.level || 0) ||
        String(a.satCode || "").trim() !== String(b.satCode || "").trim() ||
        String(a.parentCode || "").trim() !== String(b.parentCode || "").trim()) {
      return false;
    }
  }
  return true;
}

function arePolizasEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  const s2 = [...arr2].sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
  
  for (let i = 0; i < s1.length; i++) {
    const p1 = s1[i];
    const p2 = s2[i];
    if (String(p1.id || "").trim() !== String(p2.id || "").trim() ||
        String(p1.number || "").trim() !== String(p2.number || "").trim() ||
        String(p1.date || "").trim() !== String(p2.date || "").trim() ||
        String(p1.type || "").trim() !== String(p2.type || "").trim() ||
        String(p1.concept || "").trim() !== String(p2.concept || "").trim() ||
        String(p1.createdBy || "").trim() !== String(p2.createdBy || "").trim()) {
      return false;
    }
    const l1 = p1.lines || [];
    const l2 = p2.lines || [];
    if (l1.length !== l2.length) return false;
    for (let j = 0; j < l1.length; j++) {
      const line1 = l1[j];
      const line2 = l2[j];
      if (String(line1.accountCode || "").trim() !== String(line2.accountCode || "").trim() ||
          String(line1.concept || "").trim() !== String(line2.concept || "").trim() ||
          Number(line1.debit || 0) !== Number(line2.debit || 0) ||
          Number(line1.credit || 0) !== Number(line2.credit || 0) ||
          String(line1.reference || "").trim() !== String(line2.reference || "").trim()) {
        return false;
      }
    }
  }
  return true;
}

// 1. Escuchar cambios de usuarios en tiempo real
function listenCloudUsers(callback) {
  if (!db) return;
  db.collection("users").onSnapshot((snapshot) => {
    const cloudUsers = [];
    snapshot.forEach((doc) => {
      cloudUsers.push(doc.data());
    });
    
    // Asegurar que el administrador por defecto siempre exista en la lista sincronizada
    if (!cloudUsers.some(u => u.username.toLowerCase() === "admin")) {
      cloudUsers.push({
        username: "admin",
        fullName: "Administrador General",
        role: "admin",
        active: true,
        assignedCompanies: ["*"]
      });
    }

    if (cloudUsers.length > 0 && !areUsersEqual(lastSeenUsers, cloudUsers)) {
      lastSeenUsers = cloudUsers;
      const storageKey = "sistema_contable_users";
      const sorted = [...cloudUsers].sort((a, b) => a.username.localeCompare(b.username));
      localStorage.setItem(storageKey, JSON.stringify(sorted));
      if (callback) callback(sorted);
    }
  }, (error) => {
    console.warn("Límite o aviso en nube (usuarios):", error.message);
    alert(`⚠️ Error de conexión a Firebase (Usuarios):\n${error.message}\n\nEs probable que las Reglas de Seguridad de tu Firestore hayan expirado. Por favor, revísalas en Firebase Console.`);
  });
}

// 2. Guardar / Actualizar un usuario en la nube
function saveCloudUser(userObj) {
  if (!db) return;
  db.collection("users").doc(userObj.username).set(userObj, { merge: true })
    .then(() => console.log(`☁️ Usuario ${userObj.username} sincronizado en la nube.`))
    .catch(err => {
      console.error("Error al guardar usuario en nube:", err);
      alert(`⚠️ Error al sincronizar usuario con Firebase:\n${err.message}\n\nVerifica las Reglas de Seguridad en tu Firebase Console.`);
    });
}

// 3. Escuchar empresas en tiempo real
function listenCloudCompanies(callback) {
  if (!db) return;
  db.collection("companies").onSnapshot((snapshot) => {
    const cloudCompanies = [];
    snapshot.forEach((doc) => {
      cloudCompanies.push(doc.data());
    });
    if (cloudCompanies.length > 0 && !areCompaniesEqual(lastSeenCompanies, cloudCompanies)) {
      lastSeenCompanies = cloudCompanies;
      const storageKey = "sistema_contable_companies";
      const sorted = [...cloudCompanies].sort((a, b) => a.id.localeCompare(b.id));
      localStorage.setItem(storageKey, JSON.stringify(sorted));
      if (callback) callback(sorted);
    }
  }, (error) => {
    console.warn("Límite o aviso en nube (empresas):", error.message);
    alert(`⚠️ Error de conexión a Firebase (Empresas):\n${error.message}\n\nEs probable que las Reglas de Seguridad de tu Firestore hayan expirado. Por favor, revísalas en Firebase Console.`);
  });
}

// 4. Guardar empresa en la nube
function saveCloudCompany(companyObj) {
  if (!db) return;
  db.collection("companies").doc(companyObj.id).set(companyObj, { merge: true })
    .then(() => console.log(`☁️ Empresa ${companyObj.name} sincronizada en la nube.`))
    .catch(err => {
      console.error("Error al guardar empresa en nube:", err);
      alert(`⚠️ Error al sincronizar empresa con Firebase:\n${err.message}\n\nVerifica las Reglas de Seguridad en tu Firebase Console.`);
    });
}

// 5. Escuchar catálogo de cuentas en tiempo real
function listenCloudAccounts(companyId, callback) {
  if (!db || !companyId) return;
  db.collection(`accounts_${companyId}`).onSnapshot((snapshot) => {
    const accounts = [];
    snapshot.forEach((doc) => {
      accounts.push(doc.data());
    });
    const last = lastSeenAccounts[companyId];
    if (accounts.length > 0 && !areAccountsEqual(last, accounts)) {
      lastSeenAccounts[companyId] = accounts;
      const storageKey = `sistema_contable_accounts_${companyId}`;
      const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
      localStorage.setItem(storageKey, JSON.stringify(sorted));
      if (callback) callback(sorted);
    }
  }, (error) => {
    console.warn(`Límite o aviso en nube (cuentas ${companyId}):`, error.message);
    alert(`⚠️ Error de conexión a Firebase (Catálogo):\n${error.message}\n\nEs probable que las Reglas de Seguridad de tu Firestore hayan expirado. Por favor, revísalas en Firebase Console.`);
  });
}

// 6. Guardar catálogo completo o cuenta en la nube
function saveCloudAccounts(companyId, accountsArray) {
  if (!db || !companyId) return;

  const CHUNK_SIZE = 400;
  const chunks = [];
  for (let i = 0; i < accountsArray.length; i += CHUNK_SIZE) {
    chunks.push(accountsArray.slice(i, i + CHUNK_SIZE));
  }

  let completed = 0;
  let hasError = false;

  chunks.forEach((chunk, index) => {
    const batch = db.batch();
    chunk.forEach(acc => {
      const ref = db.collection(`accounts_${companyId}`).doc(acc.code.replace(/\//g, '_'));
      batch.set(ref, acc, { merge: true });
    });

    batch.commit()
      .then(() => {
        completed++;
        console.log(`☁️ Lote de catálogo ${index + 1}/${chunks.length} sincronizado.`);
        if (completed === chunks.length && !hasError) {
          console.log("🔥 Catálogo completo sincronizado con éxito.");
        }
      })
      .catch(err => {
        hasError = true;
        console.error(`Error en lote de catálogo ${index + 1}:`, err);
        alert(`⚠️ Error al sincronizar catálogo con Firebase (Lote ${index + 1}):\n${err.message}\n\nVerifica las reglas de seguridad en Firebase Console.`);
      });
  });
}

// 7. Escuchar pólizas en tiempo real
function listenCloudPolizas(companyId, callback) {
  if (!db || !companyId) return;
  db.collection(`polizas_${companyId}`).onSnapshot((snapshot) => {
    const polizas = [];
    snapshot.forEach((doc) => {
      polizas.push(doc.data());
    });
    const last = lastSeenPolizas[companyId];
    if (polizas.length > 0 && !arePolizasEqual(last, polizas)) {
      lastSeenPolizas[companyId] = polizas;
      const storageKey = `sistema_contable_polizas_${companyId}`;
      const sorted = [...polizas].sort((a, b) => a.id.localeCompare(b.id));
      localStorage.setItem(storageKey, JSON.stringify(sorted));
      if (callback) callback(sorted);
    }
  }, (error) => {
    console.warn(`Límite o aviso en nube (pólizas ${companyId}):`, error.message);
    alert(`⚠️ Error de conexión a Firebase (Pólizas):\n${error.message}\n\nEs probable que las Reglas de Seguridad de tu Firestore hayan expirado. Por favor, revísalas en Firebase Console.`);
  });
}

// 8. Guardar póliza individual en la nube
function saveCloudPoliza(companyId, polizaObj) {
  if (!db || !companyId) return;
  db.collection(`polizas_${companyId}`).doc(polizaObj.id).set(polizaObj, { merge: true })
    .then(() => console.log(`☁️ Póliza ${polizaObj.number} sincronizada en la nube.`))
    .catch(err => {
      console.error("Error al guardar póliza en nube:", err);
      alert(`⚠️ Error al sincronizar póliza con Firebase:\n${err.message}\n\nVerifica las Reglas de Seguridad en tu Firebase Console.`);
    });
}

// 9. Eliminar póliza de la nube
function deleteCloudPoliza(companyId, polizaId) {
  if (!db || !companyId) return;
  db.collection(`polizas_${companyId}`).doc(polizaId).delete()
    .then(() => console.log(`☁️ Póliza ${polizaId} eliminada de la nube.`))
    .catch(err => console.error("Error al eliminar póliza de la nube:", err));
}

// 10. Guardar múltiples pólizas en lote (batch) en la nube
function saveCloudPolizasBulk(companyId, polizasArray) {
  if (!db || !companyId) return;

  const CHUNK_SIZE = 400;
  const chunks = [];
  for (let i = 0; i < polizasArray.length; i += CHUNK_SIZE) {
    chunks.push(polizasArray.slice(i, i + CHUNK_SIZE));
  }

  let completed = 0;
  let hasError = false;

  chunks.forEach((chunk, index) => {
    const batch = db.batch();
    chunk.forEach(pol => {
      const ref = db.collection(`polizas_${companyId}`).doc(pol.id);
      batch.set(ref, pol, { merge: true });
    });

    batch.commit()
      .then(() => {
        completed++;
        console.log(`☁️ Lote de pólizas ${index + 1}/${chunks.length} sincronizado.`);
      })
      .catch(err => {
        hasError = true;
        console.error(`Error en lote de pólizas ${index + 1}:`, err);
        alert(`⚠️ Error al sincronizar pólizas (Lote ${index + 1}) con Firebase:\n${err.message}\n\nVerifica las Reglas de Seguridad en tu Firebase Console.`);
      });
  });
}
