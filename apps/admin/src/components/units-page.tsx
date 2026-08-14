"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/dashboard";

interface AcademySummary { id:string; name:string }
interface AcademyUnit { id:string; name:string; academy:AcademySummary; city:string; state:string; phone:string; email:string; isPrimary:boolean }

const pageSize=5;
const initialUnits:AcademyUnit[]=[
  {id:"1",name:"Vila Mariana - Matriz",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 98523-4567",email:"vilamariana@marealta.com.br",isPrimary:true},
  {id:"2",name:"Vila Mariana - Filial",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 98523-4568",email:"vilamariana.filial@marealta.com.br",isPrimary:false},
  {id:"3",name:"Moema",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 97562-3120",email:"moema@marealta.com.br",isPrimary:false},
  {id:"4",name:"Brooklin",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 98311-7744",email:"brooklin@marealta.com.br",isPrimary:false},
  {id:"5",name:"Lapa",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 96789-2233",email:"lapa@marealta.com.br",isPrimary:false},
  {id:"6",name:"Santana",academy:{id:"mare-alta",name:"CT Maré Alta"},city:"São Paulo",state:"SP",phone:"(11) 97410-8822",email:"santana@marealta.com.br",isPrimary:false},
];

function UnitIcon({name}:{name:string}){return <Image src={`/figma-students/${name}`} alt="" width={16} height={16} aria-hidden/>}

export function UnitsPage(){
  const [units,setUnits]=useState(initialUnits);const [search,setSearch]=useState("");const [academyId,setAcademyId]=useState("all");const [page,setPage]=useState(1);const [selected,setSelected]=useState<AcademyUnit|null>(null);const [notice,setNotice]=useState<string|null>(null);const cancelRef=useRef<HTMLButtonElement>(null);
  const academies=useMemo(()=>Array.from(new Map(units.map(item=>[item.academy.id,item.academy])).values()),[units]);
  const filtered=useMemo(()=>units.filter(item=>{const term=search.trim().toLocaleLowerCase("pt-BR");return(!term||[item.name,item.city,item.state,item.email].some(value=>value.toLocaleLowerCase("pt-BR").includes(term)))&&(academyId==="all"||item.academy.id===academyId)}),[units,search,academyId]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));const visible=filtered.slice((page-1)*pageSize,page*pageSize);const first=filtered.length?(page-1)*pageSize+1:0;const last=Math.min(page*pageSize,filtered.length);
  useEffect(()=>setPage(1),[search,academyId]);useEffect(()=>{if(page>pageCount)setPage(pageCount)},[page,pageCount]);
  useEffect(()=>{if(!selected)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[selected]);
  function clearFilters(){setSearch("");setAcademyId("all")}
  function removeUnit(){if(!selected)return;setUnits(current=>current.filter(item=>item.id!==selected.id));setNotice(`${selected.name} foi removida apenas dos dados locais.`);setSelected(null)}
  const action=<><button className="button primary" type="button" onClick={()=>setNotice("O cadastro aguarda uma rota ou modal conectado a createUnity.")}><Image src="/figma-dashboard/plus.svg" alt="" width={14} height={14} aria-hidden/>Adicionar Unidade</button><span className="divider"/></>;
  return <AdminShell title="Unidades" breadcrumb="Unidades" actions={action}><main className="units-content">
    {notice&&<div className="students-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice(null)}>×</button></div>}
    <section className="filters-bar" aria-label="Filtros de unidades"><label className="search-field units-search"><span className="sr-only">Buscar unidades</span><UnitIcon name="search.svg"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar por nome ou cidade..."/></label><label className="filter-select"><span>Academia:</span><select aria-label="Filtrar por academia" value={academyId} onChange={event=>setAcademyId(event.target.value)}><option value="all">Todas</option>{academies.map(academy=><option value={academy.id} key={academy.id}>{academy.name}</option>)}</select></label></section>
    <section className="units-table-card" aria-label="Lista de unidades"><div className="table-scroll"><table className="units-table"><thead><tr><th>Unidade</th><th>Academia</th><th>Cidade</th><th>Telefone</th><th>E-mail</th><th>Ações</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><div className="unit-identity"><span className="unit-symbol" aria-hidden>U</span><div><strong>{item.name}</strong><small>{item.isPrimary?"Unidade principal":"Unidade"}</small></div></div></td><td>{item.academy.name}</td><td>{item.city} - {item.state}</td><td>{item.phone}</td><td className="unit-email" title={item.email}>{item.email}</td><td><div className="row-actions"><button type="button" title="Editar unidade" aria-label={`Editar ${item.name}`} onClick={()=>setNotice(`A edição de ${item.name} aguarda uma rota no admin.`)}><UnitIcon name="edit.svg"/></button><button type="button" title="Excluir unidade" aria-label={`Excluir ${item.name}`} onClick={()=>{setSelected(item);requestAnimationFrame(()=>cancelRef.current?.focus())}}><UnitIcon name="delete.svg"/></button></div></td></tr>)}</tbody></table></div>
      {filtered.length===0?<div className="students-empty"><strong>Nenhuma unidade encontrada</strong><span>Ajuste a busca ou limpe os filtros.</span><button className="button secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div>:<div className="students-pagination"><span>Mostrando {first} a {last} de {filtered.length} unidades</span><nav aria-label="Paginação de unidades"><button aria-label="Página anterior" disabled={page===1} onClick={()=>setPage(value=>value-1)} type="button">‹</button>{Array.from({length:pageCount},(_,index)=>index+1).map(value=><button className={page===value?"current":""} aria-current={page===value?"page":undefined} onClick={()=>setPage(value)} type="button" key={value}>{value}</button>)}<button aria-label="Próxima página" disabled={page===pageCount} onClick={()=>setPage(value=>value+1)} type="button">›</button></nav></div>}
    </section>
  </main>{selected&&<div className="modal-backdrop" role="presentation" onMouseDown={event=>{if(event.currentTarget===event.target)setSelected(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unit-delete-title"><h2 id="unit-delete-title">Excluir unidade?</h2><p>Confirma a remoção de <strong>{selected.name}</strong>? Alunos, professores, aulas e históricos não serão alterados nesta demonstração local.</p><div><button ref={cancelRef} className="button secondary" type="button" onClick={()=>setSelected(null)}>Cancelar</button><button className="button danger" type="button" onClick={removeUnit}>Excluir unidade</button></div></section></div>}</AdminShell>;
}
