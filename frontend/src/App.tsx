import {
  BarChart3, Boxes, ClipboardCheck, LayoutDashboard, Map, PackageOpen,
  Printer, Settings, TriangleAlert,
} from 'lucide-react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

const navigation = [
  ['Dashboard', '/', LayoutDashboard],
  ['Mapa', '/mapa', Map],
  ['Checklist', '/checklist', ClipboardCheck],
  ['Impressoras', '/impressoras', Printer],
  ['Estoque Geral', '/estoque', Boxes],
  ['Meu Almoxarifado', '/almoxarifado', PackageOpen],
  ['Pendências', '/pendencias', TriangleAlert],
  ['Relatórios', '/relatorios', BarChart3],
  ['Configurações', '/configuracoes', Settings],
] as const

const cards = [
  ['Preventivas realizadas', '0', '0 no mês anterior'],
  ['Razão P/C', '0', '0 corretivas'],
  ['Pendências abertas', '0', 'SLA médio: 0 dias'],
  ['Baixas no período', '0', 'Consumo registrado'],
]

function Placeholder({ title }: { title: string }) {
  return <section><h1>{title}</h1><div className="empty">Funcionalidade em desenvolvimento — disponível em breve.</div></section>
}

function Dashboard() {
  return (
    <section>
      <div className="title-row"><div><h1>Dashboard</h1><p>Paranaguá - PR • período atual</p></div></div>
      <div className="cards">{cards.map(([label, value, detail]) => (
        <article className="card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>
      ))}</div>
      <div className="dashboard-grid">
        <article className="panel"><h2>Preventivas × Corretivas</h2><div className="chart-placeholder">Dados do período</div></article>
        <article className="panel"><h2>Evolução de checklists</h2><div className="chart-placeholder">Dados do período</div></article>
        <article className="panel"><h2>Distribuição por setor</h2><div className="empty compact">Sem dados para exibir</div></article>
        <article className="panel"><h2>Top 5 materiais</h2><div className="empty compact">Nenhum material utilizado</div></article>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <div className="shell">
      <aside>
        <div className="brand"><div className="brand-mark">M</div><div><b>Maintenex</b><small>Gestão de manutenção</small></div></div>
        <nav>{navigation.map(([label, path, Icon]) => (
          <NavLink key={path} to={path} end={path === '/'}><Icon size={19}/><span>{label}</span></NavLink>
        ))}</nav>
      </aside>
      <main>
        <header><select aria-label="Cidade"><option>Paranaguá - PR</option></select><select aria-label="Setor"><option>Todos os setores</option></select><div className="profile">YC</div></header>
        <div className="content"><Routes>
          <Route path="/" element={<Dashboard/>}/>
          {navigation.slice(1).map(([label, path]) => <Route key={path} path={path} element={<Placeholder title={label}/>}/>)}
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes></div>
      </main>
    </div>
  )
}
