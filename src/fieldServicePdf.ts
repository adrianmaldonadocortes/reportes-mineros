import { jsPDF } from 'jspdf';
import type { FieldServiceRecord } from './types';

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [51, 65, 85];

const displayTitle = (title: string) => title
  .replace(/^Turno_([AB])_(\d{2})(\d{2})$/i, 'Turno $1 - $2:$3')
  .replace(/_/g, ' ');

export function generateFieldServiceDailyPDF(records: FieldServiceRecord[], date: string, title = 'Registro de atenciones') {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const M = 14;
  const contentW = pageW - M * 2;
  const [year, month, day] = date.split('-');
  const prettyDate = `${day}-${month}-${year}`;
  let y = 0;

  const header = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 31, 'F');
    doc.setFillColor(249, 115, 22); doc.rect(0, 31, pageW, 1.2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(15);
    doc.text('ATENCIONES EN TERRENO', M, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(203, 213, 225);
    doc.text(displayTitle(title), M, 17);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    doc.text(`FECHA DE INICIO  ${prettyDate}`, M, 24);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(203, 213, 225);
    doc.text(`${records.length} atencion${records.length === 1 ? '' : 'es'}`, pageW - M, 24, { align: 'right' });
    y = 38;
  };
  const addPageIfNeeded = (height: number) => {
    if (y + height > 279) { doc.addPage(); header(); }
  };
  header();
  if (!records.length) {
    doc.setFillColor(241, 245, 249); doc.roundedRect(M, y, contentW, 18, 2, 2, 'F');
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('No hay atenciones registradas para este periodo.', M + 5, y + 11);
  }

  records.forEach(record => {
    const equipment = record.equipment;
    const failureLines = doc.splitTextToSize(record.failure || 'Sin descripcion', contentW - 32);
    const workText = record.status === 'completed' ? (record.workDone || 'Sin comentario de trabajo.') : 'Pendiente de entrega.';
    const workLines = doc.splitTextToSize(workText, contentW - 32);
    const height = 31 + (failureLines.length + workLines.length) * 3.8;
    addPageIfNeeded(height);

    doc.setDrawColor(220, 226, 234); doc.setLineWidth(.25);
    doc.roundedRect(M, y, contentW, height, 2, 2, 'S');
    doc.setFillColor(...BLUE); doc.rect(M, y + 2, .8, height - 4, 'F');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
    doc.text(equipment.internalNumber || 'Equipo', M + 5, y + 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize([equipment.type, equipment.name].filter(Boolean).join(' - '), contentW - 45), M + 38, y + 7);
    doc.setFontSize(7); doc.setTextColor(...MUTED);
    const secondary = [equipment.fleetName || 'Sin flota', equipment.brand, equipment.model].filter(Boolean).join(' | ');
    doc.text(doc.splitTextToSize(secondary, contentW - 12), M + 5, y + 11.5);

    let lineY = y + 16;
    const compactLine = (label: string, lines: string[]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(...MUTED);
      doc.text(label.toUpperCase(), M + 5, lineY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.7); doc.setTextColor(...INK);
      doc.text(lines, M + 28, lineY);
      lineY += Math.max(3.8, lines.length * 3.8);
    };
    compactLine('Aviso', [record.reportedAt]);
    compactLine('Falla', failureLines);
    compactLine('Trabajo', workLines);

    const delivered = record.status === 'completed';
    const stateText = delivered ? 'ENTREGADO' : 'FUERA DE SERVICIO';
    const stateColor: [number, number, number] = delivered ? [22, 140, 65] : [200, 45, 45];
    const stateFill: [number, number, number] = delivered ? [237, 249, 240] : [253, 239, 239];
    lineY += 1;
    doc.setFillColor(...stateFill); doc.roundedRect(M + 5, lineY, 45, 5.5, 2.75, 2.75, 'F');
    doc.setFillColor(...stateColor); doc.circle(M + 8, lineY + 2.75, 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(...stateColor);
    doc.text(stateText, M + 11, lineY + 3.8);
    if (delivered && record.deliveredAt) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(`Entrega ${record.deliveredAt}`, M + 55, lineY + 3.8);
    }
    y += height + 2.5;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setDrawColor(226, 232, 240); doc.line(M, 285, pageW - M, 285);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text('Reportes Mineros - Registro de turno', M, 290);
    doc.text(`Pagina ${page} de ${pages}`, pageW - M, 290, { align: 'right' });
  }
  doc.save(`Atenciones_terreno_${title.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '_')}_${date}.pdf`);
}
