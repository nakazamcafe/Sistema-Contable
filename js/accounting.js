/**
 * Motor Contable - Sistema Contable Mexicano
 * Maneja la lógica de cuentas, pólizas, balanza de comprobación y estados financieros.
 */

class AccountingSystem {
  constructor(accounts = [], polizas = [], companyId = "EDM260715AAA") {
    this.accounts = JSON.parse(JSON.stringify(accounts));
    this.polizas = JSON.parse(JSON.stringify(polizas));
    this.companyId = companyId;
  }

  // --- GESTIÓN DE CUENTAS ---

  getAccount(code) {
    return this.accounts.find(a => a.code === code);
  }

  // Obtener cuentas ordenadas jerárquicamente
  getSortedAccounts() {
    return [...this.accounts].sort((a, b) => a.code.localeCompare(b.code));
  }

  addAccount(account) {
    if (!account.code || !account.name || !account.type || !account.level) {
      throw new Error("Datos de cuenta incompletos.");
    }
    if (this.getAccount(account.code)) {
      throw new Error(`La cuenta con código ${account.code} ya existe.`);
    }
    
    // Si tiene cuenta padre, validar que exista
    if (account.parentCode && !this.getAccount(account.parentCode)) {
      throw new Error(`La cuenta padre ${account.parentCode} no existe.`);
    }

    this.accounts.push({
      code: account.code,
      name: account.name,
      type: account.type,
      level: parseInt(account.level),
      satCode: account.satCode || "",
      parentCode: account.parentCode || ""
    });
    
    this.saveToStorage();
    return true;
  }

  updateAccount(code, updatedData) {
    const account = this.getAccount(code);
    if (!account) throw new Error(`La cuenta ${code} no existe.`);
    
    account.name = updatedData.name || account.name;
    account.satCode = updatedData.satCode !== undefined ? updatedData.satCode : account.satCode;
    account.type = updatedData.type || account.type;
    
    this.saveToStorage();
    return true;
  }

  deleteAccount(code) {
    // Validar si tiene subcuentas (cuentas hijo)
    const hasChildren = this.accounts.some(a => a.parentCode === code);
    if (hasChildren) {
      throw new Error("No se puede eliminar la cuenta porque tiene subcuentas asociadas.");
    }

    // Validar si tiene movimientos en pólizas
    const hasMovements = this.polizas.some(p => p.lines.some(l => l.accountCode === code));
    if (hasMovements) {
      throw new Error("No se puede eliminar la cuenta porque tiene pólizas registradas.");
    }

    this.accounts = this.accounts.filter(a => a.code !== code);
    this.saveToStorage();
    return true;
  }

  // --- GESTIÓN DE PÓLIZAS ---

  getPoliza(id) {
    return this.polizas.find(p => p.id === id);
  }

  addPoliza(poliza) {
    if (!poliza.number || !poliza.date || !poliza.type || !poliza.concept || !poliza.lines || poliza.lines.length === 0) {
      throw new Error("Datos de póliza incompletos.");
    }

    // Validar partida doble (Cargos = Abonos)
    let totalDebit = 0;
    let totalCredit = 0;
    for (let line of poliza.lines) {
      if (!this.getAccount(line.accountCode)) {
        throw new Error(`La cuenta contable ${line.accountCode} no existe en el catálogo.`);
      }
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }

    // Permitir pequeña tolerancia por redondeo de centavos
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`La póliza no está cuadrada. Cargos: $${totalDebit.toFixed(2)}, Abonos: $${totalCredit.toFixed(2)} (Diferencia: $${Math.abs(totalDebit - totalCredit).toFixed(2)})`);
    }

    const id = poliza.id || `POL-${Date.now()}`;
    const newPol = {
      id,
      number: poliza.number,
      date: poliza.date,
      type: poliza.type, // Diario, Ingresos, Egresos
      concept: poliza.concept,
      lines: poliza.lines.map(l => ({
        accountCode: l.accountCode,
        concept: l.concept || poliza.concept,
        debit: parseFloat(l.debit || 0),
        credit: parseFloat(l.credit || 0),
        reference: l.reference || ""
      }))
    };

    if (poliza.id) {
      // Editar
      const idx = this.polizas.findIndex(p => p.id === poliza.id);
      if (idx !== -1) this.polizas[idx] = newPol;
      else this.polizas.push(newPol);
    } else {
      // Nueva
      this.polizas.push(newPol);
    }

    this.saveToStorage();
    return id;
  }

  deletePoliza(id) {
    this.polizas = this.polizas.filter(p => p.id !== id);
    this.saveToStorage();
    return true;
  }

  // --- CÁLCULO DE SALDOS Y BALANZA ---

  /**
   * Calcula los saldos (iniciales, cargos, abonos y finales) para un periodo.
   * Acumula jerárquicamente de hijos a padres.
   */
  calculateBalances(startDate, endDate) {
    const balances = {};
    const dateStart = new Date(startDate);
    const dateEnd = new Date(endDate);

    // 1. Inicializar objeto de balance para todas las cuentas
    this.accounts.forEach(acc => {
      balances[acc.code] = {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        level: acc.level,
        satCode: acc.satCode,
        parentCode: acc.parentCode,
        initialDebit: 0,
        initialCredit: 0,
        initialBalance: 0,
        periodDebit: 0,
        periodCredit: 0,
        finalBalance: 0,
        hasMovements: false
      };
    });

    // 2. Procesar los movimientos de las pólizas
    this.polizas.forEach(pol => {
      const polDate = new Date(pol.date);
      const isBefore = polDate < dateStart;
      const isDuring = polDate >= dateStart && polDate <= dateEnd;

      if (isBefore || isDuring) {
        pol.lines.forEach(line => {
          const accBal = balances[line.accountCode];
          if (accBal) {
            if (isBefore) {
              accBal.initialDebit += line.debit;
              accBal.initialCredit += line.credit;
            } else {
              accBal.periodDebit += line.debit;
              accBal.periodCredit += line.credit;
              if (line.debit > 0 || line.credit > 0) {
                accBal.hasMovements = true;
              }
            }
          }
        });
      }
    });

    // 3. Rollup (Acumulación jerárquica bottom-up)
    // Ordenamos de mayor a menor nivel para acumular de los nodos hoja hacia arriba
    const sortedLevels = [...this.accounts].sort((a, b) => b.level - a.level);
    
    sortedLevels.forEach(acc => {
      const parentCode = acc.parentCode;
      if (parentCode && balances[parentCode]) {
        const childBal = balances[acc.code];
        const parentBal = balances[parentCode];

        parentBal.initialDebit += childBal.initialDebit;
        parentBal.initialCredit += childBal.initialCredit;
        parentBal.periodDebit += childBal.periodDebit;
        parentBal.periodCredit += childBal.periodCredit;
        if (childBal.hasMovements) {
          parentBal.hasMovements = true;
        }
      }
    });

    // Helper para determinar naturaleza contable
    const isDeudora = (type) => {
      return ["Activo Deudor", "Costos", "Gastos"].includes(type);
    };

    // 4. Calcular los saldos netos finales e iniciales basados en la naturaleza de la cuenta
    Object.keys(balances).forEach(code => {
      const bal = balances[code];
      if (isDeudora(bal.type)) {
        bal.initialBalance = bal.initialDebit - bal.initialCredit;
        bal.finalBalance = bal.initialBalance + bal.periodDebit - bal.periodCredit;
      } else {
        // Acreedora (Pasivo, Capital, Ingresos, etc.)
        bal.initialBalance = bal.initialCredit - bal.initialDebit;
        bal.finalBalance = bal.initialBalance + bal.periodCredit - bal.periodDebit;
      }
    });

    return balances;
  }

  /**
   * Obtiene la Balanza de Comprobación para un periodo y nivel máximo de cuenta.
   */
  getBalanza(startDate, endDate, maxLevel = 4) {
    const allBalances = this.calculateBalances(startDate, endDate);
    
    // Filtrar por nivel y ordenar por código de cuenta
    const balanzaRows = Object.values(allBalances)
      .filter(bal => bal.level <= maxLevel)
      .sort((a, b) => a.code.localeCompare(b.code));

    // Calcular totales
    let totalInitialDebit = 0;
    let totalInitialCredit = 0;
    let totalPeriodDebit = 0;
    let totalPeriodCredit = 0;
    let totalFinalDebit = 0;
    let totalFinalCredit = 0;

    // Solo sumamos las cuentas de Nivel 1 (las raíces) para el total general
    balanzaRows.forEach(row => {
      if (row.level === 1) {
        // Auxiliar para determinar la naturaleza
        const isDeudora = ["Activo Deudor", "Costos", "Gastos"].includes(row.type);
        
        if (isDeudora) {
          totalInitialDebit += row.initialBalance >= 0 ? row.initialBalance : 0;
          totalInitialCredit += row.initialBalance < 0 ? -row.initialBalance : 0;
          totalFinalDebit += row.finalBalance >= 0 ? row.finalBalance : 0;
          totalFinalCredit += row.finalBalance < 0 ? -row.finalBalance : 0;
        } else {
          totalInitialDebit += row.initialBalance < 0 ? -row.initialBalance : 0;
          totalInitialCredit += row.initialBalance >= 0 ? row.initialBalance : 0;
          totalFinalDebit += row.finalBalance < 0 ? -row.finalBalance : 0;
          totalFinalCredit += row.finalBalance >= 0 ? row.finalBalance : 0;
        }
        
        totalPeriodDebit += row.periodDebit;
        totalPeriodCredit += row.periodCredit;
      }
    });

    return {
      rows: balanzaRows,
      totals: {
        initialDebit: totalInitialDebit,
        initialCredit: totalInitialCredit,
        periodDebit: totalPeriodDebit,
        periodCredit: totalPeriodCredit,
        finalDebit: totalFinalDebit,
        finalCredit: totalFinalCredit
      }
    };
  }

  // --- REPORTES AUXILIARES ---

  /**
   * Genera el reporte auxiliar de una cuenta específica en un periodo.
   */
  getAuxiliar(accountCode, startDate, endDate) {
    const account = this.getAccount(accountCode);
    if (!account) throw new Error(`La cuenta ${accountCode} no existe.`);

    const dateStart = new Date(startDate);
    const dateEnd = new Date(endDate);

    // Calcular Saldo Inicial (previo a startDate)
    let initialDebit = 0;
    let initialCredit = 0;
    
    // Obtener todas las subcuentas u hojas que pertenecen a esta cuenta (o ella misma)
    const subAccountCodes = this.accounts
      .filter(a => a.code === accountCode || a.code.startsWith(accountCode + "-") || a.parentCode === accountCode)
      .map(a => a.code);

    // Si la estructura no es estrictamente por prefijos sino por parentesco recursivo:
    const getLeafCodes = (code) => {
      const children = this.accounts.filter(a => a.parentCode === code);
      if (children.length === 0) return [code];
      return children.reduce((acc, child) => acc.concat(getLeafCodes(child.code)), []);
    };
    const leafCodes = getLeafCodes(accountCode);

    this.polizas.forEach(pol => {
      const polDate = new Date(pol.date);
      if (polDate < dateStart) {
        pol.lines.forEach(line => {
          if (leafCodes.includes(line.accountCode)) {
            initialDebit += line.debit;
            initialCredit += line.credit;
          }
        });
      }
    });

    const isDeudora = ["Activo Deudor", "Costos", "Gastos"].includes(account.type);
    let initialBalance = isDeudora ? (initialDebit - initialCredit) : (initialCredit - initialDebit);

    // Obtener movimientos en el periodo
    const movements = [];
    let runningBalance = initialBalance;

    this.polizas
      .filter(pol => {
        const polDate = new Date(pol.date);
        return polDate >= dateStart && polDate <= dateEnd;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date) || a.number.localeCompare(b.number))
      .forEach(pol => {
        pol.lines.forEach(line => {
          // Si el movimiento es en una cuenta que pertenece a la jerarquía de la seleccionada
          if (leafCodes.includes(line.accountCode)) {
            if (isDeudora) {
              runningBalance += (line.debit - line.credit);
            } else {
              runningBalance += (line.credit - line.debit);
            }

            // Obtener el nombre de la cuenta específica del movimiento
            const lineAcc = this.getAccount(line.accountCode);

            movements.push({
              date: pol.date,
              polizaNumber: pol.number,
              polizaType: pol.type,
              concept: line.concept || pol.concept,
              accountCode: line.accountCode,
              accountName: lineAcc ? lineAcc.name : "",
              reference: line.reference,
              debit: line.debit,
              credit: line.credit,
              balance: runningBalance
            });
          }
        });
      });

    return {
      account,
      initialBalance,
      movements,
      finalBalance: runningBalance
    };
  }

  // --- ESTADOS FINANCIEROS ---

  /**
   * 1. ESTADO DE RESULTADOS INTEGRAL
   */
  getEstadoResultados(startDate, endDate) {
    const balances = this.calculateBalances(startDate, endDate);

    // Agrupar ingresos, costos y gastos
    const ingresos = [];
    const costos = [];
    const gastos = [];

    let totalIngresos = 0;
    let totalCostos = 0;
    let totalGastos = 0;

    Object.values(balances).forEach(bal => {
      // Solo tomamos cuentas de Nivel 2 o Nivel 1 que no tengan subcuentas para reportar de forma agrupada y no duplicar
      const hasChildren = this.accounts.some(a => a.parentCode === bal.code);
      
      if (bal.level === 2 || (bal.level === 1 && !hasChildren)) {
        if (bal.type === "Ingresos") {
          ingresos.push({ name: bal.name, code: bal.code, amount: bal.finalBalance });
          totalIngresos += bal.finalBalance;
        } else if (bal.type === "Costos") {
          costos.push({ name: bal.name, code: bal.code, amount: bal.finalBalance });
          totalCostos += bal.finalBalance;
        } else if (bal.type === "Gastos") {
          gastos.push({ name: bal.name, code: bal.code, amount: bal.finalBalance });
          totalGastos += bal.finalBalance;
        }
      }
    });

    const utilidadBruta = totalIngresos - totalCostos;
    const utilidadNeta = utilidadBruta - totalGastos;

    return {
      period: { startDate, endDate },
      ingresos,
      costos,
      gastos,
      totals: {
        ingresos: totalIngresos,
        costos: totalCostos,
        gastos: totalGastos,
        utilidadBruta,
        utilidadNeta
      }
    };
  }

  /**
   * 2. BALANCE GENERAL (Estado de Situación Financiera)
   */
  getBalanceGeneral(startDate, endDate) {
    const balances = this.calculateBalances(startDate, endDate);
    
    // Obtener la utilidad del periodo desde el Estado de Resultados
    const er = this.getEstadoResultados(startDate, endDate);
    const utilidadNeta = er.totals.utilidadNeta;

    const activos = [];
    const pasivos = [];
    const capital = [];

    let totalActivos = 0;
    let totalPasivos = 0;
    let totalCapitalCuentas = 0;

    Object.values(balances).forEach(bal => {
      // Usar cuentas de Nivel 2 o raíces de Nivel 1 que no tienen hijos
      const hasChildren = this.accounts.some(a => a.parentCode === bal.code);
      
      if (bal.level === 2 || (bal.level === 1 && !hasChildren)) {
        if (bal.type.startsWith("Activo")) {
          // Si es Activo Acreedor (depreciación acumulada, etc.), se resta
          const sign = bal.type === "Activo Acreedor" ? -1 : 1;
          activos.push({ name: bal.name, code: bal.code, amount: bal.finalBalance * sign });
          totalActivos += (bal.finalBalance * sign);
        } else if (bal.type.startsWith("Pasivo")) {
          const sign = bal.type === "Pasivo Deudor" ? -1 : 1;
          pasivos.push({ name: bal.name, code: bal.code, amount: bal.finalBalance * sign });
          totalPasivos += (bal.finalBalance * sign);
        } else if (bal.type.startsWith("Capital")) {
          // Exceptuar la cuenta de Utilidad del Ejercicio en sí para inyectarla de forma controlada
          if (bal.satCode !== "305" && bal.name.toLowerCase().indexOf("utilidad del ejercicio") === -1) {
            const sign = bal.type === "Capital Deudor" ? -1 : 1;
            capital.push({ name: bal.name, code: bal.code, amount: bal.finalBalance * sign });
            totalCapitalCuentas += (bal.finalBalance * sign);
          }
        }
      }
    });

    // Inyectar utilidad del ejercicio calculada
    capital.push({ name: "Utilidad (o Pérdida) del Ejercicio", code: "RESULTADO", amount: utilidadNeta, isCalculated: true });
    const totalCapital = totalCapitalCuentas + utilidadNeta;

    return {
      period: { startDate, endDate },
      activos,
      pasivos,
      capital,
      totals: {
        activos: totalActivos,
        pasivos: totalPasivos,
        capital: totalCapital,
        pasivoMasCapital: totalPasivos + totalCapital,
        diferencia: totalActivos - (totalPasivos + totalCapital) // Debe ser cero
      }
    };
  }

  /**
   * 3. ESTADO DE VARIACIONES EN EL CAPITAL CONTABLE
   */
  getEstadoVariacionesCapital(startDate, endDate) {
    const balances = this.calculateBalances(startDate, endDate);
    
    // Obtener utilidad neta
    const er = this.getEstadoResultados(startDate, endDate);
    const utilidadNeta = er.totals.utilidadNeta;

    const capitalItems = [];
    let totalSaldoInicial = 0;
    let totalAumentos = 0;
    let totalReducciones = 0;
    let totalSaldoFinal = 0;

    Object.values(balances).forEach(bal => {
      if (bal.type.startsWith("Capital") && bal.level === 2) {
        const sign = bal.type === "Capital Deudor" ? -1 : 1;

        // Si es la cuenta específica para el resultado del ejercicio,
        // su incremento/aumento en el periodo se considera la Utilidad Neta calculada.
        let saldoInicial = bal.initialBalance * sign;
        let aumento = 0;
        let reduccion = 0;

        if (bal.satCode === "305" || bal.name.toLowerCase().indexOf("utilidad del ejercicio") === -1) {
          // Cuentas normales de capital (Capital Social, Utilidades Acumuladas)
          // Incrementos en el periodo (movimientos acreedores para Capital)
          aumento = bal.periodCredit;
          reduccion = bal.periodDebit;
        }

        let saldoFinal = saldoInicial + (aumento - reduccion) * sign;

        capitalItems.push({
          code: bal.code,
          name: bal.name,
          saldoInicial,
          aumentos: aumento,
          reducciones: reduccion,
          saldoFinal
        });

        totalSaldoInicial += saldoInicial;
        totalAumentos += aumento;
        totalReducciones += reduccion;
        totalSaldoFinal += saldoFinal;
      }
    });

    // Inyectar de manera explícita el renglón de Utilidad del Ejercicio
    // si no existía ya una cuenta mapeada.
    const hasUtilidadRow = capitalItems.some(item => item.name.toLowerCase().indexOf("utilidad del ejercicio") !== -1);
    if (!hasUtilidadRow) {
      capitalItems.push({
        code: "UTIL-PER",
        name: "Utilidad del Ejercicio",
        saldoInicial: 0,
        aumentos: utilidadNeta,
        reducciones: 0,
        saldoFinal: utilidadNeta
      });
      totalAumentos += utilidadNeta;
      totalSaldoFinal += utilidadNeta;
    }

    return {
      period: { startDate, endDate },
      items: capitalItems,
      totals: {
        saldoInicial: totalSaldoInicial,
        aumentos: totalAumentos,
        reducciones: totalReducciones,
        saldoFinal: totalSaldoFinal
      }
    };
  }

  /**
   * 4. ESTADO DE FLUJOS DE EFECTIVO (Método Indirecto)
   */
  getEstadoFlujosEfectivo(startDate, endDate) {
    const balances = this.calculateBalances(startDate, endDate);
    const er = this.getEstadoResultados(startDate, endDate);
    const utilidadNeta = er.totals.utilidadNeta;

    // 1. Identificar cuentas de Efectivo y Equivalentes (Caja + Bancos)
    // Son aquellas de Activo que pertenecen a la agrupación de Caja o Bancos (código SAT 101 y 102)
    const isEfectivo = (bal) => {
      return bal.satCode && (bal.satCode.startsWith("101") || bal.satCode.startsWith("102"));
    };

    let efectivoInicial = 0;
    let efectivoFinal = 0;

    Object.values(balances).forEach(bal => {
      // Sumar solo hojas de nivel más específico para no duplicar sumas
      const hasChildren = this.accounts.some(a => a.parentCode === bal.code);
      if (!hasChildren && isEfectivo(bal)) {
        efectivoInicial += bal.initialBalance;
        efectivoFinal += bal.finalBalance;
      }
    });

    // 2. Calcular los cambios en el Capital de Trabajo (Activos y Pasivos no efectivos)
    const actividadesOperacion = [];
    let totalOperacion = utilidadNeta; // Empezamos desde la utilidad neta

    const actividadesInversion = [];
    let totalInversion = 0;

    const actividadesFinanciamiento = [];
    let totalFinanciamiento = 0;

    Object.values(balances).forEach(bal => {
      // Agrupar a Nivel 2 o raíces para simplificar presentación
      const hasChildren = this.accounts.some(a => a.parentCode === bal.code);
      if ((bal.level === 2 || (bal.level === 1 && !hasChildren)) && !isEfectivo(bal)) {
        
        // Variación = Saldo Final - Saldo Inicial
        const variacionDeudor = (bal.periodDebit - bal.periodCredit);
        const variacionAcreedor = (bal.periodCredit - bal.periodDebit);

        // Clasificar según el tipo de cuenta
        if (bal.type.startsWith("Activo")) {
          // Activos no efectivos (Clientes, Inventarios, IVA Acreditable)
          // Un incremento en Activo resta flujo de efectivo, un decremento suma
          const flujo = -variacionDeudor;
          if (flujo !== 0) {
            actividadesOperacion.push({
              name: `Cambio en ${bal.name} (Activo)`,
              amount: flujo
            });
            totalOperacion += flujo;
          }
        } else if (bal.type.startsWith("Pasivo")) {
          // Pasivos (Proveedores, Acreedores, IVA Trasladado)
          // Un incremento en Pasivo suma flujo, un decremento resta
          const flujo = variacionAcreedor;
          if (flujo !== 0) {
            actividadesOperacion.push({
              name: `Cambio en ${bal.name} (Pasivo)`,
              amount: flujo
            });
            totalOperacion += flujo;
          }
        } else if (bal.type.startsWith("Capital")) {
          // Capital (excepto la utilidad neta que es el punto de partida)
          if (bal.satCode !== "305" && bal.name.toLowerCase().indexOf("utilidad del ejercicio") === -1) {
            const flujo = variacionAcreedor;
            if (flujo !== 0) {
              actividadesFinanciamiento.push({
                name: `Aportaciones / Retiros en ${bal.name}`,
                amount: flujo
              });
              totalFinanciamiento += flujo;
            }
          }
        }
      }
    });

    // Netos
    const incrementoEfectivo = efectivoFinal - efectivoInicial;
    
    // Si la suma no cuadra perfectamente debido a reclasificaciones manuales,
    // ajustamos en una línea de ajuste de operación para cuadrar por el método indirecto
    const sumaCalculada = totalOperacion + totalInversion + totalFinanciamiento;
    const diferenciaAjuste = incrementoEfectivo - (sumaCalculada - utilidadNeta); // Variación neta menos lo calculado sin utilidad
    
    // El flujo de operación neto ajustado debe ser tal que: Utilidad + OperacionOtros + Inversion + Financiamiento = IncrementoEfectivo
    const ajuste = incrementoEfectivo - (totalOperacion + totalInversion + totalFinanciamiento);
    if (Math.abs(ajuste) > 0.01) {
      actividadesOperacion.push({
        name: "Otros ajustes de operación",
        amount: ajuste
      });
      totalOperacion += ajuste;
    }

    return {
      period: { startDate, endDate },
      utilidadNeta,
      actividadesOperacion,
      actividadesInversion,
      actividadesFinanciamiento,
      totals: {
        operacion: totalOperacion,
        inversion: totalInversion,
        financiamiento: totalFinanciamiento,
        efectivoInicial,
        efectivoFinal,
        incrementoEfectivo
      }
    };
  }

  // --- LOCAL PERSISTENCE ---

  saveToStorage() {
    localStorage.setItem(`sistema_contable_accounts_${this.companyId}`, JSON.stringify(this.accounts));
    localStorage.setItem(`sistema_contable_polizas_${this.companyId}`, JSON.stringify(this.polizas));
    if (typeof saveCloudAccounts === "function") {
      saveCloudAccounts(this.companyId, this.accounts);
    }
  }

  static loadFromStorage(companyId = null) {
    if (!companyId) {
      companyId = localStorage.getItem("sistema_contable_active_company_id") || "EDM260715AAA";
    }
    
    let accounts = JSON.parse(localStorage.getItem(`sistema_contable_accounts_${companyId}`));
    let polizas = JSON.parse(localStorage.getItem(`sistema_contable_polizas_${companyId}`));

    // Si es la empresa por defecto y no hay datos, cargar los datos muestra
    if (companyId === "EDM260715AAA" && (!accounts || accounts.length === 0)) {
      accounts = DEFAULT_ACCOUNTS;
      polizas = DEFAULT_POLIZAS;
      localStorage.setItem(`sistema_contable_accounts_${companyId}`, JSON.stringify(accounts));
      localStorage.setItem(`sistema_contable_polizas_${companyId}`, JSON.stringify(polizas));
    }

    if (!accounts) {
      accounts = [];
      polizas = [];
    }

    return new AccountingSystem(accounts, polizas, companyId);
  }

  static resetDatabase(companyId = "EDM260715AAA") {
    localStorage.removeItem(`sistema_contable_accounts_${companyId}`);
    localStorage.removeItem(`sistema_contable_polizas_${companyId}`);
    return this.loadFromStorage(companyId);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AccountingSystem };
}
