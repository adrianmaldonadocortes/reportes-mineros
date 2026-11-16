import { jsPDF } from 'jspdf';
import type { FieldServiceRecord } from './types';

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [100, 116, 139];
const PALE: [number, number, number] = [241, 245, 249];

const displayTitle = (title: string) => title
  .replace(/^Turno_([AB])_(\d{2})(\d{2})$/i, 'Turno $1 · $2:$3')
  .replace(/_/g, ' ');

export function generateFieldServiceDailyPDF(records: FieldServiceRecord[], date: string, title = 'Registro de atenciones') {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const M = 14;
  const contentW = pageW - M * 2;
  const [year, month, day] = date.split('-');
  const prettyDate = `${day}-${month}-${year}`;
  let y = 0;

  const header = (page: number) => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 38, 'F');
    doc.setFillColor(249, 115, 22); doc.rect(0, 38, pageW, 1.5, 'F');
    doc.setFillColor(...BLUE); doc.roundedRect(M, 8, 14, 14, 3, 3, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('RM', M + 3.2, 17);
    doc.setFontSize(16); doc.text('ATENCIONES EN TERRENO', M + 20, 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(203, 213, 225);
    doc.text(displayTitle(title), M + 20, 21);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFontSize(9);
    doc.text(`FECHA DE INICIO  ${prettyDate}`, M + 20, 29);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(203, 213, 225);
    doc.text(`${records.length} atención${records.length === 1 ? '' : 'es'}`, pageW - M, 29, { align: 'right' });
    y = 47;
    if (page > 1) y += 1;
  };

  const footer = () => {
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc.setDrawColor(226, 232, 240); doc.line(M, 284, pageW - M, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('Reporte Mineros · Registro de turno', M, 290);
      doc.text(`Página ${page} de ${pages}`, pageW - M, 290, { align: 'right' });
    }
  };

  const addPageIfNeeded = (height: number) => {
    if (y + height > 278) { doc.addPage(); header(doc.getNumberOfPages()); }
  };

  header(1);
  if (!records.length) {
    doc.setFillColor(...PALE); doc.roundedRect(M, y, contentW, 22, 3, 3, 'F');
    doc.setTextColor(...MUTED); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('No hay atenciones registradas para este período.', M + 6, y + 13);
  }

  records.forEach((record, index) => {
    const equipment = record.equipment;
    const failureLines = doc.splitTextToSize(record.failure || 'Sin descripción', contentW - 12);
    const workText = record.status === 'completed' ? (record.workDone || 'Sin comentario de trabajo.') : 'Pendiente de entrega.';
    const workLines = doc.splitTextToSize(workText, contentW - 12);
    const height = 54 + failureLines.length * 4.4 + workLines.length * 4.4;
    addPageIfNeeded(height);

    doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 240); doc.setLineWidth(.35);
    doc.roundedRect(M, y, contentW, height, 3, 3, 'FD');
    doc.setFillColor(...BLUE); doc.roundedRect(M, y, 2.5, height, 1.2, 1.2, 'F');

    doc.setFillColor(239, 246, 255); doc.roundedRect(M + 8, y + 7, 28, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 78, 216);
    doc.text(equipment.internalNumber || 'Equipo', M + 10, y + 13.5);
    doc.setFontSize(11); doc.setTextColor(...NAVY);
    doc.text(doc.splitTextToSize(`${equipment.type}${equipment.name ? ` · ${equipment.name}` : ''}`, contentW - 76), M + 41, y + 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`${equipment.fleetName || 'Sin flota'}${equipment.brand || equipment.model ? ` · ${[equipment.brand, equipment.model].filter(Boolean).join(' ')}` : ''}`, M + 41, y + 17);

    let lineY = y + 25;
    const smallLabel = (label: string, text: string, maxWidth = contentW - 34) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(label.toUpperCase(), M + 8, lineY);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(text, maxWidth); doc.text(lines, M + 33, lineY); lineY += Math.max(5, lines.length * 4.2);
    };
    smallLabel('Aviso', record.reportedAt);
    smallLabel('Falla', record.failure || 'Sin descripción');
    smallLabel('Trabajo', workText);

    const delivered = record.status === 'completed';
    const stateText = delivered ? 'ENTREGADO' : 'FUERA DE SERVICIO';
    const stateColor: [number, number, number] = delivered ? [22, 163, 74] : [220, 38, 38];
    const stateFill: [number, number, number] = delivered ? [240, 253, 244] : [254, 242, 242];
    lineY += 1;
    doc.setDrawColor(226, 232, 240); doc.line(M + 8, lineY - 3, pageW - M - 8, lineY - 3);
    doc.setFillColor(...stateFill); doc.roundedRect(M + 8, lineY, 52, 8, 4, 4, 'F');
    doc.setFillColor(...stateColor); doc.circle(M + 12, lineY + 4, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...stateColor); doc.text(stateText, M + 16, lineY + 5.2);
    if (delivered && record.deliveredAt) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(`Entrega ${record.deliveredAt}`, M + 65, lineY + 5.2);
    }
    y += height + 5;
  });

  footer();
  doc.save(`Atenciones_terreno_${title.toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, '_')}_${date}.pdf`);
}
