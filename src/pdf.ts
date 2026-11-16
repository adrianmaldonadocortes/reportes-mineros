import jsPDF from 'jspdf';
import type { Report } from './types';
import { formatDate, formatDateTime } from './utils';

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [37, 99, 235];
const MUTED: [number, number, number] = [100, 116, 139];
const INK: [number, number, number] = [30, 41, 59];

export function generateReportPDF(report: Report) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const pageH = 297;
  const M = 15;
  const contentW = pageW - M * 2;
  let y = 0;

  const addHeader = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, pageW, 34, 'F');
    doc.setFillColor(249, 115, 22); doc.rect(0, 34, pageW, 1.4, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('INFORME TÉCNICO', M, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(203, 213, 225);
    doc.text('REPORTE DE FALLA Y MANTENIMIENTO', M, 21);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    doc.text(report.technician.company || 'REPORTES MINEROS', M, 28);
    const doneColor: [number, number, number] = report.completed ? [34, 197, 94] : [245, 158, 11];
    const doneFill: [number, number, number] = report.completed ? [22, 101, 52] : [120, 53, 15];
    doc.setFillColor(...doneFill); doc.roundedRect(pageW - M - 38, 8, 38, 8, 4, 4, 'F');
    doc.setFillColor(...doneColor); doc.circle(pageW - M - 33, 12, 1.4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text(report.completed ? 'COMPLETADO' : 'EN PROCESO', pageW - M - 29, 14.4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(203, 213, 225);
    doc.text(formatDate(new Date().toISOString()), pageW - M, 25, { align: 'right' });
    y = 43;
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 19) { doc.addPage(); addHeader(); }
  };

  const sectionTitle = (title: string) => {
    checkPage(13);
    doc.setFillColor(239, 246, 255); doc.roundedRect(M, y, contentW, 8, 1.6, 1.6, 'F');
    doc.setFillColor(...BLUE); doc.roundedRect(M, y, 2, 8, 1, 1, 'F');
    doc.setTextColor(...NAVY); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text(title.toLocaleUpperCase('es'), M + 5, y + 5.4);
    y += 12;
  };

  const field = (label: string, value: string) => {
    if (!value) return;
    const lines = doc.splitTextToSize(value, contentW - 40);
    const height = Math.max(7, lines.length * 4.4 + 2);
    checkPage(height);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...MUTED);
    doc.text(label.toLocaleUpperCase('es'), M + 1, y + 3.5);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
    doc.text(lines, M + 40, y + 3.5);
    doc.setDrawColor(226, 232, 240); doc.setLineWidth(.25); doc.line(M, y + height, M + contentW, y + height);
    y += height + 1;
  };

  const paragraph = (text: string) => {
    if (!text) return;
    const lines = doc.splitTextToSize(text, contentW - 2);
    const height = lines.length * 4.5 + 3;
    checkPage(height);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
    doc.text(lines, M + 1, y + 3);
    y += height;
  };

  addHeader();

  // Equipment snapshot panel
  const equipmentName = [report.equipment.type, report.equipment.brand, report.equipment.model].filter(Boolean).join(' · ');
  doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(M, y, contentW, 22, 3, 3, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...MUTED); doc.text('EQUIPO', M + 6, y + 7);
  doc.setFontSize(15); doc.setTextColor(...NAVY); doc.text(report.equipment.internalNumber || 'Sin número interno', M + 6, y + 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text(doc.splitTextToSize(equipmentName || report.equipment.name || 'Equipo minero', 95), M + contentW - 6, y + 10, { align: 'right' });
  y += 28;

  sectionTitle('Datos del equipo');
  field('Nombre', report.equipment.name);
  field('Tipo', report.equipment.type);
  field('Marca / modelo', [report.equipment.brand, report.equipment.model].filter(Boolean).join(' / '));
  field('N° de serie', report.equipment.serialNumber);
  field('Área / sector', report.equipment.area);
  y += 3;

  sectionTitle('Detención');
  field('Inicio', formatDateTime(report.stopDate));
  field('Término', formatDateTime(report.endDate));
  field('Motivo', report.motive);
  if (report.generalDescription) {
    checkPage(12); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text('DESCRIPCIÓN GENERAL', M + 1, y + 3.5); y += 6;
    paragraph(report.generalDescription);
  }
  y += 3;

  report.failures.forEach((failure, index) => {
    sectionTitle(`Falla ${String(index + 1).padStart(2, '0')}`);
    const items: Array<[string, string]> = [['Descripción', failure.description], ['Diagnóstico', failure.diagnosis], ['Trabajo realizado', failure.work], ['Repuestos', failure.parts]];
    for (const [label, value] of items) {
      if (!value) continue;
      checkPage(11); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
      doc.text(label.toLocaleUpperCase('es'), M + 1, y + 3.5); y += 5;
      paragraph(value);
    }
    y += 3;
  });

  if (report.photos.length) {
    sectionTitle('Registro fotográfico');
    const colW = (contentW - 5) / 2;
    let x = M;
    let rowY = y;
    let rowHeight = 0;
    report.photos.forEach((photo, index) => {
      const imgW = colW;
      const imgH = 55;
      if (x + imgW > M + contentW + 1) { x = M; rowY += rowHeight + 10; rowHeight = 0; }
      if (rowY + imgH + 14 > pageH - 19) { doc.addPage(); addHeader(); rowY = y; x = M; rowHeight = 0; }
      try {
        doc.setDrawColor(203, 213, 225); doc.roundedRect(x - 1, rowY - 1, imgW + 2, imgH + 10, 2, 2, 'S');
        doc.addImage(photo.dataUrl, 'JPEG', x, rowY, imgW, imgH, undefined, 'FAST');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
        doc.text(doc.splitTextToSize(photo.description || `Fotografía ${index + 1}`, imgW).slice(0, 2), x, rowY + imgH + 4);
      } catch { /* imagen inválida */ }
      x += colW + 5;
      rowHeight = Math.max(rowHeight, imgH + 13);
    });
    y = rowY + rowHeight + 3;
  }

  sectionTitle('Datos del técnico');
  field('Nombre', report.technician.name);
  field('Cargo', report.technician.position);
  field('Empresa', report.technician.company);
  field('Área', report.technician.area);
  field('Turno', report.technician.shift);

  checkPage(18);
  const statusColor: [number, number, number] = report.completed ? [22, 163, 74] : [217, 119, 6];
  const statusBg: [number, number, number] = report.completed ? [240, 253, 244] : [255, 251, 235];
  doc.setFillColor(...statusBg); doc.roundedRect(M, y + 2, contentW, 10, 2, 2, 'F');
  doc.setFillColor(...statusColor); doc.circle(M + 6, y + 7, 1.7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...statusColor);
  doc.text(`ESTADO DEL INFORME: ${report.completed ? 'COMPLETADO' : 'EN PROCESO'}`, M + 11, y + 9.5);

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240); doc.line(M, pageH - 14, pageW - M, pageH - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUTED);
    doc.text(`Emitido ${formatDateTime(new Date().toISOString())}`, M, pageH - 8);
    doc.text(`Página ${i} de ${total}`, pageW - M, pageH - 8, { align: 'right' });
  }

  const filename = `Informe_${report.equipment.internalNumber || 'Equipo'}_${formatDate(report.stopDate).replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}
