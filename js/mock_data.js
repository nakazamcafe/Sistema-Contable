// Datos muestra cargados por defecto para el Catálogo de Cuentas y Pólizas

const DEFAULT_ACCOUNTS = [
  // ACTIVO
  { code: "100-00-000", name: "ACTIVO", type: "Activo Deudor", level: 1, satCode: "100", parentCode: "" },
  { code: "101-00-000", name: "Caja", type: "Activo Deudor", level: 2, satCode: "101", parentCode: "100-00-000" },
  { code: "101-01-000", name: "Caja General", type: "Activo Deudor", level: 3, satCode: "101.02", parentCode: "101-00-000" },
  { code: "101-02-000", name: "Caja Chica", type: "Activo Deudor", level: 3, satCode: "101.01", parentCode: "101-00-000" },
  { code: "102-00-000", name: "Bancos", type: "Activo Deudor", level: 2, satCode: "102", parentCode: "100-00-000" },
  { code: "102-01-000", name: "Bancos Nacionales", type: "Activo Deudor", level: 3, satCode: "102.01", parentCode: "102-00-000" },
  { code: "102-01-001", name: "Bancomer *9876", type: "Activo Deudor", level: 4, satCode: "102.01", parentCode: "102-01-000" },
  { code: "102-01-002", name: "Banorte *5432", type: "Activo Deudor", level: 4, satCode: "102.01", parentCode: "102-01-000" },
  { code: "105-00-000", name: "Clientes", type: "Activo Deudor", level: 2, satCode: "105", parentCode: "100-00-000" },
  { code: "105-01-000", name: "Clientes Nacionales", type: "Activo Deudor", level: 3, satCode: "105.01", parentCode: "105-00-000" },
  { code: "105-01-001", name: "Comercializadora Alfa S.A. de C.V.", type: "Activo Deudor", level: 4, satCode: "105.01", parentCode: "105-01-000" },
  { code: "105-01-002", name: "Servicios Beta S. de R.L.", type: "Activo Deudor", level: 4, satCode: "105.01", parentCode: "105-01-000" },
  { code: "115-00-000", name: "Inventarios", type: "Activo Deudor", level: 2, satCode: "115", parentCode: "100-00-000" },
  { code: "115-01-000", name: "Almacén de Mercancías", type: "Activo Deudor", level: 3, satCode: "115.01", parentCode: "115-00-000" },
  { code: "118-00-000", name: "IVA Acreditable Pagado", type: "Activo Deudor", level: 2, satCode: "118", parentCode: "100-00-000" },
  { code: "119-00-000", name: "IVA Pendiente de Acreditar", type: "Activo Deudor", level: 2, satCode: "119", parentCode: "100-00-000" },

  // PASIVO
  { code: "200-00-000", name: "PASIVO", type: "Pasivo Acreedor", level: 1, satCode: "200", parentCode: "" },
  { code: "201-00-000", name: "Proveedores", type: "Pasivo Acreedor", level: 2, satCode: "201", parentCode: "200-00-000" },
  { code: "201-01-000", name: "Proveedores Nacionales", type: "Pasivo Acreedor", level: 3, satCode: "201.01", parentCode: "201-00-000" },
  { code: "201-01-001", name: "Distribuidora del Norte SA", type: "Pasivo Acreedor", level: 4, satCode: "201.01", parentCode: "201-01-000" },
  { code: "205-00-000", name: "Acreedores Diversos", type: "Pasivo Acreedor", level: 2, satCode: "205", parentCode: "200-00-000" },
  { code: "208-00-000", name: "IVA Trasladado Cobrado", type: "Pasivo Acreedor", level: 2, satCode: "208", parentCode: "200-00-000" },
  { code: "209-00-000", name: "IVA Pendiente de Trasladar", type: "Pasivo Acreedor", level: 2, satCode: "209", parentCode: "200-00-000" },

  // CAPITAL
  { code: "300-00-000", name: "CAPITAL", type: "Capital Acreedor", level: 1, satCode: "300", parentCode: "" },
  { code: "301-00-000", name: "Capital Social", type: "Capital Acreedor", level: 2, satCode: "301", parentCode: "300-00-000" },
  { code: "301-01-000", name: "Capital Social Fijo", type: "Capital Acreedor", level: 3, satCode: "301.01", parentCode: "301-00-000" },
  { code: "304-00-000", name: "Utilidades Acumuladas", type: "Capital Acreedor", level: 2, satCode: "304", parentCode: "300-00-000" },
  { code: "305-00-000", name: "Utilidad del Ejercicio", type: "Capital Acreedor", level: 2, satCode: "305", parentCode: "300-00-000" },

  // INGRESOS
  { code: "400-00-000", name: "INGRESOS", type: "Ingresos", level: 1, satCode: "400", parentCode: "" },
  { code: "401-00-000", name: "Ingresos por Ventas", type: "Ingresos", level: 2, satCode: "401", parentCode: "400-00-000" },
  { code: "401-01-000", name: "Ventas Grabadas al 16%", type: "Ingresos", level: 3, satCode: "401.01", parentCode: "401-00-000" },

  // COSTOS
  { code: "500-00-000", name: "COSTOS", type: "Costos", level: 1, satCode: "500", parentCode: "" },
  { code: "501-00-000", name: "Conto de Ventas", type: "Costos", level: 2, satCode: "501", parentCode: "500-00-000" },

  // GASTOS
  { code: "600-00-000", name: "GASTOS", type: "Gastos", level: 1, satCode: "600", parentCode: "" },
  { code: "601-00-000", name: "Gastos de Administración", type: "Gastos", level: 2, satCode: "601", parentCode: "600-00-000" },
  { code: "601-01-000", name: "Sueldos y Salarios", type: "Gastos", level: 3, satCode: "601.01", parentCode: "601-00-000" },
  { code: "601-03-000", name: "Arrendamiento de Oficinas", type: "Gastos", level: 3, satCode: "601.03", parentCode: "601-00-000" },
  { code: "601-05-000", name: "Energía Eléctrica y Agua", type: "Gastos", level: 3, satCode: "601.05", parentCode: "601-00-000" },
  { code: "601-84-000", name: "Papelería e Impresos", type: "Gastos", level: 3, satCode: "601.84", parentCode: "601-00-000" }
];

const DEFAULT_POLIZAS = [
  {
    id: "POL-2607-001",
    number: "D-001",
    date: "2026-07-01",
    type: "Diario",
    concept: "Asiento de apertura - Capital e inventarios iniciales",
    lines: [
      { accountCode: "102-01-001", concept: "Apertura Bancomer", debit: 500000.00, credit: 0, reference: "Apertura" },
      { accountCode: "115-01-000", concept: "Inventario Inicial Mercancías", debit: 200000.00, credit: 0, reference: "Apertura" },
      { accountCode: "301-01-000", concept: "Aportación Capital Social Fijo", debit: 0, credit: 700000.00, reference: "Apertura" }
    ]
  },
  {
    id: "POL-2607-002",
    number: "I-001",
    date: "2026-07-10",
    type: "Ingresos",
    concept: "Venta de mercancías a crédito a Comercializadora Alfa",
    lines: [
      { accountCode: "105-01-001", concept: "Venta a crédito F-101", debit: 116000.00, credit: 0, reference: "F-101" },
      { accountCode: "401-01-000", concept: "Ingreso por Venta Mercancías", debit: 0, credit: 100000.00, reference: "F-101" },
      { accountCode: "209-00-000", concept: "IVA Pendiente por Trasladar 16%", debit: 0, credit: 160000.00 * 0.10, reference: "F-101" } // 16,000
    ]
  },
  {
    id: "POL-2607-003",
    number: "I-002",
    date: "2026-07-12",
    type: "Ingresos",
    concept: "Cobro de factura F-101 a Comercializadora Alfa y traslado de IVA",
    lines: [
      { accountCode: "102-01-001", concept: "Depósito cobro F-101", debit: 116000.00, credit: 0, reference: "Traspaso" },
      { accountCode: "105-01-001", concept: "Liquidación F-101", debit: 0, credit: 116000.00, reference: "Traspaso" },
      { accountCode: "209-00-000", concept: "Cancelación IVA Pendiente", debit: 16000.00, credit: 0, reference: "Traspaso" },
      { accountCode: "208-00-000", concept: "Reconocimiento IVA Trasladado Cobrado", debit: 0, credit: 16000.00, reference: "Traspaso" }
    ]
  },
  {
    id: "POL-2607-004",
    number: "E-001",
    date: "2026-07-15",
    type: "Egresos",
    concept: "Pago de renta de oficina administrativa del mes",
    lines: [
      { accountCode: "601-03-000", concept: "Renta de oficinas Julio 2026", debit: 15000.00, credit: 0, reference: "Fac-452" },
      { accountCode: "118-00-000", concept: "IVA Acreditable Pagado 16%", debit: 2400.00, credit: 0, reference: "Fac-452" },
      { accountCode: "102-01-001", concept: "Transferencia Bancomer", debit: 0, credit: 17400.00, reference: "Fac-452" }
    ]
  },
  {
    id: "POL-2607-005",
    number: "D-002",
    date: "2026-07-15",
    type: "Diario",
    concept: "Registro del costo de ventas de mercancías vendidas en Julio",
    lines: [
      { accountCode: "501-00-000", concept: "Costo de ventas F-101", debit: 60000.00, credit: 0, reference: "Inventario" },
      { accountCode: "115-01-000", concept: "Salida de almacén mercancías", debit: 0, credit: 60000.00, reference: "Inventario" }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_ACCOUNTS, DEFAULT_POLIZAS };
}
