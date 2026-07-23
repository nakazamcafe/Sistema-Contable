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

function areUsersEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  const s2 = [...arr2].sort((a, b) => (a.username || "").localeCompare(b.username || ""));
  for (let i = 0; i < s1.length; i++) {
    if (s1[i].username !== s2[i].username || s1[i].fullName !== s2[i].fullName || s1[i].role !== s2[i].role) {
      return false;
    }
  }
  return true;
}

function areCompaniesEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  const s2 = [...arr2].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  for (let i = 0; i < s1.length; i++) {
    if (s1[i].id !== s2[i].id || s1[i].name !== s2[i].name || s1[i].rfc !== s2[i].rfc) {
      return false;
    }
  }
  return true;
}

function areAccountsEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  const s2 = [...arr2].sort((a, b) => (a.code || "").localeCompare(b.code || ""));
  for (let i = 0; i < s1.length; i++) {
    const a = s1[i];
    const b = s2[i];
    if (a.code !== b.code ||
        a.name !== b.name ||
        a.type !== b.type ||
        a.level !== b.level ||
        (a.satCode || "") !== (b.satCode || "") ||
        (a.parentCode || "") !== (b.parentCode || "")) {
      return false;
    }
  }
  return true;
}

function arePolizasEqual(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
  if (arr1.length !== arr2.length) return false;
  const s1 = [...arr1].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  const s2 = [...arr2].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  
  for (let i = 0; i < s1.length; i++) {
    const p1 = s1[i];
    const p2 = s2[i];
    if (p1.id !== p2.id ||
        p1.number !== p2.number ||
        p1.date !== p2.date ||
        p1.type !== p2.type ||
        p1.concept !== p2.concept ||
        p1.createdBy !== p2.createdBy) {
      return false;
    }
    const l1 = p1.lines || [];
    const l2 = p2.lines || [];
    if (l1.length !== l2.length) return false;
    for (let j = 0; j < l1.length; j++) {
      if (l1[j].accountCode !== l2[j].accountCode ||
          l1[j].concept !== l2[j].concept ||
          Number(l1[j].debit) !== Number(l2[j].debit) ||
          Number(l1[j].credit) !== Number(l2[j].credit) ||
          (l1[j].reference || "") !== (l2[j].reference || "")) {
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
    if (cloudUsers.length > 0) {
      const storageKey = "sistema_contable_users";
      const localRaw = localStorage.getItem(storageKey);
      const localUsers = localRaw ? JSON.parse(localRaw) : [];
      if (!areUsersEqual(localUsers, cloudUsers)) {
        const sorted = [...cloudUsers].sort((a, b) => a.username.localeCompare(b.username));
        localStorage.setItem(storageKey, JSON.stringify(sorted));
        if (callback) callback(sorted);
      }
    }
  }, (error) => {
    console.warn("Límite o aviso en nube (usuarios):", error.message);
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
    if (cloudCompanies.length > 0) {
      const storageKey = "sistema_contable_companies";
      const localRaw = localStorage.getItem(storageKey);
      const localCompanies = localRaw ? JSON.parse(localRaw) : [];
      if (!areCompaniesEqual(localCompanies, cloudCompanies)) {
        const sorted = [...cloudCompanies].sort((a, b) => a.id.localeCompare(b.id));
        localStorage.setItem(storageKey, JSON.stringify(sorted));
        if (callback) callback(sorted);
      }
    }
  }, (error) => {
    console.warn("Límite o aviso en nube (empresas):", error.message);
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
    if (accounts.length > 0) {
      const storageKey = `sistema_contable_accounts_${companyId}`;
      const localRaw = localStorage.getItem(storageKey);
      const localAccounts = localRaw ? JSON.parse(localRaw) : [];
      if (!areAccountsEqual(localAccounts, accounts)) {
        const sorted = [...accounts].sort((a, b) => a.code.localeCompare(b.code));
        localStorage.setItem(storageKey, JSON.stringify(sorted));
        if (callback) callback(sorted);
      }
    }
  }, (error) => {
    console.warn(`Límite o aviso en nube (cuentas ${companyId}):`, error.message);
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
    if (polizas.length > 0) {
      const storageKey = `sistema_contable_polizas_${companyId}`;
      const localRaw = localStorage.getItem(storageKey);
      const localPolizas = localRaw ? JSON.parse(localRaw) : [];
      if (!arePolizasEqual(localPolizas, polizas)) {
        const sorted = [...polizas].sort((a, b) => a.id.localeCompare(b.id));
        localStorage.setItem(storageKey, JSON.stringify(sorted));
        if (callback) callback(sorted);
      }
    }
  }, (error) => {
    console.warn(`Límite o aviso en nube (pólizas ${companyId}):`, error.message);
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
