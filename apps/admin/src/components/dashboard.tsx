"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const asset = (name: string) => `/figma-dashboard/${name}`;

interface NavItem { label: string; icon: string; href: string }
interface Metric { label: string; value: number; icon: string; change?: string }
interface Session { time: string; name: string; instructor: string; unit: string }
interface Attendance { day: string; value: number; weekend?: boolean }
interface Activity { message: string; time: string; positive?: boolean }

const navItems: NavItem[] = [
  { label: "Visão geral", icon: "layout-grid.svg", href: "/" },
  { label: "Aulas", icon: "book-open.svg", href: "/aulas" },
  { label: "Alunos", icon: "users.svg", href: "/alunos" },
  { label: "Professores", icon: "graduation-cap.svg", href: "/professores" },
  { label: "Unidades", icon: "map-pin.svg", href: "/unidades" },
  { label: "Academia", icon: "shield.svg", href: "/academia" },
  { label: "Equipe", icon: "users-round.svg", href: "/equipe" },
];

// Mock dashboard content from the approved Figma screen. Replace with aggregate Convex queries.
const metrics: Metric[] = [
  { label: "Total de Alunos", value: 248, change: "+4.2%", icon: "metric-users.svg" },
  { label: "Professores", value: 12, icon: "metric-graduation.svg" },
  { label: "Presenças Hoje", value: 89, change: "+12%", icon: "user-check.svg" },
  { label: "Unidades", value: 4, icon: "metric-map-pin.svg" },
];

const sessions: Session[] = [
  { time: "07:00 - 08:00", name: "Fundamentals GI", instructor: "Prof. Carlos Silva", unit: "Centro" },
  { time: "09:00 - 10:15", name: "Competition NOGI", instructor: "Prof. Thiago Alves", unit: "Centro" },
  { time: "12:00 - 13:00", name: "Open Mat (Livre)", instructor: "Monitor Ricardo", unit: "Zona Sul" },
  { time: "18:00 - 19:00", name: "Kids Jiu-Jitsu", instructor: "Profª. Ana Costa", unit: "Centro" },
  { time: "19:30 - 21:00", name: "Avançados com Kimono", instructor: "Prof. Carlos Silva", unit: "Barra" },
];

const attendance: Attendance[] = [
  { day: "Seg", value: 65 }, { day: "Ter", value: 89 }, { day: "Qua", value: 72 },
  { day: "Qui", value: 81 }, { day: "Sex", value: 50 },
  { day: "Sáb", value: 34, weekend: true }, { day: "Dom", value: 12, weekend: true },
];

const activities: Activity[] = [
  { message: "Aluno Lucas Vasconcelos realizou check-in na aula de 'Fundamentals GI'.", time: "Há 10 min", positive: true },
  { message: "Nova presença confirmada: Felipe Neves na aula 'Iniciantes NOGI' - Unidade Barra.", time: "Há 42 min" },
  { message: "Professor Carlos Silva alterou o horário da sessão de 'Avançados com Kimono' das 19h30 para as 19h45.", time: "Há 1 hora" },
  { message: "Novo aluno cadastrado: Gabriel de Souza (Matrícula #2884).", time: "Há 3 horas" },
];

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return <Image src={asset(name)} alt="" width={size} height={size} aria-hidden />;
}

function Sidebar({ open, close }: { open: boolean; close: () => void }) {
  const pathname = usePathname();
  return <>
    {open && <button className="sidebar-backdrop" aria-label="Fechar menu" onClick={close} />}
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Navegação principal">
      <div className="brand">MY<span>BJJ</span>ACADEMY</div>
      <button className="academy-selector" type="button">
        <span className="academy-avatar">M</span><span><strong>Matriz Centro</strong><small>Admin Geral</small></span>
        <Icon name="chevron-down.svg" size={12} />
      </button>
      <nav className="nav-list">
        {navItems.map(item => <a className={pathname === item.href ? "active" : ""} href={item.href} key={item.label} onClick={close}>
          <Icon name={item.icon} /><span>{item.label}</span>
        </a>)}
      </nav>
      <div className="sidebar-profile">
        <Image src={asset("avatar.png")} alt="Prof. Carlos Silva" width={32} height={32} />
        <span><strong>Prof. Carlos Silva</strong><small>Faixa Preta 2º Grau</small></span>
      </div>
    </aside>
  </>;
}

function MetricCard({ metric }: { metric: Metric }) {
  return <article className="metric-card"><div className="metric-heading"><span>{metric.label}</span><span className="metric-icon"><Icon name={metric.icon} size={14} /></span></div>
    <div className="metric-value"><strong>{metric.value}</strong>{metric.change && <span>{metric.change}</span>}</div></article>;
}

function ScheduleItem({ session }: { session: Session }) {
  return <button className="schedule-item" type="button" aria-label={`${session.name}, ${session.time}, ${session.unit}`}>
    <span className="session-main"><span className="time-badge">{session.time}</span><span className="session-copy"><strong>{session.name}</strong><small>{session.instructor}</small></span></span>
    <span className="session-end"><span className="unit-badge">{session.unit}</span><Icon name="chevron-right.svg" size={14} /></span>
  </button>;
}

function AttendanceChart() {
  return <section className="panel attendance-panel"><header><h2>Presenças na Semana</h2><span title="Total diário de presenças"><Icon name="info.svg" size={14} /></span></header>
    <div className="bar-chart" role="img" aria-label="Presenças: Segunda 65, Terça 89, Quarta 72, Quinta 81, Sexta 50, Sábado 34, Domingo 12">
      {attendance.map(item => <div className="bar-column" key={item.day} title={`${item.day}: ${item.value} alunos`}><span className={item.weekend ? "bar weekend" : "bar"} style={{ height: item.value }} /><strong>{item.day}</strong></div>)}
    </div>
    <div className="chart-summary"><Icon name="check-circle.svg" size={16} /><span>Pico de presenças registrado na <strong>Terça-feira</strong> (89 alunos).</span></div>
  </section>;
}

export function AdminShell({ title, breadcrumb = title, children, actions, showActions = false }: { title: string; breadcrumb?: string; children?: React.ReactNode; actions?: React.ReactNode; showActions?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell">
    <Sidebar open={menuOpen} close={() => setMenuOpen(false)} />
    <div className="main-column">
      <header className="topbar"><div className="topbar-title"><button className="menu-button" type="button" aria-label="Abrir menu" onClick={() => setMenuOpen(true)}>☰</button><div><p>Painel&nbsp; / &nbsp;{breadcrumb}</p><h1>{title}</h1></div></div>
        <div className="topbar-actions">{actions}{showActions && <><button className="button secondary" type="button"><Icon name="user-plus.svg" size={12} />Adicionar Aluno</button><button className="button primary" type="button"><Icon name="plus.svg" size={12} />Criar Aula</button><span className="divider"/></>}<button className="icon-button" aria-label="Notificações" type="button"><Icon name="bell.svg" size={14} /></button></div>
      </header>
      {children}
    </div>
  </div>;
}

export function BlankAdminPage({ title }: { title: string }) {
  return <AdminShell title={title}><main className="blank-page" aria-label={`Conteúdo de ${title}`} /></AdminShell>;
}

export function Dashboard() {
  return <AdminShell title="Visão Geral" showActions>
      <main className="dashboard-content">
        <section className="metrics-grid" aria-label="Resumo da academia">{metrics.map(metric => <MetricCard metric={metric} key={metric.label} />)}</section>
        <div className="dashboard-grid">
          <section className="panel schedule-panel"><header><h2>Agenda de Hoje</h2><a href="#calendario">Ver calendário completo</a></header><div className="schedule-list">{sessions.map(session => <ScheduleItem session={session} key={session.time} />)}</div></section>
          <AttendanceChart />
        </div>
        <section className="panel activity-panel"><h2>Atividade Recente</h2><ul>{activities.map(activity => <li key={activity.time}><span className={activity.positive ? "activity-dot positive" : "activity-dot"}/><span>{activity.message}</span><time>{activity.time}</time></li>)}</ul></section>
      </main>
  </AdminShell>;
}
