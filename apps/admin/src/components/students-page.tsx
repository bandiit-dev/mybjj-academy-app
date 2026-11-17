"use client";

import { PortalImage } from "@/components/portal-image";
import { api } from "@mybjj/backend/convex/_generated/api";
import { BELT_LABELS, BELT_CLASSES } from "@mybjj/backend/convex/lib/validators";
import type { Doc } from "@mybjj/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/dashboard";

const beltLabels = BELT_LABELS;
const beltClasses = BELT_CLASSES;

function SmallIcon({ name }: { name:string }) { return <Image src={`/figma-students/${name}`} alt="" width={14} height={14} aria-hidden/>; }

export function StudentsPage() {
  const students = useQuery(api.students.getAllStudents) as Doc<"students">[] | undefined;
  const unities = useQuery(api.unities.getAllUnities);
  const [search,setSearch]=useState(""); const [belt,setBelt]=useState("all"); const [unit,setUnit]=useState("all");
  const unityById=useMemo(()=>new Map((unities??[]).map(item=>[item._id,item.name??item.address])),[unities]);
  const filtered=useMemo(()=>(students??[]).filter(student=>{const term=search.trim().toLocaleLowerCase("pt-BR");return(!term||[student.name,student.email,student.phone].some(value=>value.toLocaleLowerCase("pt-BR").includes(term)))&&(belt==="all"||student.belt===belt)&&(unit==="all"||student.unityIds.includes(unit as never));}),[students,search,belt,unit]);
  const action=<><Link className="button primary" href="/alunos/novo"><Image src="/figma-dashboard/plus.svg" alt="" width={14} height={14} aria-hidden/>Adicionar Aluno</Link></>;
  return <AdminShell title="Gestão de Alunos" breadcrumb="Alunos" actions={action}><main className="students-content">
    <section className="filters-bar" aria-label="Filtros de alunos"><label className="search-field"><SmallIcon name="search.svg"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar aluno..." aria-label="Buscar aluno"/></label><label className="filter-select"><span>Faixa:</span><select value={belt} onChange={e=>setBelt(e.target.value)}><option value="all">Todas</option>{Object.entries(beltLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label className="filter-select"><span>Unidade:</span><select value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">Todas</option>{(unities??[]).map(item=><option value={item._id} key={item._id}>{item.name??item.address}</option>)}</select></label></section>
    <section className="students-table-card"><div className="table-scroll"><table className="students-table"><thead><tr><th>Aluno</th><th>Contato</th><th>Faixa / Grau</th><th>Unidade</th><th>Tipo</th><th>Status</th><th>Ações</th></tr></thead><tbody>{filtered.map(student=><tr key={student._id}><td><div className="student-identity"><PortalImage src={student.picture} className="professor-avatar" fallback={student.name.slice(0,2).toUpperCase()}/><strong>{student.name}</strong></div></td><td><div className="contact-cell"><span>{student.email || "—"}</span><small>{student.phone || "—"}</small></div></td><td><div className="belt-cell"><span className="belt-badge"><i className={`belt-dot ${beltClasses[student.belt]}`}/>{beltLabels[student.belt]}</span><small>{student.degree} {student.degree===1?"Grau":"Graus"}</small></div></td><td>{student.unityIds.map(id=>unityById.get(id)).filter(Boolean).join(", ")||"—"}</td><td><span className="member-badge student">Aluno</span></td><td><span className="student-status active">Ativo</span></td><td><div className="row-actions"><Link href={`/alunos/${student._id}/editar`} title="Editar aluno"><SmallIcon name="edit.svg"/></Link></div></td></tr>)}</tbody></table></div>
      {students===undefined||unities===undefined?<div className="students-empty"><strong>Carregando alunos...</strong></div>:filtered.length===0?<div className="students-empty"><strong>Nenhum aluno encontrado</strong><span>Alunos aparecerão aqui após serem adicionados.</span></div>:<div className="students-pagination"><span>Mostrando {filtered.length} de {students.length} alunos</span></div>}
    </section></main></AdminShell>;
}
