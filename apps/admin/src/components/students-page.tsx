"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/dashboard";

type StudentStatus = "active" | "inactive";
type MemberType = "student" | "professor";
type BeltRank = "white" | "blue" | "purple" | "brown" | "black";

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string;
  belt: BeltRank;
  degrees: number;
  unit: string;
  type: MemberType;
  status: StudentStatus;
}

const beltLabels: Record<BeltRank, string> = { white: "Branca", blue: "Azul", purple: "Roxa", brown: "Marrom", black: "Preta" };

// Figma fixtures. Replace once the API exposes status and resolved unit names.
const initialStudents: Student[] = [
  { id:"1", name:"Adriano Martins", email:"adriano.m@gmail.com", phone:"(21) 98122-4432", avatarUrl:"/figma-students/adriano.png", belt:"brown", degrees:1, unit:"Barra", type:"student", status:"active" },
  { id:"2", name:"Beatriz Oliveira", email:"beatriz.oliveira@outlook.com", phone:"(21) 97722-1145", avatarUrl:"/figma-students/beatriz.png", belt:"blue", degrees:3, unit:"Centro", type:"student", status:"active" },
  { id:"3", name:"Carlos Alberto Neves", email:"carlos.alberto@gmail.com", phone:"(21) 99122-3321", avatarUrl:"/figma-students/carlos.png", belt:"black", degrees:2, unit:"Centro", type:"professor", status:"active" },
  { id:"4", name:"Daniela Costa", email:"daniela.costa@hotmail.com", phone:"(21) 98877-2211", avatarUrl:"/figma-students/daniela.png", belt:"purple", degrees:2, unit:"Zona Sul", type:"student", status:"active" },
  { id:"5", name:"Eduardo Santos", email:"edu.santos@gmail.com", phone:"(21) 98455-2211", avatarUrl:"/figma-students/eduardo.png", belt:"white", degrees:4, unit:"Barra", type:"student", status:"inactive" },
  { id:"6", name:"Fernanda Ribeiro", email:"fernanda.bjj@outlook.com", phone:"(21) 96122-9900", avatarUrl:"/figma-students/fernanda.png", belt:"blue", degrees:1, unit:"Zona Norte", type:"student", status:"active" },
  { id:"7", name:"Guilherme Fonseca", email:"guilherme.f@gmail.com", phone:"(21) 98233-1100", avatarUrl:"/figma-students/guilherme.png", belt:"purple", degrees:0, unit:"Centro", type:"student", status:"active" },
  { id:"8", name:"Hugo Rezende", email:"hugo.rezende@bjj.com", phone:"(21) 97000-1122", avatarUrl:"/figma-students/hugo.png", belt:"brown", degrees:3, unit:"Zona Sul", type:"student", status:"active" },
  { id:"9", name:"Isabela Lima", email:"isabella.lima@gmail.com", phone:"(21) 98111-5544", avatarUrl:"/figma-students/isabela.png", belt:"white", degrees:2, unit:"Barra", type:"student", status:"active" },
  { id:"10", name:"João Pedro Silva", email:"joao.pedro@hotmail.com", phone:"(21) 96233-9988", avatarUrl:"/figma-students/joao.png", belt:"blue", degrees:2, unit:"Zona Norte", type:"student", status:"active" },
];

function SmallIcon({ name, size = 14 }: { name: string; size?: number }) {
  return <Image src={`/figma-students/${name}`} alt="" width={size} height={size} aria-hidden />;
}

function BeltBadge({ belt, degrees }: Pick<Student, "belt" | "degrees">) {
  return <div className="belt-cell"><span className="belt-badge"><i className={`belt-dot ${belt}`} />{beltLabels[belt]}</span><small>{degrees} {degrees === 1 ? "Grau" : "Graus"}</small></div>;
}

function Pagination({ onUnavailable }: { onUnavailable: () => void }) {
  return <div className="students-pagination"><span>Mostrando 10 de 248 alunos</span><nav aria-label="Paginação de alunos">
    <button disabled type="button">Anterior</button><button className="current" aria-current="page" type="button">1</button>
    <button type="button" onClick={onUnavailable}>2</button><button type="button" onClick={onUnavailable}>3</button><button type="button" onClick={onUnavailable}>Próximo</button>
  </nav></div>;
}

export function StudentsPage() {
  const [students, setStudents] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [belt, setBelt] = useState("all");
  const [unit, setUnit] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Student | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const filtered = useMemo(() => students.filter(student => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !term || [student.name, student.email, student.phone].some(value => value.toLocaleLowerCase("pt-BR").includes(term));
    return matchesSearch && (belt === "all" || student.belt === belt) && (unit === "all" || student.unit === unit) && (status === "all" || student.status === status);
  }), [students, search, belt, unit, status]);

  useEffect(() => {
    if (!selected) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  function clearFilters() { setSearch(""); setBelt("all"); setUnit("all"); setStatus("all"); }
  function placeholder(message: string) { setNotice(message); }
  function removeStudent() {
    if (!selected) return;
    setStudents(current => current.filter(student => student.id !== selected.id));
    setNotice(`${selected.name} foi removido apenas dos dados locais.`);
    setSelected(null);
  }

  const addAction = <><a className="button primary" href="/alunos/novo"><Image src="/figma-dashboard/plus.svg" alt="" width={14} height={14} aria-hidden />Adicionar Aluno</a><span className="divider" /></>;

  return <AdminShell title="Gestão de Alunos" breadcrumb="Alunos" actions={addAction}>
    <main className="students-content">
      {notice && <div className="students-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}>×</button></div>}
      <section className="filters-bar" aria-label="Filtros de alunos">
        <label className="search-field"><span className="sr-only">Buscar aluno</span><SmallIcon name="search.svg"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar aluno..." /></label>
        <label className="filter-select"><span className="sr-only">Filtrar por faixa</span><span>Faixa:</span><select value={belt} onChange={event => setBelt(event.target.value)}><option value="all">Todas</option>{Object.entries(beltLabels).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="filter-select"><span className="sr-only">Filtrar por unidade</span><span>Unidade:</span><select value={unit} onChange={event => setUnit(event.target.value)}><option value="all">Todas</option>{["Centro","Barra","Zona Norte","Zona Sul"].map(value => <option value={value} key={value}>{value}</option>)}</select></label>
        <label className="filter-select"><span className="sr-only">Filtrar por status</span><span>Status:</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos</option><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label>
      </section>

      <section className="students-table-card" aria-label="Lista de alunos">
        <div className="table-scroll"><table className="students-table"><thead><tr><th>Aluno</th><th>Contato</th><th>Faixa / Grau</th><th>Unidade</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>{filtered.map(student => <tr key={student.id}>
            <td><div className="student-identity"><Image src={student.avatarUrl} alt="" width={32} height={32}/><strong>{student.name}</strong></div></td>
            <td><div className="contact-cell"><span>{student.email}</span><small>{student.phone}</small></div></td>
            <td><BeltBadge belt={student.belt} degrees={student.degrees}/></td><td>{student.unit}</td>
            <td><span className={`member-badge ${student.type}`}>{student.type === "student" ? "Aluno" : "Professor"}</span></td>
            <td><span className={`student-status ${student.status}`}>{student.status === "active" ? "Ativo" : "Inativo"}</span></td>
            <td><div className="row-actions"><button type="button" title="Editar aluno" aria-label={`Editar ${student.name}`} onClick={() => placeholder(`A edição de ${student.name} aguarda uma rota no admin.`)}><SmallIcon name="edit.svg"/></button><button type="button" title="Excluir aluno" aria-label={`Excluir ${student.name}`} onClick={() => { setSelected(student); requestAnimationFrame(() => cancelRef.current?.focus()); }}><SmallIcon name="delete.svg"/></button></div></td>
          </tr>)}</tbody></table></div>
        {filtered.length === 0 ? <div className="students-empty"><strong>Nenhum aluno encontrado</strong><span>Ajuste sua busca ou limpe os filtros para ver todos os alunos.</span><button className="button secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div> : <Pagination onUnavailable={() => placeholder("As próximas páginas serão ativadas com a paginação do Convex.")} />}
      </section>
    </main>
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setSelected(null); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description"><h2 id="delete-title">Excluir aluno?</h2><p id="delete-description">Confirma a remoção de <strong>{selected.name}</strong>? Esta demonstração altera apenas os dados locais.</p><div><button ref={cancelRef} className="button secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="button danger" type="button" onClick={removeStudent}>Excluir aluno</button></div></section></div>}
  </AdminShell>;
}
