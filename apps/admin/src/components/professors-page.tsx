"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/dashboard";

type BeltRank = "white" | "blue" | "purple" | "brown" | "black";
type ProfessorRole = "head_professor" | "professor" | "assistant_professor";
interface Professor { id:string; name:string; designation:"Professor"|"Professora"; belt:BeltRank; unitName:string; role:ProfessorRole; email:string; phone:string }

const beltLabels:Record<BeltRank,string>={white:"Faixa Branca",blue:"Faixa Azul",purple:"Faixa Roxa",brown:"Faixa Marrom",black:"Faixa Preta"};
const roleLabels:Record<ProfessorRole,string>={head_professor:"Professor Principal",professor:"Professor",assistant_professor:"Professora Assistente"};
const pageSize=5;
const initialProfessors:Professor[]=[
  {id:"1",name:"Rafael Mendes",designation:"Professor",belt:"black",unitName:"Unidade Centro",role:"head_professor",email:"rafael.mendes@mybjj.com.br",phone:"(11) 98765-4321"},
  {id:"2",name:"Juliana Carvalho",designation:"Professora",belt:"brown",unitName:"Sul",role:"professor",email:"juliana.carvalho@mybjj.com.br",phone:"(11) 97654-3210"},
  {id:"3",name:"Bruno Souza",designation:"Professor",belt:"black",unitName:"Barra",role:"professor",email:"bruno.souza@mybjj.com.br",phone:"(21) 99876-5432"},
  {id:"4",name:"Felipe Oliveira",designation:"Professor",belt:"brown",unitName:"Centro",role:"professor",email:"felipe.oliveira@mybjj.com.br",phone:"(11) 96432-1098"},
  {id:"5",name:"Carla Costa",designation:"Professora",belt:"purple",unitName:"Sul",role:"assistant_professor",email:"carla.costa@mybjj.com.br",phone:"(11) 98321-6547"},
  {id:"6",name:"Thiago Alves",designation:"Professor",belt:"black",unitName:"Centro",role:"professor",email:"thiago.alves@mybjj.com.br",phone:"(21) 99124-6755"},
  {id:"7",name:"Ana Costa",designation:"Professora",belt:"brown",unitName:"Barra",role:"professor",email:"ana.costa@mybjj.com.br",phone:"(21) 98831-2044"},
  {id:"8",name:"Ricardo Lima",designation:"Professor",belt:"purple",unitName:"Sul",role:"assistant_professor",email:"ricardo.lima@mybjj.com.br",phone:"(21) 97920-1144"},
  {id:"9",name:"Marina Lopes",designation:"Professora",belt:"blue",unitName:"Centro",role:"assistant_professor",email:"marina.lopes@mybjj.com.br",phone:"(11) 97552-6677"},
  {id:"10",name:"Paulo Nunes",designation:"Professor",belt:"brown",unitName:"Barra",role:"professor",email:"paulo.nunes@mybjj.com.br",phone:"(21) 99871-3002"},
  {id:"11",name:"Renata Dias",designation:"Professora",belt:"purple",unitName:"Sul",role:"professor",email:"renata.dias@mybjj.com.br",phone:"(11) 98314-4090"},
  {id:"12",name:"André Rocha",designation:"Professor",belt:"black",unitName:"Unidade Centro",role:"head_professor",email:"andre.rocha@mybjj.com.br",phone:"(21) 98700-2210"},
];

function ProfessorIcon({name}:{name:string}){return <Image src={`/figma-students/${name}`} alt="" width={16} height={16} aria-hidden/>}
function initials(name:string){return name.split(" ").slice(0,2).map(part=>part[0]).join("")}

export function ProfessorsPage(){
  const [professors,setProfessors]=useState(initialProfessors);const [search,setSearch]=useState("");const [belt,setBelt]=useState("all");const [unit,setUnit]=useState("all");const [role,setRole]=useState("all");const [page,setPage]=useState(1);const [selected,setSelected]=useState<Professor|null>(null);const [notice,setNotice]=useState<string|null>(null);const cancelRef=useRef<HTMLButtonElement>(null);
  const filtered=useMemo(()=>professors.filter(item=>{const term=search.trim().toLocaleLowerCase("pt-BR");return(!term||[item.name,item.email,item.phone].some(value=>value.toLocaleLowerCase("pt-BR").includes(term)))&&(belt==="all"||item.belt===belt)&&(unit==="all"||item.unitName===unit)&&(role==="all"||item.role===role)}),[professors,search,belt,unit,role]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));const visible=filtered.slice((page-1)*pageSize,page*pageSize);const first=filtered.length?(page-1)*pageSize+1:0;const last=Math.min(page*pageSize,filtered.length);
  useEffect(()=>setPage(1),[search,belt,unit,role]);useEffect(()=>{if(page>pageCount)setPage(pageCount)},[page,pageCount]);
  useEffect(()=>{if(!selected)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[selected]);
  function clearFilters(){setSearch("");setBelt("all");setUnit("all");setRole("all")}
  function removeProfessor(){if(!selected)return;setProfessors(current=>current.filter(item=>item.id!==selected.id));setNotice(`${selected.name} foi removido apenas dos dados locais.`);setSelected(null)}
  const action=<><a className="button primary professor-add" href="/professores/novo"><Image src="/figma-dashboard/plus.svg" alt="" width={14} height={14} aria-hidden/>Adicionar Professor</a><span className="divider"/></>;
  return <AdminShell title="Professores" breadcrumb="Professores" actions={action}><main className="professors-content">
    {notice&&<div className="students-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice(null)}>×</button></div>}
    <section className="filters-bar" aria-label="Filtros de professores"><label className="search-field professor-search"><span className="sr-only">Buscar professores</span><ProfessorIcon name="search.svg"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome ou e-mail..."/></label>
      <label className="filter-select"><span>Faixa:</span><select aria-label="Filtrar por faixa" value={belt} onChange={e=>setBelt(e.target.value)}><option value="all">Todas</option>{Object.entries(beltLabels).map(([value,label])=><option value={value} key={value}>{label.replace("Faixa ","")}</option>)}</select></label>
      <label className="filter-select"><span>Unidade:</span><select aria-label="Filtrar por unidade" value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">Todas</option>{[...new Set(professors.map(item=>item.unitName))].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="filter-select"><span>Função:</span><select aria-label="Filtrar por função" value={role} onChange={e=>setRole(e.target.value)}><option value="all">Todas</option>{Object.entries(roleLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
    </section>
    <section className="professors-table-card" aria-label="Lista de professores"><div className="table-scroll"><table className="professors-table"><thead><tr><th>Nome</th><th>Faixa</th><th>Unidade</th><th>Função</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><div className="professor-identity"><span className="professor-avatar" aria-hidden>{initials(item.name)}</span><div><strong>{item.name}</strong><small>{item.designation}</small></div></div></td><td><span className="professor-belt"><i className={`belt-line ${item.belt}`}/>{beltLabels[item.belt]}</span></td><td>{item.unitName}</td><td>{item.role==="professor"?item.designation:roleLabels[item.role]}</td><td className="professor-email" title={item.email}>{item.email}</td><td>{item.phone}</td><td><div className="row-actions"><button type="button" title="Editar professor" aria-label={`Editar ${item.name}`} onClick={()=>setNotice(`A edição de ${item.name} aguarda uma rota no admin.`)}><ProfessorIcon name="edit.svg"/></button><button type="button" title="Excluir professor" aria-label={`Excluir ${item.name}`} onClick={()=>{setSelected(item);requestAnimationFrame(()=>cancelRef.current?.focus())}}><ProfessorIcon name="delete.svg"/></button></div></td></tr>)}</tbody></table></div>
      {filtered.length===0?<div className="students-empty"><strong>Nenhum professor encontrado</strong><span>Ajuste a busca ou limpe os filtros.</span><button className="button secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div>:<div className="students-pagination professors-pagination"><span>Mostrando {first} a {last} de {filtered.length} professores</span><nav aria-label="Paginação de professores"><button aria-label="Página anterior" disabled={page===1} onClick={()=>setPage(value=>value-1)} type="button">‹</button>{Array.from({length:pageCount},(_,index)=>index+1).map(value=><button className={page===value?"current":""} aria-current={page===value?"page":undefined} onClick={()=>setPage(value)} type="button" key={value}>{value}</button>)}<button aria-label="Próxima página" disabled={page===pageCount} onClick={()=>setPage(value=>value+1)} type="button">›</button></nav></div>}
    </section>
  </main>{selected&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="professor-delete-title"><h2 id="professor-delete-title">Excluir professor?</h2><p>Confirma a remoção de <strong>{selected.name}</strong>? A conta de autenticação, aulas e históricos não serão alterados nesta demonstração local.</p><div><button ref={cancelRef} className="button secondary" type="button" onClick={()=>setSelected(null)}>Cancelar</button><button className="button danger" type="button" onClick={removeProfessor}>Excluir professor</button></div></section></div>}</AdminShell>;
}
