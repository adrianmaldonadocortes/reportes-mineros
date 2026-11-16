import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import Home from './pages/Home';
import EquipmentPage from './pages/EquipmentPage';
import FleetsPage from './pages/FleetsPage';
import ReportsPage from './pages/ReportsPage';
import ReportFormPage from './pages/ReportFormPage';
import CalculatorPage from './pages/CalculatorPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import FieldServicePage from './pages/FieldServicePage';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  return (
    <div className="app">
      {!isHome && (
        <header className="topbar">
          <button className="back" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')}>
            ‹ Volver
          </button>
          <span className="topbar-title">Reportes Mineros</span>
          <span style={{ width: 60 }} />
        </header>
      )}
      <main className={isHome ? '' : 'main'}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/equipos" element={<EquipmentPage />} />
          <Route path="/atenciones" element={<FieldServicePage />} />
          <Route path="/flotas" element={<FleetsPage />} />
          <Route path="/informes" element={<ReportsPage />} />
          <Route path="/informes/:id" element={<ReportFormPage />} />
          <Route path="/informes/nuevo" element={<ReportFormPage />} />
          <Route path="/calculadora" element={<CalculatorPage />} />
          <Route path="/historial" element={<HistoryPage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
