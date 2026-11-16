import { jsPDF } from 'jspdf';
import type { FieldServiceRecord } from './types';

export function generateFieldServiceDailyPDF(records: FieldServiceRecord[], date: string) {
  const doc = new jsPDF();
  const [year, month, day] = date.split('-');
  const prettyDate = `${day}-${month}-${year}`;
  doc.setFontSize(18);
  doc.text('Atenciones en terreno', 14, 18);
  doc.setFontSize(11);
  doc.text(`Registro diario · ${prettyDate}`, 14, 26);
  doc.text(`Atenciones: ${records.length}`, 14, 33);
  let y = 43;
  records.forEach((record, index) => {
    const equipment = record.equipment;
    const lines = [
      `${index + 1}. ${equipment.internalNumber} · ${equipment.type}${equipment.name ? ` · ${equipment.name}` : ''}`,
      `Flota: ${equipment.fleetName || 'Sin flota'}${equipment.brand || equipment.model ? ` · ${[equipment.brand, equipment.model].filter(Boolean).join(' ')}` : ''}`,
      `Aviso: ${record.reportedAt} · Estado: ${record.status === 'open' ? 'Pendiente' : 'Entregado'}`,
      `Falla: ${record.failure}`,
      ...(record.status === 'completed' ? [`Entrega: ${record.deliveredAt || '—'}`, `Trabajo realizado: ${record.workDone || 'Sin comentario'}`] : ['Equipo aún detenido'])
    ];
    const wrapped = lines.flatMap(line => doc.splitTextToSize(line, 180));
    const blockHeight = wrapped.length * 5 + 8;
    if (y + blockHeight > 278) { doc.addPage(); y = 18; }
    doc.setDrawColor(210);
    doc.roundedRect(12, y - 5, 186, blockHeight, 2, 2);
    doc.text(wrapped, 16, y);
    y += blockHeight + 5;
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setFontSize(9);
    doc.text(`Página ${page} de ${pages}`, 196, 290, { align: 'right' });
  }
  doc.save(`Atenciones_terreno_${date}.pdf`);
}
