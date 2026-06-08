async function generarPDF() {
try {
if (typeof window.jspdf === 'undefined') {
alert('Librería PDF no disponible. Verifica tu conexión a internet.');
return;
}
const { jsPDF } = window.jspdf;
if (!lastCalculationData || lastCalculationData.length === 0 || !lastImputacion) {
alert('Primero realiza un cálculo antes de exportar.');
return;
}
const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
const PAGE_W = 210, MARGIN = 14, CONTENT_W = PAGE_W - MARGIN * 2;
let y = 14;
const utmHoy = getUtmActualVal();
const utmHoyMes = getUtmActual();
const fechaLiq = (typeof getFechaLiquidacion === 'function') ? getFechaLiquidacion() : new Date();
const fechaDoc = fechaLiq.toLocaleDateString('es-CL');
const usarTicActualPDF = document.getElementById('ticActual')?.checked || false;
const aplicarRecargoPDF = document.getElementById('recargoLey')?.checked || false;
const tasaLabel = usarTicActualPDF
  ? 'Tasa Interés Corriente para Op. Reajustables (CMF) — interés simple diario base 365 días (Art. 19 Ley 14.908)'
  : aplicarRecargoPDF
    ? 'Tasa Corriente histórica +50% Ley 14.908 — interés simple diario base 365 días (Art. 19 Ley 14.908)'
    : 'Tasa Corriente histórica por cuota (CMF) — interés simple diario base 365 días (Art. 19 Ley 14.908)';
const pensiones = lastCalculationData.filter(d => !d.isDebt);
const historicas = lastCalculationData.filter(d => d.isDebt);
const totalCapPesos = lastCalculationData.reduce((s,d) => s + d.cap, 0);
const totalIntPesos = lastCalculationData.reduce((s,d) => s + d.inte, 0);
const totalAbonosCLP = abonos.reduce((s,a) => s + a.amount, 0);
// Nota: totalParciales NO se resta del totalFinalReal — los pagos parciales ya están
// incorporados en el cap neto de cada cuota (capNeto = cuota - pagoParcial).
// Esta variable se usa solo para mostrar el total en la tabla de pagos parciales del PDF.
const totalParcialesTabla = pagosParciales.reduce((s,p) => s + p.amount, 0);
const totalCapUTM = totalCapPesos / utmHoy;
const fmt = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
// Header: solo texto sin fondo
doc.setTextColor(15, 23, 42);
doc.setFontSize(13); doc.setFont('helvetica','bold');
doc.text('LIQUIDACION DE PENSION ALIMENTICIA', PAGE_W/2, 14, {align:'center'});
doc.setFontSize(7.5); doc.setFont('helvetica','normal');
doc.setTextColor(107, 114, 142);
doc.text('Calculo referencial — Pension UTM Pro | ' + tasaLabel, PAGE_W/2, 20, {align:'center'});
doc.setTextColor(107, 114, 142);
doc.text('Generado: ' + fechaDoc + ' | UTM ref: ' + fmt(utmHoy) + ' (' + (utmHoyMes?.m||'') + ' ' + (utmHoyMes?.y||'') + ')', PAGE_W/2, 26, {align:'center'});
y = 34;
// ── Bloque Datos del Expediente ──────────────────────────────
(function renderExpedientePDF() {
  if (!activeCasoId) return;
  const casos = getCasosIndex();
  const c = casos.find(x => x.id === activeCasoId);
  if (!c) return;
  const estadoLabels = { activo: 'Activo', suspendido: 'Suspendido', archivado: 'Archivado' };
  // Construir celdas: cada celda = { label, val }
  const celdas = [];
  if (c.nombre)          celdas.push({ label: 'Carátula',      val: c.nombre });
  if (c.rolCausa)        celdas.push({ label: 'Rol',           val: c.rolCausa });
  if (c.tribunal)        celdas.push({ label: 'Tribunal',      val: c.tribunal });
  if (c.estado)          celdas.push({ label: 'Estado',        val: estadoLabels[c.estado] || c.estado });
  if (c.montoDecretado)  celdas.push({ label: 'Monto decreto', val: c.montoDecretado });
  if (c.diaPago)         celdas.push({ label: 'Día de pago',   val: c.diaPago });
  if (c.fechaInicioPago) celdas.push({ label: 'Inicio pago',   val: c.fechaInicioPago });
  if (c.reajustabilidad) celdas.push({ label: 'Reajuste',      val: c.reajustabilidad });
  if (c.alimentante)     celdas.push({ label: 'Alimentante',   val: c.alimentante + (c.rutAlimentante ? '  RUT ' + c.rutAlimentante : '') });
  if (c.alimentario)     celdas.push({ label: 'Alimentario/a', val: c.alimentario + (c.rutAlimentario ? '  RUT ' + c.rutAlimentario : '') });
  if (celdas.length === 0) return;

  // Layout en 2 columnas
  const PAD = 5, CELL_GAP = 4, CELL_H = 9;
  const colW = (CONTENT_W - PAD * 2 - CELL_GAP) / 2;
  const rows = Math.ceil(celdas.length / 2);
  const blockH = rows * CELL_H + 10; // +10 para título

  // Fondo y barra
  doc.setFillColor(241, 245, 249);
  doc.rect(MARGIN, y, CONTENT_W, blockH, 'F');
  doc.setFillColor(180, 152, 90);
  doc.rect(MARGIN, y, 2.5, blockH, 'F');

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(18, 38, 71);
  doc.text('DATOS DEL EXPEDIENTE', MARGIN + PAD, y + 5);
  let cellY = y + 9;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 2; col++) {
      const idx = row * 2 + col;
      if (idx >= celdas.length) break;
      const { label, val } = celdas[idx];
      const cellX = MARGIN + PAD + col * (colW + CELL_GAP);

      // Fondo celda blanco
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cellX, cellY, colW, CELL_H - 1, 1, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(107, 114, 142);
      doc.text(label.toUpperCase(), cellX + 2.5, cellY + 3);

      // Valor (truncar si es muy largo)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      const maxW = colW - 5;
      const valStr = String(val);
      const truncated = doc.splitTextToSize(valStr, maxW)[0]; // solo primera línea
      doc.text(truncated, cellX + 2.5, cellY + 7);
    }
    cellY += CELL_H;
  }
  y += blockH + 6;
})();
function checkPage(needed) {
if (y + needed > 270) {
doc.addPage();
y = 14;
}
}
function seccion(titulo, color) {
checkPage(15);
doc.setFillColor(...(color||[71,85,105]));
doc.rect(MARGIN, y, CONTENT_W, 7, 'F');
doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont('helvetica','bold');
doc.text(titulo, MARGIN+2, y+5);
y += 10;
}
if (pensiones.length > 0) {
seccion('PENSIONES MENSUALES IMPAGAS', [37,99,155]);
const pensCap = pensiones.reduce((s,d) => s + d.cap, 0);
const pensInt = pensiones.reduce((s,d) => s + d.inte, 0);
const pensSub = pensCap + pensInt;
const pensCapUTM = pensiones.reduce((s,d) => s + (d.capUTM||d.cap/d.utmVal), 0);
doc.autoTable({
startY: y,
head: [['Periodo','Capital ($)','UTM','Días','Tasa Mensual','Interes ($)','Interés UTM','Subtotal ($)']],
body: pensiones.map(d => { const capMostrado=d.esLav?0:d.cap; const cap0=d.cap; const int0=d.inte; const intUtm=(int0/d.utmVal).toFixed(5); let periodoLabel = d.hayParcialConRemanente ? d.periodo+'*' : d.periodo; if ((d.excedenteParcialAplicado||0) > 0) periodoLabel += '†'; if (d.esLav) periodoLabel += ' ✓'; return [periodoLabel, fmt(capMostrado), d.esLav?'0.000':(d.capUTM||cap0/d.utmVal).toFixed(3), d.mora, ((d.tasa*10).toFixed(3)+(d.tasaEsAproximada?'~':''))+'%', fmt(int0), intUtm, fmt(capMostrado+int0)]; }),
foot: [['TOTAL', fmt(pensCap), pensCapUTM.toFixed(3)+' UTM', '', '', fmt(pensInt), (pensiones.reduce((s,d)=>{const i=d.inte; return s+i/d.utmVal;},0)).toFixed(5)+' UTM', fmt(pensSub)]],
showFoot: 'lastPage',
theme:'grid',
headStyles:{fillColor:[37,99,155],textColor:[255,255,255],fontSize:6,fontStyle:'bold',halign:'center'},
footStyles:{fillColor:[37,99,155],textColor:[255,255,255],fontSize:6,fontStyle:'bold',halign:'right'},
styles:{fontSize:6,cellPadding:1.5,textColor:[15,23,42]},
columnStyles:{0:{cellWidth:20},1:{halign:'right'},2:{halign:'right',cellWidth:14},3:{halign:'center',cellWidth:11},4:{halign:'center',cellWidth:13},5:{halign:'right'},6:{halign:'right',cellWidth:16},7:{halign:'right'}},
margin:{left:MARGIN,right:MARGIN}, tableWidth:CONTENT_W
});
y = doc.lastAutoTable.finalY + 4;
// Nota al pie si hay meses con pago parcial (interés calculado sobre remanente)
if (pensiones.some(d => d.hayParcialConRemanente)) {
  doc.setFontSize(6); doc.setTextColor(80,80,80);
  doc.text('* Interés calculado sobre el saldo remanente (cuota − pago parcial), conforme metodología SITFA/PJUD (RIT Z-617-2024).', MARGIN, y);
  y += 5;
}
// Nota al pie si hay meses con excedente arrastrado al mes siguiente
if (pensiones.some(d => d.excedenteParcialAplicado > 0)) {
  doc.setFontSize(6); doc.setTextColor(21,128,61);
  doc.text('† Excedente de pago parcial descontado del capital total adeudado.', MARGIN, y);
  y += 5;
}
y += 4;
}
if (historicas.length > 0) {
seccion('DEUDA HISTORICA CONSOLIDADA', [245,158,11]);
const histCap = historicas.reduce((s,d) => s + (d.capOriginal??d.capOriginalBruto??d.cap), 0);
const histInt = historicas.reduce((s,d) => s + d.inte, 0);
const histSub = histCap + histInt;
const histCapUTM = historicas.reduce((s,d) => s + (d.capUTM||(d.capOriginal??d.capOriginalBruto??d.cap)/d.utmVal), 0);
doc.autoTable({
startY: y,
head: [['Periodo','Capital ($)','UTM','Días','Tasa Mensual','Interes ($)','Subtotal ($)']],
body: historicas.map(d => { const cap0=d.capOriginal??d.capOriginalBruto??d.cap; const int0=d.inte; return [d.periodo, fmt(cap0), (d.capUTM||cap0/d.utmVal).toFixed(3), d.mora, d.isConsolidada ? 'Monto al corte' : (((d.tasa*10).toFixed(3)+(d.tasaEsAproximada?'~':''))+'%'), fmt(int0), fmt(cap0+int0)]; }),
foot: [['TOTAL', fmt(histCap), histCapUTM.toFixed(3)+' UTM', '', '', fmt(histInt), fmt(histSub)]],
showFoot: 'lastPage',
theme:'grid',
headStyles:{fillColor:[245,158,11],textColor:[255,255,255],fontSize:6.5,fontStyle:'bold',halign:'center'},
footStyles:{fillColor:[245,158,11],textColor:[255,255,255],fontSize:6.5,fontStyle:'bold',halign:'right'},
styles:{fontSize:6.5,cellPadding:1.5,textColor:[15,23,42]},
columnStyles:{0:{cellWidth:22},1:{halign:'right'},2:{halign:'right'},3:{halign:'center',cellWidth:12},4:{halign:'center',cellWidth:14},5:{halign:'right'},6:{halign:'right'}},
margin:{left:MARGIN,right:MARGIN}, tableWidth:CONTENT_W
});
y = doc.lastAutoTable.finalY + 8;
}
// Reutilizar imputación ya calculada en calculate() — NO recalcular sobre datos mutados
const imputacionPDF = lastImputacion;
// Restar LAV en UTM históricas × UTM actual (igual que en calculate() — Opción A).
// NO usar suma de pesos nominales LAV: las UTM históricas valen más que a UTM de hoy.
const lavTotalUTMpdf = (typeof abonosLav !== 'undefined' ? abonosLav : []).reduce((s,p) => s + (p.amountUtm||0), 0);
const totalFinalReal = Math.max(0, imputacionPDF.saldoFinal - (lavTotalUTMpdf * utmHoy));
const totalFinalRealUTM = totalFinalReal / utmHoy;
const intImputadoPDF = imputacionPDF.interesesPagados;
const capImputadoPDF  = imputacionPDF.capitalPagado;
if (abonos.length > 0) {
seccion('ABONOS REALIZADOS', [51,65,135]);
const abonoTotal = abonos.reduce((s,a) => s + a.amount, 0);
const abonoTotalUTM = abonoTotal / utmHoy;
doc.autoTable({
startY: y,
head: [['N°','Fecha','Monto ($)','Equiv. UTM']],
body: abonos.map((a,i) => [i+1, a.date, fmt(a.amount), (a.amount/utmHoy).toFixed(2)+' UTM']),
foot: [['', 'TOTAL', fmt(abonoTotal), abonoTotalUTM.toFixed(4)+' UTM']],
theme:'grid',
headStyles:{fillColor:[51,65,135],textColor:[255,255,255],fontSize:7,fontStyle:'bold'},
footStyles:{fillColor:[51,65,135],textColor:[255,255,255],fontSize:7,fontStyle:'bold',halign:'right'},
styles:{fontSize:7,cellPadding:2,textColor:[15,23,42]},
margin:{left:MARGIN,right:MARGIN}, tableWidth:CONTENT_W
});
y = doc.lastAutoTable.finalY + 8;
// Nota legal: imputación cronológica correcta (Art. 1595 CC)
checkPage(22);
doc.setFillColor(235, 242, 252);
doc.rect(MARGIN, y, CONTENT_W, 14, 'F');
doc.setDrawColor(37, 99, 155);
doc.setLineWidth(0.5);
doc.rect(MARGIN, y, CONTENT_W, 14, 'S');
// Línea izquierda decorativa
doc.setFillColor(37, 99, 155);
doc.rect(MARGIN, y, 2.5, 14, 'F');
doc.setTextColor(18, 38, 71);
doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
doc.text('✓ Imputación cronológica aplicada — Art. 1595 Código Civil', MARGIN + 5, y + 5);
doc.setFont('helvetica', 'normal');
doc.setTextColor(37, 70, 120);
doc.setFontSize(6);
doc.text(`Intereses pagados: ${fmt(intImputadoPDF)}   |   Capital pagado: ${fmt(capImputadoPDF)}`, MARGIN + 5, y + 9.5);
doc.text('Cada abono se imputó primero a intereses devengados a su fecha, luego a capital, en orden cronológico.', MARGIN + 5, y + 13);
y += 20;
// ── Tabla de desglose por abono (Intereses cubiertos vs Capital rebajado) ──
if (imputacionPDF.detalleImputacion && imputacionPDF.detalleImputacion.length > 0) {
  checkPage(40);
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.setTextColor(18, 38, 71);
  doc.text('DESGLOSE DE IMPUTACIÓN POR ABONO (Art. 1595 CC)', MARGIN, y);
  y += 4;
  const desgloseRows = imputacionPDF.detalleImputacion.map((imp, i) => {
    const intCubierto = imp.porCuota.filter(p => p.tipo === 'interés').reduce((s, p) => s + p.monto, 0);
    const capRebajado = imp.porCuota.filter(p => p.tipo === 'capital' || p.tipo === 'capital anticipado').reduce((s, p) => s + p.monto, 0);
    const remanenteSinAplicar = imp.monto - intCubierto - capRebajado;
    return [
      i + 1,
      imp.fecha,
      fmt(imp.monto),
      fmt(Math.round(intCubierto)),
      fmt(Math.round(capRebajado)),
      remanenteSinAplicar > 1 ? fmt(Math.round(remanenteSinAplicar)) : '—'
    ];
  });
  doc.autoTable({
    startY: y,
    head: [['N°', 'Fecha Abono', 'Monto Total', 'Intereses Cubiertos', 'Capital Rebajado', 'Sin Aplicar']],
    body: desgloseRows,
    theme: 'grid',
    headStyles: { fillColor: [18, 52, 110], textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 6.5, cellPadding: 2, textColor: [15, 23, 42], halign: 'right' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { cellWidth: 30 },
      3: { cellWidth: 36 },
      4: { cellWidth: 34 },
      5: { cellWidth: 30 }
    },
    margin: { left: MARGIN, right: MARGIN }, tableWidth: CONTENT_W
  });
  y = doc.lastAutoTable.finalY + 6;
}
}
if (pagosParciales.length > 0) {
seccion('PAGOS PARCIALES POR MES (descontados del capital)', [124,58,237]);
const parcialTotal = totalParcialesTabla;
const { cuotaMensualUTM } = getMonthlyValues ? getMonthlyValues() : { cuotaMensualUTM: 0 };
doc.autoTable({
startY: y,
head: [['N°','Período','Monto ($)','UTM Período','Equiv. Pago UTM','Remanente UTM']],
body: pagosParciales.map((p,i) => {
  const utmP = p.utmVal || utmHoy;
  const amtUtm = p.amountUtm !== null && p.amountUtm !== undefined ? p.amountUtm : (p.amount / utmP);
  const rem = cuotaMensualUTM > 0 ? Math.max(0, cuotaMensualUTM - amtUtm) : null;
  return [i+1, p.periodoLabel, fmt(p.amount), p.utmVal ? `$${p.utmVal.toLocaleString('es-CL')}` : '—', amtUtm.toFixed(4)+' UTM', rem !== null ? rem.toFixed(4)+' UTM' : '—'];
}),
foot: [['', 'TOTAL', fmt(parcialTotal), '', (pagosParciales.reduce((s,p) => { const utmP=p.utmVal||utmHoy; return s+(p.amountUtm!==null&&p.amountUtm!==undefined?p.amountUtm:(p.amount/utmP)); },0)).toFixed(4)+' UTM', '']],
theme:'grid',
headStyles:{fillColor:[124,58,237],textColor:[255,255,255],fontSize:7,fontStyle:'bold'},
footStyles:{fillColor:[124,58,237],textColor:[255,255,255],fontSize:7,fontStyle:'bold',halign:'right'},
styles:{fontSize:7,cellPadding:2,textColor:[15,23,42]},
columnStyles:{0:{halign:'center',cellWidth:8},1:{halign:'center',cellWidth:18},2:{halign:'right',cellWidth:24},3:{halign:'center',cellWidth:22},4:{halign:'center',cellWidth:24},5:{halign:'center',cellWidth:24}},
margin:{left:MARGIN,right:MARGIN}, tableWidth:CONTENT_W
});
y = doc.lastAutoTable.finalY + 8;
}
// ── Tabla Abonos LAV en PDF ──
if (typeof abonosLav !== 'undefined' && abonosLav.length > 0) {
checkPage(40);
seccion('ABONOS LAV (descontados del capital total)', [5,150,105]);
const lavTotal = abonosLav.reduce((s,p) => s + p.amount, 0);
const lavTotalUTM = abonosLav.reduce((s,p) => s + (p.amountUtm||0), 0);
doc.autoTable({
  startY: y,
  head: [['N°','Fecha depósito','Monto ($)','UTM mes','Equiv. UTM']],
  body: abonosLav.map((p,i) => {
    const utmP = p.utmVal || utmHoy;
    const amtUtm = p.amountUtm !== null && p.amountUtm !== undefined ? p.amountUtm : (p.amount / utmP);
    return [i+1, p.date, fmt(p.amount), p.utmVal ? `$${p.utmVal.toLocaleString('es-CL')}` : '—', amtUtm.toFixed(5)+' UTM'];
  }),
  foot: [['','TOTAL', fmt(lavTotal), '', lavTotalUTM.toFixed(5)+' UTM']],
  theme:'grid',
  headStyles:{fillColor:[5,150,105],textColor:[255,255,255],fontSize:7,fontStyle:'bold'},
  footStyles:{fillColor:[5,150,105],textColor:[255,255,255],fontSize:7,fontStyle:'bold',halign:'right'},
  styles:{fontSize:7,cellPadding:2,textColor:[15,23,42]},
  columnStyles:{0:{halign:'center',cellWidth:8},1:{halign:'center',cellWidth:24},2:{halign:'right',cellWidth:28},3:{halign:'center',cellWidth:22},4:{halign:'center',cellWidth:28}},
  margin:{left:MARGIN,right:MARGIN}, tableWidth:CONTENT_W
});
y = doc.lastAutoTable.finalY + 8;
}
checkPage(50);
doc.setFillColor(18, 38, 71);
doc.rect(MARGIN, y, CONTENT_W, 8, 'F');
doc.setFillColor(180,152,90);
doc.rect(MARGIN, y+7.2, CONTENT_W, 0.8, 'F');
doc.setTextColor(255, 255, 255);
doc.setFontSize(9); doc.setFont('helvetica', 'bold');
doc.text('RESUMEN FINAL DE LIQUIDACION', MARGIN + 3, y + 5.5);
y += 11;
const filasDesglose = [];
filasDesglose.push([
'Capital total (pensiones impagas)',
fmt(totalCapPesos),
totalCapUTM.toFixed(4) + ' UTM',
''
]);
filasDesglose.push([
'Total intereses generados',
fmt(totalIntPesos),
(totalIntPesos / utmHoy).toFixed(4) + ' UTM',
''
]);
const subtotalBruto = totalCapPesos + totalIntPesos;
filasDesglose.push([
'SUBTOTAL BRUTO (capital + intereses)',
fmt(subtotalBruto),
(subtotalBruto / utmHoy).toFixed(4) + ' UTM',
''
]);
if (totalAbonosCLP > 0) {
filasDesglose.push([
'(-) Abonos imputados a intereses (Art. 1595 CC)',
'-' + fmt(intImputadoPDF),
'-' + (intImputadoPDF / utmHoy).toFixed(4) + ' UTM',
''
]);
filasDesglose.push([
'(-) Abonos imputados a capital (Art. 1595 CC)',
'-' + fmt(capImputadoPDF),
'-' + (capImputadoPDF / utmHoy).toFixed(4) + ' UTM',
''
]);
}
if (lavTotalUTMpdf > 0) {
filasDesglose.push([
'(-) Abonos LAV (depósitos cuenta vista)',
'-' + fmt(Math.round(lavTotalUTMpdf * utmHoy)),
'-' + lavTotalUTMpdf.toFixed(4) + ' UTM',
''
]);
}
// Fila de TOTAL FINAL
filasDesglose.push([
'TOTAL ADEUDADO (saldo neto a la fecha)',
fmt(Math.round(totalFinalReal)),
totalFinalRealUTM.toFixed(4) + ' UTM',
''
]);
const idxSubtotal = 2;
const idxLast = filasDesglose.length - 1;
const filasDesgloseClean = filasDesglose.map(f => [f[0], f[1], f[2]]);
doc.autoTable({
startY: y,
head: [['Concepto', 'Monto ($)', 'Equiv. UTM']],
body: filasDesgloseClean,
theme: 'grid',
headStyles: { fillColor: [18, 38, 71], textColor: [255, 255, 255], fontSize: 7, fontStyle: 'bold', halign: 'center' },
styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [15, 23, 42] },
columnStyles: {
0: { fontStyle: 'bold', cellWidth: 110 },
1: { halign: 'right', cellWidth: 36 },
2: { halign: 'right', cellWidth: 36 }
},
willDrawCell: (data) => {
if (data.section !== 'body') return;
if (data.row.index === idxSubtotal) {
doc.setFillColor(241, 245, 249);
doc.setFont('helvetica', 'bold');
}
if (data.row.index === idxLast - 1 && totalAbonosCLP > 0) {
doc.setFillColor(239, 246, 255);
}
if (data.row.index === idxLast) {
doc.setFillColor(18, 38, 71);
doc.setTextColor(255, 255, 255);
doc.setFont('helvetica', 'bold');
}
},
margin: { left: MARGIN, right: MARGIN }, tableWidth: CONTENT_W
});
y = doc.lastAutoTable.finalY + 10;
doc.setTextColor(100, 116, 139);
doc.setFontSize(7); doc.setFont('helvetica', 'bold');
doc.text('TOTAL A PAGAR — LIQUIDACION FINAL', PAGE_W / 2, y + 6, { align: 'center' });
doc.setTextColor(18, 38, 71);
doc.setFontSize(26); doc.setFont('helvetica', 'bold');
doc.text(fmt(totalFinalReal), PAGE_W / 2, y + 18, { align: 'center' });
doc.setTextColor(37, 99, 155);
doc.setFontSize(9.5); doc.setFont('helvetica', 'bold');
doc.text(totalFinalRealUTM.toFixed(4) + ' UTM (1 UTM = ' + fmt(utmHoy) + ')', PAGE_W / 2, y + 26, { align: 'center' });
doc.setTextColor(100, 116, 139);
doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
const notaUTM = 'UTM de referencia: ' + (utmHoyMes?.m || '') + ' ' + (utmHoyMes?.y || '') + ' = ' + fmt(utmHoy) + ' | Fecha liquidacion: ' + fechaDoc;
doc.text(notaUTM, PAGE_W / 2, y + 32, { align: 'center' });
y += 38;
checkPage(40);
// Nota de validación de saldo
if (totalAbonosCLP > 0) {
  checkPage(14);
  doc.setFillColor(240, 253, 244);
  doc.rect(MARGIN, y, CONTENT_W, 12, 'F');
  doc.setDrawColor(21, 128, 61);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, y, CONTENT_W, 12, 'S');
  doc.setFillColor(21, 128, 61);
  doc.rect(MARGIN, y, 2.5, 12, 'F');
  doc.setTextColor(20, 83, 45);
  doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
  doc.text('✓ Verificación de saldo:', MARGIN + 5, y + 4.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('(Σ Capitales originales − Abonos al capital) + Σ Intereses no cubiertos = ' + fmt(Math.round(totalFinalReal)), MARGIN + 5, y + 9);
  y += 16;
}
// Disclaimer detallado
const disclaimerParrafos = [
  'AVISO LEGAL Y LIMITACION DE RESPONSABILIDAD',
  'El presente documento ha sido generado mediante una herramienta de calculo referencial de caracter informativo y no constituye una liquidacion judicial definitiva ni un informe pericial. Los valores aqui expresados son estimativos y han sido calculados en base a informacion de dominio publico (UTM publicadas por el SII y tasas de interes publicadas por la CMF), sin perjuicio de los errores, omisiones o desactualizaciones que dicha informacion pudiera contener.',
  'Este documento no reemplaza el criterio ni la intervencion de un abogado, perito judicial, contador u otro profesional habilitado. El usuario es el unico responsable del uso que haga de esta informacion y de las decisiones que adopte en base a ella. Ni el desarrollador de esta herramienta ni ninguna parte vinculada a su creacion asumen responsabilidad alguna por inexactitudes en los calculos, diferencias con liquidaciones judiciales oficiales, uso indebido del documento, ni por cualquier perjuicio directo o indirecto que pudiera derivarse de su utilizacion.',
  'Para efectos legales, judiciales o administrativos, este documento debe ser validado y suscrito por un profesional competente.'
];
doc.setFontSize(6.5);
let disclaimerH = 8; // título
disclaimerParrafos.slice(1).forEach(p => {
  const lines = doc.splitTextToSize(p, CONTENT_W - 6);
  disclaimerH += lines.length * 4 + 3;
});
doc.setFillColor(241, 245, 249);
doc.rect(MARGIN, y, CONTENT_W, disclaimerH + 4, 'F');
doc.setFillColor(18, 38, 71);
doc.rect(MARGIN, y, 2.5, disclaimerH + 4, 'F');
doc.setTextColor(18, 38, 71);
doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
doc.text(disclaimerParrafos[0], MARGIN + 5, y + 5);
let dy = y + 10;
doc.setFont('helvetica', 'normal');
doc.setTextColor(71, 85, 105);
disclaimerParrafos.slice(1).forEach(p => {
  const lines = doc.splitTextToSize(p, CONTENT_W - 6);
  doc.text(lines, MARGIN + 5, dy);
  dy += lines.length * 4 + 3;
});
y += 8;
const totalPags = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPags; i++) {
doc.setPage(i);
doc.setFontSize(6); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
doc.text('Pag. ' + i + ' / ' + totalPags, PAGE_W - MARGIN, 290, { align: 'right' });
doc.text('Pension UTM Pro – Calculo referencial', MARGIN, 290);
}
const pdfBase64 = doc.output('datauristring');
const pdfLink = document.createElement('a');
pdfLink.href = pdfBase64;
pdfLink.download = 'Liquidacion_' + fechaDoc.replace(/\//g, '-') + '.pdf';
document.body.appendChild(pdfLink); pdfLink.click();
document.body.removeChild(pdfLink);
} catch(e) { console.error("[generarPDF] Error:", e); alert("Error al generar PDF: " + e.message); }
}
// ============================================================
// SISTEMA DE CASOS MÚLTIPLES
// ============================================================
const CASOS_INDEX_KEY = 'pension_utm_casos_index_v1';
const CASO_DATA_PREFIX = 'pension_utm_caso_v1_';
let activeCasoId = null;
let renamingCasoId = null;
let deletingCasoId = null;
function getCasosIndex() {
try { return JSON.parse(localStorage.getItem(CASOS_INDEX_KEY)) || []; }
catch(e) { return []; }
}
function saveCasosIndex(idx) {
dbg('IDX WRITE: ' + idx.length + ' casos → ' + idx.map(c=>c.nombre||c.id.slice(0,6)).join(', '));
localStorage.setItem(CASOS_INDEX_KEY, JSON.stringify(idx));
}
function getCasoKey(id) { return CASO_DATA_PREFIX + id; }
function getInitials(name) {
if (!name || !name.trim()) return '?';
return name.trim().split(/\s+/).slice(0,2).map(w => w[0] ? w[0].toUpperCase() : '').join('') || '?';
}
function isDesktop() {
  return window.innerWidth >= 1024;
}
function openSidebar() {
  if (isDesktop()) return; // En desktop el sidebar siempre está visible
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
  try { renderCasosList(); } catch(e) { console.error('[openSidebar] renderCasosList error:', e); }
}
function closeSidebar() {
  if (isDesktop()) return; // En desktop no se cierra
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}
function renderCasosList() {
const casos = getCasosIndex();
dbg('RENDER: ' + casos.length + ' casos → ' + casos.map(c=>c.nombre||c.id.slice(0,6)).join(', '));
const container = document.getElementById('casosList');
container.innerHTML = '';
if (casos.length === 0) {
container.innerHTML = `<p class="text-[10px] text-slate-600 font-bold text-center mt-6 px-4">No hay casos guardados.<br>Crea uno con el botón de arriba.</p>`;
return;
}
casos.forEach(c => {
const isActive = c.id === activeCasoId;
const div = document.createElement('div');
div.className = `caso-item ${isActive ? 'active' : ''}`;
// Avatar
const avatar = document.createElement('div');
avatar.className = 'caso-avatar';
avatar.textContent = getInitials(c.nombre);
// Info
const info = document.createElement('div');
info.className = 'flex-1 min-w-0 ml-2';
const pNombre = document.createElement('p');
pNombre.className = 'text-[11px] font-black text-white truncate';
pNombre.textContent = c.nombre;
const pFecha = document.createElement('p');
pFecha.className = 'text-[9px] text-slate-500 font-bold truncate';
pFecha.textContent = c.saved_at ? new Date(c.saved_at).toLocaleDateString('es-CL') : 'Sin guardar';
info.appendChild(pNombre);
info.appendChild(pFecha);
// Botón ficha (único icono visible)
const btnFicha = document.createElement('button');
btnFicha.className = 'p-1.5 rounded-lg text-slate-500 hover:text-[#3b82f6] hover:bg-white/6 transition-colors ml-1';
btnFicha.title = 'Ver ficha del expediente';
btnFicha.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
btnFicha.addEventListener('click', e => { e.stopPropagation(); openFichaModal(c.id); });
// Botón eliminar caso
const btnEliminar = document.createElement('button');
btnEliminar.className = 'p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors ml-1';
btnEliminar.title = 'Eliminar caso';
btnEliminar.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
btnEliminar.addEventListener('click', e => { e.stopPropagation(); confirmarEliminarCaso(c.id, c.nombre); });
div.appendChild(avatar);
div.appendChild(info);
div.appendChild(btnFicha);
div.appendChild(btnEliminar);
div.addEventListener('click', () => switchCaso(c.id));
container.appendChild(div);
});
}
function switchCaso(id) {
if (activeCasoId) saveCurrentCasoNow();
activeCasoId = id;
localStorage.setItem('pension_utm_last_caso', id);
// Limpiar siempre antes de cargar el nuevo caso
// Evita que datos del caso anterior (arrays, períodos, abonos) persistan en pantalla
resetAllSilent();
const raw = localStorage.getItem(getCasoKey(id));
dbg('SWITCH: id='+id.slice(0,12)+' localLen='+(raw?raw.length:0));
if (raw) {
try {
const s = JSON.parse(raw);
dbg('SWITCH: applySession saved_at='+(s.saved_at||'?').slice(0,19));
applySession(s);
} catch(e) { dbg('SWITCH PARSE ERROR: '+e.message); }
} else {
dbg('SWITCH: SIN DATOS localStorage — caso nuevo o sin datos locales');
}
updateActiveCasoBadge();
renderCasosList();
closeSidebar();
}
function updateActiveCasoBadge() {
  const span = document.getElementById('activeCasoNombreHeader');
  const centerSpan = document.getElementById('headerCasoNombre');
  // Mostrar correo del usuario en el badge izquierdo
  if (span) {
    const email = (sbCurrentUser && sbCurrentUser.email) ? sbCurrentUser.email : 'Sin sesión';
    span.innerText = email;
  }
  // Mostrar nombre del caso en el centro del header
  if (centerSpan) {
    if (!activeCasoId) { centerSpan.innerText = ''; return; }
    const casos = getCasosIndex();
    const caso = casos.find(c => c.id === activeCasoId);
    centerSpan.innerText = caso ? caso.nombre : '';
  }
}
// Guardar sincrónicamente el caso activo (sin debounce)
function saveCurrentCasoNow() {
if (!activeCasoId) return;
const session = buildSession();
const now = new Date().toISOString();
session.saved_at = now;
localStorage.setItem(getCasoKey(activeCasoId), JSON.stringify(session));
// Actualizar saved_at en el índice
const idx = getCasosIndex();
const c = idx.find(x => x.id === activeCasoId);
if (c) { c.saved_at = now; c.updated_at_local = Date.now(); saveCasosIndex(idx); }
}
function buildSession() {
return {
calculationMode: document.getElementById('calculationMode').value,
utmAmount: document.getElementById('utmAmount').value,
clpAmount: document.getElementById('clpAmount').value,
salaryAmount: document.getElementById('salaryAmount').value,
salaryPercent: document.getElementById('salaryPercent').value,
minimumPercent: '',
useIMM: document.getElementById('toggleIMM')?.checked || false,
recargoLey: document.getElementById('recargoLey').checked,
tasaMaxima: false,
ticActual: document.getElementById('ticActual')?.checked || false,
diaVencimiento: document.getElementById('diaVencimiento')?.value || '5',
fechaLiquidacion: document.getElementById('fechaLiquidacion')?.value || '',
startPeriod: startIndex >= 0 ? { y: utmData[startIndex].y, m: utmData[startIndex].monthIdx } : null,
endPeriod: endIndex >= 0 ? { y: utmData[endIndex].y, m: utmData[endIndex].monthIdx } : null,
historicalDebts, abonos, pagosParciales, periodosPension, abonosLav,
histMode, consolidadaData,
_hasData: (startIndex >= 0) || (endIndex >= 0) ||
          (periodosPension && periodosPension.length > 0) ||
          (historicalDebts && historicalDebts.length > 0) ||
          (abonos && abonos.length > 0) ||
          !!(document.getElementById('utmAmount')?.value) ||
          !!(document.getElementById('clpAmount')?.value)
// BUG 5 FIX: saved_at y updated_at los estampa el llamador (saveSession / saveCurrentCasoNow)
// para garantizar que objeto e índice tengan el mismo timestamp exacto.
};
}

// Recalcula calcStartIndex/calcEndIndex como la unión de todos los rangos en periodosPension.
// Se llama tras restaurar sesión o eliminar un período.
function recalcCalcRange() {
  if (periodosPension.length === 0) {
    // Sin períodos registrados: usar el rango actual del formulario si existe
    calcStartIndex = startIndex !== -1 ? Math.min(startIndex, endIndex) : -1;
    calcEndIndex   = endIndex   !== -1 ? Math.max(startIndex, endIndex) : -1;
    return;
  }
  let minAbs = Infinity, maxAbs = -Infinity;
  periodosPension.forEach(p => {
    const dAbs = p.desde.anio * 12 + (p.desde.mes - 1);
    const hAbs = p.hasta ? (p.hasta.anio * 12 + (p.hasta.mes - 1)) : dAbs;
    if (dAbs < minAbs) minAbs = dAbs;
    if (hAbs > maxAbs) maxAbs = hAbs;
  });
  // También incluir el rango actual del formulario si está activo
  if (startIndex !== -1 && endIndex !== -1) {
    const fStart = Math.min(startIndex, endIndex);
    const fEnd   = Math.max(startIndex, endIndex);
    const fStartAbs = utmData[fStart].y * 12 + utmData[fStart].monthIdx;
    const fEndAbs   = utmData[fEnd].y   * 12 + utmData[fEnd].monthIdx;
    if (fStartAbs < minAbs) minAbs = fStartAbs;
    if (fEndAbs   > maxAbs) maxAbs = fEndAbs;
  }
  calcStartIndex = utmData.findIndex(d => d.y * 12 + d.monthIdx === minAbs);
  calcEndIndex   = utmData.findIndex(d => d.y * 12 + d.monthIdx === maxAbs);
  // Si no se encontró exacto, buscar el más cercano
  if (calcStartIndex === -1) calcStartIndex = 0;
  if (calcEndIndex   === -1) calcEndIndex   = utmData.length - 1;
}
function applySession(s) {
// ── Guard Supabase: bloquea queueSave durante toda la restauración ──
// saveSession() se dispara varias veces dentro de applySession (por handleCalculationModeChange,
// renderHistoricalList, etc.). Sin este flag, el debounce de 2s puede capturar el DOM
// a medio restaurar y subir un snapshot incompleto/vacío a Supabase.
_isRestoringSession = true;
// ── FIX v74: Limpiar totales y datos de cálculo ANTES de restaurar sesión.
// Evita que los totales del caso anterior persistan cuando handleCalculationModeChange()
// llama a calculate() al final de esta función — sin este reset, calculate() usaba
// lastCalculationData del caso previo y repintaba sus totales en el caso nuevo.
lastCalculationData = [];
lastImputacion = null;
document.getElementById('totalGrand').innerText = '0';
document.getElementById('totalGrandUtm').innerText = '0.00 UTM';
document.getElementById('totalCap').innerText = '$0';
document.getElementById('totalCapUtm').innerText = '0.00 UTM';
document.getElementById('totalInt').innerText = '$0';
document.getElementById('totalIntUtm').innerText = '0.00 UTM';
document.getElementById('yearTabsCard').classList.add('hidden');
document.getElementById('detailsList').classList.add('hidden');
document.getElementById('detailsList').innerHTML = '';
document.getElementById('abonoResultRow').classList.add('hidden');
// ── fin FIX v74 ──
document.getElementById('calculationMode').value = s.calculationMode || 'utm';
document.getElementById('utmAmount').value = s.utmAmount || '';
document.getElementById('clpAmount').value = s.clpAmount || '';
document.getElementById('salaryAmount').value = s.salaryAmount || '';
document.getElementById('salaryPercent').value = s.salaryPercent || '';
if (document.getElementById('toggleIMM')) {
document.getElementById('toggleIMM').checked = s.useIMM || false;
const si = document.getElementById('salaryAmount');
si.disabled = s.useIMM || false;
si.classList.toggle('opacity-40', s.useIMM || false);
}
document.getElementById('recargoLey').checked = s.recargoLey || false;
if (document.getElementById('ticActual')) document.getElementById('ticActual').checked = s.ticActual || false;
if (document.getElementById('diaVencimiento')) document.getElementById('diaVencimiento').value = s.diaVencimiento || '5';
if (document.getElementById('fechaLiquidacion')) document.getElementById('fechaLiquidacion').value = s.fechaLiquidacion || '';
// Restaurar indices de periodo: usar startPeriod/endPeriod (anio+mes) si existen,
// con fallback a startIndex/endIndex legacy para sesiones guardadas anteriormente.
if (s.startPeriod) {
  startIndex = utmData.findIndex(d => d.y === s.startPeriod.y && d.monthIdx === s.startPeriod.m);
  if (startIndex === -1) startIndex = s.startIndex ?? -1;
} else {
  startIndex = s.startIndex ?? -1;
}
if (s.endPeriod) {
  endIndex = utmData.findIndex(d => d.y === s.endPeriod.y && d.monthIdx === s.endPeriod.m);
  if (endIndex === -1) endIndex = s.endIndex ?? -1;
} else {
  endIndex = s.endIndex ?? -1;
}
historicalDebts = s.historicalDebts || [];
abonos = s.abonos || [];
pagosParciales = s.pagosParciales || [];
abonosLav = s.abonosLav || [];
if (typeof renderAbonosLav === 'function') renderAbonosLav();
periodosPension = s.periodosPension || [];
// Restaurar modo histórico (recalculable vs consolidada)
if (s.histMode) {
  histMode = s.histMode;
} else {
  histMode = 'recalculable';
}
consolidadaData = s.consolidadaData || null;
// Restaurar UI del modo histórico
if (histMode === 'consolidada' && consolidadaData) {
  setHistMode('consolidada');
  const fmt = v => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  document.getElementById('consolidadaMontoCLP').value = fmt(consolidadaData.montoCLP);
  const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const lbl = document.getElementById('consolidadaFechaLabel');
  if (lbl && consolidadaData.fechaMes && consolidadaData.fechaAnio) {
    lbl.innerText = `${mNames[consolidadaData.fechaMes-1]} ${consolidadaData.fechaAnio}`;
    lbl.className = 'input-date__value text-[#fb923c]';
    document.getElementById('consolidadaFechaMes').value = String(consolidadaData.fechaMes).padStart(2,'0');
    document.getElementById('consolidadaFechaAnio').value = String(consolidadaData.fechaAnio);
  }
  const chkInt = document.getElementById('consolidadaAplicaIntereses');
  if (chkInt) chkInt.checked = consolidadaData.aplicaIntereses !== false;
  const chkMax = document.getElementById('consolidadaUsaMaxima');
  if (chkMax) chkMax.checked = consolidadaData.usaMaxima || false;
} else {
  setHistMode('recalculable');
}
// Restaurar pickers deuda histórica
if (historicalDebts.length > 0) {
const d = historicalDebts[0];
if (d.startMes && d.startAnio) {
const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
document.getElementById('histStartMes').value = String(d.startMes).padStart(2,'0');
document.getElementById('histStartAnio').value = String(d.startAnio);
const lbl = document.getElementById('histStartLabel');
if (lbl) { lbl.innerText = `${mNames[d.startMes-1]} ${d.startAnio}`; lbl.className = 'input-date__value text-[#bfdbfe]'; }
}
} else {
const lblS = document.getElementById('histStartLabel');
if (lblS) { lblS.innerText = 'Mes / Año'; lblS.className = 'input-date__value'; }
const lblE = document.getElementById('histEndLabel');
if (lblE) { lblE.innerText = 'Mes actual'; lblE.className = 'input-date__value'; }
}
// Reset picker labels
const lblA = document.getElementById('tempAbonoLabel');
if (lblA) { lblA.innerText = 'Mes / Año'; lblA.classList.add('text-slate-400'); lblA.classList.remove('text-white'); }
const lblP = document.getElementById('tempParcialLabel');
if (lblP) { lblP.innerText = 'Mes / Año'; lblP.classList.add('text-slate-400'); lblP.classList.remove('text-white'); }
renderHistoricalList();
renderAbonosList();
renderPagosParciales();
renderPeriodosPension();
recalcCalcRange();
handleCalculationModeChange();
updateLabels();
if (s.saved_at) {
updateSaveIndicator(s.saved_at);
document.getElementById('saveIndicator').classList.remove('hidden');
} else {
document.getElementById('saveIndicator').classList.add('hidden');
}
// ── Liberar guard y disparar UN solo save limpio ──
// En este punto el DOM está 100% restaurado y calculate() ya corrió.
// Si Supabase tiene datos (sbCurrentUser existe), guardamos el snapshot
// completo — esto corrige casos que llegaron vacíos desde otro dispositivo.
// FIX RACE CONDITION: solo subir si la restauración fue exitosa.
// Si _hasData=true pero el estado quedó vacío → race condition → NO subir a Supabase.
_isRestoringSession = false;
const _snapshotTeniaDatos = !!(s && s._hasData);
const _estadoActualTieneDatos = (startIndex !== -1) || (endIndex !== -1) ||
  (periodosPension && periodosPension.length > 0) ||
  (historicalDebts && historicalDebts.length > 0) ||
  (abonos && abonos.length > 0);
const _restoreOk = !_snapshotTeniaDatos || _estadoActualTieneDatos;
if (typeof queueSave === 'function' && sbCurrentUser && activeCasoId && !_deletedCasoIds?.has(activeCasoId) && _restoreOk) {
  queueSave(activeCasoId);
} else if (!_restoreOk) {
  dbg('applySession: ⚠️ _hasData=true pero estado vacío — race condition, queueSave bloqueado');
}
}
function resetAllSilent() {
document.querySelectorAll('input').forEach(i => { if (!i.readOnly && i.type !== 'checkbox') i.value = ''; });
document.getElementById('calculationMode').value = 'utm';
startIndex = -1; endIndex = -1; calcStartIndex = -1; calcEndIndex = -1;
abonos = []; pagosParciales = []; abonosLav = []; historicalDebts = []; periodosPension = [];
consolidadaData = null;
lastCalculationData = [];
lastImputacion = null;
histMode = 'recalculable';
setHistMode('recalculable');
renderAbonosList(); renderPagosParciales(); renderHistoricalList(); renderPeriodosPension();
if (typeof renderAbonosLav === 'function') renderAbonosLav();
updateLabels();
const lblA = document.getElementById('tempAbonoLabel');
if (lblA) { lblA.innerText = 'Mes / Año'; lblA.classList.add('text-slate-400'); lblA.classList.remove('text-white'); }
const lblPa = document.getElementById('tempParcialLabel');
if (lblPa) { lblPa.innerText = 'Mes / Año'; lblPa.classList.add('text-slate-400'); lblPa.classList.remove('text-white'); }
// Limpiar deuda histórica completamente
const hSM = document.getElementById('histStartMes'); if (hSM) hSM.value = '';
const hSA = document.getElementById('histStartAnio'); if (hSA) hSA.value = '';
const hEM = document.getElementById('histEndMes'); if (hEM) hEM.value = '';
const hEA = document.getElementById('histEndAnio'); if (hEA) hEA.value = '';
const lblHS = document.getElementById('histStartLabel');
if (lblHS) { lblHS.innerText = 'Mes / Año'; lblHS.className = 'input-date__value'; }
const lblHE = document.getElementById('histEndLabel');
if (lblHE) { lblHE.innerText = 'Mes actual'; lblHE.className = 'input-date__value'; }
if (document.getElementById('historicalDebtUtm')) document.getElementById('historicalDebtUtm').value = '';
// Limpiar campos del modo consolidada
const cMonto = document.getElementById('consolidadaMontoCLP'); if (cMonto) cMonto.value = '';
const cFM = document.getElementById('consolidadaFechaMes'); if (cFM) cFM.value = '';
const cFA = document.getElementById('consolidadaFechaAnio'); if (cFA) cFA.value = '';
const cFL = document.getElementById('consolidadaFechaLabel'); if (cFL) { cFL.innerText = 'Seleccionar'; cFL.className = 'input-date__value'; }
const cPrev = document.getElementById('consolidadaPreview'); if (cPrev) cPrev.classList.add('hidden');
const cAI = document.getElementById('consolidadaAplicaIntereses'); if (cAI) cAI.checked = true;
const cUM = document.getElementById('consolidadaUsaMaxima'); if (cUM) cUM.checked = false;
const dS = document.getElementById('debtSummary'); if (dS) dS.classList.add('hidden');
// reset totals to zero
document.getElementById('totalGrand').innerText = '0';
document.getElementById('totalGrandUtm').innerText = '0.00 UTM';
document.getElementById('totalCap').innerText = '$0';
document.getElementById('totalCapUtm').innerText = '0.00 UTM';
document.getElementById('totalInt').innerText = '$0';
document.getElementById('totalIntUtm').innerText = '0.00 UTM';
document.getElementById('yearTabsCard').classList.add('hidden');
document.getElementById('yearTabs').innerHTML = '';
document.getElementById('detailsList').classList.add('hidden');
document.getElementById('detailsList').innerHTML = '';
const mesesLabelReset = document.getElementById('yearTabsMesesLabel');
if (mesesLabelReset) mesesLabelReset.innerHTML = '0 meses';
activeTabYear = null;
document.getElementById('abonoResultRow').classList.add('hidden');
document.getElementById('recargoLey').checked = false;
if (document.getElementById('ticActual')) document.getElementById('ticActual').checked = false;
document.getElementById('saveIndicator').classList.add('hidden');
// Restaurar día de vencimiento al valor por defecto
const diaVencEl = document.getElementById('diaVencimiento');
if (diaVencEl) diaVencEl.value = '5';
handleCalculationModeChange();
}
// Formatea RUT chileno automáticamente mientras el usuario escribe
function formatRutInput(input) {
  let v = input.value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (v.length > 9) v = v.slice(0, 9);
  if (v.length > 1) {
    const dv = v.slice(-1);
    let body = v.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = body + '-' + dv;
  } else {
    input.value = v;
  }
}
// Nuevo caso
function checkNuevoCasoBtn() {
  const nombre = (document.getElementById('newCasoInput')?.value || '').trim();
  document.getElementById('btnCrearCaso').disabled = nombre.length < 2;
}
function showNewCasoModal() {
  ['newCasoInput','newCasoRol','newCasoTribunal','newCasoAlimentante',
   'newCasoRutAlimentante','newCasoAlimentario','newCasoRutAlimentario'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const est = document.getElementById('newCasoEstado'); if (est) est.value = 'activo';
  document.getElementById('btnCrearCaso').disabled = true;
  document.getElementById('newCasoModal').classList.replace('hidden','flex'); lockBody();
  setTimeout(() => document.getElementById('newCasoInput').focus(), 100);
}
function hideNewCasoModal() { document.getElementById('newCasoModal').classList.replace('flex','hidden'); unlockBody(); }
function crearCaso() {
  const nombre = (document.getElementById('newCasoInput')?.value || '').trim();
  if (nombre.length < 2) return;
  // Guardar caso actual antes de crear el nuevo
  if (activeCasoId) saveCurrentCasoNow();
  const id = crypto.randomUUID ? crypto.randomUUID() : 'caso_' + Date.now() + '_' + Math.random().toString(36).slice(2,9);
  const idx = getCasosIndex();
  idx.push({
    id,
    nombre,
    rolCausa:        (document.getElementById('newCasoRol')?.value || '').trim(),
    tribunal:        (document.getElementById('newCasoTribunal')?.value || '').trim(),
    estado:          document.getElementById('newCasoEstado')?.value || 'activo',
    alimentante:     (document.getElementById('newCasoAlimentante')?.value || '').trim(),
    rutAlimentante:  (document.getElementById('newCasoRutAlimentante')?.value || '').trim(),
    alimentario:     (document.getElementById('newCasoAlimentario')?.value || '').trim(),
    rutAlimentario:  (document.getElementById('newCasoRutAlimentario')?.value || '').trim(),
    montoDecretado:  (document.getElementById('newCasoMonto')?.value || '').trim(),
    diaPago:         (document.getElementById('newCasoDiaPago')?.value || '').trim(),
    fechaInicioPago: (document.getElementById('newCasoFechaInicio')?.value || '').trim(),
    reajustabilidad: (document.getElementById('newCasoReajuste')?.value || '').trim(),
    sync_status: 'pending_create',
    version: 1,
    created_at_local: Date.now(),
    updated_at_local: Date.now(),
    saved_at: null
  });
  saveCasosIndex(idx);
  hideNewCasoModal();
  switchCaso(id);
}
// ============================================================
// MODAL FICHA DE EXPEDIENTE
// ============================================================
let fichaActiveCasoId = null;

function openFichaModal(id) {
  fichaActiveCasoId = id;
  const casos = getCasosIndex();
  const c = casos.find(x => x.id === id);
  if (!c) return;
  // Poblar modo vista
  const estadoLabels = { activo: '🟢 Activo', suspendido: '🟡 Suspendido', archivado: '⚫ Archivado' };
  _fichaSetText('fichaVista-nombre', c.nombre || '—');
  _fichaSetText('fichaSubtitle', c.nombre || '');
  _fichaSetText('fichaVista-rol', c.rolCausa || '');
  _fichaRowVisible('fichaVista-rolRow', !!c.rolCausa);
  _fichaSetText('fichaVista-tribunal', c.tribunal || '');
  _fichaRowVisible('fichaVista-tribunalRow', !!c.tribunal);
  _fichaSetText('fichaVista-estado', estadoLabels[c.estado] || '🟢 Activo');
  _fichaSetText('fichaVista-fecha', c.saved_at ? new Date(c.saved_at).toLocaleDateString('es-CL', {day:'2-digit',month:'long',year:'numeric'}) : 'No guardado aún');
  // Partes
  const hasAlim = !!(c.alimentante);
  const hasAlimario = !!(c.alimentario);
  _fichaRowVisible('fichaVista-alimentanteBlock', hasAlim);
  _fichaRowVisible('fichaVista-alimentarioBlock', hasAlimario);
  if (hasAlim) {
    _fichaSetText('fichaVista-alimentante', c.alimentante);
    _fichaSetText('fichaVista-rutAlimentante', c.rutAlimentante ? 'RUT ' + c.rutAlimentante : '');
  }
  if (hasAlimario) {
    _fichaSetText('fichaVista-alimentario', c.alimentario);
    _fichaSetText('fichaVista-rutAlimentario', c.rutAlimentario ? 'RUT ' + c.rutAlimentario : '');
  }
  // Resolución judicial
  const hasResolucion = !!(c.montoDecretado || c.diaPago || c.fechaInicioPago || c.reajustabilidad);
  _fichaRowVisible('fichaVista-resolucionBlock', hasResolucion);
  _fichaSetText('fichaVista-monto', c.montoDecretado || '');
  _fichaRowVisible('fichaVista-montoRow', !!c.montoDecretado);
  _fichaSetText('fichaVista-diaPago', c.diaPago || '');
  _fichaRowVisible('fichaVista-diaPagoRow', !!c.diaPago);
  _fichaSetText('fichaVista-fechaInicio', c.fechaInicioPago || '');
  _fichaRowVisible('fichaVista-fechaInicioRow', !!c.fechaInicioPago);
  _fichaSetText('fichaVista-reajuste', c.reajustabilidad || '');
  _fichaRowVisible('fichaVista-reajusteRow', !!c.reajustabilidad);
  // Botón activar
  const btnActivar = document.getElementById('fichaBtn-activar');
  if (btnActivar) {
    const esActivo = id === activeCasoId;
    btnActivar.textContent = esActivo ? '✓ Caso activo' : 'Usar este caso';
    btnActivar.disabled = esActivo;
    btnActivar.style.opacity = esActivo ? '0.5' : '1';
  }
  // Mostrar en modo vista
  toggleFichaEdicion(false);
  // Abrir modal
  document.getElementById('fichaModal').classList.replace('hidden', 'flex');
  lockBody();
}

function closeFichaModal() {
  document.getElementById('fichaModal').classList.replace('flex', 'hidden');
  fichaActiveCasoId = null;
  unlockBody();
}

function toggleFichaEdicion(editMode) {
  const show = id => document.getElementById(id)?.classList.remove('hidden');
  const hide = id => document.getElementById(id)?.classList.add('hidden');
  if (editMode) {
    // Poblar campos de edición desde el índice
    const c = getCasosIndex().find(x => x.id === fichaActiveCasoId) || {};
    document.getElementById('fichaEdit-nombre').value    = c.nombre || '';
    document.getElementById('fichaEdit-rol').value       = c.rolCausa || '';
    document.getElementById('fichaEdit-tribunal').value  = c.tribunal || '';
    document.getElementById('fichaEdit-estado').value    = c.estado || 'activo';
    document.getElementById('fichaEdit-alimentante').value      = c.alimentante || '';
    document.getElementById('fichaEdit-rutAlimentante').value   = c.rutAlimentante || '';
    document.getElementById('fichaEdit-alimentario').value      = c.alimentario || '';
    document.getElementById('fichaEdit-rutAlimentario').value   = c.rutAlimentario || '';
    document.getElementById('fichaEdit-monto').value         = c.montoDecretado || '';
    document.getElementById('fichaEdit-diaPago').value       = c.diaPago || '';
    document.getElementById('fichaEdit-fechaInicio').value   = c.fechaInicioPago || '';
    document.getElementById('fichaEdit-reajuste').value      = c.reajustabilidad || '';
    hide('fichaHeader-vista'); show('fichaHeader-edicion');
    hide('fichaBody-vista');   show('fichaBody-edicion');
    hide('fichaFooter-vista'); show('fichaFooter-edicion');
    setTimeout(() => document.getElementById('fichaEdit-nombre')?.focus(), 80);
  } else {
    show('fichaHeader-vista'); hide('fichaHeader-edicion');
    show('fichaBody-vista');   hide('fichaBody-edicion');
    show('fichaFooter-vista'); hide('fichaFooter-edicion');
  }
}

function guardarFichaEdicion() {
  if (!fichaActiveCasoId) return;
  const nombre = (document.getElementById('fichaEdit-nombre')?.value || '').trim();
  if (nombre.length < 2) { document.getElementById('fichaEdit-nombre')?.focus(); return; }
  const idx = getCasosIndex();
  const c = idx.find(x => x.id === fichaActiveCasoId);
  if (!c) return;
  c.nombre          = nombre;
  c.rolCausa        = (document.getElementById('fichaEdit-rol')?.value || '').trim();
  c.tribunal        = (document.getElementById('fichaEdit-tribunal')?.value || '').trim();
  c.estado          = document.getElementById('fichaEdit-estado')?.value || 'activo';
  c.alimentante     = (document.getElementById('fichaEdit-alimentante')?.value || '').trim();
  c.rutAlimentante  = (document.getElementById('fichaEdit-rutAlimentante')?.value || '').trim();
  c.alimentario     = (document.getElementById('fichaEdit-alimentario')?.value || '').trim();
  c.rutAlimentario  = (document.getElementById('fichaEdit-rutAlimentario')?.value || '').trim();
  c.montoDecretado  = (document.getElementById('fichaEdit-monto')?.value || '').trim();
  c.diaPago         = (document.getElementById('fichaEdit-diaPago')?.value || '').trim();
  c.fechaInicioPago = (document.getElementById('fichaEdit-fechaInicio')?.value || '').trim();
  c.reajustabilidad = (document.getElementById('fichaEdit-reajuste')?.value || '').trim();
  saveCasosIndex(idx);
  updateActiveCasoBadge();
  renderCasosList();
  // Reabrir en modo vista con datos actualizados
  openFichaModal(fichaActiveCasoId);
}

function activarCasoDesdeFicha() {
  if (!fichaActiveCasoId) return;
  closeFichaModal();
  switchCaso(fichaActiveCasoId);
}

function confirmarDeleteDesdeFicha() {
  if (!fichaActiveCasoId) return;
  const casos = getCasosIndex();
  const c = casos.find(x => x.id === fichaActiveCasoId);
  closeFichaModal();
  if (c) showDeleteCasoModal(c.id, c.nombre);
}

// Helpers internos
function _fichaSetText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function _fichaRowVisible(id, visible) { const el = document.getElementById(id); if (el) el.style.display = visible ? '' : 'none'; }

// ============================================================
// FIN MODAL FICHA
// ============================================================
function showRenameCasoModal(id) {
renamingCasoId = id;
const casos = getCasosIndex();
const caso = casos.find(c => c.id === id);
document.getElementById('renameCasoInput').value = caso ? caso.nombre : '';
document.getElementById('renameCasoModal').classList.replace('hidden','flex'); lockBody();
setTimeout(() => document.getElementById('renameCasoInput').focus(), 100);
}
function hideRenameCasoModal() { document.getElementById('renameCasoModal').classList.replace('flex','hidden'); unlockBody(); renamingCasoId = null; }
function confirmarRename() {
const nombre = document.getElementById('renameCasoInput').value.trim();
if (!nombre || !renamingCasoId) return;
const idx = getCasosIndex();
const caso = idx.find(c => c.id === renamingCasoId);
if (caso) { caso.nombre = nombre; saveCasosIndex(idx); }
const idRenaming = renamingCasoId;
hideRenameCasoModal();
updateActiveCasoBadge();
renderCasosList();
// Sincronizar nombre en Supabase (a través de la cola)
if (typeof queueSave === 'function' && sbCurrentUser) queueSave(idRenaming);
}
// Eliminar
function showDeleteCasoModal(id, nombre) {
deletingCasoId = id;
document.getElementById('deleteCasoNombre').innerText = '"' + nombre + '"';
document.getElementById('deleteCasoModal').classList.replace('hidden','flex'); lockBody();
}
function hideDeleteCasoModal() { document.getElementById('deleteCasoModal').classList.replace('flex','hidden'); unlockBody(); deletingCasoId = null; }
function confirmarDelete() {
if (!deletingCasoId) return;
const idToDelete = deletingCasoId;
// Calcular índice residual ANTES de que sbDeleteCaso lo modifique
const idxResidual = getCasosIndex().filter(c => c.id !== idToDelete);
// Delegar limpieza local + cola Supabase a sbDeleteCaso
if (typeof sbDeleteCaso === 'function') sbDeleteCaso(idToDelete);
// Cambiar de caso activo si era el que se eliminó
if (activeCasoId === idToDelete) {
activeCasoId = null;
localStorage.removeItem('pension_utm_last_caso');
if (idxResidual.length > 0) switchCaso(idxResidual[idxResidual.length - 1].id);
else { resetAllSilent(); updateActiveCasoBadge(); }
}
hideDeleteCasoModal();
renderCasosList();
updateActiveCasoBadge();
}
// ============================================================
// FIN SISTEMA DE CASOS
// ============================================================
// ═══════════════════════════════════════════════════════════════
// SISTEMA DE PERFILES — modal central
// ═══════════════════════════════════════════════════════════════
function abrirUserProfile() {
  const modal = document.getElementById('userProfileModal');
  const email = sb?.auth?.getUser ? '' : '';
  // Obtener email del usuario actual
  sb.auth.getUser().then(({ data }) => {
    const e = data?.user?.email || 'Sin sesión';
    document.getElementById('userProfileEmail').textContent = e;
    document.getElementById('userProfileEmailDetail').textContent = e;
  });
  modal.classList.add('modal-showing');
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-visible')));
  lockBody();
}
function cerrarUserProfile() {
  const modal = document.getElementById('userProfileModal');
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.classList.remove('modal-showing'), 280);
  unlockBody();
}
function openProfileModal() {
  renderProfileList();
  document.getElementById('profileNameInput').value = '';
  document.getElementById('profileCreateBtn').disabled = true;
  const el = document.getElementById('profileModal');
  el.classList.add('modal-showing');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('modal-visible')));
  lockBody();
}
function closeProfileModal() {
  const el = document.getElementById('profileModal');
  el.classList.remove('modal-visible');
  setTimeout(() => { el.classList.remove('modal-showing'); }, 280);
  unlockBody();
  // Mostrar app suavemente si aún no está lista
  const app = document.getElementById('app-container');
  if (!app.classList.contains('app-ready')) {
    requestAnimationFrame(() => app.classList.add('app-ready'));
  }
}
function checkProfileBtn() {
  const val = document.getElementById('profileNameInput').value.trim();
  document.getElementById('profileCreateBtn').disabled = val.length === 0;
}
function renderProfileList() {
  const container = document.getElementById('profileList');
  const casos = getCasosIndex();
  container.innerHTML = '';
  if (casos.length === 0) {
    container.innerHTML = '<p class="text-[10px] text-slate-600 font-bold text-center py-2">No hay casos aún</p>';
    return;
  }
  casos.forEach(c => {
    const isActive = c.id === activeCasoId;
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all active:scale-95';
    row.style.cssText = isActive
      ? 'background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.4)'
      : 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)';
    // Avatar initial
    const av = document.createElement('div');
    av.className = 'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-black';
    av.style.cssText = isActive
      ? 'background:rgba(59,130,246,0.3);color:#bfdbfe'
      : 'background:rgba(255,255,255,0.07);color:#94a3b8';
    av.innerText = c.nombre.charAt(0).toUpperCase();
    row.appendChild(av);
    // Name
    const name = document.createElement('span');
    name.className = 'flex-1 text-[12px] font-black truncate ' + (isActive ? 'text-[#bfdbfe]' : 'text-slate-300');
    name.innerText = c.nombre;
    row.appendChild(name);
    // Active badge
    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'text-[8px] font-black px-1.5 py-0.5 rounded-full';
      badge.style.cssText = 'background:rgba(59,130,246,0.3);color:#bfdbfe';
      badge.innerText = 'ACTIVO';
      row.appendChild(badge);
    }
    // Delete button
    const del = document.createElement('button');
    del.className = 'w-5 h-5 rounded-full flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0';
    del.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>';
    del.onclick = (e) => { e.stopPropagation(); eliminarPerfil(c.id); };
    row.appendChild(del);
    // Click to select
    row.addEventListener('click', () => {
      switchCaso(c.id);
      closeProfileModal();
    });
    container.appendChild(row);
  });
}
function crearPerfil() {
  const nombre = document.getElementById('profileNameInput').value.trim();
  if (!nombre) return;
  const id = 'caso_' + Date.now();
  const now = new Date().toISOString();
  const idx = getCasosIndex();
  // BUG 6 FIX: incluir created_at_local, updated_at y sync_status
  // para que sbLoadCasos pueda rescatar este caso si queda huérfano.
  idx.push({ id, nombre, created: Date.now(), created_at_local: Date.now(),
             updated_at_local: Date.now(), saved_at: null,
             sync_status: 'pending_create', version: 1 });
  saveCasosIndex(idx);
  // Save current state then switch to new empty caso
  if (activeCasoId) saveCurrentCasoNow();
  activeCasoId = id;
  resetAllSilent();
  saveCurrentCasoNow();
  updateActiveCasoBadge();
  renderCasosList();
  closeProfileModal();
  requestAnimationFrame(() => document.getElementById('app-container').classList.add('app-ready'));
  // Encolar sincronización inicial del caso nuevo
  if (typeof queueSave === 'function' && sbCurrentUser) setTimeout(() => queueSave(id), 700);
}
function confirmarEliminarCaso(id, nombre) {
  const modal = document.getElementById('confirmDeleteModal');
  document.getElementById('confirmDeleteNombre').textContent = nombre;
  document.getElementById('confirmDeleteBtn').onclick = () => {
    cerrarConfirmDelete();
    setTimeout(() => eliminarPerfil(id), 300);
  };
  modal.classList.add('modal-showing');
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('modal-visible')));
  lockBody();
}
function cerrarConfirmDelete() {
  const modal = document.getElementById('confirmDeleteModal');
  modal.classList.remove('modal-visible');
  setTimeout(() => modal.classList.remove('modal-showing'), 280);
  unlockBody();
}
function eliminarPerfil(id) {
  // BUG 7 FIX: cancelar debounce pendiente ANTES de cualquier limpieza,
  // para evitar que un autosave rezagado re-suba datos ya eliminados.
  if (id === activeCasoId && typeof saveTimeout !== 'undefined') {
    clearTimeout(saveTimeout);
    dbg('eliminarPerfil: saveTimeout cancelado para ' + id.slice(0,8));
  }
  // Delegar limpieza local + Supabase + bloqueo de futuros saves a sbDeleteCaso
  if (typeof sbDeleteCaso === 'function') sbDeleteCaso(id);
  if (activeCasoId === id) {
    activeCasoId = null;
    localStorage.removeItem('pension_utm_last_caso');
    resetAllSilent();
    updateActiveCasoBadge();
  } else {
    updateActiveCasoBadge();
  }
  renderCasosList();
  renderProfileList();
}
// ============================================================
// MODAL RESUMEN — vista completa equivalente al PDF
// ============================================================
function showResumenModal() {
  if (!lastCalculationData || lastCalculationData.length === 0) {
    alert('No hay datos calculados. Ingresa los datos y el cálculo se actualizará automáticamente.');
    return;
  }
  buildResumenContent();
  document.getElementById('resumenModal').classList.replace('hidden','flex');
  lockBody();
}
function hideResumenModal() {
  document.getElementById('resumenModal').classList.replace('flex','hidden');
  unlockBody();
}
function buildResumenContent() {
  const container = document.getElementById('resumenContent');
  container.innerHTML = '';
  const utmHoy = getUtmActualVal();
  const fmt = n => new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);
  const fmtPct = v => (v * 100).toFixed(2) + '%';
  const pensiones  = lastCalculationData.filter(d => !d.isDebt);
  const historicas = lastCalculationData.filter(d =>  d.isDebt);
  const imputacion = lastImputacion;
  const totalCapPesos = lastCalculationData.reduce((s,d) => s + d.cap, 0); // ya descontados LAV
  const totalIntPesos = lastCalculationData.reduce((s,d) => s + d.inte, 0);
  const totalAbonosCLP = abonos.reduce((s,a) => s + a.amount, 0);
  const totalParcialesCLP = pagosParciales.reduce((s,p) => s + p.amount, 0);
  const lavTotalUTM_h = (typeof abonosLav !== 'undefined' ? abonosLav : []).reduce((s,p) => s + (p.amountUtm||0), 0);
  const saldoPostImput = imputacion ? imputacion.saldoFinal : Math.max(0, totalCapPesos + totalIntPesos - totalAbonosCLP);
  const totalFinalReal = Math.max(0, saldoPostImput - (lavTotalUTM_h * utmHoy));
  const intImputado = imputacion ? imputacion.interesesPagados : 0;
  const capImputado = imputacion ? imputacion.capitalPagado : 0;

  // ── 0. Datos del Caso (colapsable) ──
  (function renderCasoBlock() {
    if (!activeCasoId) return;
    const casos = getCasosIndex();
    const c = casos.find(x => x.id === activeCasoId);
    if (!c) return;
    const estadoLabels = { activo: 'Activo', suspendido: 'Suspendido', archivado: 'Archivado' };
    const estadoColors = { activo: '#16a34a', suspendido: '#d97706', archivado: '#64748b' };
    const campos = [
      { label: 'Carátula',     val: c.nombre },
      { label: 'ROL',          val: c.rolCausa },
      { label: 'Tribunal',     val: c.tribunal },
      { label: 'Monto decreto',val: c.montoDecretado },
      { label: 'Día de pago',  val: c.diaPago },
      { label: 'Inicio pago',  val: c.fechaInicioPago },
      { label: 'Reajuste',     val: c.reajustabilidad },
      { label: 'Alimentante',  val: c.alimentante ? (c.alimentante + (c.rutAlimentante ? ' · ' + c.rutAlimentante : '')) : null },
      { label: 'Alimentario/a',val: c.alimentario  ? (c.alimentario  + (c.rutAlimentario  ? ' · ' + c.rutAlimentario  : '')) : null },
    ].filter(f => f.val);
    if (campos.length === 0 && !c.estado) return;

    const wrap = document.createElement('div');
    wrap.className = 'rounded-xl overflow-hidden';
    wrap.style.cssText = 'border:1px solid rgba(37,99,235,0.18)';

    // Header colapsable
    const header = document.createElement('button');
    header.className = 'w-full flex items-center justify-between px-3 py-2.5 transition-colors';
    header.style.cssText = 'background:rgba(37,99,235,0.06);border:none;cursor:pointer;';
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <span style="font-size:10px;font-weight:900;color:#1e40af;text-transform:uppercase;letter-spacing:0.08em">Datos del Caso</span>
        ${c.estado ? `<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;background:${estadoColors[c.estado] || '#64748b'}18;color:${estadoColors[c.estado] || '#64748b'};border:1px solid ${estadoColors[c.estado] || '#64748b'}30">${estadoLabels[c.estado] || c.estado}</span>` : ''}
      </div>
      <svg id="casoResumenChevron" style="width:14px;height:14px;color:#3b82f6;transition:transform 0.25s ease;transform:rotate(0deg)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>`;

    // Cuerpo colapsable
    const body = document.createElement('div');
    body.style.cssText = 'max-height:0;overflow:hidden;transition:max-height 0.3s cubic-bezier(.4,0,.2,1)';

    const inner = document.createElement('div');
    inner.style.cssText = 'padding:4px 0 4px';

    campos.forEach((f, i) => {
      const row = document.createElement('div');
      row.className = 'flex items-start gap-2 px-3 py-2';
      row.style.cssText = `border-top:1px solid rgba(0,0,0,0.05);background:${i%2===0?'#ffffff':'#f8fafc'}`;
      row.innerHTML = `
        <div style="flex:1;min-width:0">
          <p style="font-size:8.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:1px">${f.label}</p>
          <p style="font-size:10.5px;font-weight:700;color:#1e293b;word-break:break-word">${f.val}</p>
        </div>`;
      inner.appendChild(row);
    });

    body.appendChild(inner);

    // Toggle logic
    let open = false;
    header.addEventListener('click', () => {
      open = !open;
      body.style.maxHeight = open ? body.scrollHeight + 'px' : '0';
      document.getElementById('casoResumenChevron').style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
      // Recalcular maxHeight si el contenido cambió
      if (open) setTimeout(() => { body.style.maxHeight = body.scrollHeight + 'px'; }, 10);
    });

    wrap.appendChild(header);
    wrap.appendChild(body);
    container.appendChild(wrap);
  })();

  // ── Helper: sección con título de color ──
  function seccion(titulo, colorHex, emoji) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="flex items-center gap-2 px-3 py-2 rounded-xl font-black text-[10px] uppercase tracking-wide" style="background:${colorHex}14;border:1px solid ${colorHex}30">
      <span>${emoji}</span><span style="color:${colorHex}">${titulo}</span>
    </div>`;
    container.appendChild(div);
  }

  // ── Helper: tabla de cuotas (con separadores por año) ──
  function tablaFilas(datos, colorHeader) {
    if (datos.length === 0) return;
    const COLS = '2.2fr 1.2fr 2fr 1.2fr 1.8fr 2fr 2fr';
    const wrap = document.createElement('div');
    wrap.className = 'rounded-xl overflow-hidden';
    wrap.style.border = `1px solid ${colorHeader}30`;
    // Header
    const head = document.createElement('div');
    head.className = 'grid text-[9px] font-black uppercase text-white px-3 py-2';
    head.style.cssText = `background:${colorHeader};grid-template-columns:${COLS};column-gap:6px`;
    head.innerHTML = '<span>Período</span><span>UTM</span><span>Capital $</span><span>Días</span><span class="text-center">Tasa</span><span class="text-right">Interés</span><span class="text-right">Subtotal</span>';
    wrap.appendChild(head);

    let lastYear = null;
    let rowIndex = 0;
    datos.forEach((d) => {
      // Usar cap efectivo si el mes fue reducido por excedente de pago parcial
      const cap0 = (d.hayParcialConRemanente || (d.excedenteParcialAplicado||0) > 0 || d.cap < (d.capOriginal??d.capOriginalBruto??d.cap)) ? d.cap : (d.capOriginal ?? d.capOriginalBruto ?? d.cap);
      const int0 = d.inte;
      // Extraer año del período (ej: "Ene 2020" → 2020)
      const periodoClean = d.periodo.replace(/^HIST /,'').replace(/^CONS /,'');
      const yearMatch = periodoClean.match(/\d{4}/);
      const rowYear = yearMatch ? parseInt(yearMatch[0]) : null;

      // Separador de año
      if (rowYear && rowYear !== lastYear) {
        lastYear = rowYear;
        const sep = document.createElement('div');
        sep.style.cssText = `background:${colorHeader}10;border-top:1.5px solid ${colorHeader}40`;
        sep.innerHTML = `
          <div class="flex items-center gap-2 px-3 py-1">
            <span style="font-size:9px;font-weight:900;color:${colorHeader};letter-spacing:0.08em">${rowYear}</span>
          </div>
          <div class="grid px-3 pb-1 text-[8px] font-black uppercase" style="grid-template-columns:${COLS};column-gap:6px;color:${colorHeader};opacity:0.7">
            <span>Período</span><span>UTM</span><span>Capital $</span><span>Días</span><span class="text-center">Tasa</span><span class="text-right">Interés</span><span class="text-right">Subtotal</span>
          </div>`;
        wrap.appendChild(sep);
        rowIndex = 0;
      }

      const row = document.createElement('div');
      row.className = 'grid px-3 py-2.5 text-[10px] font-bold cursor-pointer hover:bg-sky-50 active:opacity-70 transition-colors';
      row.style.cssText = `grid-template-columns:${COLS};column-gap:6px;background:${d.esLav?'#f0fdf4':(rowIndex%2===0?'#ffffff':'#f8fafc')};border-top:1px solid #e2e8f0`;
      const aproxTag = d.tasaEsAproximada ? `<span style="color:#d97706;font-size:7.5px">~</span>` : '';
      const capMostrado = d.esLav ? 0 : cap0;
      const capUTM = d.esLav ? '0.00' : ((d.utmVal && d.utmVal > 0) ? (cap0 / d.utmVal).toFixed(2) : '—');
      const lavTag = d.esLav ? `<span style="color:#10b981;font-size:7.5px;font-weight:900"> ✓LAV</span>` : '';
      row.innerHTML = `
        <span class="truncate" style="color:#1e293b">${periodoClean}${d.isDebt?'<span style="color:#ea580c;font-size:7.5px;font-weight:900"> H</span>':''}${lavTag}</span>
        <span style="color:#7c3aed;font-size:9px;font-weight:900">${capUTM}</span>
        <span style="color:${d.esLav?'#10b981':'#334155'}">${fmt(capMostrado)}</span>
        <span style="color:#64748b">${d.mora}</span>
        <span class="text-center" style="color:#0284c7;white-space:nowrap">${fmtPct(d.tasa)}${aproxTag}</span>
        <span class="text-right" style="color:#0369a1">${fmt(int0)}</span>
        <span class="text-right font-black" style="color:#0f172a">${fmt(capMostrado+int0)}</span>`;
      row.onclick = () => { hideResumenModal(); openDetailModal(d.id); };
      wrap.appendChild(row);
      rowIndex++;
    });
    // Sub-header antes del total
    const subHead = document.createElement('div');
    subHead.className = 'grid px-3 py-1 text-[8px] font-black uppercase';
    subHead.style.cssText = `grid-template-columns:${COLS};column-gap:6px;color:${colorHeader};opacity:0.7;background:${colorHeader}08;border-top:1px solid ${colorHeader}30`;
    subHead.innerHTML = `<span>Período</span><span>UTM</span><span>Capital $</span><span>Días</span><span class="text-center">Tasa</span><span class="text-right">Interés</span><span class="text-right">Subtotal</span>`;
    wrap.appendChild(subHead);
    // Footer totales
    const totCap = datos.reduce((s,d) => s+d.cap,0);
    const totInt = datos.reduce((s,d) => s+d.inte,0);
    const foot = document.createElement('div');
    foot.className = 'grid px-3 py-2.5 text-[10px] font-black';
    foot.style.cssText = `grid-template-columns:${COLS};column-gap:6px;background:${colorHeader}18;border-top:2px solid ${colorHeader}50;color:#0f172a`;
    const totUTM = datos.reduce((s,d) => s + ((d.utmVal && d.utmVal > 0) ? d.cap / d.utmVal : 0), 0);
    foot.innerHTML = `<span>TOTAL</span><span style="color:#7c3aed;font-size:9px;font-weight:900">${totUTM.toFixed(2)}</span><span>${fmt(totCap)}</span><span></span><span></span><span class="text-right">${fmt(totInt)}</span><span class="text-right">${fmt(totCap+totInt)}</span>`;
    wrap.appendChild(foot);
    container.appendChild(wrap);
  }

  // ── 1. Pensiones ──
  if (pensiones.length > 0) {
    seccion('Período Actual', '#0284c7', '');
    tablaFilas(pensiones, '#0284c7');
  }

  // ── 2. Deuda Histórica ──
  if (historicas.length > 0) {
    seccion('Deuda Histórica', '#d97706', '');
    tablaFilas(historicas, '#d97706');
  }

  // ── 3. Abonos ──
  if (abonos.length > 0) {
    seccion('Abonos Realizados', '#0891b2', '');
    const wrapA = document.createElement('div');
    wrapA.className = 'rounded-xl overflow-hidden';
    wrapA.style.border = '1px solid rgba(8,145,178,0.25)';
    abonos.forEach((a, i) => {
      const [anio, mes] = a.date.split('-');
      const label = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(mes)-1] + ' ' + anio;
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center px-3 py-2 text-[10px] font-bold';
      row.style.cssText = `background:${i%2===0?'#ffffff':'#f8fafc'};border-top:${i>0?'1px solid #e2e8f0':'none'}`;
      row.innerHTML = `<span style="color:#475569">${label}</span><span class="font-black" style="color:#0f172a">${fmt(a.amount)}</span>`;
      wrapA.appendChild(row);
    });
    // nota imputación
    if (imputacion && (intImputado > 0 || capImputado > 0)) {
      const nota = document.createElement('div');
      nota.className = 'px-3 py-2.5 text-[9px] font-bold space-y-0.5';
      nota.style.cssText = 'background:rgba(8,145,178,0.06);border-top:1px solid rgba(8,145,178,0.2)';
      nota.innerHTML = `<p class="font-black uppercase" style="color:#0284c7">Imputación Art. 1595 CC</p>
        ${intImputado>0?`<p style="color:#475569">→ A intereses: <span class="font-black" style="color:#0369a1">${fmt(intImputado)}</span></p>`:''}
        ${capImputado>0?`<p style="color:#475569">→ A capital: <span class="font-black" style="color:#0369a1">${fmt(capImputado)}</span></p>`:''}`;
      wrapA.appendChild(nota);
    }
    container.appendChild(wrapA);
  }

  // ── 4. Pagos Parciales ──
  if (pagosParciales.length > 0) {
    seccion('Pagos Parciales por Mes', '#7c3aed', '');
    const wrapP = document.createElement('div');
    wrapP.className = 'rounded-xl overflow-hidden';
    wrapP.style.border = '1px solid rgba(124,58,237,0.2)';
    // Agrupar por período (puede haber múltiples pagos en el mismo mes)
    const agrupados = [];
    const vistoPeriodos = {};
    pagosParciales.forEach(p => {
      if (vistoPeriodos[p.periodo] !== undefined) {
        agrupados[vistoPeriodos[p.periodo]].amount += p.amount;
      } else {
        vistoPeriodos[p.periodo] = agrupados.length;
        agrupados.push({ periodo: p.periodo, periodoLabel: p.periodoLabel, amount: p.amount });
      }
    });
    agrupados.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center px-3 py-2 text-[10px] font-bold';
      row.style.cssText = `background:${i%2===0?'#ffffff':'#f8fafc'};border-top:${i>0?'1px solid #e2e8f0':'none'}`;
      row.innerHTML = `<span style="color:#475569">${p.periodoLabel}</span><span class="font-black" style="color:#0f172a">${fmt(p.amount)}</span>`;
      wrapP.appendChild(row);
    });
    container.appendChild(wrapP);
  }

  // ── 4b. Abonos LAV ──
  if (typeof abonosLav !== 'undefined' && abonosLav.length > 0) {
    seccion('Abonos LAV', '#059669', '');
    const wrapLav = document.createElement('div');
    wrapLav.className = 'rounded-xl overflow-hidden';
    wrapLav.style.border = '1px solid rgba(16,185,129,0.2)';
    const totalLavUTM = abonosLav.reduce((s,p) => s + (p.amountUtm||0), 0);
    const totalLavCLP = abonosLav.reduce((s,p) => s + p.amount, 0);
    abonosLav.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between items-center px-3 py-2 text-[10px] font-bold';
      row.style.cssText = `background:${i%2===0?'#ffffff':'#f8fafc'};border-top:${i>0?'1px solid #e2e8f0':'none'}`;
      const utmStr = p.amountUtm ? p.amountUtm.toFixed(5) : '—';
      row.innerHTML = `<span style="color:#475569">${p.date}</span><span style="color:#059669">${utmStr} UTM</span><span class="font-black" style="color:#0f172a">${fmt(p.amount)}</span>`;
      wrapLav.appendChild(row);
    });
    // Fila total
    const totRow = document.createElement('div');
    totRow.className = 'flex justify-between items-center px-3 py-2 text-[10px] font-black';
    totRow.style.cssText = 'background:rgba(16,185,129,0.08);border-top:2px solid rgba(16,185,129,0.3)';
    totRow.innerHTML = `<span style="color:#059669">TOTAL LAV</span><span style="color:#059669">${totalLavUTM.toFixed(5)} UTM</span><span style="color:#0f172a">${fmt(totalLavCLP)}</span>`;
    wrapLav.appendChild(totRow);
    container.appendChild(wrapLav);
  }

  // ── 5. Resumen Final ──
  seccion('Resumen Final', '#0369a1', '');
  const subtotalBruto = totalCapPesos + totalIntPesos;
  const resumenRows = [
    { label: 'Capital total (pensiones impagas)', val: totalCapPesos, labelColor: '#334155', valColor: '#0f172a', bold: false },
    { label: 'Total intereses generados', val: totalIntPesos, labelColor: '#334155', valColor: '#0284c7', bold: false },
    { label: 'SUBTOTAL BRUTO', val: subtotalBruto, labelColor: '#0f172a', valColor: '#0f172a', bold: true, sep: true },
  ];
  if (totalAbonosCLP > 0) {
    resumenRows.push({ label: '(-) Abonos a intereses (Art. 1595 CC)', val: -intImputado, labelColor: '#0891b2', valColor: '#0891b2', bold: false });
    resumenRows.push({ label: '(-) Abonos a capital (Art. 1595 CC)', val: -capImputado, labelColor: '#0891b2', valColor: '#0891b2', bold: false });
  }
  if (lavTotalUTM_h > 0) {
    resumenRows.push({ label: '(-) Abonos LAV (depósitos cuenta vista)', val: -(lavTotalUTM_h * utmHoy), labelColor: '#059669', valColor: '#059669', bold: false });
  }
  const wrapR = document.createElement('div');
  wrapR.className = 'rounded-xl overflow-hidden';
  wrapR.style.border = '1px solid #e2e8f0';
  resumenRows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'flex justify-between items-center px-3 py-2.5 text-[10.5px]';
    row.style.cssText = `background:${r.sep?'#eff6ff':i%2===0?'#ffffff':'#f8fafc'};border-top:${i>0?'1px solid #e2e8f0':'none'}`;
    row.innerHTML = `<span class="${r.bold?'font-black':'font-semibold'}" style="color:${r.labelColor}">${r.label}</span>
      <span class="${r.bold?'font-black':'font-bold'}" style="color:${r.valColor}">${r.val<0?'-':''}${fmt(Math.abs(r.val))}</span>`;
    wrapR.appendChild(row);
  });
  // Total final destacado
  const totalRow = document.createElement('div');
  totalRow.className = 'px-4 py-4 text-center';
  totalRow.style.cssText = 'background:linear-gradient(135deg,#1e3a5f,#1e40af);border-top:2px solid #1d4ed8';
  totalRow.innerHTML = `
    <p style="font-size:9px;font-weight:900;color:#93c5fd;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Total a Pagar — Liquidación Final</p>
    <p class="font-black text-white" style="font-size:clamp(28px,8vw,42px);line-height:1;letter-spacing:-1px">${fmt(totalFinalReal)}</p>
    <p style="font-size:10px;font-weight:700;margin-top:4px;color:#bfdbfe">${(totalFinalReal/utmHoy).toFixed(4)} UTM</p>
    <p style="font-size:8px;font-weight:600;color:#93c5fd;margin-top:2px;opacity:0.8">1 UTM = ${fmt(utmHoy)}</p>`;
  wrapR.appendChild(totalRow);
  container.appendChild(wrapR);

  // ── 6. Nota pie ──
  const nota = document.createElement('div');
  nota.className = 'rounded-xl px-3 py-3 text-[9px] font-medium leading-relaxed';
  nota.style.cssText = 'border:1px solid #e2e8f0;background:#f8fafc;color:#64748b';
  nota.innerHTML = `<p class="font-black mb-1" style="color:#475569">Nota</p>Toca cualquier fila de cuota para ver su detalle completo. Los valores son referenciales. Para uso judicial, valide con un profesional habilitado.`;
  container.appendChild(nota);
}
function toggleDownloadMenu() {
  const menu = document.getElementById('downloadMenu');
  const btn = document.getElementById('downloadBtn');
  if (!menu || !btn) return;
  const isOpen = menu.style.display !== 'none';
  if (isOpen) {
    menu.style.display = 'none';
    return;
  }
  const rect = btn.getBoundingClientRect();
  menu.style.display = 'block';
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  setTimeout(() => document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    }
  }), 10);
}

async function exportarExcel() {
  if (!lastCalculationData || lastCalculationData.length === 0) return;

  const utmHoy   = getUtmActualVal();
  const fmtN     = n => Math.round(n);
  const fmtPct   = v => parseFloat((v * 100).toFixed(2));
  const pensiones  = lastCalculationData.filter(d => !d.isDebt);
  const historicas = lastCalculationData.filter(d =>  d.isDebt);
  const imputacion = lastImputacion;
  const totalCapPesos  = lastCalculationData.reduce((s,d) => s+d.cap, 0);
  const totalIntPesos  = lastCalculationData.reduce((s,d) => s+d.inte, 0);
  const totalAbonosCLP = abonos.reduce((s,a) => s+a.amount, 0);
  const lavTotalUTM_x  = (typeof abonosLav !== 'undefined' ? abonosLav : []).reduce((s,p) => s+(p.amountUtm||0), 0);
  const saldoPostImput = imputacion ? imputacion.saldoFinal : (totalCapPesos+totalIntPesos-totalAbonosCLP);
  const totalFinalReal = Math.max(0, saldoPostImput - (lavTotalUTM_x * utmHoy));
  const intImputado    = imputacion ? imputacion.interesesPagados : 0;
  const capImputado    = imputacion ? imputacion.capitalPagado : 0;
  const hoy = new Date();
  const fechaStr = hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0')+'-'+String(hoy.getDate()).padStart(2,'0');
  const casoNombre = document.getElementById('activeCasoNombreHeader')?.textContent || 'Liquidación';

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pensión UTM';
  wb.created = hoy;

  // ── Paleta ──
  const COLORS = {
    azulOscuro:'1E3A5F', azulMedio:'2563EB', azulClaro:'DBEAFE', azulFila:'EFF6FF',
    naranjaOscuro:'92400E', naranjaMedio:'D97706', naranjaClaro:'FEF3C7', naranjaFila:'FFFBEB',
    cianoOscuro:'065F46', cianoMedio:'059669', cianoClaro:'D1FAE5', cianoFila:'ECFDF5',
    violetaOscuro:'4C1D95', violetaMedio:'7C3AED', violetaClaro:'EDE9FE',
    blanco:'FFFFFF', grisClaro:'F8FAFC', grisMedio:'E2E8F0', grisTexto:'334155', negro:'0F172A',
    separador:'94A3B8',
  };

  function hdrStyle(bgHex, fgHex='FFFFFF') {
    return {
      font: { bold:true, color:{argb:'FF'+fgHex}, size:10, name:'Calibri' },
      fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+bgHex} },
      alignment: { horizontal:'center', vertical:'middle' },
      border: { bottom:{ style:'medium', color:{argb:'FF'+fgHex+'80'} } },
    };
  }
  function rowStyle(even, bgEven, bgOdd, bold=false) {
    return {
      font: { bold, size:10, name:'Calibri', color:{argb:'FF'+COLORS.grisTexto} },
      fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+(even?bgEven:bgOdd)} },
      alignment: { vertical:'middle' },
    };
  }
  function totalStyle(bgHex, fgHex=COLORS.negro) {
    return {
      font: { bold:true, size:10, name:'Calibri', color:{argb:'FF'+fgHex} },
      fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+bgHex} },
      alignment: { vertical:'middle' },
      border: { top:{ style:'medium', color:{argb:'FF'+bgHex} } },
    };
  }

  // ══════════════════════════════════════════════════════════
  // HOJA ÚNICA — Liquidación Completa
  // ══════════════════════════════════════════════════════════
  const ws = wb.addWorksheet('Liquidación', { tabColor: { argb: 'FF1E3A5F' } });
  ws.columns = [
    { width:18 }, // A: Período
    { width:11 }, // B: UTM
    { width:12 }, // C: Capital UTM
    { width:16 }, // D: Capital $
    { width:11 }, // E: Días mora
    { width:12 }, // F: Tasa anual
    { width:16 }, // G: Interés $
    { width:16 }, // H: Subtotal $
  ];

  // ── Título principal ──
  ws.mergeCells('A1:H1');
  const tCell = ws.getCell('A1');
  tCell.value = 'Liquidación de Pensión Alimenticia';
  tCell.style = { font:{bold:true,size:16,name:'Calibri',color:{argb:'FFFFFFFF'}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.azulOscuro}}, alignment:{horizontal:'center',vertical:'middle'} };
  ws.getRow(1).height = 36;

  ws.mergeCells('A2:H2');
  const stCell = ws.getCell('A2');
  stCell.value = casoNombre + '  ·  ' + fechaStr;
  stCell.style = { font:{size:10,name:'Calibri',color:{argb:'FFAAAAAA'}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.azulOscuro}}, alignment:{horizontal:'center',vertical:'middle'} };
  ws.getRow(2).height = 18;

  let currentRow = 3;

  // ── Helper: sección separadora ──
  function addSectionHeader(label, color, nCols=8) {
    currentRow++;
    ws.mergeCells(currentRow, 1, currentRow, nCols);
    const c = ws.getCell(currentRow, 1);
    c.value = label;
    c.style = {
      font: { bold:true, size:11, name:'Calibri', color:{argb:'FFFFFFFF'} },
      fill: { type:'pattern', pattern:'solid', fgColor:{argb:'FF'+color} },
      alignment: { horizontal:'left', vertical:'middle', indent:1 },
    };
    ws.getRow(currentRow).height = 24;
    currentRow++;
  }

  // ── Helper: fila de encabezado de tabla ──
  function addTableHeader(headers, colorMedio) {
    const hRow = ws.getRow(currentRow);
    hRow.height = 22;
    headers.forEach((h, i) => {
      const cell = ws.getCell(currentRow, i+1);
      cell.value = h;
      cell.style = hdrStyle(colorMedio);
    });
    currentRow++;
  }

  // ── Helper: tabla de cuotas ──
  function addCuotasTable(datos, colorSet) {
    const tieneExcedentes = datos.some(d => (d.excedenteParcialAplicado||0) > 0);
    const hdrs = tieneExcedentes
      ? ['Período','UTM','Capital UTM','Capital $','Excedente aplicado $','Días mora','Tasa anual','Interés $','Subtotal $']
      : ['Período','UTM','Capital UTM','Capital $','Días mora','Tasa anual','Interés $','Subtotal $'];
    addTableHeader(hdrs, colorSet.medio);

    // Guardar referencia de filas para el gráfico
    const firstDataRow = currentRow;
    const periodos = [], caps = [], ints = [];

    datos.forEach((d, i) => {
      const cap0   = d.cap;
      const capMostrado = d.esLav ? 0 : cap0;
      const int0   = d.intOriginal ?? d.inte;
      const capUTM = d.esLav ? 0 : ((d.utmVal && d.utmVal > 0) ? parseFloat((cap0/d.utmVal).toFixed(2)) : 0);
      const periodoClean = (d.periodo.replace(/^HIST /,'').replace(/^CONS /,'')) + (d.esLav ? ' ✓' : '');
      periodos.push(periodoClean);
      caps.push(Math.round(cap0));
      ints.push(Math.round(int0));
      const row = ws.getRow(currentRow);
      row.height = 18;
      const excedente = (d.excedenteParcialAplicado||0) > 0 ? Math.round(d.excedenteParcialAplicado * (d.utmVal||1)) : 0; // UTM excess × UTM del mes
      ws.getCell(currentRow,1).value = periodoClean;
      ws.getCell(currentRow,2).value = d.utmVal||0;
      ws.getCell(currentRow,3).value = capUTM;
      ws.getCell(currentRow,4).value = fmtN(capMostrado);
      if (tieneExcedentes) {
        ws.getCell(currentRow,5).value = excedente > 0 ? -excedente : 0;
        ws.getCell(currentRow,6).value = d.mora;
        ws.getCell(currentRow,7).value = fmtPct(d.tasa);
        ws.getCell(currentRow,8).value = fmtN(int0);
        ws.getCell(currentRow,9).value = fmtN(capMostrado+int0);
      } else {
        ws.getCell(currentRow,5).value = d.mora;
        ws.getCell(currentRow,6).value = fmtPct(d.tasa);
        ws.getCell(currentRow,7).value = fmtN(int0);
        ws.getCell(currentRow,8).value = fmtN(capMostrado+int0);
      }
      const even = i%2===0;
      const totalCols = tieneExcedentes ? 9 : 8;
      for (let col=1; col<=totalCols; col++) {
        const cell = ws.getCell(currentRow, col);
        cell.style = rowStyle(even, colorSet.fila, COLORS.blanco);
        cell.style.alignment = { horizontal: col===1 ? 'left' : 'right', vertical:'middle' };
        if (tieneExcedentes) {
          if (col===7) { cell.numFmt = '0.00"%"'; }
          if ([4,5,8,9].includes(col)) { cell.numFmt = '#,##0'; }
          if (col===5 && excedente > 0) { cell.font = { ...cell.font, color: { argb: 'FF16A34A' } }; }
        } else {
          if (col===6) { cell.numFmt = '0.00"%"'; }
          if ([4,7,8].includes(col)) { cell.numFmt = '#,##0'; }
        }
      }
      currentRow++;
    });

    // Fila TOTAL
    const totCap = datos.reduce((s,d)=>s+d.cap,0);
    const totInt = datos.reduce((s,d)=>s+d.inte,0);
    const totUTM = datos.reduce((s,d)=>s+((d.utmVal&&d.utmVal>0)?d.cap/d.utmVal:0),0);
    const totExcedente = datos.reduce((s,d)=>s+((d.excedenteParcialAplicado||0)*(d.utmVal||1)),0);
    const lastDataRow = currentRow - 1;
    const tRow = ws.getRow(currentRow);
    tRow.height = 22;
    ws.getCell(currentRow,1).value = 'TOTAL';
    ws.getCell(currentRow,3).value = parseFloat(totUTM.toFixed(2));
    ws.getCell(currentRow,4).value = fmtN(totCap);
    if (tieneExcedentes) {
      ws.getCell(currentRow,5).value = fmtN(-Math.round(totExcedente));
      ws.getCell(currentRow,8).value = fmtN(totInt);
      ws.getCell(currentRow,9).value = fmtN(totCap+totInt);
    } else {
      ws.getCell(currentRow,7).value = fmtN(totInt);
      ws.getCell(currentRow,8).value = fmtN(totCap+totInt);
    }
    const totalCols2 = tieneExcedentes ? 9 : 8;
    for (let col=1; col<=totalCols2; col++) {
      const cell = ws.getCell(currentRow, col);
      cell.style = totalStyle(colorSet.claro, colorSet.oscuro);
      cell.style.alignment = { horizontal: col===1 ? 'left' : 'right', vertical:'middle' };
      if (tieneExcedentes) {
        if ([4,5,8,9].includes(col)) cell.numFmt='#,##0';
      } else {
        if ([4,7,8].includes(col)) cell.numFmt='#,##0';
      }
    }
    currentRow++;
    return { firstDataRow, lastDataRow, periodos };
  }

  // ──────────────────────────────────────────
  // SECCIÓN 1: PERÍODO ACTUAL
  // ──────────────────────────────────────────
  let chartActualRef = null;
  if (pensiones.length > 0) {
    addSectionHeader('📅  Período Actual', COLORS.azulMedio);
    chartActualRef = addCuotasTable(pensiones, {
      oscuro: COLORS.azulOscuro, medio: COLORS.azulMedio,
      claro: COLORS.azulClaro, fila: COLORS.azulFila,
    });
  }

  // ──────────────────────────────────────────
  // SECCIÓN 2: DEUDA HISTÓRICA
  // ──────────────────────────────────────────
  let chartHistRef = null;
  if (historicas.length > 0) {
    addSectionHeader('🗂  Deuda Histórica', COLORS.naranjaOscuro);
    chartHistRef = addCuotasTable(historicas, {
      oscuro: COLORS.naranjaOscuro, medio: COLORS.naranjaMedio,
      claro: COLORS.naranjaClaro, fila: COLORS.naranjaFila,
    });
  }

  // ──────────────────────────────────────────
  // SECCIÓN 3: ABONOS
  // ──────────────────────────────────────────
  if (abonos.length > 0) {
    addSectionHeader('💳  Abonos Realizados', COLORS.cianoOscuro);
    const abonoHdrs = ['Mes / Concepto','Monto $','','','','','',''];
    addTableHeader(abonoHdrs, COLORS.cianoMedio);
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    abonos.forEach((a, i) => {
      const [anio, mes] = a.date.split('-');
      ws.getCell(currentRow,1).value = meses[parseInt(mes)-1]+' '+anio;
      ws.getCell(currentRow,2).value = a.amount;
      ws.mergeCells(currentRow,2,currentRow,8);
      const even = i%2===0;
      for (let col=1; col<=2; col++) {
        const cell = ws.getCell(currentRow,col);
        cell.style = rowStyle(even, COLORS.cianoFila, COLORS.blanco);
        if (col===2) { cell.numFmt='#,##0'; cell.style.alignment={horizontal:'right',vertical:'middle'}; }
      }
      ws.getRow(currentRow).height = 18;
      currentRow++;
    });

    // Imputación
    if (intImputado > 0 || capImputado > 0) {
      currentRow++;
      ws.mergeCells(currentRow,1,currentRow,8);
      const iHeaderCell = ws.getCell(currentRow,1);
      iHeaderCell.value = 'Imputación Art. 1595 CC — primero a intereses, luego a capital';
      iHeaderCell.style = { font:{bold:true,size:10,name:'Calibri',color:{argb:'FF'+COLORS.cianoOscuro}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.cianoClaro}}, alignment:{horizontal:'left',vertical:'middle',indent:1} };
      ws.getRow(currentRow).height = 20;
      currentRow++;
      if (intImputado>0) {
        ws.getCell(currentRow,1).value = '→ A intereses';
        ws.getCell(currentRow,2).value = Math.round(intImputado);
        ws.mergeCells(currentRow,2,currentRow,8);
        ws.getCell(currentRow,2).numFmt='#,##0';
        ws.getCell(currentRow,2).style.alignment={horizontal:'right',vertical:'middle'};
        ws.getRow(currentRow).height = 18;
        currentRow++;
      }
      if (capImputado>0) {
        ws.getCell(currentRow,1).value = '→ A capital';
        ws.getCell(currentRow,2).value = Math.round(capImputado);
        ws.mergeCells(currentRow,2,currentRow,8);
        ws.getCell(currentRow,2).numFmt='#,##0';
        ws.getCell(currentRow,2).style.alignment={horizontal:'right',vertical:'middle'};
        ws.getRow(currentRow).height = 18;
        currentRow++;
      }
    }
  }

  // ──────────────────────────────────────────
  // SECCIÓN 4: RESUMEN FINAL
  // ──────────────────────────────────────────
  addSectionHeader('📊  Resumen de Liquidación', COLORS.azulOscuro);
  addTableHeader(['Concepto','Monto $','','','','','',''], COLORS.azulMedio);

  const conceptos = [
    { label:'Capital total (pensiones impagas)', val:totalCapPesos, bold:false },
    { label:'Total intereses generados',         val:totalIntPesos, bold:false },
    { label:'SUBTOTAL BRUTO',                    val:totalCapPesos+totalIntPesos, bold:true, sep:true },
  ];
  if (totalAbonosCLP > 0) {
    conceptos.push({ label:'(-) Abonos a intereses (Art. 1595 CC)', val:-intImputado, bold:false, desc:true });
    conceptos.push({ label:'(-) Abonos a capital (Art. 1595 CC)',   val:-capImputado, bold:false, desc:true });
  }
  if (lavTotalUTM_x > 0) {
    conceptos.push({ label:'(-) Abonos LAV (depósitos cuenta vista)', val:-(lavTotalUTM_x * utmHoy), bold:false, desc:true });
  }
  conceptos.forEach((c, i) => {
    const bg = c.sep ? COLORS.azulClaro : i%2===0 ? COLORS.azulFila : COLORS.blanco;
    ws.getCell(currentRow,1).value = c.label;
    ws.getCell(currentRow,2).value = Math.round(c.val);
    ws.mergeCells(currentRow,2,currentRow,8);
    [1,2].forEach(col => {
      const cell = ws.getCell(currentRow,col);
      cell.style = {
        font:{bold:c.bold||c.sep,size:10,name:'Calibri',color:{argb:'FF'+(c.desc?COLORS.cianoOscuro:COLORS.negro)}},
        fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+bg}},
        alignment:{vertical:'middle'},
      };
      if (col===2) { cell.numFmt='#,##0'; cell.style.alignment={horizontal:'right',vertical:'middle'}; }
    });
    ws.getRow(currentRow).height = 18;
    currentRow++;
  });

  // Fila TOTAL final
  currentRow++;
  ws.getCell(currentRow,1).value = '⚖️  TOTAL A PAGAR';
  ws.getCell(currentRow,2).value = Math.round(totalFinalReal);
  ws.mergeCells(currentRow,2,currentRow,8);
  [1,2].forEach(col => {
    const cell = ws.getCell(currentRow,col);
    cell.style = { font:{bold:true,size:14,name:'Calibri',color:{argb:'FFFFFFFF'}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.azulOscuro}}, alignment:{horizontal:col===2?'right':'left',vertical:'middle',indent:col===1?1:0} };
    if (col===2) cell.numFmt='#,##0';
  });
  ws.getRow(currentRow).height = 32;
  currentRow++;

  // UTM y valor UTM
  ws.getCell(currentRow,1).value = 'Total en UTM (valor hoy)';
  ws.getCell(currentRow,2).value = parseFloat((totalFinalReal/utmHoy).toFixed(4));
  ws.mergeCells(currentRow,2,currentRow,8);
  [1,2].forEach(col => {
    const cell = ws.getCell(currentRow,col);
    cell.style = { font:{bold:true,size:10,name:'Calibri',color:{argb:'FF'+COLORS.azulOscuro}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.azulClaro}}, alignment:{horizontal:col===2?'right':'left',vertical:'middle'} };
    if (col===2) cell.numFmt='0.0000';
  });
  ws.getRow(currentRow).height = 18;
  currentRow++;

  ws.getCell(currentRow,1).value = 'Valor UTM utilizado';
  ws.getCell(currentRow,2).value = Math.round(utmHoy);
  ws.mergeCells(currentRow,2,currentRow,8);
  [1,2].forEach(col => {
    const cell = ws.getCell(currentRow,col);
    cell.style = { font:{size:9,name:'Calibri',color:{argb:'FFAAAAAA'}}, fill:{type:'pattern',pattern:'solid',fgColor:{argb:'FF'+COLORS.grisClaro}}, alignment:{horizontal:col===2?'right':'left',vertical:'middle'} };
    if (col===2) cell.numFmt='#,##0';
  });
  ws.getRow(currentRow).height = 16;
  currentRow++;

  // ── Hoja "Datos Gráfico" — ordenada cronológicamente con separador ──
  const MONTH_IDX_MAP = { Ene:0,Feb:1,Mar:2,Abr:3,May:4,Jun:5,Jul:6,Ago:7,Sep:8,Oct:9,Nov:10,Dic:11 };
  function periodoToDate(periodoStr) {
    const clean = periodoStr.replace(/^HIST /,'').replace(/^CONS /,'');
    const parts = clean.split(' ');
    const m = MONTH_IDX_MAP[parts[0]] ?? 0;
    const y = parseInt(parts[1]) || 0;
    return y * 100 + m;
  }

  const todasCuotas = [...pensiones, ...historicas];
  if (todasCuotas.length > 0) {
    // Ordenar cronológicamente
    const historicasOrdenadas = [...historicas].sort((a,b) => periodoToDate(a.periodo) - periodoToDate(b.periodo));
    const pensionesOrdenadas  = [...pensiones].sort((a,b)  => periodoToDate(a.periodo) - periodoToDate(b.periodo));

    const wsChart = wb.addWorksheet('Datos Gráfico');
    wsChart.columns = [{ width:20 }, { width:16 }, { width:16 }, { width:16 }];

    // Estilos
    const hdrFill  = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1E3A5F' } };
    const sepFill1 = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFEF3C7' } }; // naranja claro
    const sepFill2 = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFDBEAFE' } }; // azul claro
    const hdrFont  = { bold:true, color:{ argb:'FFFFFFFF' }, name:'Calibri', size:10 };
    const sepFont1 = { bold:true, color:{ argb:'FF92400E' }, name:'Calibri', size:10 };
    const sepFont2 = { bold:true, color:{ argb:'FF1E3A5F' }, name:'Calibri', size:10 };
    const numFmt   = '#,##0';

    // Encabezado global
    const hRow = wsChart.getRow(1);
    hRow.values = ['Período', 'Capital $', 'Interés $', 'Subtotal $'];
    hRow.height = 22;
    [1,2,3,4].forEach(c => {
      const cell = wsChart.getCell(1, c);
      cell.font = hdrFont;
      cell.fill = hdrFill;
      cell.alignment = { horizontal:'center', vertical:'middle' };
    });

    let r = 2;

    // Sección Deuda Histórica
    if (historicasOrdenadas.length > 0) {
      wsChart.mergeCells(r, 1, r, 4);
      const sepCell = wsChart.getCell(r, 1);
      sepCell.value = '📂  Deuda Histórica';
      sepCell.font = sepFont1;
      sepCell.fill = sepFill1;
      sepCell.alignment = { horizontal:'left', vertical:'middle', indent:1 };
      wsChart.getRow(r).height = 20;
      r++;

      historicasOrdenadas.forEach(d => {
        const cap0 = d.capOriginal ?? d.capOriginalBruto ?? d.cap;
        const int0 = d.intOriginal ?? d.inte;
        const row = wsChart.getRow(r);
        row.values = [
          d.periodo.replace(/^HIST /,'').replace(/^CONS /,''),
          Math.round(cap0),
          Math.round(int0),
          Math.round(cap0 + int0),
        ];
        [2,3,4].forEach(c => { wsChart.getCell(r, c).numFmt = numFmt; });
        r++;
      });
    }

    // Sección Período Actual
    if (pensionesOrdenadas.length > 0) {
      wsChart.mergeCells(r, 1, r, 4);
      const sepCell2 = wsChart.getCell(r, 1);
      sepCell2.value = '📅  Período Actual';
      sepCell2.font = sepFont2;
      sepCell2.fill = sepFill2;
      sepCell2.alignment = { horizontal:'left', vertical:'middle', indent:1 };
      wsChart.getRow(r).height = 20;
      r++;

      pensionesOrdenadas.forEach(d => {
        const cap0 = d.cap;
        const int0 = d.intOriginal ?? d.inte;
        const row = wsChart.getRow(r);
        row.values = [
          d.periodo.replace(/^HIST /,'').replace(/^CONS /,''),
          Math.round(cap0),
          Math.round(int0),
          Math.round(cap0 + int0),
        ];
        [2,3,4].forEach(c => { wsChart.getCell(r, c).numFmt = numFmt; });
        r++;
      });
    }
  }

  // ── Congelar fila 1-2 ──
  ws.views = [{ state:'frozen', ySplit:2 }];

  // ── Descargar ──
  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Liquidacion_Pension_' + fechaStr + '.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch(e) {
    console.error('Error al generar Excel:', e);
    alert('Error al generar el Excel: ' + e.message);
  }
}

// ── Extender saveCurrentCasoNow para sincronizar con Supabase ──
// Se ejecuta al final de export.js, cuando saveCurrentCasoNow ya existe.
(function() {
  const _orig = saveCurrentCasoNow;
  window.saveCurrentCasoNow = function() {
    _orig();
    if (typeof sbCurrentUser !== 'undefined' && sbCurrentUser &&
        typeof activeCasoId !== 'undefined' && activeCasoId &&
        typeof _deletedCasoIds !== 'undefined' && !_deletedCasoIds.has(activeCasoId) &&
        typeof queueSave === 'function') {
      queueSave(activeCasoId);
    }
  };
})();

// ── Extender crearCaso para sincronizar con Supabase ──
(function() {
  const _orig = crearCaso;
  window.crearCaso = function() {
    _orig();
    if (typeof sbCurrentUser !== 'undefined' && sbCurrentUser && typeof queueSave === 'function') {
      setTimeout(() => { if (typeof activeCasoId !== 'undefined' && activeCasoId) queueSave(activeCasoId); }, 800);
    }
  };
})();

// ══════════════════════════════════════════════════════════════════
// OCR LAV — Importación de abonos desde documento (Claude API)
// ══════════════════════════════════════════════════════════════════

let _ocrTab = 'pjud';         // 'pjud' | 'cartola'
let _ocrFile = null;          // File object
let _ocrBase64 = null;        // base64 del archivo
let _ocrMime = null;          // 'application/pdf' | 'image/jpeg' | 'image/png'
let _ocrResultados = [];      // [{ date, amount, description }]

function openOcrLav() {
  ocrReset();
  const m = document.getElementById('ocrLavModal');
  m.style.display = 'flex';
}
function closeOcrLav() {
  const m = document.getElementById('ocrLavModal');
  m.style.display = 'none';
  ocrReset();
}

function setOcrTab(tab) {
  _ocrTab = tab;
  const isPjud = tab === 'pjud';
  const btnPjud    = document.getElementById('ocrTabPjud');
  const btnCartola = document.getElementById('ocrTabCartola');
  const activeStyle  = 'background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.4);';
  const inactiveStyle = 'background:rgba(255,255,255,0.04);color:#64748b;border:1px solid rgba(255,255,255,0.08);';
  btnPjud.style.cssText    = isPjud  ? activeStyle : inactiveStyle;
  btnCartola.style.cssText = !isPjud ? activeStyle : inactiveStyle;
  document.getElementById('ocrInstruccion').textContent = isPjud
    ? 'Sube el PDF o imagen de la liquidación. La app extraerá los abonos LAV de la sección V.'
    : 'Sube la cartola bancaria. La app filtrará los movimientos del alimentante o alimentario según los datos del caso.';
}

function handleOcrDrop(e) {
  e.preventDefault();
  document.getElementById('ocrDropZone').style.background = 'rgba(16,185,129,0.04)';
  const file = e.dataTransfer.files[0];
  if (file) handleOcrFile(file);
}

function handleOcrFile(file) {
  if (!file) return;
  const allowed = ['application/pdf','image/jpeg','image/png','image/jpg'];
  if (!allowed.includes(file.type)) {
    alert('Formato no soportado. Usa PDF, JPG o PNG.');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert('El archivo supera los 10 MB.');
    return;
  }
  _ocrFile = file;
  _ocrMime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  document.getElementById('ocrFileName').textContent = '📄 ' + file.name;
  document.getElementById('ocrFileName').classList.remove('hidden');
  // FIX Bug2: deshabilitar botón hasta que FileReader.onload termine (era race condition)
  const btn = document.getElementById('btnOcrAnalizar');
  btn.disabled = true;
  btn.style.cssText = 'background:rgba(16,185,129,0.12);color:#475569;border:1px solid rgba(16,185,129,0.15);';
  const reader = new FileReader();
  reader.onload = e => {
    _ocrBase64 = e.target.result.split(',')[1];
    btn.disabled = false;
    btn.style.cssText = 'background:rgba(16,185,129,0.2);color:#10b981;border:1px solid rgba(16,185,129,0.4);';
  };
  reader.onerror = () => {
    dbg('OCR FileReader error');
    document.getElementById('ocrErrorMsg').textContent = 'No se pudo leer el archivo.';
    _ocrShowStep('ocrStepError');
  };
  reader.readAsDataURL(file);
}

function _ocrShowStep(step) {
  ['ocrStepUpload','ocrStepLoading','ocrStepError','ocrStepPreview']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
  document.getElementById(step).classList.remove('hidden');
}

function ocrReset() {
  _ocrFile = null; _ocrBase64 = null; _ocrMime = null; _ocrResultados = [];
  document.getElementById('ocrFileInput').value = '';
  document.getElementById('ocrFileName').classList.add('hidden');
  const btn = document.getElementById('btnOcrAnalizar');
  btn.disabled = true;
  btn.style.cssText = 'background:rgba(16,185,129,0.12);color:#475569;border:1px solid rgba(16,185,129,0.15);';
  _ocrShowStep('ocrStepUpload');
}

async function runOcrAnalysis() {
  if (!_ocrBase64) return;
  _ocrShowStep('ocrStepLoading');

  // Obtener nombres/rut del caso activo
  const casoMeta = getCasosIndex().find(x => x.id === activeCasoId)?.meta || {};
  const alimentante  = casoMeta.alimentante  || '';
  const rutAlim      = casoMeta.rutAlimentante || '';
  const alimentario  = casoMeta.alimentario  || '';
  const rutAlimario  = casoMeta.rutAlimentario || '';

  const isPjud = _ocrTab === 'pjud';

  // FIX Bug5: cartola requiere datos del caso — avisar si están vacíos
  if (!isPjud && !alimentante && !alimentario) {
    document.getElementById('ocrErrorMsg').textContent =
      'El caso no tiene nombre de alimentante ni alimentario en la ficha. Completa esos datos primero para que la app pueda filtrar los movimientos.';
    _ocrShowStep('ocrStepError');
    return;
  }

  // Construir prompt según tipo de documento
  const promptPjud = `Eres un asistente especializado en documentos judiciales chilenos de pensión alimenticia.
Se te entrega una liquidación del Poder Judicial de Chile (PJUD).
Debes extraer los abonos de DOS secciones:
1. "IV. Otros abonos": tabla con columnas Fecha movimiento / Tipo movimiento / Referencia / Monto UTM. El monto está en UTM, NO en pesos. Usa monto_utm en lugar de monto_pesos para estas filas.
2. "V. Abonos LAV": tabla con columnas Fecha movimiento / Tipo movimiento / Monto pesos / Monto UTM. El monto está en pesos.
Combina ambas secciones en un único array. Para cada movimiento indica de qué sección proviene.
Devuelve SOLO un JSON array (sin texto adicional, sin markdown) con este formato exacto:
[
  {"fecha":"DD-MM-YYYY","monto_pesos":150000,"monto_utm":null,"descripcion":"DEP. EN EFECTIVO SIN LIBRETA","seccion":"LAV"},
  {"fecha":"DD-MM-YYYY","monto_pesos":null,"monto_utm":2.31506,"descripcion":"Abono Depósito 04.03.2024","seccion":"otros_abonos"}
]
Reglas:
- Si el monto está en pesos (sección V): pon monto_pesos como entero, monto_utm como null.
- Si el monto está en UTM (sección IV): pon monto_utm como decimal, monto_pesos como null.
- Si el monto en pesos viene con puntos de miles (ej: 150.000), conviértelo a entero (150000).
- Si alguna sección está vacía o tiene Total 0, no incluyas sus filas.
- Usa formato de fecha DD-MM-YYYY.
- Si no hay movimientos en ninguna sección, devuelve [].`;

  const promptCartola = `Eres un asistente especializado en análisis de cartolas bancarias chilenas.
Se te entrega una cartola bancaria.
Debes identificar ÚNICAMENTE los movimientos (cargos o abonos) que correspondan a pagos de pensión alimenticia relacionados con estas personas:
- Alimentante: "${alimentante}"${rutAlim ? ` (RUT: ${rutAlim})` : ''}
- Alimentario/a: "${alimentario}"${rutAlimario ? ` (RUT: ${rutAlimario})` : ''}
Busca en la columna "Descripción" cualquier mención del nombre (parcial o completo) o RUT de cualquiera de las dos partes.
El período de la cartola está en el encabezado del documento; úsalo para completar el año de cada movimiento si solo aparece día/mes.
Para cada movimiento encontrado, extrae la fecha exacta, el monto en pesos y la descripción.
Devuelve SOLO un JSON array (sin texto adicional, sin markdown):
[{"fecha":"DD-MM-YYYY","monto_pesos":150000,"descripcion":"TEF A MARIA JOSE MUNOZ VALDES"}]
Si no encuentras movimientos relevantes, devuelve [].
Usa el formato de fecha DD-MM-YYYY. El monto debe ser entero sin puntos.`;

  const prompt = isPjud ? promptPjud : promptCartola;

  // ── OCR ENGINE ──────────────────────────────────────────────────
  // Llama a la Edge Function de Supabase (proxy seguro).
  // La API key de OpenRouter vive en los secrets de Supabase, no en el código.
  // ────────────────────────────────────────────────────────────────

  const _ocrLog = [];
  try {
    // ── Token: leer desde la clave exacta que usa el cliente Supabase ──
    _ocrLog.push('1. obteniendo token...');
    let _token = window.sbAccessToken || null;
    if (!_token) {
      try {
        const raw = localStorage.getItem('pension_utm_auth');
        if (raw) {
          const p = JSON.parse(raw);
          _token = p?.access_token || p?.session?.access_token || null;
        }
      } catch(e) {}
    }
    if (!_token) {
      try {
        const { data: _sd } = await sb.auth.getSession();
        _token = _sd?.session?.access_token || null;
      } catch(e) {}
    }
    if (!_token) throw new Error('No hay sesión activa. Recarga la app.');
    _ocrLog.push('2. token OK: ' + _token.slice(0,10) + '...');

    // ── Construir content: texto primero, imagen después (requerido por Groq) ──
    const imageContent = [];
    imageContent.push({ type: 'text', text: prompt });
    if (_ocrMime === 'application/pdf') {
      imageContent.push({ type: 'image_url', image_url: { url: `data:application/pdf;base64,${_ocrBase64}` } });
    } else {
      imageContent.push({ type: 'image_url', image_url: { url: `data:${_ocrMime};base64,${_ocrBase64}` } });
    }

    // ── Llamar proxy con timeout de 40s ──
    _ocrLog.push('3. llamando proxy...');
    const _ocrAbort = new AbortController();
    const _ocrTimeout = setTimeout(() => { _ocrAbort.abort(); }, 40000);

    let response;
    try {
      response = await fetch('https://pipfpwpkzjajgmwcdrsv.supabase.co/functions/v1/ocr-proxy', {
        method: 'POST',
        signal: _ocrAbort.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _token,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcGZwd3Bremphamdtd2NkcnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2OTE1MDcsImV4cCI6MjA5NTI2NzUwN30.cFjf2ycu6y-y6pWZMsaPcKhQ_m34I3kjsqT9-7Iz-7w'
        },
        body: JSON.stringify({
          max_tokens: 2000,
          temperature: 0,
          messages: [{ role: 'user', content: imageContent }]
        })
      });
    } catch(fetchErr) {
      clearTimeout(_ocrTimeout);
      throw new Error(fetchErr.name === 'AbortError' ? 'Timeout: el servidor tardó demasiado.' : 'Error de red: ' + fetchErr.message);
    }
    clearTimeout(_ocrTimeout);

    _ocrLog.push('4. proxy HTTP ' + response.status);
    if (!response.ok) {
      const errText = await response.text();
      _ocrLog.push('ERR body: ' + errText.slice(0,300));
      throw new Error('Proxy ' + response.status + ': ' + errText.slice(0,200));
    }
    const data = await response.json();
    _ocrLog.push('5. respuesta OK');
    const raw = data?.choices?.[0]?.message?.content || '';

    // Limpiar posibles backticks
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!Array.isArray(parsed)) throw new Error('Respuesta inesperada del modelo');
    if (parsed.length === 0) {
      document.getElementById('ocrErrorMsg').textContent =
        isPjud ? 'No se encontraron abonos LAV en el documento.'
                : 'No se encontraron movimientos del alimentante o alimentario en la cartola.';
      _ocrShowStep('ocrStepError');
      return;
    }

    _ocrResultados = parsed;
    _ocrRenderPreview(parsed);
    _ocrShowStep('ocrStepPreview');

  } catch(err) {
    dbg('OCR error: ' + err.message);
    document.getElementById('ocrErrorMsg').textContent = 'Error al procesar: ' + err.message;
    _ocrShowStep('ocrStepError');
  }
}

function _ocrRenderPreview(items) {
  const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  document.getElementById('ocrPreviewCount').textContent = items.length + (items.length === 1 ? ' movimiento' : ' movimientos');
  const container = document.getElementById('ocrPreviewList');
  container.innerHTML = items.map((item, i) => {
    const fechaNorm6 = _ocrNormalizeFecha(item.fecha) || item.fecha;
    const [dd, mm, yyyy] = fechaNorm6.split('-');
    const mIdx = parseInt(mm) - 1;
    const utmEntry = utmData.find(d => d.y === parseInt(yyyy) && d.monthIdx === mIdx);
    const utmVal = utmEntry ? utmEntry.v : null;
    let montoStr, utmStr;
    if (item.monto_pesos != null && item.monto_pesos > 0) {
      montoStr = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(item.monto_pesos);
      utmStr = utmVal ? (item.monto_pesos / utmVal).toFixed(5) + ' UTM' : '— UTM';
    } else if (item.monto_utm != null && item.monto_utm > 0) {
      utmStr = item.monto_utm.toFixed(5) + ' UTM';
      montoStr = utmVal ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Math.round(item.monto_utm * utmVal)) : '— CLP';
    } else {
      montoStr = '—'; utmStr = '—';
    }
    const seccionBadge = item.seccion === 'otros_abonos'
      ? '<span style="background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.25);" class="text-[7px] font-black px-1.5 py-0.5 rounded-full ml-1">Otro abono</span>'
      : '';
    return `<div class="flex items-center justify-between rounded-lg px-3 py-2" style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.12);">
      <div class="min-w-0 flex-1 mr-2">
        <p class="text-[9px] font-black text-white truncate flex items-center gap-1">${dd}/${mm}/${yyyy} · ${montoStr}${seccionBadge}</p>
        <p class="text-[8px] text-slate-400 truncate">${item.descripcion || ''} · ${utmStr}</p>
      </div>
      <button onclick="_ocrRemoveItem(${i})" class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors" style="background:rgba(255,255,255,0.05);">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join('');
}

function _ocrRemoveItem(i) {
  // FIX Bug3: guard against stale index (double-tap or async re-render race)
  if (i < 0 || i >= _ocrResultados.length) return;
  _ocrResultados.splice(i, 1);
  if (_ocrResultados.length === 0) { ocrReset(); return; }
  _ocrRenderPreview(_ocrResultados);
}

function _ocrNormalizeFecha(fecha) {
  // FIX Bug6: el modelo puede devolver YYYY-MM-DD o DD-MM-YYYY — normalizar a DD-MM-YYYY
  if (!fecha) return null;
  const parts = fecha.split('-');
  if (parts.length !== 3) return null;
  if (parts[0].length === 4) {
    // YYYY-MM-DD → invertir
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return fecha; // ya es DD-MM-YYYY
}
function ocrConfirmar() {
  const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  let added = 0;
  _ocrResultados.forEach(item => {
    const fechaNorm = _ocrNormalizeFecha(item.fecha);
    if (!fechaNorm) return;
    const [dd, mm, yyyy] = fechaNorm.split('-');
    const mIdx = parseInt(mm) - 1;
    const dia = parseInt(dd);
    const anio = parseInt(yyyy);
    if (!mm || !yyyy || dia < 1) return;
    const periodoLabel = mNames[mIdx] + ' ' + yyyy;
    const periodo = yyyy + '-' + mm;
    const date = `${yyyy}-${mm}-${String(dia).padStart(2,'0')}`;
    const utmEntry = utmData.find(d => d.y === anio && d.monthIdx === mIdx);
    const utmVal = utmEntry ? utmEntry.v : null;
    let amount, amountUtm;
    if (item.monto_pesos != null && item.monto_pesos > 0) {
      // Sección V LAV: monto en pesos, UTM calculada
      amount = item.monto_pesos;
      amountUtm = utmVal ? amount / utmVal : null;
    } else if (item.monto_utm != null && item.monto_utm > 0) {
      // Sección IV otros abonos: monto en UTM, pesos calculados desde UTM del mes
      amountUtm = item.monto_utm;
      amount = utmVal ? Math.round(amountUtm * utmVal) : null;
    } else {
      return; // sin monto válido
    }
    if (!amount || amount <= 0) return;
    if (item.seccion === 'otros_abonos') {
      // Sección IV "Otros abonos" → imputación Art. 1595 CC (primero intereses, luego capital)
      abonos.push({ amount, date: yyyy + '-' + mm });
      added++;
    } else {
      // Sección V "Abonos LAV" → descuento directo por depósito cuenta vista
      abonosLav.push({ date, periodo, periodoLabel, amount, utmVal, amountUtm });
      added++;
    }
  });
  if (added > 0) {
    reasignarPeriodosLav();
    renderAbonosLav();
    renderAbonosList();
    calculate();
    saveSession();
    dbg('OCR: ' + added + ' abonos importados (LAV + Art.1595)');
  }
  closeOcrLav();
}
