import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Layout from './components/Layout'
import LoginPage from './auth/LoginPage'
import RotaProtegida from './auth/RotaProtegida'
import Dashboard from './pages/Dashboard'
import Checklist from './pages/Checklist'
import Equipamentos from './pages/Equipamentos'
import Estoque from './pages/Estoque'
import Pendencias from './pages/Pendencias'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import Empresas from './pages/Empresas'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<RotaProtegida><Layout /></RotaProtegida>}>
        <Route index element={<Dashboard />} />
        <Route path="checklist" element={<Checklist />} />
        <Route path="equipamentos" element={<Equipamentos />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="pendencias" element={<Pendencias />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="empresas" element={<Empresas />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
