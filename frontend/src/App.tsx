import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Landing from './pages/Landing'
import LoginPage from './auth/LoginPage'
import RotaProtegida from './auth/RotaProtegida'

/**
 * Landing e login carregam direto — são a porta de entrada e precisam ser leves.
 * O painel (e o recharts, que é pesado) só desce quando o usuário entra.
 */
const Layout = lazy(() => import('./components/Layout'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Checklist = lazy(() => import('./pages/Checklist'))
const Equipamentos = lazy(() => import('./pages/Equipamentos'))
const Estoque = lazy(() => import('./pages/Estoque'))
const Pendencias = lazy(() => import('./pages/Pendencias'))
const Relatorios = lazy(() => import('./pages/Relatorios'))
const Configuracoes = lazy(() => import('./pages/Configuracoes'))
const Empresas = lazy(() => import('./pages/Empresas'))

/**
 * O painel antigo vivia na raiz e tinha Mapa e Meu Almoxarifado.
 * Mantemos os caminhos funcionando para não quebrar links já compartilhados.
 */
const rotasLegadas: Record<string, string> = {
  '/dashboard': '/app',
  '/mapa': '/app',
  '/almoxarifado': '/app/estoque',
  '/impressoras': '/app/equipamentos',
  '/checklist': '/app/checklist',
  '/estoque': '/app/estoque',
  '/pendencias': '/app/pendencias',
  '/relatorios': '/app/relatorios',
  '/configuracoes': '/app/configuracoes',
}

function Carregando() {
  return <div className="tela-carregando"><Loader2 size={26} className="girando" /><span>Carregando…</span></div>
}

export default function App() {
  return (
    <Suspense fallback={<Carregando />}>
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

        {Object.entries(rotasLegadas).map(([antiga, nova]) => (
          <Route key={antiga} path={antiga} element={<Navigate to={nova} replace />} />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
