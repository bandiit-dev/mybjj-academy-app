"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Doc } from "@mybjj/backend/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard";

const beltLabels:Record<Doc<"teachers">["belt"],string>={White:"Faixa Branca",Blue:"Faixa Azul",Purple:"Faixa Roxa",Brown:"Faixa Marrom",Black:"Faixa Preta",Coral:"Faixa Coral",Red:"Faixa Vermelha"};
const beltClasses:Record<Doc<"teachers">["belt"],string>={White:"white",Blue:"blue",Purple:"purple",Brown:"brown",Black:"black",Coral:"brown",Red:"brown"};
function Icon({name}:{name:string}){return <Image src={`/figma-students/${name}`} alt="" width={16} height={16} aria-hidden/>}
function initials(name:string){return name.split(" ").slice(0,2).map(part=>part[0]).join("")}

export function ProfessorsPage(){
  const teachers=useQuery(api.teachers.getAllTeachers) as Doc<"teachers">[] | undefined; const unities=useQuery(api.unities.getAllUnities);
  const [search,setSearch]=useState("");const [belt,setBelt]=useState("all");const [unit,setUnit]=useState("all");const [role,setRole]=useState("all");
  const unityById=useMemo(()=>new Map((unities??[]).map(item=>[item._id,item.name??item.address])),[unities]);
  const filtered=useMemo(()=>(teachers??[]).filter(item=>{const term=search.trim().toLocaleLowerCase("pt-BR");return(!term||[item.name,item.email,item.phone].some(v=>v.toLocaleLowerCase("pt-BR").includes(term)))&&(belt==="all"||item.belt===belt)&&(unit==="all"||item.unityIds.some(id=>id===unit))&&(role==="all"||item.role===role)}),[teachers,search,belt,unit,role]);
  const roles=[...new Set((teachers??[]).map(item=>item.role))];
  const action=<><Link className="button primary" href="/professores/novo"><Image src="/figma-dashboard/plus.svg" alt="" width={14} height={14} aria-hidden/>Adicionar Professor</Link><span className="divider"/></>;
  return <AdminShell title="Professores" actions={action}><main className="professors-content"><section className="filters-bar"><label className="search-field professor-search"><Icon name="search.svg"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..." aria-label="Buscar professores"/></label><label className="filter-select"><span>Faixa:</span><select value={belt} onChange={e=>setBelt(e.target.value)}><option value="all">Todas</option>{Object.entries(beltLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label className="filter-select"><span>Unidade:</span><select value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">Todas</option>{(unities??[]).map(item=><option value={item._id} key={item._id}>{item.name??item.address}</option>)}</select></label><label className="filter-select"><span>Função:</span><select value={role} onChange={e=>setRole(e.target.value)}><option value="all">Todas</option>{roles.map(value=><option key={value}>{value}</option>)}</select></label></section>
  <section className="professors-table-card"><div className="table-scroll"><table className="professors-table"><thead><tr><th>Nome</th><th>Faixa</th><th>Unidade</th><th>Função</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{filtered.map(item=><tr key={item._id}><td><div className="professor-identity"><span className="professor-avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>Professor</small></div></div></td><td><span className="professor-belt"><i className={`belt-line ${beltClasses[item.belt]}`}/>{beltLabels[item.belt]}</span></td><td>{item.unityIds.map(id=>unityById.get(id)).filter(Boolean).join(", ")||"—"}</td><td>{item.role}</td><td className="professor-email">{item.email}</td><td>{item.phone}</td><td><div className="row-actions"><button type="button" disabled title="Editar professor"><Icon name="edit.svg"/></button></div></td></tr>)}</tbody></table></div>{teachers===undefined||unities===undefined?<div className="students-empty"><strong>Carregando professores...</strong></div>:filtered.length===0?<div className="students-empty"><strong>Nenhum professor cadastrado</strong><span>Professores aparecerão aqui após serem adicionados.</span></div>:<div className="students-pagination professors-pagination"><span>Mostrando {filtered.length} de {teachers.length} professores</span></div>}</section></main></AdminShell>;
}
