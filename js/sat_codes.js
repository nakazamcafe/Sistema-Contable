// Catálogo de Códigos Agrupadores oficiales del SAT (Simplificado pero completo para operación general)
const SAT_CODES = [
  { code: "100", name: "ACTIVO", type: "Activo Deudor" },
  { code: "101", name: "Caja", type: "Activo Deudor" },
  { code: "101.01", name: "Caja chica", type: "Activo Deudor" },
  { code: "101.02", name: "Caja general", type: "Activo Deudor" },
  { code: "102", name: "Bancos", type: "Activo Deudor" },
  { code: "102.01", name: "Bancos nacionales", type: "Activo Deudor" },
  { code: "102.02", name: "Bancos extranjeros", type: "Activo Deudor" },
  { code: "103", name: "Inversiones", type: "Activo Deudor" },
  { code: "105", name: "Clientes", type: "Activo Deudor" },
  { code: "105.01", name: "Clientes nacionales", type: "Activo Deudor" },
  { code: "105.02", name: "Clientes extranjeros", type: "Activo Deudor" },
  { code: "115", name: "Inventarios", type: "Activo Deudor" },
  { code: "115.01", name: "Inventario general", type: "Activo Deudor" },
  { code: "118", name: "Impuestos acreditables pagados (IVA Acreditable)", type: "Activo Deudor" },
  { code: "119", name: "Impuestos acreditables por pagar (IVA Pendiente de Acreditar)", type: "Activo Deudor" },
  { code: "120", name: "Anticipo a proveedores", type: "Activo Deudor" },
  
  { code: "200", name: "PASIVO", type: "Pasivo Acreedor" },
  { code: "201", name: "Proveedores", type: "Pasivo Acreedor" },
  { code: "201.01", name: "Proveedores nacionales", type: "Pasivo Acreedor" },
  { code: "201.02", name: "Proveedores extranjeros", type: "Pasivo Acreedor" },
  { code: "205", name: "Acreedores diversos", type: "Pasivo Acreedor" },
  { code: "208", name: "Impuestos trasladados cobrados (IVA Trasladado)", type: "Pasivo Acreedor" },
  { code: "209", name: "Impuestos trasladados por cobrar (IVA Pendiente de Trasladar)", type: "Pasivo Acreedor" },
  { code: "216", name: "Impuestos retenidos", type: "Pasivo Acreedor" },
  
  { code: "300", name: "CAPITAL", type: "Capital Acreedor" },
  { code: "301", name: "Capital social", type: "Capital Acreedor" },
  { code: "301.01", name: "Capital social fijo", type: "Capital Acreedor" },
  { code: "302", name: "Reserva legal", type: "Capital Acreedor" },
  { code: "304", name: "Resultado de ejercicios anteriores (Utilidades acumuladas)", type: "Capital Acreedor" },
  { code: "305", name: "Resultado del ejercicio (Utilidad del ejercicio)", type: "Capital Acreedor" },
  
  { code: "400", name: "INGRESOS", type: "Ingresos" },
  { code: "401", name: "Ingresos por ventas de mercancías o servicios", type: "Ingresos" },
  { code: "401.01", name: "Ventas grabadas a tasa general", type: "Ingresos" },
  { code: "401.03", name: "Ventas exentas", type: "Ingresos" },
  { code: "402", name: "Devoluciones o descuentos sobre ventas", type: "Ingresos" },
  
  { code: "500", name: "COSTOS", type: "Costos" },
  { code: "501", name: "Costo de ventas", type: "Costos" },
  
  { code: "600", name: "GASTOS", type: "Gastos" },
  { code: "601", name: "Gastos de administración", type: "Gastos" },
  { code: "601.01", name: "Sueldos y salarios", type: "Gastos" },
  { code: "601.03", name: "Arrendamiento de inmuebles", type: "Gastos" },
  { code: "601.05", name: "Servicios públicos (Luz, Agua, Teléfono)", type: "Gastos" },
  { code: "601.09", name: "Depreciaciones", type: "Gastos" },
  { code: "601.84", name: "Otros gastos de administración", type: "Gastos" },
  { code: "602", name: "Gastos de venta", type: "Gastos" },
  { code: "602.01", name: "Propaganda y publicidad", type: "Gastos" },
  { code: "603", name: "Gastos financieros", type: "Gastos" },
  { code: "603.01", name: "Intereses bancarios", type: "Gastos" },
  { code: "603.03", name: "Comisiones bancarias", type: "Gastos" }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SAT_CODES };
}
