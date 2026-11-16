import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="home">
      <h1 className="home-title">Reportes Mineros</h1>
      <p className="home-sub">Registro de fallas · Informes PDF · Indisponibilidad</p>
      <div className="grid grid-2">
        <Link to="/informes" className="tile">
          <div className="tile-icon">📄</div>
          <div className="tile-title">Informes técnicos</div>
          <div className="tile-sub">Crear y gestionar informes</div>
        </Link>
        <Link to="/equipos" className="tile">
          <div className="tile-icon">🚜</div>
          <div className="tile-title">Mis equipos</div>
          <div className="tile-sub">Flota y equipos</div>
        </Link>
        <Link to="/calculadora" className="tile">
          <div className="tile-icon">📊</div>
          <div className="tile-title">Calculadora</div>
          <div className="tile-sub">Indisponibilidad</div>
        </Link>
        <Link to="/historial" className="tile">
          <div className="tile-icon">🗂️</div>
          <div className="tile-title">Historial</div>
          <div className="tile-sub">Consultar registros</div>
        </Link>
        <Link to="/configuracion" className="tile tile-wide">
          <div className="tile-icon">⚙️</div>
          <div className="tile-title">Configuración y respaldos</div>
          <div className="tile-sub">Datos del técnico · Exportar / Restaurar</div>
        </Link>
      </div>
    </div>
  );
}
