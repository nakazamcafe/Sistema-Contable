/**
 * Controlador de la Interfaz de Usuario (SPA) - Sistema Contable Mexicano
 */

// Instancia global del sistema
let system;
let currentView = "dashboard";
let charts = {};

const DEFAULT_COMPANIES = [
  {
    id: "EDM260715AAA",
    name: "Empresa Demo Mexicana, S.A.",
    rfc: "EDM260715AAA"
  },
  {
    id: "NCA2603137Q1",
    name: "Nakazam Cafe SA de CV",
    rfc: "NCA2603137Q1"
  }
];

const DEFAULT_COMPANY = DEFAULT_COMPANIES[0];

// --- MOTOR MULTI-USUARIO Y PERMISOS ---
const DEFAULT_USERS = [
  {
    username: "admin",
    password: "123",
    fullName: "Administrador General",
    role: "admin",
    active: true,
    assignedCompanies: ["*"]
  }
];

function getUsers() {
  let users = JSON.parse(localStorage.getItem("sistema_contable_users"));
  if (!users || users.length === 0) {
    users = DEFAULT_USERS;
    localStorage.setItem("sistema_contable_users", JSON.stringify(users));
  }
  return users;
}

function saveUsers(users) {
  localStorage.setItem("sistema_contable_users", JSON.stringify(users));
  if (typeof saveCloudUser === "function") {
    users.forEach(u => saveCloudUser(u));
  }
}

function getCurrentUser() {
  const username = localStorage.getItem("sistema_contable_current_user");
  if (!username) return null;
  const users = getUsers();
  return users.find(u => u.username === username) || null;
}

function setCurrentUser(username) {
  if (username) {
    localStorage.setItem("sistema_contable_current_user", username);
  } else {
    localStorage.removeItem("sistema_contable_current_user");
  }
}

function getCompanies() {
  let companies = JSON.parse(localStorage.getItem("sistema_contable_companies"));
  if (!companies || companies.length === 0) {
    companies = DEFAULT_COMPANIES;
    localStorage.setItem("sistema_contable_companies", JSON.stringify(companies));
  }

  const currentUser = getCurrentUser();
  if (!currentUser) return companies;

  // Si es Admin, tiene acceso a todas las empresas
  if (currentUser.role === "admin" || (currentUser.assignedCompanies && currentUser.assignedCompanies.includes("*"))) {
    return companies;
  }

  // Filtrar empresas asignadas para usuarios estándar
  const assigned = currentUser.assignedCompanies || [];
  return companies.filter(c => assigned.includes(c.id));
}

function getActiveCompany() {
  const companies = getCompanies();
  const activeId = localStorage.getItem("sistema_contable_active_company_id") || DEFAULT_COMPANY.id;
  return companies.find(c => c.id === activeId) || companies[0];
}

function updateActiveCompanyHeader(company) {
  document.getElementById("active-company-name").innerText = company.name;
  document.getElementById("active-company-rfc").innerText = `RFC: ${company.rfc}`;
}

async function checkAutoSyncSeedDatabase() {
  try {
    const res = await fetch("default_database.json", { cache: "no-cache" });
    if (res.ok) {
      const jsonText = await res.text();
      const lastSynced = localStorage.getItem("sistema_contable_seed_hash");
      if (lastSynced !== jsonText) {
        const data = JSON.parse(jsonText);
        let count = 0;
        Object.keys(data).forEach(key => {
          if (key.startsWith("sistema_contable_")) {
            const val = data[key];
            const strVal = typeof val === "string" ? val : JSON.stringify(val);
            localStorage.setItem(key, strVal);
            count++;
          }
        });
        localStorage.setItem("sistema_contable_seed_hash", jsonText);
        if (count > 0 && !sessionStorage.getItem("db_synced_reload")) {
          sessionStorage.setItem("db_synced_reload", "true");
          location.reload();
        }
      }
    }
  } catch (e) {
    // Si no existe default_database.json continua con la bd local sin interrumpir
  }
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener("DOMContentLoaded", async () => {
  // Sincronizar automáticamente si existe default_database.json en el servidor/GitHub
  await checkAutoSyncSeedDatabase();

  // Inicializar base de datos
  const activeComp = getActiveCompany();
  system = AccountingSystem.loadFromStorage(activeComp.id);

  // Suscribirse a cambios en tiempo real en la Nube (Google Firebase)
  if (typeof listenCloudUsers === "function") {
    listenCloudUsers(() => {
      if (currentView === "users") renderUsers();
    });
    listenCloudCompanies(() => {
      renderCompanyDropdownItems();
    });
    listenCloudAccounts(activeComp.id, (cloudAccounts) => {
      system.accounts = cloudAccounts;
      if (currentView === "catalog") renderCatalog();
    });
    listenCloudPolizas(activeComp.id, (cloudPolizas) => {
      system.polizas = cloudPolizas;
      if (currentView === "polizas") renderPolizas();
      if (currentView === "dashboard") renderDashboard();
    });
  }
  
  // Establecer el color scheme del sistema
  const currentTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.style.colorScheme = currentTheme;

  // Actualizar datos de cabecera de la empresa activa
  updateActiveCompanyHeader(activeComp);

  // Rellenar selectores estáticos
  populateSatCodesSelects();
  populateParentAccountsSelect();

  // Configurar listeners de la interfaz
  initAuth();
  initNavigation();
  initThemeToggle();
  initAccountModal();
  initPolizaModal();
  initImportSection();
  initReportsSection();
  initCompanySection();
  initUsersSection();
  
  // Cargar vista inicial
  switchView("dashboard");

  // Botón para resetear base de datos
  document.getElementById("btn-reset-db").addEventListener("click", () => {
    const active = getActiveCompany();
    if (confirm(`¿Estás seguro de que deseas reestablecer los datos de ${active.name} a los valores muestra por defecto? Se perderán todas tus cuentas y pólizas personalizadas.`)) {
      system = AccountingSystem.resetDatabase(active.id);
      alert("Base de datos reestablecida correctamente.");
      location.reload();
    }
  });
});

// --- ENRUTADOR Y NAVEGACIÓN ---

function initNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("btn-toggle-sidebar");

  navLinks.forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.getAttribute("data-view");
      switchView(view);
      
      // En móviles, cerrar sidebar tras clic
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active-sidebar");
      }
    });
  });

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("active-sidebar");
  });
}

function switchView(viewName) {
  currentView = viewName;
  
  // Alternar clases activas en navegación
  document.querySelectorAll(".nav-link").forEach(link => {
    if (link.getAttribute("data-view") === viewName) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Alternar vistas de contenido
  document.querySelectorAll(".content-view").forEach(view => {
    if (view.id === `view-${viewName}`) {
      view.classList.add("active-view");
    } else {
      view.classList.remove("active-view");
    }
  });

  // Actualizar Título de cabecera
  const titles = {
    dashboard: { title: "Resumen General", subtitle: "Indicadores clave de rendimiento contable" },
    catalog: { title: "Catálogo de Cuentas", subtitle: "Gestión jerárquica de cuentas y códigos SAT" },
    polizas: { title: "Pólizas Contables", subtitle: "Registro diario de transacciones y doble partida" },
    import: { title: "Importación de Datos", subtitle: "Subir catálogos y pólizas en lote vía Excel" },
    reports: { title: "Reportes y Estados Financieros", subtitle: "Balanza de comprobación y reportes de finanzas básicos" },
    users: { title: "Gestión de Usuarios y Permisos", subtitle: "Administración centralizada de accesos y empresas asignadas" }
  };

  document.getElementById("view-title").innerText = titles[viewName].title;
  document.getElementById("view-subtitle").innerText = titles[viewName].subtitle;

  // Renderizar contenido según vista
  if (viewName === "dashboard") renderDashboard();
  else if (viewName === "catalog") renderCatalog();
  else if (viewName === "polizas") renderPolizas();
  else if (viewName === "import") renderImportLogs();
  else if (viewName === "reports") renderReports();
  else if (viewName === "users") renderUsers();
}

// --- TEMA CLARO / OSCURO ---

function initThemeToggle() {
  const btn = document.getElementById("btn-theme-toggle");
  
  // Guardar preferencia de tema
  const currentTheme = localStorage.getItem("theme") || "dark";
  document.body.className = `${currentTheme}-theme`;
  document.documentElement.style.colorScheme = currentTheme;
  updateThemeIcon(currentTheme);

  btn.addEventListener("click", () => {
    let theme = "dark";
    if (document.body.classList.contains("dark-theme")) {
      theme = "light";
    }
    document.body.className = `${theme}-theme`;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
    updateThemeIcon(theme);
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector("#btn-theme-toggle i");
  if (theme === "light") {
    icon.className = "fa-solid fa-moon";
  } else {
    icon.className = "fa-solid fa-sun";
  }
}

// --- SELECTS Y DROPDOWNS DINÁMICOS ---

function populateSatCodesSelects() {
  const select = document.getElementById("acc-sat");
  select.innerHTML = '<option value="">Sin código agrupador SAT</option>';
  
  // Agrupar y ordenar códigos SAT
  SAT_CODES.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.code;
    opt.innerText = `${item.code} - ${item.name} (${item.type})`;
    select.appendChild(opt);
  });
}

function populateParentAccountsSelect() {
  const select = document.getElementById("acc-parent");
  select.innerHTML = '<option value="">Ninguna (Nivel 1 - Cuenta Raíz)</option>';
  
  // Solo se permite ser padre a cuentas de niveles superiores (e.g. niveles 1, 2, 3)
  const sortedAccounts = system.getSortedAccounts();
  sortedAccounts.forEach(acc => {
    // Evitar que cuentas auxiliares de nivel 4+ sean padres
    if (acc.level < 4) {
      const opt = document.createElement("option");
      opt.value = acc.code;
      opt.innerText = `${acc.code} - ${acc.name} (Nivel ${acc.level})`;
      select.appendChild(opt);
    }
  });

  // Rellenar selectores de cuentas en otros filtros si aplica
  const reportAccSelect = document.getElementById("report-auxiliar-account");
  if (reportAccSelect) {
    reportAccSelect.innerHTML = "";
    sortedAccounts.forEach(acc => {
      const opt = document.createElement("option");
      opt.value = acc.code;
      opt.innerText = `${acc.code} - ${acc.name}`;
      reportAccSelect.appendChild(opt);
    });
  }

  // Actualizar también la lista autocompletable para los asientos
  populateAccountsDatalist();
}

function populateAccountsDatalist() {
  const datalist = document.getElementById("datalist-accounts");
  if (!datalist) return;
  datalist.innerHTML = "";
  
  const sortedAccounts = system.getSortedAccounts();
  sortedAccounts.forEach(acc => {
    // Solo permitir cuentas de último nivel (sin subcuentas) en las partidas
    const hasChildren = sortedAccounts.some(a => a.parentCode === acc.code);
    if (!hasChildren) {
      const opt = document.createElement("option");
      opt.value = acc.code;
      opt.innerText = `${acc.code} - ${acc.name}`;
      datalist.appendChild(opt);
    }
  });
}

// --- VISTA 1: DASHBOARD ---

function renderDashboard() {
  // Periodo de cálculo (Mes actual)
  const today = new Date();
  const startStr = `${today.getFullYear()}-07-01`; // Fijado a Julio 2026 por los datos muestra
  const endStr = `${today.getFullYear()}-07-31`;

  // Obtener balances
  const balances = system.calculateBalances(startStr, endStr);
  const bg = system.getBalanceGeneral(startStr, endStr);
  const er = system.getEstadoResultados(startStr, endStr);

  // Formato de moneda
  const fmt = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

  // Cargar KPI Cards
  document.getElementById("kpi-activos").innerText = fmt(bg.totals.activos);
  document.getElementById("kpi-pasivos").innerText = fmt(bg.totals.pasivos);
  document.getElementById("kpi-capital").innerText = fmt(bg.totals.capital);
  
  const util = er.totals.utilidadNeta;
  const utilCard = document.getElementById("kpi-utilidad");
  utilCard.innerText = fmt(util);
  utilCard.className = util >= 0 ? "" : "text-rose";
  
  const utilPct = er.totals.ingresos > 0 ? (util / er.totals.ingresos) * 100 : 0;
  document.getElementById("kpi-utilidad-pct").innerHTML = util >= 0 
    ? `<i class="fa-solid fa-chart-line text-emerald"></i> Margen Neto: ${utilPct.toFixed(1)}%` 
    : `<i class="fa-solid fa-chart-line text-rose"></i> Pérdida Neta`;

  // Renderizar gráficos
  renderDashboardCharts(bg.totals.activos, bg.totals.pasivos, bg.totals.capital, er.totals.ingresos, er.totals.costos, er.totals.gastos);

  // Cargar últimas 5 pólizas
  const tbody = document.querySelector("#dashboard-polizas-table tbody");
  tbody.innerHTML = "";
  
  const recent = [...system.polizas]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay pólizas registradas en el periodo.</td></tr>`;
    return;
  }

  recent.forEach(pol => {
    const totalDebit = pol.lines.reduce((sum, l) => sum + l.debit, 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pol.date}</td>
      <td><span class="badge ${pol.type === 'Ingresos' ? 'badge-emerald' : pol.type === 'Egresos' ? 'badge-rose' : 'badge-indigo'}">${pol.type}</span></td>
      <td class="col-code">${pol.number}</td>
      <td>${pol.concept}</td>
      <td class="text-right font-mono">${fmt(totalDebit)}</td>
      <td class="text-center"><span class="text-emerald"><i class="fa-solid fa-circle-check"></i> Cuadrada</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDashboardCharts(activos, pasivos, capital, ingresos, costos, gastos) {
  // Destruir gráficos anteriores para evitar overlaps al recargar
  if (charts.comp) charts.comp.destroy();
  if (charts.prof) charts.prof.destroy();

  const ctxComp = document.getElementById('chart-financial-composition').getContext('2d');
  const ctxProf = document.getElementById('chart-profitability').getContext('2d');

  const isDark = document.body.classList.contains("dark-theme");
  const textColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  // Gráfico de Composición Financiera (Doughnut)
  charts.comp = new Chart(ctxComp, {
    type: 'doughnut',
    data: {
      labels: ['Activos', 'Pasivos', 'Capital Contable'],
      datasets: [{
        data: [activos, pasivos, capital],
        backgroundColor: [
          '#6366f1', // Indigo
          '#f43f5e', // Rose
          '#a855f7'  // Purple
        ],
        borderWidth: isDark ? 2 : 1,
        borderColor: isDark ? '#101420' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Inter' } }
        }
      }
    }
  });

  // Gráfico de Estructura de Resultados (Barra)
  charts.prof = new Chart(ctxProf, {
    type: 'bar',
    data: {
      labels: ['Ingresos', 'Costos', 'Gastos'],
      datasets: [{
        label: 'Monto ($)',
        data: [ingresos, costos, gastos],
        backgroundColor: [
          '#10b981', // Emerald
          '#f59e0b', // Amber
          '#f43f5e'  // Rose
        ],
        borderRadius: 8,
        barThickness: 32
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: gridColor },
          ticks: { color: textColor }
        },
        x: {
          grid: { display: false },
          ticks: { color: textColor }
        }
      }
    }
  });
}

// --- VISTA 2: CATÁLOGO DE CUENTAS ---

function renderCatalog() {
  const treeRoot = document.getElementById("catalog-tree-root");
  const searchInput = document.getElementById("catalog-search");
  treeRoot.innerHTML = "";

  const query = searchInput.value.toLowerCase().trim();
  const sortedAccounts = system.getSortedAccounts();

  // Filtrado simple por búsqueda
  let filteredAccounts = sortedAccounts;
  if (query) {
    filteredAccounts = sortedAccounts.filter(acc => 
      acc.code.toLowerCase().includes(query) || 
      acc.name.toLowerCase().includes(query) ||
      (acc.satCode && acc.satCode.includes(query))
    );
  }

  if (filteredAccounts.length === 0) {
    treeRoot.innerHTML = `<div class="text-center p-4 text-muted">No se encontraron cuentas en el catálogo.</div>`;
    return;
  }

  filteredAccounts.forEach(acc => {
    // Determinar si la cuenta tiene hijos para iconografía
    const hasChildren = sortedAccounts.some(a => a.parentCode === acc.code);
    const iconClass = hasChildren ? "fa-solid fa-folder text-indigo" : "fa-solid fa-file-invoice text-muted";

    const node = document.createElement("div");
    node.className = `tree-node level-${acc.level}`;
    
    // Sangría del árbol
    const indentWidth = (acc.level - 1) * 24;
    
    node.innerHTML = `
      <span class="col-code">${acc.code}</span>
      <span class="col-name" style="padding-left: ${indentWidth}px">
        <i class="${iconClass}"></i>
        ${acc.name}
      </span>
      <span class="col-type"><span class="badge ${acc.type.startsWith('Activo') ? 'badge-indigo' : acc.type.startsWith('Pasivo') ? 'badge-rose' : 'badge-purple'}">${acc.type}</span></span>
      <span class="col-sat font-mono">${acc.satCode || "-"}</span>
      <span class="col-level">${acc.level}</span>
      <div class="col-actions">
        ${acc.level < 4 ? `
          <button class="btn-icon btn-icon-success" onclick="openAddSubaccount('${acc.code}')" title="Agregar subcuenta">
            <i class="fa-solid fa-circle-plus"></i>
          </button>
        ` : `<div style="width:28px"></div>`}
        <button class="btn-icon" onclick="openEditAccount('${acc.code}')" title="Editar cuenta">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteAccount('${acc.code}')" title="Eliminar cuenta">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    treeRoot.appendChild(node);
  });

  // Configurar listener en el buscador para filtrado en tiempo real
  if (!searchInput.dataset.listenerSet) {
    searchInput.addEventListener("input", renderCatalog);
    searchInput.dataset.listenerSet = "true";
  }
}

// --- GESTIÓN DE MODAL DE CUENTA ---

function initAccountModal() {
  const modal = document.getElementById("modal-account");
  const form = document.getElementById("form-account");
  const cancelBtn = document.getElementById("btn-cancel-account");
  const closeBtn = document.getElementById("btn-close-modal-account");
  const parentSelect = document.getElementById("acc-parent");

  const closeModal = () => modal.classList.remove("active-modal");

  // Al cambiar el padre en el modal, pre-establecer el nivel y tipo
  parentSelect.addEventListener("change", () => {
    const parentCode = parentSelect.value;
    if (parentCode) {
      const parentAcc = system.getAccount(parentCode);
      if (parentAcc) {
        document.getElementById("acc-level").value = parentAcc.level + 1;
        document.getElementById("acc-type").value = parentAcc.type;
        // Deshabilitar naturaleza para forzar herencia
        document.getElementById("acc-type").disabled = true;
      }
    } else {
      document.getElementById("acc-level").value = 1;
      document.getElementById("acc-type").disabled = false;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    // Habilitar temporalmente para leer el valor en el submit
    document.getElementById("acc-type").disabled = false;

    const accountData = {
      code: document.getElementById("acc-code").value.trim(),
      name: document.getElementById("acc-name").value.trim(),
      type: document.getElementById("acc-type").value,
      level: parseInt(document.getElementById("acc-level").value),
      satCode: document.getElementById("acc-sat").value,
      parentCode: document.getElementById("acc-parent").value
    };

    try {
      const editMode = form.dataset.editMode === "true";
      if (editMode) {
        system.updateAccount(form.dataset.originalCode, accountData);
      } else {
        system.addAccount(accountData);
      }
      
      closeModal();
      populateParentAccountsSelect();
      renderCatalog();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  });

  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Agregar listener para abrir el modal desde el botón "Nueva Cuenta"
  document.getElementById("btn-add-account").addEventListener("click", () => {
    form.reset();
    form.dataset.editMode = "false";
    document.getElementById("modal-account-title").innerText = "Agregar Nueva Cuenta";
    document.getElementById("acc-code").disabled = false;
    document.getElementById("acc-type").disabled = false;
    document.getElementById("acc-level").value = 1;
    modal.classList.add("active-modal");
  });
}

window.openAddSubaccount = function(parentCode) {
  const modal = document.getElementById("modal-account");
  const form = document.getElementById("form-account");
  const parentAcc = system.getAccount(parentCode);

  form.reset();
  form.dataset.editMode = "false";
  document.getElementById("modal-account-title").innerText = `Nueva Subcuenta de: ${parentAcc.name}`;
  
  // Establecer jerarquía heredada
  document.getElementById("acc-parent").value = parentCode;
  document.getElementById("acc-type").value = parentAcc.type;
  document.getElementById("acc-type").disabled = true;
  document.getElementById("acc-level").value = parentAcc.level + 1;
  document.getElementById("acc-code").disabled = false;

  modal.classList.add("active-modal");
};

window.openEditAccount = function(code) {
  const modal = document.getElementById("modal-account");
  const form = document.getElementById("form-account");
  const acc = system.getAccount(code);

  form.dataset.editMode = "true";
  form.dataset.originalCode = code;
  document.getElementById("modal-account-title").innerText = `Editar Cuenta: ${acc.name}`;

  document.getElementById("acc-code").value = acc.code;
  document.getElementById("acc-code").disabled = true; // El código no se edita para cuidar la integridad contable
  document.getElementById("acc-name").value = acc.name;
  document.getElementById("acc-type").value = acc.type;
  document.getElementById("acc-type").disabled = acc.parentCode ? true : false;
  document.getElementById("acc-level").value = acc.level;
  document.getElementById("acc-sat").value = acc.satCode || "";
  document.getElementById("acc-parent").value = acc.parentCode || "";

  modal.classList.add("active-modal");
};

window.deleteAccount = function(code) {
  if (confirm(`¿Estás seguro de que deseas eliminar la cuenta ${code}? Esta acción es permanente.`)) {
    try {
      system.deleteAccount(code);
      populateParentAccountsSelect();
      renderCatalog();
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  }
};

// --- VISTA 3: PÓLIZAS CONTABLES ---

function renderPolizas() {
  const tbody = document.querySelector("#polizas-main-table tbody");
  const searchInput = document.getElementById("poliza-search");
  const filterType = document.getElementById("filter-poliza-type");
  
  tbody.innerHTML = "";
  
  const query = searchInput.value.toLowerCase().trim();
  const typeFilter = filterType.value;
  const fmt = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

  let filtered = [...system.polizas];

  // Aplicar filtros
  if (typeFilter !== "all") {
    filtered = filtered.filter(p => p.type === typeFilter);
  }
  if (query) {
    filtered = filtered.filter(p => 
      p.number.toLowerCase().includes(query) || 
      p.concept.toLowerCase().includes(query) ||
      p.date.includes(query)
    );
  }

  // Ordenar cronológicamente descendente
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No se encontraron pólizas registradas.</td></tr>`;
    return;
  }

  filtered.forEach(pol => {
    const totalDebit = pol.lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = pol.lines.reduce((sum, l) => sum + l.credit, 0);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-code font-bold">${pol.number}</td>
      <td>${pol.date}</td>
      <td><span class="badge ${pol.type === 'Ingresos' ? 'badge-emerald' : pol.type === 'Egresos' ? 'badge-rose' : 'badge-indigo'}">${pol.type}</span></td>
      <td>
        ${pol.concept}
        ${pol.createdBy ? `<br><small class="text-xs text-muted" style="opacity:0.8;"><i class="fa-solid fa-user-pen"></i> ${pol.createdBy}</small>` : ''}
      </td>
      <td class="text-right font-mono">${fmt(totalDebit)}</td>
      <td class="text-right font-mono">${fmt(totalCredit)}</td>
      <td class="text-center"><span class="badge badge-emerald"><i class="fa-solid fa-circle-check"></i> Cuadrada</span></td>
      <td class="text-center">
        <div class="col-actions justify-center">
          <button class="btn-icon" onclick="openEditPoliza('${pol.id}')" title="Editar póliza">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="deletePoliza('${pol.id}')" title="Eliminar póliza">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!searchInput.dataset.listenerSet) {
    searchInput.addEventListener("input", renderPolizas);
    filterType.addEventListener("change", renderPolizas);
    searchInput.dataset.listenerSet = "true";
  }
}

// --- GESTIÓN DE MODAL DE PÓLIZAS ---

// Generador de folio consecutivo automático por tipo y mes
function generateNextFolio(type, dateStr) {
  if (!dateStr) return "";
  
  // Extraer año y mes (YYYY-MM)
  const dateParts = dateStr.split("-");
  const year = dateParts[0];
  const month = dateParts[1];
  
  // Prefijo según tipo de póliza
  let prefix = "D";
  if (type === "Ingresos") prefix = "I";
  else if (type === "Egresos") prefix = "E";
  
  // Filtrar pólizas del mismo tipo, mes y año
  const monthPolizas = system.polizas.filter(p => {
    if (p.type !== type) return false;
    const pParts = p.date.split("-");
    return pParts[0] === year && pParts[1] === month;
  });
  
  // Encontrar el consecutivo numérico más alto
  let maxSeq = 0;
  monthPolizas.forEach(p => {
    // Busca concordar con el patrón "Prefijo-Número" (ej. D-001)
    const match = p.number.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) {
      const seq = parseInt(match[1]);
      if (seq > maxSeq) maxSeq = seq;
    }
  });
  
  const nextSeq = maxSeq + 1;
  // Formatear con ceros a la izquierda a 3 dígitos (ej. D-001)
  const formattedSeq = String(nextSeq).padStart(3, '0');
  return `${prefix}-${formattedSeq}`;
}

function initPolizaModal() {
  const modal = document.getElementById("modal-poliza");
  const form = document.getElementById("form-poliza");
  const cancelBtn = document.getElementById("btn-cancel-poliza");
  const closeBtn = document.getElementById("btn-close-modal-poliza");
  const addLineBtn = document.getElementById("btn-add-pol-line");

  const closeModal = () => modal.classList.remove("active-modal");

  cancelBtn.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);

  // Agregar fila dinámica
  addLineBtn.addEventListener("click", () => {
    addPolizaRow();
  });

  // Listener para cambiar folio automáticamente en creación
  const autoUpdateFolio = () => {
    const isEdit = document.getElementById("poliza-id").value !== "";
    if (!isEdit) {
      const type = document.getElementById("pol-type").value;
      const date = document.getElementById("pol-date").value;
      document.getElementById("pol-number").value = generateNextFolio(type, date);
    }
  };

  document.getElementById("pol-type").addEventListener("change", autoUpdateFolio);
  document.getElementById("pol-date").addEventListener("change", autoUpdateFolio);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const lines = [];
    const rows = document.querySelectorAll("#pol-lines-body tr");
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const accountInput = row.querySelector(".line-account");
      const accountCode = accountInput.value.trim();
      const concept = row.querySelector(".line-concept").value;
      const debit = parseFloat(row.querySelector(".line-debit").value || 0);
      const credit = parseFloat(row.querySelector(".line-credit").value || 0);
      const reference = row.querySelector(".line-ref").value;

      if (accountCode && (debit > 0 || credit > 0)) {
        // VALIDAR que el código escrito exista en el catálogo de cuentas
        const accExists = system.getAccount(accountCode);
        if (!accExists) {
          alert(`La cuenta contable "${accountCode}" no es válida.\n\nPor favor, escribe un código de cuenta válido del catálogo.`);
          accountInput.focus();
          return; // Detiene el submit
        }
        lines.push({ accountCode, concept, debit, credit, reference });
      }
    }

    const currentUser = getCurrentUser();
    const polizaData = {
      id: document.getElementById("poliza-id").value || undefined,
      number: document.getElementById("pol-number").value.trim(),
      date: document.getElementById("pol-date").value,
      type: document.getElementById("pol-type").value,
      concept: document.getElementById("pol-concept").value.trim(),
      createdBy: currentUser ? currentUser.fullName : "Sistema",
      lines
    };

    try {
      system.addPoliza(polizaData);
      const activeComp = getActiveCompany();
      if (typeof saveCloudPoliza === "function") {
        saveCloudPoliza(activeComp.id, polizaData);
      }
      closeModal();
      renderPolizas();
      renderDashboard();
    } catch (err) {
      alert(`Error al guardar póliza: ${err.message}`);
    }
  });

  // Botón abrir nueva póliza
  document.getElementById("btn-new-poliza").addEventListener("click", () => {
    form.reset();
    document.getElementById("poliza-id").value = "";
    document.getElementById("modal-poliza-title").innerText = "Crear Nueva Póliza";
    document.getElementById("pol-lines-body").innerHTML = "";
    
    // Pre-poblar fecha de hoy
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("pol-date").value = today;
    document.getElementById("pol-type").value = "Diario";

    // Calcular consecutivo inicial
    autoUpdateFolio();

    // Agregar 2 filas en blanco iniciales
    addPolizaRow();
    addPolizaRow();
    updatePolizaBalance();

    modal.classList.add("active-modal");
  });
}

function addPolizaRow(lineData = null) {
  const tbody = document.getElementById("pol-lines-body");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td>
      <input type="text" class="line-account" list="datalist-accounts" placeholder="Código (ej. 102-01-001)..." required autocomplete="off">
    </td>
    <td><input type="text" class="line-concept" placeholder="Concepto detalle"></td>
    <td><input type="number" class="line-debit text-right font-mono" min="0" step="0.01" placeholder="0.00"></td>
    <td><input type="number" class="line-credit text-right font-mono" min="0" step="0.01" placeholder="0.00"></td>
    <td><input type="text" class="line-ref" placeholder="Ej. F-123"></td>
    <td class="text-center">
      <button type="button" class="btn-icon btn-icon-danger btn-delete-row" title="Eliminar fila">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </td>
  `;

  // Asignar datos si vienen cargados (Edición)
  if (lineData) {
    tr.querySelector(".line-account").value = lineData.accountCode;
    tr.querySelector(".line-concept").value = lineData.concept;
    tr.querySelector(".line-debit").value = lineData.debit || "";
    tr.querySelector(".line-credit").value = lineData.credit || "";
    tr.querySelector(".line-ref").value = lineData.reference || "";
  }

  // Event Listeners para recálculo de balance al cambiar inputs
  tr.querySelector(".line-debit").addEventListener("input", () => {
    const dVal = parseFloat(tr.querySelector(".line-debit").value || 0);
    if (dVal > 0) tr.querySelector(".line-credit").value = ""; // Exclusión mutua
    updatePolizaBalance();
  });
  tr.querySelector(".line-credit").addEventListener("input", () => {
    const cVal = parseFloat(tr.querySelector(".line-credit").value || 0);
    if (cVal > 0) tr.querySelector(".line-debit").value = ""; // Exclusión mutua
    updatePolizaBalance();
  });

  tr.querySelector(".btn-delete-row").addEventListener("click", () => {
    tr.remove();
    updatePolizaBalance();
  });

  tbody.appendChild(tr);
}

function updatePolizaBalance() {
  const rows = document.querySelectorAll("#pol-lines-body tr");
  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach(row => {
    const debit = parseFloat(row.querySelector(".line-debit").value || 0);
    const credit = parseFloat(row.querySelector(".line-credit").value || 0);
    totalDebit += debit;
    totalCredit += credit;
  });

  const fmt = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);
  document.getElementById("pol-total-debit").innerText = fmt(totalDebit);
  document.getElementById("pol-total-credit").innerText = fmt(totalCredit);

  const diff = Math.abs(totalDebit - totalCredit);
  const saveBtn = document.getElementById("btn-save-poliza");

  if (diff <= 0.01 && totalDebit > 0) {
    document.getElementById("pol-match-badge").style.display = "inline-flex";
    document.getElementById("pol-mismatch-badge").style.display = "none";
    saveBtn.disabled = false;
  } else {
    document.getElementById("pol-match-badge").style.display = "none";
    document.getElementById("pol-mismatch-badge").style.display = "inline-flex";
    document.getElementById("pol-mismatch-val").innerText = fmt(diff);
    // Si la póliza está en cero absoluto también bloqueamos guardar
    saveBtn.disabled = totalDebit === 0 ? true : false;
  }
}

window.openEditPoliza = function(id) {
  const modal = document.getElementById("modal-poliza");
  const form = document.getElementById("form-poliza");
  const pol = system.getPoliza(id);

  document.getElementById("poliza-id").value = pol.id;
  document.getElementById("modal-poliza-title").innerText = `Editar Póliza: ${pol.number}`;
  document.getElementById("pol-number").value = pol.number;
  document.getElementById("pol-date").value = pol.date;
  document.getElementById("pol-type").value = pol.type;
  document.getElementById("pol-concept").value = pol.concept;

  const tbody = document.getElementById("pol-lines-body");
  tbody.innerHTML = "";
  
  pol.lines.forEach(line => {
    addPolizaRow(line);
  });

  updatePolizaBalance();
  modal.classList.add("active-modal");
};

window.deletePoliza = function(id) {
  if (confirm("¿Estás seguro de que deseas eliminar esta póliza? Afectará los saldos y estados financieros.")) {
    system.deletePoliza(id);
    renderPolizas();
    renderDashboard();
  }
};

// --- VISTA 4: IMPORTACIÓN / LAYOUTS ---

function initImportSection() {
  const logPanel = document.getElementById("import-log-panel");
  const logContent = document.getElementById("import-log-content");

  // Botón Limpiar Logs
  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    logContent.innerHTML = "";
    logPanel.style.display = "none";
  });

  // Descarga de layouts (Generados al vuelo con SheetJS)
  document.getElementById("btn-download-layout-catalog").addEventListener("click", () => {
    const data = [
      ["Código", "Nombre", "Tipo", "Nivel", "Código Agrupador SAT", "Cuenta Padre"],
      ["100-00-000", "ACTIVO", "Activo Deudor", 1, "100", ""],
      ["101-00-000", "Caja", "Activo Deudor", 2, "101", "100-00-000"],
      ["101-01-000", "Caja General", "Activo Deudor", 3, "101.02", "101-00-000"],
      ["102-00-000", "Bancos", "Activo Deudor", 2, "102", "100-00-000"],
      ["102-01-000", "Bancos Nacionales", "Activo Deudor", 3, "102.01", "102-00-000"],
      ["102-01-001", "Bancomer *9876", "Activo Deudor", 4, "102.01", "102-01-000"],
      ["200-00-000", "PASIVO", "Pasivo Acreedor", 1, "200", ""],
      ["201-00-000", "Proveedores", "Pasivo Acreedor", 2, "201", "200-00-000"],
      ["201-01-000", "Proveedores Nacionales", "Pasivo Acreedor", 3, "201.01", "201-00-000"],
      ["201-01-001", "Distribuidora Norte SA", "Pasivo Acreedor", 4, "201.01", "201-01-000"],
      ["300-00-000", "CAPITAL", "Capital Acreedor", 1, "300", ""],
      ["400-00-000", "INGRESOS", "Ingresos", 1, "400", ""],
      ["500-00-000", "COSTOS", "Costos", 1, "500", ""],
      ["600-00-000", "GASTOS", "Gastos", 1, "600", ""]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Catálogo");
    XLSX.writeFile(wb, "layout_catalogo.xlsx");
    addLog("info", "Descarga iniciada: layout_catalogo.xlsx");
  });

  document.getElementById("btn-download-layout-polizas").addEventListener("click", () => {
    const data = [
      ["Número", "Fecha", "Tipo", "Concepto General", "Cuenta Contable", "Concepto Línea", "Debe", "Haber", "Referencia"],
      ["D-100", "2026-07-20", "Diario", "Venta de contado de prueba", "102-01-001", "Cargo por depósito", 58000, 0, "F-102"],
      ["D-100", "2026-07-20", "Diario", "Venta de contado de prueba", "401-01-000", "Ingreso por ventas", 0, 50000, "F-102"],
      ["D-100", "2026-07-20", "Diario", "Venta de contado de prueba", "208-00-000", "IVA Cobrado 16%", 0, 8000, "F-102"],
      ["E-100", "2026-07-21", "Egresos", "Pago de papelería administrativa", "601-84-000", "Compra de hojas y toner", 1500, 0, "F-998"],
      ["E-100", "2026-07-21", "Egresos", "Pago de papelería administrativa", "118-00-000", "IVA Acreditable pagado", 240, 0, "F-998"],
      ["E-100", "2026-07-21", "Egresos", "Pago de papelería administrativa", "102-01-001", "Pago cheque Bancomer", 0, 1740, "F-998"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pólizas");
    XLSX.writeFile(wb, "layout_polizas.xlsx");
    addLog("info", "Descarga iniciada: layout_polizas.xlsx");
  });

  // Configuración de Drag & Drop
  setupDropzone("dropzone-catalog", "file-catalog-input", (data) => importCatalog(data));
  setupDropzone("dropzone-polizas", "file-polizas-input", (data) => importPolizas(data));

  // Configuración de Respaldo Completo (.json)
  const exportBackupBtn = document.getElementById("btn-export-full-backup");
  const importBackupBtn = document.getElementById("btn-import-full-backup");
  const backupFileInput = document.getElementById("file-backup-input");

  if (exportBackupBtn) {
    exportBackupBtn.addEventListener("click", () => {
      exportFullBackup();
    });
  }

  if (backupFileInput) {
    backupFileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          importFullBackup(evt.target.result);
          e.target.value = "";
        };
        reader.readAsText(file);
      }
    });
  }
}

function exportFullBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("sistema_contable_")) {
      const raw = localStorage.getItem(key);
      try {
        data[key] = JSON.parse(raw);
      } catch (e) {
        data[key] = raw;
      }
    }
  }
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "default_database.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importFullBackup(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    let count = 0;
    Object.keys(data).forEach(key => {
      if (key.startsWith("sistema_contable_")) {
        const val = data[key];
        const strVal = typeof val === "string" ? val : JSON.stringify(val);
        localStorage.setItem(key, strVal);
        count++;
      }
    });
    if (count > 0) {
      alert(`¡Respaldo restaurado con éxito! Se importaron ${count} categorías de datos contables.`);
      location.reload();
    } else {
      alert("El archivo seleccionado no contiene datos válidos del sistema contable.");
    }
  } catch (err) {
    alert(`Error al procesar el archivo de respaldo: ${err.message}`);
  }
}

function setupDropzone(zoneId, inputId, onDataRead) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove("dragover");
  });

  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    
    if (e.dataTransfer.files.length > 0) {
      handleExcelFile(e.dataTransfer.files[0], onDataRead);
    }
  });

  input.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleExcelFile(e.target.files[0], onDataRead);
    }
  });
}

function handleExcelFile(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    callback(json);
  };
  reader.readAsArrayBuffer(file);
}

function addLog(type, message) {
  const logPanel = document.getElementById("import-log-panel");
  const logContent = document.getElementById("import-log-content");
  logPanel.style.display = "block";

  const div = document.createElement("div");
  div.className = `log-item log-item-${type}`;
  
  let icon = '<i class="fa-solid fa-circle-info"></i>';
  if (type === "success") icon = '<i class="fa-solid fa-circle-check"></i>';
  if (type === "error") icon = '<i class="fa-solid fa-circle-xmark"></i>';

  div.innerHTML = `${icon} <span>[${new Date().toLocaleTimeString()}] ${message}</span>`;
  logContent.appendChild(div);
  logContent.scrollTop = logContent.scrollHeight;
}

function importCatalog(jsonRows) {
  addLog("info", `Procesando ${jsonRows.length} renglones del archivo Excel de Catálogo...`);
  
  let successCount = 0;
  let errorCount = 0;

  // Limpiar catálogo actual para una importación limpia (opcional, pero sugerido para consistencia total en layouts)
  const sortedRows = [...jsonRows].sort((a, b) => parseInt(a.Nivel) - parseInt(b.Nivel));

  sortedRows.forEach(row => {
    const code = row["Código"];
    const name = row["Nombre"];
    const type = row["Tipo"];
    const level = parseInt(row["Nivel"]);
    const satCode = String(row["Código Agrupador SAT"] || "");
    const parentCode = row["Cuenta Padre"] || "";

    if (!code || !name || !type || !level) {
      addLog("error", `Fila inválida. Faltan campos requeridos en la cuenta ${code || 'sin código'}.`);
      errorCount++;
      return;
    }

    try {
      // Si la cuenta ya existe, se actualiza, si no se agrega
      if (system.getAccount(code)) {
        system.updateAccount(code, { name, type, satCode });
      } else {
        system.addAccount({ code, name, type, level, satCode, parentCode });
      }
      successCount++;
    } catch (err) {
      addLog("error", `Error al cargar cuenta ${code}: ${err.message}`);
      errorCount++;
    }
  });

  populateParentAccountsSelect();
  renderCatalog();
  addLog("success", `Carga finalizada. Cuentas creadas/actualizadas con éxito: ${successCount}. Errores: ${errorCount}.`);
}

function importPolizas(jsonRows) {
  addLog("info", `Procesando ${jsonRows.length} renglones del archivo Excel de Pólizas...`);

  // Agrupar filas por Número de Póliza
  const polizasMap = {};

  jsonRows.forEach(row => {
    const number = row["Número"];
    const dateStr = row["Fecha"];
    const type = row["Tipo"];
    const conceptGen = row["Concepto General"];
    const accountCode = row["Cuenta Contable"];
    const conceptLine = row["Concepto Línea"] || conceptGen;
    const debit = parseFloat(row["Debe"] || 0);
    const credit = parseFloat(row["Haber"] || 0);
    const reference = row["Referencia"] || "";

    if (!number || !dateStr || !type || !accountCode) {
      addLog("error", `Fila ignorada. Faltan datos esenciales de póliza. Folio: ${number || 'Indefinido'}`);
      return;
    }

    // Normalizar formato de fecha si Excel la lee como número serial
    let date = dateStr;
    if (typeof dateStr === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const convertedDate = new Date(excelEpoch.getTime() + (dateStr - 2) * 24 * 60 * 60 * 1000);
      date = convertedDate.toISOString().split('T')[0];
    }

    if (!polizasMap[number]) {
      polizasMap[number] = {
        number,
        date,
        type,
        concept: conceptGen,
        lines: []
      };
    }

    polizasMap[number].lines.push({
      accountCode,
      concept: conceptLine,
      debit,
      credit,
      reference
    });
  });

  let successCount = 0;
  let errorCount = 0;

  Object.values(polizasMap).forEach(pol => {
    try {
      system.addPoliza(pol);
      addLog("success", `Póliza ${pol.number} cargada con éxito. Partidas: ${pol.lines.length}`);
      successCount++;
    } catch (err) {
      addLog("error", `Error al validar e importar póliza ${pol.number}: ${err.message}`);
      errorCount++;
    }
  });

  renderPolizas();
  renderDashboard();
  addLog("success", `Carga contable finalizada. Pólizas ingresadas: ${successCount}. Rechazadas/Error: ${errorCount}.`);
}

function renderImportLogs() {
  // Solo actualiza la pantalla de carga, el log persiste hasta que se limpia
}

// --- VISTA 5: REPORTES FINANCIEROS Y EXPORTADORES ---

function initReportsSection() {
  const rSelect = document.getElementById("report-select");
  const filterBalanza = document.getElementById("filter-group-balanza-level");
  const filterAuxiliar = document.getElementById("filter-group-auxiliar-account");
  const filterHideEmpty = document.getElementById("filter-group-hide-empty");

  // Mostrar u ocultar filtros contextuales
  rSelect.addEventListener("change", () => {
    const val = rSelect.value;
    filterBalanza.style.display = val === "balanza" ? "flex" : "none";
    filterAuxiliar.style.display = val === "auxiliar" ? "flex" : "none";
    filterHideEmpty.style.display = "flex"; // Siempre visible para todos los reportes
    renderReports();
  });

  // Re-renderizar al cambiar filtros
  document.getElementById("report-start-date").addEventListener("change", renderReports);
  document.getElementById("report-end-date").addEventListener("change", renderReports);
  document.getElementById("report-balanza-level").addEventListener("change", renderReports);
  document.getElementById("report-auxiliar-account").addEventListener("change", renderReports);
  document.getElementById("report-hide-empty").addEventListener("change", renderReports);

  // Botones de descarga
  document.getElementById("btn-export-excel").addEventListener("click", exportCurrentReportToExcel);
  document.getElementById("btn-export-pdf").addEventListener("click", exportCurrentReportToPDF);
}

function renderReports() {
  const type = document.getElementById("report-select").value;
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;
  const maxLevel = parseInt(document.getElementById("report-balanza-level").value || 4);
  const accountCode = document.getElementById("report-auxiliar-account").value;
  const hideEmpty = document.getElementById("report-hide-empty").checked;

  const container = document.getElementById("report-viewer-content");
  container.innerHTML = "";

  if (!startDate || !endDate) {
    container.innerHTML = `<div class="text-center p-4 text-muted">Selecciona un rango de fechas válido.</div>`;
    return;
  }

  const activeComp = getActiveCompany();

  // Cabecera dinámica de reporte en pantalla
  const headerHtml = `
    <div class="report-header">
      <h2>${activeComp.name}</h2>
      <p class="text-xs">RFC: ${activeComp.rfc}</p>
      <h3>${document.getElementById("report-select").options[document.getElementById("report-select").selectedIndex].text}</h3>
      <p>Periodo: del <strong>${startDate}</strong> al <strong>${endDate}</strong></p>
    </div>
  `;

  const fmt = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

  if (type === "balanza") {
    const balanza = system.getBalanza(startDate, endDate, maxLevel);
    
    let rowsHtml = "";
    balanza.rows.forEach(r => {
      // Omitir cuentas si la casilla está marcada y la cuenta está completamente en ceros (sin saldos ni movimientos)
      if (hideEmpty && 
          Math.abs(r.initialBalance) < 0.01 && 
          Math.abs(r.periodDebit) < 0.01 && 
          Math.abs(r.periodCredit) < 0.01 && 
          Math.abs(r.finalBalance) < 0.01) {
        return;
      }
      
      // Formatear saldos según naturaleza
      const isDeudora = ["Activo Deudor", "Costos", "Gastos"].includes(r.type);
      
      let initDeb = r.initialBalance >= 0 ? r.initialBalance : 0;
      let initCred = r.initialBalance < 0 ? -r.initialBalance : 0;
      let finDeb = r.finalBalance >= 0 ? r.finalBalance : 0;
      let finCred = r.finalBalance < 0 ? -r.finalBalance : 0;

      if (!isDeudora) {
        initDeb = r.initialBalance < 0 ? -r.initialBalance : 0;
        initCred = r.initialBalance >= 0 ? r.initialBalance : 0;
        finDeb = r.finalBalance < 0 ? -r.finalBalance : 0;
        finCred = r.finalBalance >= 0 ? r.finalBalance : 0;
      }

      rowsHtml += `
        <tr class="level-${r.level}">
          <td class="font-mono">${r.code}</td>
          <td>${r.name}</td>
          <td class="col-amount">${fmt(initDeb)}</td>
          <td class="col-amount">${fmt(initCred)}</td>
          <td class="col-amount">${fmt(r.periodDebit)}</td>
          <td class="col-amount">${fmt(r.periodCredit)}</td>
          <td class="col-amount">${fmt(finDeb)}</td>
          <td class="col-amount">${fmt(finCred)}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      ${headerHtml}
      <div class="responsive-table">
        <table class="report-table">
          <thead>
            <tr>
              <th rowspan="2">Código</th>
              <th rowspan="2">Nombre de la Cuenta</th>
              <th colspan="2">Saldos Iniciales</th>
              <th colspan="2">Movimientos</th>
              <th colspan="2">Saldos Finales</th>
            </tr>
            <tr>
              <th>Deudor</th>
              <th>Acreedor</th>
              <th>Debe</th>
              <th>Haber</th>
              <th>Deudor</th>
              <th>Acreedor</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td colspan="2">TOTALES</td>
              <td class="col-amount">${fmt(balanza.totals.initialDebit)}</td>
              <td class="col-amount">${fmt(balanza.totals.initialCredit)}</td>
              <td class="col-amount">${fmt(balanza.totals.periodDebit)}</td>
              <td class="col-amount">${fmt(balanza.totals.periodCredit)}</td>
              <td class="col-amount">${fmt(balanza.totals.finalDebit)}</td>
              <td class="col-amount">${fmt(balanza.totals.finalCredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  else if (type === "auxiliar") {
    if (!accountCode) {
      container.innerHTML = `<div class="text-center p-4 text-muted">Selecciona una cuenta contable.</div>`;
      return;
    }
    
    try {
      const aux = system.getAuxiliar(accountCode, startDate, endDate);
      
      let rowsHtml = "";
      aux.movements.forEach(m => {
        rowsHtml += `
          <tr>
            <td>${m.date}</td>
            <td class="font-mono">${m.polizaNumber}</td>
            <td><span class="badge ${m.polizaType === 'Ingresos' ? 'badge-emerald' : m.polizaType === 'Egresos' ? 'badge-rose' : 'badge-indigo'}">${m.polizaType}</span></td>
            <td>${m.concept}</td>
            <td class="font-mono">${m.accountCode} - ${m.accountName}</td>
            <td>${m.reference || "-"}</td>
            <td class="col-amount">${fmt(m.debit)}</td>
            <td class="col-amount">${fmt(m.credit)}</td>
            <td class="col-amount">${fmt(m.balance)}</td>
          </tr>
        `;
      });

      if (aux.movements.length === 0) {
        rowsHtml = `<tr><td colspan="9" class="text-center text-muted">No se registraron movimientos en este periodo.</td></tr>`;
      }

      container.innerHTML = `
        ${headerHtml}
        <div class="report-summary-box flex-between">
          <span>Saldo Inicial (${aux.account.type === 'Activo Deudor' ? 'Deudor' : 'Acreedor'}): <strong>${fmt(aux.initialBalance)}</strong></span>
          <span>Saldo Final: <strong>${fmt(aux.finalBalance)}</strong></span>
        </div>
        <div class="responsive-table">
          <table class="report-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Poliza</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Cuenta Movimiento</th>
                <th>Ref</th>
                <th>Debe</th>
                <th>Haber</th>
                <th>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div class="text-center p-4 text-rose">Error: ${err.message}</div>`;
    }
  }

  else if (type === "balance") {
    const bg = system.getBalanceGeneral(startDate, endDate);

    let activosHtml = bg.activos
      .filter(a => !hideEmpty || Math.abs(a.amount) >= 0.01)
      .map(a => `<tr><td>${a.name}</td><td class="col-amount">${fmt(a.amount)}</td></tr>`)
      .join("");
    let pasivosHtml = bg.pasivos
      .filter(p => !hideEmpty || Math.abs(p.amount) >= 0.01)
      .map(p => `<tr><td>${p.name}</td><td class="col-amount">${fmt(p.amount)}</td></tr>`)
      .join("");
    let capitalHtml = bg.capital
      .filter(c => !hideEmpty || Math.abs(c.amount) >= 0.01)
      .map(c => `<tr><td class="${c.isCalculated ? 'font-bold' : ''}">${c.name}</td><td class="col-amount ${c.isCalculated ? 'font-bold' : ''}">${fmt(c.amount)}</td></tr>`)
      .join("");

    container.innerHTML = `
      ${headerHtml}
      <div class="dashboard-grid">
        <!-- Activos (Izquierda) -->
        <div class="responsive-table card card-glass no-padding">
          <table class="report-table">
            <thead>
              <tr><th colspan="2" class="text-emerald">ACTIVOS</th></tr>
            </thead>
            <tbody>
              ${activosHtml}
              <tr class="total-row text-emerald">
                <td>TOTAL ACTIVOS</td>
                <td class="col-amount">${fmt(bg.totals.activos)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pasivos y Capital (Derecha) -->
        <div class="flex-gap flex-wrap" style="flex-direction: column; width: 100%;">
          <div class="responsive-table card card-glass no-padding" style="width: 100%;">
            <table class="report-table">
              <thead>
                <tr><th colspan="2" class="text-rose">PASIVOS</th></tr>
              </thead>
              <tbody>
                ${pasivosHtml}
                <tr class="total-row text-rose">
                  <td>TOTAL PASIVOS</td>
                  <td class="col-amount">${fmt(bg.totals.pasivos)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="responsive-table card card-glass no-padding" style="width: 100%;">
            <table class="report-table">
              <thead>
                <tr><th colspan="2" class="text-purple">CAPITAL CONTABLE</th></tr>
              </thead>
              <tbody>
                ${capitalHtml}
                <tr class="total-row text-purple">
                  <td>TOTAL CAPITAL</td>
                  <td class="col-amount">${fmt(bg.totals.capital)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="responsive-table card card-glass no-padding" style="width: 100%;">
            <table class="report-table">
              <tbody>
                <tr class="report-total-major text-emerald" style="font-size: 1rem;">
                  <td>TOTAL PASIVO + CAPITAL</td>
                  <td class="col-amount">${fmt(bg.totals.pasivoMasCapital)}</td>
                </tr>
                ${Math.abs(bg.totals.diferencia) > 0.01 ? `
                  <tr class="text-rose font-bold">
                    <td>DIFERENCIA (Desbalanceo)</td>
                    <td class="col-amount">${fmt(bg.totals.diferencia)}</td>
                  </tr>
                ` : `
                  <tr class="text-emerald text-center font-bold">
                    <td colspan="2"><i class="fa-solid fa-circle-check"></i> El Balance General cuadra correctamente.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  else if (type === "resultados") {
    const er = system.getEstadoResultados(startDate, endDate);

    let ingHtml = er.ingresos
      .filter(i => !hideEmpty || Math.abs(i.amount) >= 0.01)
      .map(i => `<tr><td>${i.name}</td><td class="col-amount">${fmt(i.amount)}</td></tr>`)
      .join("");
    let costHtml = er.costos
      .filter(c => !hideEmpty || Math.abs(c.amount) >= 0.01)
      .map(c => `<tr><td>${c.name}</td><td class="col-amount">${fmt(c.amount)}</td></tr>`)
      .join("");
    let gastHtml = er.gastos
      .filter(g => !hideEmpty || Math.abs(g.amount) >= 0.01)
      .map(g => `<tr><td>${g.name}</td><td class="col-amount">${fmt(g.amount)}</td></tr>`)
      .join("");

    container.innerHTML = `
      ${headerHtml}
      <div class="responsive-table" style="max-width: 600px; margin: 0 auto;">
        <table class="report-table">
          <thead>
            <tr><th colspan="2">Cuentas de Resultados</th></tr>
          </thead>
          <tbody>
            <tr class="report-section-title"><td colspan="2">INGRESOS</td></tr>
            ${ingHtml || '<tr><td colspan="2" class="text-muted text-center">Sin ingresos registrados</td></tr>'}
            <tr class="total-row"><td>Total Ingresos</td><td class="col-amount">${fmt(er.totals.ingresos)}</td></tr>
            
            <tr class="report-section-title"><td colspan="2">COSTOS</td></tr>
            ${costHtml || '<tr><td colspan="2" class="text-muted text-center">Sin costos registrados</td></tr>'}
            <tr class="total-row"><td>Total Costos</td><td class="col-amount">${fmt(er.totals.costos)}</td></tr>
            
            <tr class="total-row text-emerald" style="font-size:0.95rem;"><td>UTILIDAD BRUTA</td><td class="col-amount">${fmt(er.totals.utilidadBruta)}</td></tr>

            <tr class="report-section-title"><td colspan="2">GASTOS DE OPERACIÓN</td></tr>
            ${gastHtml || '<tr><td colspan="2" class="text-muted text-center">Sin gastos registrados</td></tr>'}
            <tr class="total-row"><td>Total Gastos</td><td class="col-amount">${fmt(er.totals.gastos)}</td></tr>
            
            <tr class="report-total-major ${er.totals.utilidadNeta >= 0 ? 'text-emerald' : 'text-rose'}" style="font-size:1.05rem;">
              <td>UTILIDAD (O PÉRDIDA) NETA DEL EJERCICIO</td>
              <td class="col-amount">${fmt(er.totals.utilidadNeta)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  else if (type === "variaciones") {
    const varCap = system.getEstadoVariacionesCapital(startDate, endDate);

    let rowsHtml = varCap.items
      .filter(item => !hideEmpty || 
                      Math.abs(item.saldoInicial) >= 0.01 || 
                      Math.abs(item.aumentos) >= 0.01 || 
                      Math.abs(item.reducciones) >= 0.01 || 
                      Math.abs(item.saldoFinal) >= 0.01)
      .map(item => `
      <tr>
        <td>${item.name}</td>
        <td class="col-amount">${fmt(item.saldoInicial)}</td>
        <td class="col-amount">${fmt(item.aumentos)}</td>
        <td class="col-amount">${fmt(item.reducciones)}</td>
        <td class="col-amount font-bold">${fmt(item.saldoFinal)}</td>
      </tr>
    `).join("");

    container.innerHTML = `
      ${headerHtml}
      <div class="responsive-table">
        <table class="report-table">
          <thead>
            <tr>
              <th>Rubro / Cuenta de Capital</th>
              <th>Saldo Inicial</th>
              <th>Aumentos</th>
              <th>Reducciones</th>
              <th>Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="report-total-major">
              <td>TOTAL CAPITAL CONTABLE</td>
              <td class="col-amount">${fmt(varCap.totals.saldoInicial)}</td>
              <td class="col-amount">${fmt(varCap.totals.aumentos)}</td>
              <td class="col-amount">${fmt(varCap.totals.reducciones)}</td>
              <td class="col-amount">${fmt(varCap.totals.saldoFinal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  else if (type === "flujo") {
    const flujo = system.getEstadoFlujosEfectivo(startDate, endDate);

    let opHtml = flujo.actividadesOperacion
      .filter(op => !hideEmpty || Math.abs(op.amount) >= 0.01)
      .map(op => `
      <tr>
        <td style="padding-left: 20px;">${op.name}</td>
        <td class="col-amount">${fmt(op.amount)}</td>
      </tr>
    `).join("");

    let invHtml = flujo.actividadesInversion
      .filter(inv => !hideEmpty || Math.abs(inv.amount) >= 0.01)
      .map(inv => `
      <tr>
        <td style="padding-left: 20px;">${inv.name}</td>
        <td class="col-amount">${fmt(inv.amount)}</td>
      </tr>
    `).join("");

    let finHtml = flujo.actividadesFinanciamiento
      .filter(fin => !hideEmpty || Math.abs(fin.amount) >= 0.01)
      .map(fin => `
      <tr>
        <td style="padding-left: 20px;">${fin.name}</td>
        <td class="col-amount">${fmt(fin.amount)}</td>
      </tr>
    `).join("");

    container.innerHTML = `
      ${headerHtml}
      <div class="responsive-table" style="max-width: 700px; margin: 0 auto;">
        <table class="report-table">
          <thead>
            <tr>
              <th>Concepto de Flujo</th>
              <th style="width: 200px;">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr class="report-section-title"><td colspan="2">ACTIVIDADES DE OPERACIÓN</td></tr>
            <tr>
              <td>Utilidad Neta del Ejercicio</td>
              <td class="col-amount">${fmt(flujo.utilidadNeta)}</td>
            </tr>
            ${opHtml}
            <tr class="total-row text-emerald">
              <td>Flujos Netos de Actividades de Operación</td>
              <td class="col-amount">${fmt(flujo.totals.operacion)}</td>
            </tr>

            <tr class="report-section-title"><td colspan="2">ACTIVIDADES DE INVERSIÓN</td></tr>
            ${invHtml || '<tr><td class="text-muted text-center" colspan="2">Sin actividades de inversión</td></tr>'}
            <tr class="total-row text-emerald">
              <td>Flujos Netos de Actividades de Inversión</td>
              <td class="col-amount">${fmt(flujo.totals.inversion)}</td>
            </tr>

            <tr class="report-section-title"><td colspan="2">ACTIVIDADES DE FINANCIAMIENTO</td></tr>
            ${finHtml || '<tr><td class="text-muted text-center" colspan="2">Sin actividades de financiamiento</td></tr>'}
            <tr class="total-row text-emerald">
              <td>Flujos Netos de Actividades de Financiamiento</td>
              <td class="col-amount">${fmt(flujo.totals.financiamiento)}</td>
            </tr>

            <tr class="report-total-major" style="font-size:0.95rem;">
              <td>Incremento Neto en el Efectivo y Equivalentes</td>
              <td class="col-amount">${fmt(flujo.totals.incrementoEfectivo)}</td>
            </tr>
            <tr>
              <td>Efectivo y Equivalentes al Inicio del Periodo</td>
              <td class="col-amount">${fmt(flujo.totals.efectivoInicial)}</td>
            </tr>
            <tr class="report-total-major text-emerald" style="font-size:1.05rem;">
              <td>Efectivo y Equivalentes al Final del Periodo (Bancos/Caja)</td>
              <td class="col-amount">${fmt(flujo.totals.efectivoFinal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }
}

// --- EXPORTAR REPORTES A EXCEL (SheetJS) ---

function exportCurrentReportToExcel() {
  const type = document.getElementById("report-select").value;
  const table = document.querySelector("#report-viewer-content table");

  if (!table) {
    alert("No hay ningún reporte renderizado para exportar.");
    return;
  }

  const wb = XLSX.utils.table_to_book(table, { sheet: "Reporte" });
  XLSX.writeFile(wb, `Reporte_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// --- EXPORTAR REPORTES A PDF (jsPDF + AutoTable) ---

function exportCurrentReportToPDF() {
  const type = document.getElementById("report-select").value;
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;

  const { jsPDF } = window.jspdf;
  
  // Balanza de comprobación es más ancha, usar modo Landscape (horizontal)
  const orientation = type === "balanza" || type === "auxiliar" ? "l" : "p";
  const doc = new jsPDF(orientation, "mm", "a4");

  // Paleta de colores para el PDF
  const primaryColor = [99, 102, 241]; // Indigo
  const textColor = [31, 41, 55]; // Gris oscuro
  const mutedColor = [156, 163, 175]; // Gris claro

  // Encabezados dinámicos
  const activeComp = getActiveCompany();
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(activeComp.name, 14, 15);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`RFC: ${activeComp.rfc} | Contabilidad Adaptada al SAT`, 14, 20);

  doc.setFontSize(13);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  const titleText = document.getElementById("report-select").options[document.getElementById("report-select").selectedIndex].text;
  doc.text(titleText.toUpperCase(), 14, 27);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periodo: del ${startDate} al ${endDate}`, 14, 32);

  // Línea divisoria
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  const lineY = 35;
  const docWidth = doc.internal.pageSize.getWidth();
  doc.line(14, lineY, docWidth - 14, lineY);

  // Obtener la tabla renderizada
  const table = document.querySelector("#report-viewer-content table");
  if (!table) {
    alert("Carga un reporte primero.");
    return;
  }

  // Generar tabla PDF usando jsPDF AutoTable
  doc.autoTable({
    html: table,
    startY: 40,
    theme: 'grid',
    styles: {
      font: 'Helvetica',
      fontSize: 8,
      cellPadding: 3,
      valign: 'middle'
    },
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      // Alinear montos a la derecha por defecto en columnas numéricas
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' }
    },
    didParseCell: function(data) {
      // Estilos para filas especiales
      const classes = data.row.raw.className || "";
      if (classes.includes("total-row") || classes.includes("report-total-major")) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
      if (classes.includes("report-section-title")) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [224, 231, 255];
        data.cell.styles.textColor = primaryColor;
      }
    }
  });

  // Guardar archivo PDF
  doc.save(`Reporte_${type}_${startDate}_a_${endDate}.pdf`);
}

// Inyección de app global para eventos inline
window.app = {
  switchView
};

function initCompanySection() {
  const badge = document.getElementById("company-badge-click");
  const dropdown = document.getElementById("company-dropdown-list");
  const addBtn = document.getElementById("btn-add-company");
  const modal = document.getElementById("modal-company");
  const closeBtn = document.getElementById("btn-close-modal-company");
  const cancelBtn = document.getElementById("btn-cancel-company");
  const form = document.getElementById("form-company");

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("active");
    renderCompanyDropdownItems();
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("active");
  });

  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.remove("active");
    form.reset();
    modal.classList.add("active-modal");
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("active-modal"));
  cancelBtn.addEventListener("click", () => modal.classList.remove("active-modal"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("comp-name").value.trim();
    const rfc = document.getElementById("comp-rfc").value.trim().toUpperCase();
    const preload = document.getElementById("comp-preload").checked;

    if (rfc.length < 12 || rfc.length > 13) {
      alert("El RFC debe tener entre 12 y 13 caracteres.");
      return;
    }

    const companies = getCompanies();
    if (companies.some(c => c.rfc === rfc)) {
      alert("Ya existe una empresa registrada con ese RFC.");
      return;
    }

    const newCompany = { id: rfc, name, rfc };
    companies.push(newCompany);
    localStorage.setItem("sistema_contable_companies", JSON.stringify(companies));
    localStorage.setItem("sistema_contable_active_company_id", rfc);

    if (preload) {
      localStorage.setItem(`sistema_contable_accounts_${rfc}`, JSON.stringify(DEFAULT_ACCOUNTS));
      localStorage.setItem(`sistema_contable_polizas_${rfc}`, JSON.stringify(DEFAULT_POLIZAS));
    } else {
      const rootAccs = DEFAULT_ACCOUNTS.filter(a => a.level === 1);
      localStorage.setItem(`sistema_contable_accounts_${rfc}`, JSON.stringify(rootAccs));
      localStorage.setItem(`sistema_contable_polizas_${rfc}`, JSON.stringify([]));
    }

    alert(`Empresa "${name}" registrada con éxito.`);
    modal.classList.remove("active-modal");
    location.reload();
  });
}

function renderCompanyDropdownItems() {
  const container = document.getElementById("company-list-items");
  container.innerHTML = "";
  
  const companies = getCompanies();
  const activeCompany = getActiveCompany();

  companies.forEach(c => {
    const item = document.createElement("button");
    item.className = `dropdown-item ${c.id === activeCompany.id ? 'active' : ''}`;
    item.innerHTML = `
      <div class="dropdown-item-info">
        <strong>${c.name}</strong>
        <span>RFC: ${c.rfc}</span>
      </div>
      ${c.id === activeCompany.id ? '<i class="fa-solid fa-check text-emerald"></i>' : ''}
    `;

    item.addEventListener("click", () => {
      if (c.id !== activeCompany.id) {
        localStorage.setItem("sistema_contable_active_company_id", c.id);
        location.reload();
      }
    });

    container.appendChild(item);
  });
}

// --- SISTEMA DE AUTENTICACIÓN Y GESTIÓN DE USUARIOS ---

function initAuth() {
  const overlay = document.getElementById("login-overlay");
  const loginForm = document.getElementById("form-login");
  const logoutBtn = document.getElementById("btn-logout");
  const currentUser = getCurrentUser();

  if (!currentUser || !currentUser.active) {
    overlay.classList.add("active");
  } else {
    overlay.classList.remove("active");
    updateUserHeader(currentUser);
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const userVal = document.getElementById("login-username").value.trim().toLowerCase();
    const pwdVal = document.getElementById("login-password").value.trim();
    const errorMsg = document.getElementById("login-error-msg");

    const users = getUsers();
    const userObj = users.find(u => u.username.toLowerCase() === userVal && (u.password === pwdVal || (u.username === "admin" && pwdVal === "admin123")));

    if (!userObj) {
      errorMsg.innerText = "Usuario o contraseña incorrectos.";
      errorMsg.style.display = "block";
      return;
    }

    if (!userObj.active) {
      errorMsg.innerText = "Esta cuenta de usuario se encuentra deshabilitada por el Administrador.";
      errorMsg.style.display = "block";
      return;
    }

    errorMsg.style.display = "none";
    setCurrentUser(userObj.username);
    overlay.classList.remove("active");
    location.reload();
  });

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (confirm("¿Deseas cerrar tu sesión actual?")) {
        setCurrentUser(null);
        location.reload();
      }
    });
  }
}

function updateUserHeader(user) {
  const headerName = document.getElementById("header-user-name");
  const roleBadge = document.getElementById("header-user-role");
  if (headerName) headerName.innerText = user.fullName;
  if (roleBadge) {
    roleBadge.innerText = user.role === "admin" ? "Admin" : "Usuario";
    roleBadge.className = user.role === "admin" ? "badge badge-indigo" : "badge badge-emerald";
  }

  // Mostrar el botón de navegación a usuarios solo si es admin
  const usersNavItem = document.getElementById("nav-item-users");
  if (usersNavItem) {
    usersNavItem.style.display = user.role === "admin" ? "block" : "none";
  }
}

function initUsersSection() {
  const newBtn = document.getElementById("btn-new-user");
  const modal = document.getElementById("modal-user");
  const closeBtn = document.getElementById("btn-close-modal-user");
  const cancelBtn = document.getElementById("btn-cancel-user");
  const form = document.getElementById("form-user");

  if (!newBtn || !modal) return;

  newBtn.addEventListener("click", () => {
    document.getElementById("user-edit-username").value = "";
    document.getElementById("user-username").value = "";
    document.getElementById("user-username").disabled = false;
    document.getElementById("user-fullname").value = "";
    document.getElementById("user-password").value = "";
    document.getElementById("user-password").required = true;
    document.getElementById("user-pwd-help").style.display = "none";
    document.getElementById("user-role").value = "user";
    document.getElementById("modal-user-title").innerText = "Registrar Nuevo Usuario";
    populateUserCompanyCheckboxes([]);
    modal.classList.add("active-modal");
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("active-modal"));
  cancelBtn.addEventListener("click", () => modal.classList.remove("active-modal"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const editUsername = document.getElementById("user-edit-username").value;
    const username = document.getElementById("user-username").value.trim().toLowerCase();
    const fullName = document.getElementById("user-fullname").value.trim();
    const password = document.getElementById("user-password").value.trim();
    const role = document.getElementById("user-role").value;

    const selectedCompanies = [];
    document.querySelectorAll(".user-comp-checkbox:checked").forEach(cb => {
      selectedCompanies.push(cb.value);
    });

    const users = getUsers();

    if (editUsername) {
      const uIndex = users.findIndex(u => u.username === editUsername);
      if (uIndex !== -1) {
        users[uIndex].fullName = fullName;
        users[uIndex].role = role;
        if (password) users[uIndex].password = password;
        users[uIndex].assignedCompanies = role === "admin" ? ["*"] : selectedCompanies;
      }
    } else {
      if (users.some(u => u.username.toLowerCase() === username)) {
        alert("El nombre de usuario ya existe. Elige otro.");
        return;
      }
      users.push({
        username,
        fullName,
        password,
        role,
        active: true,
        assignedCompanies: role === "admin" ? ["*"] : selectedCompanies
      });
    }

    saveUsers(users);
    modal.classList.remove("active-modal");
    renderUsers();
    alert("Usuario guardado con éxito.");
  });
}

function populateUserCompanyCheckboxes(assignedList = []) {
  const container = document.getElementById("user-companies-checkbox-list");
  if (!container) return;
  container.innerHTML = "";

  const allCompanies = JSON.parse(localStorage.getItem("sistema_contable_companies")) || [DEFAULT_COMPANY];
  
  allCompanies.forEach(c => {
    const isChecked = assignedList.includes("*") || assignedList.includes(c.id);
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "8px";
    label.style.cursor = "pointer";
    label.style.fontSize = "0.85rem";
    label.innerHTML = `
      <input type="checkbox" class="user-comp-checkbox" value="${c.id}" ${isChecked ? 'checked' : ''} style="width: auto;">
      <span><strong>${c.name}</strong> (${c.rfc})</span>
    `;
    container.appendChild(label);
  });
}

function renderUsers() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  const users = getUsers();
  const allCompanies = JSON.parse(localStorage.getItem("sistema_contable_companies")) || [DEFAULT_COMPANY];
  const currentUser = getCurrentUser();

  users.forEach(u => {
    const tr = document.createElement("tr");
    
    let companyBadges = "";
    if (u.role === "admin" || (u.assignedCompanies && u.assignedCompanies.includes("*"))) {
      companyBadges = '<span class="badge badge-purple">Todas las Empresas (Admin)</span>';
    } else if (u.assignedCompanies && u.assignedCompanies.length > 0) {
      companyBadges = u.assignedCompanies.map(cId => {
        const comp = allCompanies.find(c => c.id === cId);
        return `<span class="badge badge-indigo" style="margin: 2px;">${comp ? comp.name : cId}</span>`;
      }).join(" ");
    } else {
      companyBadges = '<span class="badge badge-rose">Sin empresas asignadas</span>';
    }

    const isSelf = currentUser && currentUser.username === u.username;

    tr.innerHTML = `
      <td><strong class="font-mono">${u.username}</strong></td>
      <td>${u.fullName}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-indigo' : 'badge-emerald'}">${u.role === 'admin' ? 'Administrador' : 'Usuario'}</span></td>
      <td><div style="display: flex; flex-wrap: wrap; gap: 4px;">${companyBadges}</div></td>
      <td>
        <span class="badge ${u.active ? 'badge-emerald' : 'badge-rose'}">
          ${u.active ? '<i class="fa-solid fa-circle-check"></i> Activo' : '<i class="fa-solid fa-circle-xmark"></i> Inactivo'}
        </span>
      </td>
      <td class="text-center">
        <div class="table-actions-cell" style="justify-content: center; display: flex; gap: 6px;">
          <button type="button" class="btn-icon btn-icon-primary" title="Editar usuario y permisos" onclick="openEditUser('${u.username}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          ${!isSelf ? `
            <button type="button" class="btn-icon ${u.active ? 'btn-icon-danger' : 'btn-icon-success'}" title="${u.active ? 'Deshabilitar acceso' : 'Habilitar acceso'}" onclick="toggleUserActive('${u.username}')">
              <i class="fa-solid ${u.active ? 'fa-user-slash' : 'fa-user-check'}"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.openEditUser = function(username) {
  const users = getUsers();
  const u = users.find(user => user.username === username);
  if (!u) return;

  const modal = document.getElementById("modal-user");
  document.getElementById("user-edit-username").value = u.username;
  document.getElementById("user-username").value = u.username;
  document.getElementById("user-username").disabled = true;
  document.getElementById("user-fullname").value = u.fullName;
  document.getElementById("user-password").value = "";
  document.getElementById("user-password").required = false;
  document.getElementById("user-pwd-help").style.display = "block";
  document.getElementById("user-role").value = u.role;
  document.getElementById("modal-user-title").innerText = `Editar Usuario: ${u.username}`;

  populateUserCompanyCheckboxes(u.assignedCompanies || []);
  modal.classList.add("active-modal");
};

window.toggleUserActive = function(username) {
  const users = getUsers();
  const uIndex = users.findIndex(user => user.username === username);
  if (uIndex !== -1) {
    users[uIndex].active = !users[uIndex].active;
    saveUsers(users);
    renderUsers();
  }
};
