"use client";

import { PortalImage } from "@/components/portal-image";
import {
  academyToday,
  getStudentPlan,
} from "@mybjj/backend/convex/lib/studentPlans";
import { api } from "@mybjj/backend/convex/_generated/api";
import type { Doc } from "@mybjj/backend/convex/_generated/dataModel";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

const asset = (name: string) => `/figma-dashboard/${name}`;
const navItems = [
  { label: "Visão geral", icon: "layout-grid.svg", href: "/" },
  { label: "Aulas", icon: "book-open.svg", href: "/aulas" },
  { label: "Alunos", icon: "users.svg", href: "/alunos" },
  { label: "Professores", icon: "graduation-cap.svg", href: "/professores" },
  { label: "Unidades", icon: "map-pin.svg", href: "/unidades" },
  { label: "Academia", icon: "shield.svg", href: "/academia" },
];
type StudentSidebarProfile = {
  name: string;
  picture: string;
  beltLabel: string;
};
const studentNavItems = [
  { label: "Visão geral", icon: "layout-grid.svg", href: "/aluno" },
  { label: "Aulas", icon: "book-open.svg", href: "/aluno/aulas" },
  { label: "Meu Perfil", icon: "settings.svg", href: "/aluno/perfil" },
];

const teacherNavItems = [
  { label: "Aulas", icon: "book-open.svg", href: "/aulas" },
  {
    label: "Meu histórico",
    icon: "graduation-cap.svg",
    href: "/professores/meu-historico",
  },
];

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <Image src={asset(name)} alt="" width={size} height={size} aria-hidden />
  );
}
function Sidebar({
  open,
  close,
  student,
  teacher = false,
}: {
  open: boolean;
  close: () => void;
  student?: StudentSidebarProfile;
  teacher?: boolean;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const items = student
    ? studentNavItems
    : teacher
      ? teacherNavItems
      : navItems;
  return (
    <>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={close}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <BrandLogo className="sidebar-brand-logo" />
        <nav className="nav-list" aria-label="Menu principal">
          {items.map((item) => (
            <Link
              className={
                pathname === item.href ||
                (!student &&
                  item.href !== "/" &&
                  pathname.startsWith(`${item.href}/`))
                  ? "active"
                  : ""
              }
              aria-current={pathname === item.href ? "page" : undefined}
              href={item.href}
              key={item.href}
              onClick={close}
            >
              {student ? (
                <Image
                  src={`/figma-student/${item.icon}`}
                  alt=""
                  width={16}
                  height={16}
                  aria-hidden
                />
              ) : (
                <Icon name={item.icon} />
              )}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        {student ? (
          <Link
            href="/aluno/perfil"
            className="sidebar-profile student-sidebar-profile"
            onClick={close}
          >
            <PortalImage
              src={student.picture}
              className="student-sidebar-avatar"
              fallback={student.name.trim().charAt(0).toUpperCase() || "A"}
            />
            <span>
              <strong>{student.name}</strong>
              <small>Faixa {student.beltLabel}</small>
            </span>
          </Link>
        ) : (
          <div className="sidebar-profile">
            <UserButton
              afterSignOutUrl="/"
              appearance={{ elements: { avatarBox: "sidebar-user-avatar" } }}
            />
            <span>
              <strong>
                {user?.fullName ??
                  user?.primaryEmailAddress?.emailAddress ??
                  (teacher ? "Professor" : "Admin")}
              </strong>
              <small>{teacher ? "Professor" : "Administrador"}</small>
            </span>
            <SignOutButton redirectUrl="/">
              <button
                className="sidebar-logout"
                type="button"
                title="Sair"
                aria-label="Sair da conta"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="m16 17 5-5-5-5M21 12H9" />
                </svg>
              </button>
            </SignOutButton>
          </div>
        )}
      </aside>
    </>
  );
}
export function AdminShell({
  title,
  breadcrumb = title,
  children,
  actions,
  showActions = false,
  student,
  teacher = false,
}: {
  title: string;
  breadcrumb?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  showActions?: boolean;
  student?: StudentSidebarProfile;
  teacher?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="app-shell">
      <Sidebar
        open={open}
        close={() => setOpen(false)}
        student={student}
        teacher={teacher}
      />
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-title">
            <button
              className="menu-button"
              aria-label="Abrir menu"
              aria-expanded={open}
              type="button"
              onClick={() => setOpen(true)}
            >
              ☰
            </button>
            <div>
              <p>Painel&nbsp; / &nbsp;{breadcrumb}</p>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {actions}
            {showActions && (
              <>
                <Link className="button secondary" href="/alunos/novo">
                  <Icon name="user-plus.svg" size={12} />
                  Adicionar Aluno
                </Link>
                <Link className="button primary" href="/aulas/nova">
                  <Icon name="plus.svg" size={12} />
                  Criar Aula
                </Link>
              </>
            )}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
export function BlankAdminPage({ title }: { title: string }) {
  return (
    <AdminShell title={title}>
      <main className="blank-page" />
    </AdminShell>
  );
}
const weekDayLabels = {
  Sunday: "Dom",
  Monday: "Seg",
  Tuesday: "Ter",
  Wednesday: "Qua",
  Thursday: "Qui",
  Friday: "Sex",
  Saturday: "Sáb",
} as const;

function MonthlyTeachingPanel({
  month,
  monthLabel,
  teachers,
}: {
  month: string;
  monthLabel: string;
  teachers: Pick<Doc<"teachers">, "_id" | "name">[] | undefined;
}) {
  const counts = useQuery(api.classSessions.getMonthlyTeachingCounts, {
    month,
  });
  const byTeacher = new Map(
    counts?.map((item) => [item.teacherId, item.total]),
  );
  const rows = teachers
    ?.map((teacher) => ({ ...teacher, total: byTeacher.get(teacher._id) ?? 0 }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "pt-BR"));
  return (
    <section
      className="panel monthly-teaching-panel"
      aria-labelledby="monthly-teaching-heading"
    >
      <header>
        <h2 id="monthly-teaching-heading">Aulas ministradas no mês</h2>
      </header>
      <p className="monthly-presence-month">{monthLabel}</p>
      {rows === undefined || counts === undefined ? (
        <p role="status">Carregando aulas...</p>
      ) : rows.length ? (
        <ul className="monthly-teaching-list">
          {rows.map((teacher) => (
            <li key={teacher._id}>
              <Link
                className="teacher-history-link"
                href={`/professores/${teacher._id}`}
              >
                {teacher.name}
              </Link>
              <strong>
                {teacher.total} {teacher.total === 1 ? "aula" : "aulas"}
              </strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum professor cadastrado.</p>
      )}
    </section>
  );
}

export function Dashboard() {
  const students = useQuery(api.students.getAllStudents);
  const teachers = useQuery(api.teachers.getAllTeachers);
  const units = useQuery(api.unities.getAllUnities);
  const month = academyToday().slice(0, 7);
  const monthlyPresence = useQuery(api.enrollments.getMonthlyPresence, {
    month,
  });
  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" },
  );
  const classes = useQuery(api.classes.getAllClasses);
  const teacherById = useMemo(
    () =>
      new Map((teachers ?? []).map((teacher) => [teacher._id, teacher.name])),
    [teachers],
  );
  const unitById = useMemo(
    () =>
      new Map(
        (units ?? []).map((unit) => [unit._id, unit.name ?? unit.address]),
      ),
    [units],
  );
  const sortedStudents = useMemo(
    () =>
      [...(students ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    [students],
  );
  const activeStudents = students?.filter(
    (student) => getStudentPlan(student).isActive,
  ).length;
  const inactiveStudents =
    students === undefined
      ? undefined
      : students.length - (activeStudents ?? 0);
  const loading = [students, teachers, units].some(
    (value) => value === undefined,
  );
  const metrics = [
    {
      label: "Total de Alunos",
      value: students?.length ?? 0,
      icon: "metric-users.svg",
    },
    {
      label: "Professores",
      value: teachers?.length ?? 0,
      icon: "metric-graduation.svg",
    },
    {
      label: "Unidades",
      value: units?.length ?? 0,
      icon: "metric-map-pin.svg",
    },
  ];
  return (
    <AdminShell title="Visão Geral" showActions>
      <main className="dashboard-content">
        <section className="metrics-grid">
          {metrics.map((metric) => (
            <article className="metric-card" key={metric.label}>
              <div className="metric-heading">
                <span>{metric.label}</span>
                <span className="metric-icon">
                  <Icon name={metric.icon} size={14} />
                </span>
              </div>
              <div className="metric-value">
                <strong>{loading ? "—" : metric.value}</strong>
              </div>
            </article>
          ))}
        </section>
        <div className="dashboard-grid">
          <div className="dashboard-list-column">
            <section className="panel dashboard-students-panel">
              <header>
                <h2>Alunos</h2>
                <Link className="card-action" href="/alunos">
                  Ver alunos
                </Link>
              </header>
              {students === undefined ? (
                <div className="students-empty">Carregando alunos...</div>
              ) : sortedStudents.length === 0 ? (
                <div className="students-empty">
                  <strong>Nenhum aluno cadastrado</strong>
                  <Link className="button primary" href="/alunos/novo">
                    Adicionar aluno
                  </Link>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="dashboard-students-table">
                    <thead>
                      <tr>
                        <th scope="col">Nome</th>
                        <th scope="col">Plano</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedStudents.map((student) => {
                        const plan = getStudentPlan(student);
                        return (
                          <tr key={student._id}>
                            <td>
                              <div className="student-identity">
                                <PortalImage
                                  src={student.picture}
                                  className="professor-avatar"
                                  fallback={student.name
                                    .slice(0, 2)
                                    .toUpperCase()}
                                />
                                <Link href={`/alunos/${student._id}`}>
                                  <strong>{student.name}</strong>
                                </Link>
                              </div>
                            </td>
                            <td>{plan.type}</td>
                            <td>
                              <span
                                className={`student-status ${plan.isActive ? "active" : "inactive"}`}
                              >
                                {plan.isActive ? "Ativo" : "Inativo"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section className="panel dashboard-classes-panel">
              <header>
                <h2>Aulas</h2>
                <Link className="card-action" href="/aulas">
                  Ver aulas
                </Link>
              </header>
              {classes === undefined ||
              teachers === undefined ||
              units === undefined ? (
                <div className="students-empty">Carregando aulas...</div>
              ) : classes.length === 0 ? (
                <div className="students-empty">
                  <strong>Nenhuma aula cadastrada</strong>
                  <Link className="button primary" href="/aulas/nova">
                    Criar aula
                  </Link>
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="dashboard-classes-table">
                    <thead>
                      <tr>
                        <th scope="col">Aula</th>
                        <th scope="col">Professores</th>
                        <th scope="col">Unidade</th>
                        <th scope="col">Dias</th>
                        <th scope="col">Horário</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((item) => (
                        <tr key={item._id}>
                          <td>
                            <Link
                              href={`/aulas/${item._id}/editar`}
                              title="Editar aula"
                            >
                              <strong>
                                {item.classType} ·{" "}
                                {item.level === "Beginner"
                                  ? "Iniciantes"
                                  : "Avançados"}
                              </strong>
                            </Link>
                          </td>
                          <td>
                            {item.teacherIds
                              .map((id) => teacherById.get(id))
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                          <td>
                            {item.unityIds
                              .map((id) => unitById.get(id))
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                          <td>
                            <div className="weekday-list">
                              {item.weekDays.map((day) => (
                                <span key={day}>{weekDayLabels[day]}</span>
                              ))}
                            </div>
                          </td>
                          <td>
                            <strong>{item.startHour}</strong>
                            <small>{item.duration}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
          <div className="dashboard-list-column">
            <section className="panel attendance-panel">
              <header>
                <h2>Resumo Operacional</h2>
              </header>
              <div className="academy-stats">
                <div>
                  <span>Alunos ativos</span>
                  <strong className="summary-active-count">
                    {activeStudents ?? "—"}
                  </strong>
                </div>
                <div>
                  <span>Alunos inativos</span>
                  <strong className="summary-inactive-count">
                    {inactiveStudents ?? "—"}
                  </strong>
                </div>
              </div>
              <div className="monthly-presence">
                <div className="monthly-presence-heading">
                  <h3>Presença mensal</h3>
                  <p className="monthly-presence-month">{monthLabel}</p>
                </div>
                <div className="monthly-presence-metric">
                  <strong className="monthly-presence-total">
                    {monthlyPresence?.totalEnrollments ?? "—"}
                  </strong>
                  <span>
                    {monthlyPresence?.totalEnrollments === 1
                      ? "presença no mês"
                      : "presenças no mês"}
                  </span>
                </div>
                <p className="monthly-presence-students">
                  {monthlyPresence === undefined
                    ? "Carregando presenças..."
                    : `${monthlyPresence.studentCount} ${monthlyPresence.studentCount === 1 ? "aluno com presença" : "alunos com presença"}`}
                </p>
                <small>
                  Presenças confirmadas nas aulas do mês, sem cancelamentos.
                </small>
              </div>
            </section>
            <MonthlyTeachingPanel
              month={month}
              monthLabel={monthLabel}
              teachers={teachers}
            />
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
