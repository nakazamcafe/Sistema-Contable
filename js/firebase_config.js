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

// 1. Escuchar cambios de usuarios en tiempo real
function listenCloudUsers(callback) {
  if (!db) return;
  db.collection("users").onSnapshot((snapshot) => {
    const cloudUsers = [];
    snapshot.forEach((doc) => {
      cloudUsers.push(doc.data());
    });
    if (cloudUsers.length > 0) {
      const current = localStorage.getItem("sistema_contable_users");
      const nextStr = JSON.stringify(cloudUsers);
      if (current !== nextStr) {
        localStorage.setItem("sistema_contable_users", nextStr);
        if (callback) callback(cloudUsers);
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
    .catch(err => console.error("Error al guardar usuario en nube:", err));
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
      const current = localStorage.getItem("sistema_contable_companies");
      const nextStr = JSON.stringify(cloudCompanies);
      if (current !== nextStr) {
        localStorage.setItem("sistema_contable_companies", nextStr);
        if (callback) callback(cloudCompanies);
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
    .catch(err => console.error("Error al guardar empresa en nube:", err));
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
      const current = localStorage.getItem(`sistema_contable_accounts_${companyId}`);
      const nextStr = JSON.stringify(accounts);
      if (current !== nextStr) {
        localStorage.setItem(`sistema_contable_accounts_${companyId}`, nextStr);
        if (callback) callback(accounts);
      }
    }
  }, (error) => {
    console.warn(`Límite o aviso en nube (cuentas ${companyId}):`, error.message);
  });
}

// 6. Guardar catálogo completo o cuenta en la nube
function saveCloudAccounts(companyId, accountsArray) {
  if (!db || !companyId) return;
  const batch = db.batch();
  accountsArray.forEach(acc => {
    const ref = db.collection(`accounts_${companyId}`).doc(acc.code.replace(/\//g, '_'));
    batch.set(ref, acc, { merge: true });
  });
  batch.commit()
    .then(() => console.log(`☁️ Catálogo de ${companyId} sincronizado en la nube.`))
    .catch(err => console.error("Error al guardar catálogo en nube:", err));
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
      const current = localStorage.getItem(`sistema_contable_polizas_${companyId}`);
      const nextStr = JSON.stringify(polizas);
      if (current !== nextStr) {
        localStorage.setItem(`sistema_contable_polizas_${companyId}`, nextStr);
        if (callback) callback(polizas);
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
    .catch(err => console.error("Error al guardar póliza en nube:", err));
}
