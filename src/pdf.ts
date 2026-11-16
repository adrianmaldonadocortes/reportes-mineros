import jsPDF from 'jspdf';
import type { Report } from './types';
import { formatDate, formatDateTime } from './utils';

export function generateReportPDF(report: Report) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = 210;
  const pageH = 297;
  const M = 15;
  const contentW = pageW - M * 2;
  let y = M;

  const addHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORME TÉCNICO DE FALLA', M, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(report.technician.company || 'Reportes Mineros', M, 19);
    const dateStr = formatDate(new Date().toISOString());
    doc.text(dateStr, pageW - M, 19, { align: 'right' });
    doc.setTextColor(30, 30, 30);
    y = 32;
  };

  const checkPage = (needed: number) => {
    if (y + needed > pageH - M - 10) {
      doc.addPage();
      addHeader();
    }
  };

  const sectionTitle = (title: string) => {
    checkPage(14);
    doc.setFillColor(59, 130, 246);
    doc.rect(M, y, contentW, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), M + 3, y + 5);
    doc.setTextColor(30, 30, 30);
    y += 10;
  };

  const field = (label: string, value: string) => {
    if (!value) return;
    checkPage(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(label + ':', M, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, contentW - 30);
    doc.text(lines, M + 30, y);
    y += Math.max(5, lines.length * 4.5);
  };

  const paragraph = (text: string) => {
    if (!text) return;
    checkPage(8);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentW);
    doc.text(lines, M, y);
    y += lines.length * 4.5 + 2;
  };

  addHeader();

  // Equipment
  sectionTitle('Datos del Equipo');
  field('N° Interno', report.equipment.internalNumber);
  field('Nombre', report.equipment.name);
  field('Tipo', report.equipment.type);
  field('Marca', report.equipment.brand);
  field('Modelo', report.equipment.model);
  field('N° Serie', report.equipment.serialNumber);
  field('Área', report.equipment.area);
  y += 3;

  // Detention
  sectionTitle('Detención');
  field('Inicio', formatDateTime(report.stopDate));
  field('Término', formatDateTime(report.endDate));
  field('Motivo', report.motive);
  if (report.generalDescription) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Descripción general:', M, y);
    y += 5;
    paragraph(report.generalDescription);
  }
  y += 3;

  // Failures
  report.failures.forEach((f, i) => {
    sectionTitle(`Falla ${i + 1}`);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Descripción:', M, y); y += 4;
    paragraph(f.description);
    if (f.diagnosis) { doc.setFont('helvetica', 'bold'); doc.text('Diagnóstico:', M, y); y += 4; paragraph(f.diagnosis); }
    if (f.work) { doc.setFont('helvetica', 'bold'); doc.text('Trabajo realizado:', M, y); y += 4; paragraph(f.work); }
    if (f.parts) { doc.setFont('helvetica', 'bold'); doc.text('Repuestos:', M, y); y += 4; paragraph(f.parts); }
    y += 3;
  });

  // Photos
  if (report.photos.length) {
    sectionTitle('Fotografías');
    const colW = (contentW - 5) / 2;
    let x = M;
    let rowY = y;
    report.photos.forEach((p, idx) => {
      const imgW = colW;
      const imgH = 55;
      if (x + imgW > M + contentW + 1) {
        x = M;
        rowY += imgH + 12;
      }
      if (rowY + imgH + 12 > pageH - M - 10) {
        doc.addPage();
        addHeader();
        rowY = y;
        x = M;
      }
      try {
        doc.addImage(p.dataUrl, 'JPEG', x, rowY, imgW, imgH, undefined, 'FAST');
        doc.setDrawColor(200, 200, 200);
        doc.rect(x, rowY, imgW, imgH);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        const desc = doc.splitTextToSize(p.description || `Foto ${idx + 1}`, imgW);
        doc.text(desc.slice(0, 2), x, rowY + imgH + 3);
      } catch { /* imagen inválida */ }
      x += colW + 5;
    });
    y = rowY + 55 + 15;
  }

  // Technician
  sectionTitle('Datos del Técnico');
  field('Nombre', report.technician.name);
  field('Cargo', report.technician.position);
  field('Empresa', report.technician.company);
  field('Área', report.technician.area);
  field('Turno', report.technician.shift);
  y += 5;

  checkPage(10);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Elaborado: ${formatDateTime(new Date().toISOString())}`, M, y);

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  const filename = `Informe_${report.equipment.internalNumber || 'Equipo'}_${formatDate(report.stopDate).replace(/\//g, '-')}.pdf`;
  doc.save(filename);
}
