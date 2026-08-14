"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/dashboard";

type ClassType = "gi" | "nogi";
type ClassLevel = "beginner" | "advanced" | "all";
type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
interface AcademyClass { id:string; name:string; type:ClassType; level:ClassLevel; instructorName:string; unitName:string; weekdays:Weekday[]; startTime:string; durationMinutes:number }

const levelLabels: Record<ClassLevel,string> = { beginner:"Iniciante", advanced:"Avançado", all:"Qualquer" };
const weekdayLabels: Record<Weekday,string> = { monday:"Seg", tuesday:"Ter", wednesday:"Qua", thursday:"Qui", friday:"Sex", saturday:"Sáb", sunday:"Dom" };
const pageSize = 8;

// Figma fixtures. Current Convex classes lack names and resolved teacher/unit labels.
const initialClasses: AcademyClass[] = [
  {id:"1",name:"Fundamentals GI",type:"gi",level:"beginner",instructorName:"Prof. Carlos Silva",unitName:"Centro",weekdays:["monday","wednesday","friday"],startTime:"07:00",durationMinutes:60},
  {id:"2",name:"Competition NOGI",type:"nogi",level:"advanced",instructorName:"Prof. Thiago Alves",unitName:"Centro",weekdays:["tuesday","thursday"],startTime:"09:00",durationMinutes:75},
  {id:"3",name:"Kids Jiu-Jitsu",type:"gi",level:"beginner",instructorName:"Profª. Ana Costa",unitName:"Centro",weekdays:["monday","wednesday"],startTime:"18:00",durationMinutes:60},
  {id:"4",name:"Open Mat",type:"nogi",level:"all",instructorName:"Monitor Ricardo",unitName:"Zona Sul",weekdays:["saturday"],startTime:"12:00",durationMinutes:90},
  {id:"5",name:"Avançados com Kimono",type:"gi",level:"advanced",instructorName:"Prof. Carlos Silva",unitName:"Barra",weekdays:["monday","tuesday","wednesday","thursday"],startTime:"19:30",durationMinutes:90},
  {id:"6",name:"Iniciantes NOGI",type:"nogi",level:"beginner",instructorName:"Prof. Thiago Alves",unitName:"Barra",weekdays:["tuesday","thursday"],startTime:"18:00",durationMinutes:60},
  {id:"7",name:"Master Class Senior",type:"gi",level:"advanced",instructorName:"Prof. Carlos Silva",unitName:"Zona Norte",weekdays:["friday"],startTime:"10:00",durationMinutes:90},
  {id:"8",name:"Sparring / No-Gi Pro",type:"nogi",level:"advanced",instructorName:"Prof. Thiago Alves",unitName:"Centro",weekdays:["friday"],startTime:"19:00",durationMinutes:90},
  {id:"9",name:"Fundamentos Noturno",type:"gi",level:"beginner",instructorName:"Profª. Ana Costa",unitName:"Zona Sul",weekdays:["tuesday","thursday"],startTime:"20:00",durationMinutes:60},
  {id:"10",name:"Open Mat Domingo",type:"nogi",level:"all",instructorName:"Monitor Ricardo",unitName:"Centro",weekdays:["sunday"],startTime:"10:00",durationMinutes:90},
  {id:"11",name:"Competition GI",type:"gi",level:"advanced",instructorName:"Prof. Carlos Silva",unitName:"Barra",weekdays:["saturday"],startTime:"09:00",durationMinutes:90},
  {id:"12",name:"Kids Iniciante",type:"gi",level:"beginner",instructorName:"Profª. Ana Costa",unitName:"Zona Norte",weekdays:["saturday"],startTime:"11:00",durationMinutes:60},
];

function ClassIcon({name}:{name:string}) { return <Image src={`/figma-classes/${name}`} alt="" width={14} height={14} aria-hidden/>; }

export function ClassesPage() {
  const [classes,setClasses]=useState(initialClasses); const [search,setSearch]=useState(""); const [type,setType]=useState("all"); const [level,setLevel]=useState("all-filter"); const [teacher,setTeacher]=useState("all"); const [unit,setUnit]=useState("all"); const [page,setPage]=useState(1); const [selected,setSelected]=useState<AcademyClass|null>(null); const [notice,setNotice]=useState<string|null>(null); const cancelRef=useRef<HTMLButtonElement>(null);
  const filtered=useMemo(()=>classes.filter(item=>{const term=search.trim().toLocaleLowerCase("pt-BR");return (!term||[item.name,item.instructorName,item.unitName].some(value=>value.toLocaleLowerCase("pt-BR").includes(term)))&&(type==="all"||item.type===type)&&(level==="all-filter"||item.level===level)&&(teacher==="all"||item.instructorName===teacher)&&(unit==="all"||item.unitName===unit)}),[classes,search,type,level,teacher,unit]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)); const visible=filtered.slice((page-1)*pageSize,page*pageSize);
  useEffect(()=>setPage(1),[search,type,level,teacher,unit]);
  useEffect(()=>{if(!selected)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setSelected(null)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[selected]);
  function clearFilters(){setSearch("");setType("all");setLevel("all-filter");setTeacher("all");setUnit("all")}
  function removeClass(){if(!selected)return;setClasses(current=>current.filter(item=>item.id!==selected.id));setNotice(`${selected.name} foi removida apenas dos dados locais.`);setSelected(null)}
  const action=<><a className="button primary" href="/aulas/nova"><ClassIcon name="plus.svg"/>Criar Aula</a><span className="divider"/></>;
  return <AdminShell title="Gestão de Aulas" breadcrumb="Aulas" actions={action}><main className="classes-content">
    {notice&&<div className="students-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice(null)}>×</button></div>}
    <section className="filters-bar" aria-label="Filtros de aulas"><label className="search-field classes-search"><span className="sr-only">Buscar aula</span><ClassIcon name="search.svg"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar aula..."/></label>
      <label className="filter-select"><span>Tipo:</span><select aria-label="Filtrar por tipo" value={type} onChange={e=>setType(e.target.value)}><option value="all">Todos</option><option value="gi">GI</option><option value="nogi">NOGI</option></select></label>
      <label className="filter-select"><span>Nível:</span><select aria-label="Filtrar por nível" value={level} onChange={e=>setLevel(e.target.value)}><option value="all-filter">Todos</option><option value="beginner">Iniciante</option><option value="advanced">Avançado</option><option value="all">Qualquer</option></select></label>
      <label className="filter-select"><span>Professor:</span><select aria-label="Filtrar por professor" value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="all">Todos</option>{[...new Set(classes.map(item=>item.instructorName))].map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="filter-select"><span>Unidade:</span><select aria-label="Filtrar por unidade" value={unit} onChange={e=>setUnit(e.target.value)}><option value="all">Todos</option>{[...new Set(classes.map(item=>item.unitName))].map(value=><option key={value}>{value}</option>)}</select></label>
    </section>
    <section className="classes-table-card" aria-label="Lista de aulas"><div className="table-scroll"><table className="classes-table"><thead><tr><th>Nome da Aula</th><th>Tipo</th><th>Nível</th><th>Professores</th><th>Unidade</th><th>Dias da Semana</th><th>Horário</th><th>Duração</th><th>Ações</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><strong>{item.name}</strong></td><td><span className={`class-type ${item.type}`}>{item.type==="gi"?"GI":"NOGI"}</span></td><td>{levelLabels[item.level]}</td><td className="class-teacher" title={item.instructorName}>{item.instructorName}</td><td className="class-unit">{item.unitName}</td><td><div className="weekday-list">{item.weekdays.map(day=><span key={day}>{weekdayLabels[day]}</span>)}</div></td><td className="class-time">{item.startTime}</td><td className="class-duration">{item.durationMinutes} min</td><td><div className="row-actions"><button title="Editar aula" aria-label={`Editar ${item.name}`} type="button" onClick={()=>setNotice(`A edição de ${item.name} aguarda uma rota no admin.`)}><ClassIcon name="edit.svg"/></button><button title="Excluir aula" aria-label={`Excluir ${item.name}`} type="button" onClick={()=>{setSelected(item);requestAnimationFrame(()=>cancelRef.current?.focus())}}><ClassIcon name="delete.svg"/></button></div></td></tr>)}</tbody></table></div>
      {filtered.length===0?<div className="students-empty"><strong>Nenhuma aula encontrada</strong><span>Ajuste a busca ou limpe os filtros.</span><button className="button secondary" type="button" onClick={clearFilters}>Limpar filtros</button></div>:<div className="students-pagination"><span>Mostrando {visible.length} de {filtered.length} aulas</span><nav aria-label="Paginação de aulas"><button disabled={page===1} onClick={()=>setPage(value=>value-1)} type="button">Anterior</button>{Array.from({length:pageCount},(_,index)=>index+1).map(value=><button className={page===value?"current":""} aria-current={page===value?"page":undefined} onClick={()=>setPage(value)} type="button" key={value}>{value}</button>)}<button disabled={page===pageCount} onClick={()=>setPage(value=>value+1)} type="button">Próximo</button></nav></div>}
    </section>
  </main>{selected&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setSelected(null)}}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="class-delete-title"><h2 id="class-delete-title">Excluir aula?</h2><p>Confirma a remoção de <strong>{selected.name}</strong>? Sessões e históricos não serão alterados nesta demonstração local.</p><div><button ref={cancelRef} className="button secondary" type="button" onClick={()=>setSelected(null)}>Cancelar</button><button className="button danger" type="button" onClick={removeClass}>Excluir aula</button></div></section></div>}</AdminShell>;
}
