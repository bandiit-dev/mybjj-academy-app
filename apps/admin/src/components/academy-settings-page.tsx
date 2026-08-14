"use client";

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { AdminShell } from "@/components/dashboard";

interface Academy {
  id: string; name: string; cnpj: string; contactEmail: string; phone: string;
  foundationDate: string; primaryColor: string; accentColor: string;
}
interface AcademyUnit { id: string; name: string; address: string; isPrimary: boolean }
interface TeamLeader { id: string; name: string; title: string; avatarUrl: string }
interface AcademySettingsData { academy: Academy; units: AcademyUnit[]; leaders: TeamLeader[]; totalProfessors: number; totalStaff: number }
type AcademyErrors = Partial<Record<keyof Academy | "logo", string>>;

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const initialData: AcademySettingsData = {
  academy: { id:"gym-demo", name:"Team Alpha BJJ", cnpj:"12.345.678/0001-90", contactEmail:"suporte@teamalphabjj.com.br", phone:"(21) 2244-9988", foundationDate:"2012-03-12", primaryColor:"#09090B", accentColor:"#22C55E" },
  units: [
    { id:"centro", name:"Matriz Centro", address:"Av. Rio Branco, 156 - Centro, Rio de Janeiro - RJ, 20040-003", isPrimary:true },
    { id:"barra", name:"Unidade Barra", address:"Av. das Américas, 4200 - Barra da Tijuca, Rio de Janeiro - RJ, 22640-102", isPrimary:false },
    { id:"sul", name:"Unidade Zona Sul", address:"Rua Figueiredo de Magalhães, 286 - Copacabana, Rio de Janeiro - RJ, 22031-012", isPrimary:false },
  ],
  leaders: [
    { id:"flavio", name:"Mestre Flávio Almeida", title:"Faixa Vermelha e Preta 7º Grau - Fundador", avatarUrl:"/figma-academy/flavio.png" },
    { id:"carlos", name:"Prof. Carlos Silva", title:"Faixa Preta 2º Grau - Diretor Técnico", avatarUrl:"/figma-academy/carlos.png" },
  ], totalProfessors:12, totalStaff:8,
};

function validateAcademy(academy: Academy): AcademyErrors {
  const errors: AcademyErrors = {};
  if (!academy.name.trim()) errors.name = "Informe o nome da academia.";
  if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(academy.cnpj)) errors.cnpj = "Use o formato 00.000.000/0000-00.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(academy.contactEmail)) errors.contactEmail = "Informe um e-mail válido.";
  if (!/^\(\d{2}\) \d{4,5}-\d{4}$/.test(academy.phone)) errors.phone = "Informe um telefone brasileiro válido.";
  if (!academy.foundationDate || new Date(`${academy.foundationDate}T00:00:00`) > new Date()) errors.foundationDate = "Informe uma data válida que não esteja no futuro.";
  if (!/^#[0-9A-F]{6}$/.test(academy.primaryColor)) errors.primaryColor = "Use uma cor no formato #RRGGBB.";
  if (!/^#[0-9A-F]{6}$/.test(academy.accentColor)) errors.accentColor = "Use uma cor no formato #RRGGBB.";
  return errors;
}

function SectionCard({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return <section className="academy-card"><header><h2>{title}</h2>{action}</header>{children}</section>;
}

function Field({ label, value, editing, error, type="text", onChange }: { label:string; value:string; editing:boolean; error?:string; type?:string; onChange:(value:string)=>void }) {
  return <label className="academy-field"><span>{label}</span>{editing ? <><input type={type} value={value} aria-invalid={Boolean(error)} onChange={event => onChange(event.target.value)} />{error && <small role="alert">{error}</small>}</> : <strong>{type === "date" ? "12 de Março, 2012" : value}</strong>}</label>;
}

export function AcademySettingsPage() {
  const [academy, setAcademy] = useState(initialData.academy);
  const [savedAcademy, setSavedAcademy] = useState(initialData.academy);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<AcademyErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = useMemo(() => JSON.stringify(academy) !== JSON.stringify(savedAcademy) || Boolean(logo), [academy, savedAcademy, logo]);

  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  function update<K extends keyof Academy>(key: K, value: Academy[K]) { setAcademy(current => ({ ...current, [key]: value })); setNotice(null); }
  function placeholder(message: string) { setNotice(message); }
  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) { setErrors(current => ({...current, logo:"Envie um arquivo PNG ou SVG válido."})); return; }
    if (file.size > MAX_LOGO_SIZE) { setErrors(current => ({...current, logo:"A logo deve ter no máximo 2 MB."})); return; }
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogo(file); setLogoPreview(URL.createObjectURL(file)); setErrors(current => ({...current, logo:undefined}));
  }
  async function save() {
    const nextErrors = validateAcademy(academy); setErrors(nextErrors);
    if (Object.keys(nextErrors).length) { setEditing(true); return; }
    if (!dirty || saving) return;
    setSaving(true); await Promise.resolve();
    setSavedAcademy(academy); setLogo(null); setSaving(false); setEditing(false);
    setNotice("Alterações validadas e salvas localmente. A integração com updateGym e armazenamento da logo ainda precisa do gymId autenticado e de um serviço de upload.");
  }
  const saveAction = <><button className="button primary" disabled={!dirty || saving} type="button" onClick={save}><Image src="/figma-academy/save.svg" alt="" width={14} height={14} aria-hidden />{saving ? "Salvando..." : "Salvar Alterações"}</button><span className="divider"/></>;

  return <AdminShell title="Configurações da Academia" breadcrumb="Academia" actions={saveAction}>
    <main className="academy-content">
      {notice && <div className="students-notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={() => setNotice(null)}>×</button></div>}
      <SectionCard title="Informações da Academia" action={<a className="card-action" href="/academia/editar">Editar</a>}>
        <div className="academy-fields"><Field label="Nome da Academia" value={academy.name} editing={editing} error={errors.name} onChange={value=>update("name",value)}/><Field label="CNPJ" value={academy.cnpj} editing={editing} error={errors.cnpj} onChange={value=>update("cnpj",value)}/><Field label="E-mail de Contato" value={academy.contactEmail} editing={editing} error={errors.contactEmail} type="email" onChange={value=>update("contactEmail",value)}/><Field label="Telefone" value={academy.phone} editing={editing} error={errors.phone} onChange={value=>update("phone",value)}/><Field label="Data de Fundação" value={academy.foundationDate} editing={editing} error={errors.foundationDate} type="date" onChange={value=>update("foundationDate",value)}/></div>
      </SectionCard>
      <SectionCard title="Unidades e Endereços" action={<button className="card-action" type="button" onClick={()=>placeholder("O cadastro de unidades aguarda uma rota ou modal integrado ao Convex.")}>Adicionar Unidade</button>}>
        <div className="academy-units">{initialData.units.map(unit=><article key={unit.id}><div><strong>{unit.name}</strong>{unit.isPrimary&&<span>Principal</span>}</div><p>{unit.address}</p></article>)}</div>
      </SectionCard>
      <SectionCard title="Equipe e Liderança" action={<a className="card-action" href="/equipe">Gerenciar</a>}>
        <div className="academy-leaders">{initialData.leaders.map(leader=><article key={leader.id}><Image src={leader.avatarUrl} alt="" width={40} height={40}/><div><strong>{leader.name}</strong><span>{leader.title}</span></div></article>)}</div>
        <div className="academy-stats"><div><span>Total Professores</span><strong>{initialData.totalProfessors}</strong></div><div><span>Monitores e Staff</span><strong>{initialData.totalStaff}</strong></div></div>
      </SectionCard>
      <SectionCard title="Branding e Identidade" action={<button className="card-action" type="button" onClick={()=>fileRef.current?.click()}>Atualizar</button>}>
        <label className="logo-upload"><input ref={fileRef} type="file" accept="image/png,image/svg+xml" onChange={chooseLogo}/>{logoPreview ? <Image src={logoPreview} alt="Prévia da nova logo" width={160} height={48} unoptimized/> : <Image src="/figma-academy/upload.svg" alt="" width={24} height={24} aria-hidden/>}<strong>{logo ? logo.name : "Clique para enviar a logo (PNG, SVG)"}</strong><span>Tamanho recomendado: 400x120px · Máximo: 2 MB</span></label>
        {errors.logo&&<p className="academy-error" role="alert">{errors.logo}</p>}{logo&&<button className="clear-logo" type="button" onClick={()=>{ if(logoPreview)URL.revokeObjectURL(logoPreview); setLogo(null);setLogoPreview(null);if(fileRef.current)fileRef.current.value=""; }}>Remover seleção</button>}
        <div className="color-row"><label><span>Cor Primária</span><div><input type="color" value={academy.primaryColor} onChange={event=>update("primaryColor",event.target.value.toUpperCase())}/><input type="text" value={academy.primaryColor} aria-invalid={Boolean(errors.primaryColor)} onChange={event=>update("primaryColor",event.target.value.toUpperCase())}/></div>{errors.primaryColor&&<small>{errors.primaryColor}</small>}</label><label><span>Cor de Destaque</span><div><input type="color" value={academy.accentColor} onChange={event=>update("accentColor",event.target.value.toUpperCase())}/><input type="text" value={academy.accentColor} aria-invalid={Boolean(errors.accentColor)} onChange={event=>update("accentColor",event.target.value.toUpperCase())}/></div>{errors.accentColor&&<small>{errors.accentColor}</small>}</label></div>
      </SectionCard>
    </main>
  </AdminShell>;
}
