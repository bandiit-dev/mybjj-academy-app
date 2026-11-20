"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import {
  assertInvitationEmail,
  BELTS,
  BELT_LABELS,
  formatUnityAddress,
  type Belt,
} from "@mybjj/backend/convex/lib/validators";
import type { Doc, Id } from "@mybjj/backend/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  StudentPlanFields,
  readStudentPlan,
} from "@/components/student-plan-fields";
import { ImageFileField } from "@/components/image-file-field";
import { useImageUpload } from "@/lib/image-uploads";
import { AdminShell } from "@/components/dashboard";

type Option = { label: string; value: string };
function Field({
  name,
  label,
  required,
  placeholder,
  type = "text",
  options,
  defaultValue,
  textarea,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  options?: Option[];
  defaultValue?: string;
  textarea?: boolean;
}) {
  return (
    <label className="management-field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {options ? (
        <select
          name={name}
          required={required}
          defaultValue={defaultValue ?? ""}
        >
          <option value="" disabled>
            {placeholder ?? "Selecione"}
          </option>
          {options.map((x) => (
            <option value={x.value} key={x.value}>
              {x.label}
            </option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      ) : (
        <input
          name={name}
          required={required}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
function Section({
  title,
  children,
  onChange,
}: {
  title: string;
  children: ReactNode;
  onChange?: () => void;
}) {
  return (
    <section className="management-section" onChange={onChange}>
      <h2>{title}</h2>
      <div className="management-fields">{children}</div>
    </section>
  );
}
function friendlyError(cause: unknown) {
  const message = cause instanceof Error ? cause.message : "";
  if (
    /plano|pagamento|JPG|PNG|2 MB|ler a imagem|carregar a imagem/.test(message)
  )
    return message;
  if (message.includes("already has an account or pending invitation"))
    return "Este aluno já possui uma conta ou convite de acesso.";
  if (message.includes("dateOfBirth"))
    return "Informe uma data de nascimento válida, até a data de hoje.";
  if (message.includes("valid email"))
    return "Informe um e-mail válido para criar a conta do aluno.";
  if (message.includes("Unauthorized"))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (message.includes("Forbidden") || message.includes("admin role required"))
    return "Você não tem permissão para realizar esta ação.";
  if (message.includes("already") || message.includes("duplicate"))
    return "Já existe um cadastro com estes dados.";
  return "Não foi possível salvar. Revise os campos e tente novamente.";
}
function Shell({
  title,
  breadcrumb,
  backHref,
  saveLabel,
  busy,
  error,
  onSubmit,
  children,
}: {
  title: string;
  breadcrumb: string;
  backHref: string;
  saveLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (data: FormData) => Promise<void>;
  children: ReactNode;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!busy) await onSubmit(new FormData(e.currentTarget));
  }
  const back = (
    <>
      <Link className="button secondary form-back" href={backHref}>
        ← Voltar
      </Link>
    </>
  );
  return (
    <AdminShell title={title} breadcrumb={breadcrumb} actions={back}>
      <main className="management-content">
        {error && (
          <div className="students-notice" role="alert">
            <span>{error}</span>
          </div>
        )}
        <form
          id="management-form"
          className="management-card"
          onSubmit={submit}
        >
          {children}
        </form>
        <div className="management-actions">
          <Link className="button secondary" href={backHref}>
            Cancelar
          </Link>
          <button
            className="button primary form-save"
            form="management-form"
            disabled={busy}
            type="submit"
          >
            {busy ? "Salvando..." : saveLabel}
          </button>
        </div>
      </main>
    </AdminShell>
  );
}
function useSubmit(backHref: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.push(backHref);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
const belts: Option[] = BELTS.map((value) => ({
  value,
  label: `Faixa ${BELT_LABELS[value]}`,
}));
const teacherModalities: Option[] = [
  { label: "GI", value: "GI" },
  { label: "NO-GI", value: "NOGI" },
  { label: "GI e NO-GI", value: "GI_NOGI" },
];

function UnitFields({
  gyms,
  unit,
}: {
  gyms: Doc<"gyms">[] | undefined;
  unit?: Doc<"unities">;
}) {
  const [addressChanged, setAddressChanged] = useState(false);
  const details = unit?.addressDetails;
  const requireDetails = !unit || Boolean(details) || addressChanged;
  return (
    <>
      <Section title="Dados da unidade">
        <Field
          name="gymId"
          label="Academia"
          required
          placeholder={
            gyms === undefined ? "Carregando..." : "Selecione a academia"
          }
          options={(gyms ?? []).map((gym) => ({
            label: gym.name,
            value: gym._id,
          }))}
          defaultValue={unit?.gymId ?? undefined}
        />
        <Field
          name="name"
          label="Nome da Unidade"
          required
          placeholder="Ex.: Unidade Centro"
          defaultValue={unit?.name ?? unit?.address.split(",")[0]}
        />
        <Field
          name="phone"
          label="Telefone"
          type="tel"
          placeholder="(11) 99999-9999"
          defaultValue={unit?.phone}
        />
      </Section>
      <Section title="Endereço" onChange={() => setAddressChanged(true)}>
        {unit && !details && (
          <p className="account-access-help">
            O endereço atual está no campo Endereço. Ao alterá-lo, distribua as
            informações nos campos abaixo.
          </p>
        )}
        <Field
          name="postalCode"
          label="CEP"
          placeholder="Ex.: 01310-100"
          defaultValue={details?.postalCode}
        />
        <Field
          name="address"
          label="Endereço"
          required
          placeholder="Ex.: Avenida Paulista"
          defaultValue={details?.street ?? unit?.address}
        />
        <div className="field-pair">
          <Field
            name="number"
            label="Número"
            required={requireDetails}
            defaultValue={details?.number}
          />
          <Field
            name="complement"
            label="Complemento"
            defaultValue={details?.complement}
          />
        </div>
        <Field
          name="district"
          label="Bairro"
          defaultValue={details?.district}
        />
        <div className="field-pair">
          <Field
            name="city"
            label="Cidade"
            required={requireDetails}
            defaultValue={details?.city}
          />
          <Field
            name="state"
            label="Estado"
            required={requireDetails}
            defaultValue={details?.state}
          />
        </div>
      </Section>
    </>
  );
}

function unitFormValues(data: FormData, unit?: Doc<"unities">) {
  const value = (name: string) => String(data.get(name) ?? "").trim();
  const addressDetails = {
    street: value("address"),
    number: value("number"),
    complement: value("complement"),
    district: value("district"),
    city: value("city"),
    state: value("state"),
    postalCode: value("postalCode"),
  };
  const keepLegacyAddress =
    unit &&
    !unit.addressDetails &&
    addressDetails.street === unit.address &&
    ![
      addressDetails.number,
      addressDetails.complement,
      addressDetails.district,
      addressDetails.city,
      addressDetails.state,
      addressDetails.postalCode,
    ].some(Boolean);
  return {
    name: value("name"),
    phone: value("phone"),
    gymId: (data.get("gymId") || null) as Id<"gyms"> | null,
    address: keepLegacyAddress
      ? unit.address
      : formatUnityAddress(addressDetails),
    ...(keepLegacyAddress ? {} : { addressDetails }),
  };
}

export function AddUnitForm() {
  const gyms = useQuery(api.gyms.getAllGyms);
  const create = useMutation(api.unities.createUnity);
  const submit = useSubmit("/unidades");
  return (
    <Shell
      title="Adicionar Unidade"
      breadcrumb="Unidades / Adicionar Unidade"
      backHref="/unidades"
      saveLabel="Salvar unidade"
      {...submit}
      onSubmit={async (data) => submit.run(() => create(unitFormValues(data)))}
    >
      <UnitFields gyms={gyms} />
    </Shell>
  );
}

export function AddProfessorForm() {
  const uploadImage = useImageUpload();
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const invite = useAction(api.provisioning.inviteTeacher);
  const submit = useSubmit("/professores");
  return (
    <Shell
      title="Adicionar Professor"
      breadcrumb="Professores / Adicionar Professor"
      backHref="/professores"
      saveLabel="Convidar professor"
      {...submit}
      onSubmit={async (d) =>
        submit.run(async () =>
          invite({
            name: String(d.get("name")),
            email: String(d.get("email")),
            phone: String(d.get("phone")),
            belt: String(d.get("belt")) as Belt,
            degree: Number(d.get("degree")),
            gymId: d.get("gymId") as Id<"gyms">,
            unityId: d.get("unityId") as Id<"unities">,
            role: String(d.get("role")),
            picture: await uploadImage(d, "picture"),
            classType: String(
              d.get("classType"),
            ) as Doc<"teachers">["classType"],
            userType: String(d.get("userType")) as "Normal",
            redirectUrl: `${window.location.origin}/`,
          }),
        )
      }
    >
      <Section title="Dados pessoais">
        <Field name="name" label="Nome completo" required />
        <Field name="email" label="E-mail" required type="email" />
        <Field name="phone" label="Telefone" required />
        <div className="field-pair">
          <Field name="belt" label="Faixa" required options={belts} />
          <Field
            name="degree"
            label="Grau"
            required
            type="number"
            defaultValue="0"
          />
        </div>
        <ImageFileField name="picture" label="Foto" />
      </Section>
      <Section title="Informações profissionais">
        <Field
          name="gymId"
          label="Academia"
          required
          options={(gyms ?? []).map((x) => ({ label: x.name, value: x._id }))}
        />
        <Field
          name="unityId"
          label="Unidade"
          required
          options={(units ?? []).map((x) => ({
            label: x.name ?? x.address,
            value: x._id,
          }))}
        />
        <Field name="role" label="Função" required />
        <div className="field-pair">
          <Field
            name="classType"
            label="Modalidade"
            required
            options={teacherModalities}
          />
          <Field
            name="userType"
            label="Permissão"
            required
            options={[
              { label: "Professor", value: "Normal" },
              { label: "Administrador", value: "Admin" },
            ]}
          />
        </div>
      </Section>
    </Shell>
  );
}

export function AddStudentForm() {
  const uploadImage = useImageUpload();
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const invite = useAction(api.provisioning.inviteStudent);
  const create = useMutation(api.students.createStudentWithoutAccount);
  const [createAccount, setCreateAccount] = useState(false);
  const submit = useSubmit("/alunos");
  return (
    <Shell
      title="Adicionar Aluno"
      breadcrumb="Alunos / Adicionar Aluno"
      backHref="/alunos"
      saveLabel={createAccount ? "Salvar e convidar aluno" : "Salvar aluno"}
      {...submit}
      onSubmit={async (d) =>
        submit.run(async () => {
          const email = String(d.get("email") ?? "").trim();
          if (createAccount) assertInvitationEmail(email);

          const profile = {
            plan: readStudentPlan(d),
            name: String(d.get("name")),
            email,
            phone: String(d.get("phone") ?? ""),
            dateOfBirth: String(d.get("dateOfBirth") ?? "") || undefined,
            belt: String(d.get("belt")) as Belt,
            degree: Number(d.get("degree")),
            gymId: d.get("gymId") as Id<"gyms">,
            unityId: d.get("unityId") as Id<"unities">,
            picture: await uploadImage(d, "picture"),
          };
          return createAccount
            ? invite({ ...profile, redirectUrl: `${window.location.origin}/` })
            : create(profile);
        })
      }
    >
      <Section title="Dados pessoais">
        <div className="form-grid four">
          <Field name="name" label="Nome completo" required />
          <Field name="dateOfBirth" label="Data de nascimento" type="date" />
          <Field
            name="email"
            label="E-mail"
            required={createAccount}
            type="email"
          />
          <Field name="phone" label="Telefone" />
          <Field name="belt" label="Faixa" required options={belts} />
          <Field
            name="degree"
            label="Grau"
            required
            type="number"
            defaultValue="0"
          />
          <Field
            name="gymId"
            label="Academia"
            required
            options={(gyms ?? []).map((x) => ({ label: x.name, value: x._id }))}
          />
          <Field
            name="unityId"
            label="Unidade"
            required
            options={(units ?? []).map((x) => ({
              label: x.name ?? x.address,
              value: x._id,
            }))}
          />
          <ImageFileField name="picture" label="Foto" />
        </div>
      </Section>
      <StudentPlanFields />
      <Section title="Acesso ao aplicativo">
        <label className="account-access-option">
          <input
            type="checkbox"
            name="createAccount"
            checked={createAccount}
            onChange={(event) => setCreateAccount(event.target.checked)}
            aria-describedby="account-access-help"
          />
          Criar conta para o aluno acessar o aplicativo
        </label>
        <p className="account-access-help" id="account-access-help">
          {createAccount
            ? "Informe um e-mail para enviar o convite de acesso ao aluno."
            : "O aluno será cadastrado sem acesso ao aplicativo. E-mail e telefone são opcionais."}
        </p>
      </Section>
    </Shell>
  );
}

export function CreateClassForm() {
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const teachers = useQuery(api.teachers.getAllTeachers);
  const create = useMutation(api.classes.createClass);
  const submit = useSubmit("/aulas");
  return (
    <Shell
      title="Criar Aula"
      breadcrumb="Aulas / Criar Aula"
      backHref="/aulas"
      saveLabel="Criar aula"
      {...submit}
      onSubmit={async (d) =>
        submit.run(() =>
          create({
            gymIds: [d.get("gymId") as Id<"gyms">],
            unityIds: [d.get("unityId") as Id<"unities">],
            teacherIds: [d.get("teacherId") as Id<"teachers">],
            classType: String(d.get("classType")) as "GI",
            level: String(d.get("level")) as "Beginner",
            startHour: String(d.get("startHour")),
            duration: String(d.get("duration")),
            weekDays: d.getAll("weekDays") as (
              | "Monday"
              | "Tuesday"
              | "Wednesday"
              | "Thursday"
              | "Friday"
              | "Saturday"
              | "Sunday"
            )[],
          }),
        )
      }
    >
      <Section title="Informações da aula">
        <Field
          name="gymId"
          label="Academia"
          required
          options={(gyms ?? []).map((x) => ({ label: x.name, value: x._id }))}
        />
        <Field
          name="unityId"
          label="Unidade"
          required
          options={(units ?? []).map((x) => ({
            label: x.name ?? x.address,
            value: x._id,
          }))}
        />
        <Field
          name="teacherId"
          label="Professor"
          required
          options={(teachers ?? []).map((x) => ({
            label: x.name,
            value: x._id,
          }))}
        />
        <div className="field-pair">
          <Field
            name="classType"
            label="Modalidade"
            required
            options={[
              { label: "GI", value: "GI" },
              { label: "NOGI", value: "NOGI" },
            ]}
          />
          <Field
            name="level"
            label="Nível"
            required
            options={[
              { label: "Iniciante", value: "Beginner" },
              { label: "Avançado", value: "Advanced" },
            ]}
          />
        </div>
      </Section>
      <Section title="Recorrência e horário">
        <Field
          name="startHour"
          label="Horário de início"
          required
          type="time"
        />
        <Field
          name="duration"
          label="Duração"
          required
          placeholder="Ex.: 60 min"
        />
        <fieldset className="weekday-field">
          <legend>Dias da semana *</legend>
          {[
            ["Monday", "Seg"],
            ["Tuesday", "Ter"],
            ["Wednesday", "Qua"],
            ["Thursday", "Qui"],
            ["Friday", "Sex"],
            ["Saturday", "Sáb"],
            ["Sunday", "Dom"],
          ].map(([v, l]) => (
            <label key={v}>
              <input type="checkbox" name="weekDays" value={v} />
              {l}
            </label>
          ))}
        </fieldset>
      </Section>
    </Shell>
  );
}

function LoadingForm({ title }: { title: string }) {
  return (
    <AdminShell title={title}>
      <main className="management-content">
        <div className="students-empty">
          <strong>Carregando dados...</strong>
        </div>
      </main>
    </AdminShell>
  );
}
function MissingForm({ title }: { title: string }) {
  return (
    <AdminShell title={title}>
      <main className="management-content">
        <div className="students-empty">
          <strong>Cadastro não encontrado</strong>
        </div>
      </main>
    </AdminShell>
  );
}

export function EditStudentForm({ studentId }: { studentId: Id<"students"> }) {
  const uploadImage = useImageUpload();
  const student = useQuery(api.students.getStudentById, { studentId });
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const update = useMutation(api.students.updateStudent);
  const invite = useAction(api.provisioning.inviteExistingStudent);
  const [createAccount, setCreateAccount] = useState(false);
  const submit = useSubmit("/alunos");
  if (student === undefined || gyms === undefined || units === undefined)
    return <LoadingForm title="Editar Aluno" />;
  if (!student) return <MissingForm title="Editar Aluno" />;
  const shouldInvite = createAccount && !student.clerkUserId;
  return (
    <Shell
      title="Editar Aluno"
      breadcrumb="Alunos / Editar Aluno"
      backHref="/alunos"
      saveLabel={shouldInvite ? "Salvar e convidar aluno" : "Salvar alterações"}
      {...submit}
      onSubmit={async (data) =>
        submit.run(async () => {
          const profile = {
            plan: readStudentPlan(data),
            studentId,
            name: String(data.get("name")),
            email: String(data.get("email") ?? ""),
            phone: String(data.get("phone") ?? ""),
            dateOfBirth: String(data.get("dateOfBirth") ?? ""),
            belt: String(data.get("belt")) as Belt,
            degree: Number(data.get("degree")),
            picture: await uploadImage(data, "picture"),
          };
          const gymId = data.get("gymId") as Id<"gyms">;
          const unityId = data.get("unityId") as Id<"unities">;
          return shouldInvite
            ? invite({
                ...profile,
                gymId,
                unityId,
                redirectUrl: `${window.location.origin}/`,
              })
            : update({ ...profile, gymIds: [gymId], unityIds: [unityId] });
        })
      }
    >
      <Section title="Dados pessoais">
        <div className="form-grid four">
          <Field
            name="name"
            label="Nome completo"
            required
            defaultValue={student.name}
          />
          <Field
            name="dateOfBirth"
            label="Data de nascimento"
            type="date"
            defaultValue={student.dateOfBirth}
          />
          <Field
            name="email"
            label="E-mail"
            required={shouldInvite || Boolean(student.clerkUserId)}
            type="email"
            defaultValue={student.email}
          />
          <Field name="phone" label="Telefone" defaultValue={student.phone} />
          <Field
            name="belt"
            label="Faixa"
            required
            options={belts}
            defaultValue={student.belt}
          />
          <Field
            name="degree"
            label="Grau"
            required
            type="number"
            defaultValue={String(student.degree)}
          />
          <Field
            name="gymId"
            label="Academia"
            required
            options={gyms.map((x) => ({ label: x.name, value: x._id }))}
            defaultValue={student.gymIds[0]}
          />
          <Field
            name="unityId"
            label="Unidade"
            required
            options={units.map((x) => ({
              label: x.name ?? x.address,
              value: x._id,
            }))}
            defaultValue={student.unityIds[0]}
          />
          <ImageFileField
            name="picture"
            label="Foto"
            currentUrl={student.picture}
          />
        </div>
      </Section>
      <StudentPlanFields
        plan={student.plan}
        detailsHref={`/alunos/${studentId}`}
      />
      <Section title="Acesso ao aplicativo">
        {student.clerkUserId ? (
          <p className="account-access-help">
            {student.clerkUserId.startsWith("invitation:")
              ? "Um convite de acesso já foi enviado para este aluno."
              : "Este aluno já possui uma conta de acesso ao aplicativo."}
          </p>
        ) : (
          <>
            <label className="account-access-option">
              <input
                type="checkbox"
                name="createAccount"
                checked={createAccount}
                onChange={(event) => setCreateAccount(event.target.checked)}
                aria-describedby="edit-account-access-help"
              />
              Criar conta para o aluno acessar o aplicativo
            </label>
            <p className="account-access-help" id="edit-account-access-help">
              {createAccount
                ? "Informe um e-mail para enviar o convite de acesso ao aluno."
                : "O aluno continuará sem acesso ao aplicativo. E-mail e telefone são opcionais."}
            </p>
          </>
        )}
      </Section>
    </Shell>
  );
}

export function EditProfessorForm({
  teacherId,
}: {
  teacherId: Id<"teachers">;
}) {
  const uploadImage = useImageUpload();
  const teacher = useQuery(api.teachers.getTeacherById, { teacherId });
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const update = useMutation(api.teachers.updateTeacher);
  const submit = useSubmit("/professores");
  if (teacher === undefined || gyms === undefined || units === undefined)
    return <LoadingForm title="Editar Professor" />;
  if (!teacher) return <MissingForm title="Editar Professor" />;
  return (
    <Shell
      title="Editar Professor"
      breadcrumb="Professores / Editar Professor"
      backHref="/professores"
      saveLabel="Salvar alterações"
      {...submit}
      onSubmit={async (d) =>
        submit.run(async () =>
          update({
            teacherId,
            name: String(d.get("name")),
            email: String(d.get("email")),
            phone: String(d.get("phone")),
            belt: String(d.get("belt")) as Belt,
            degree: Number(d.get("degree")),
            gymIds: [d.get("gymId") as Id<"gyms">],
            unityIds: [d.get("unityId") as Id<"unities">],
            role: String(d.get("role")),
            picture: await uploadImage(d, "picture"),
            classType: String(
              d.get("classType"),
            ) as Doc<"teachers">["classType"],
            userType: String(d.get("userType")) as "Normal",
          }),
        )
      }
    >
      <Section title="Dados pessoais">
        <Field
          name="name"
          label="Nome completo"
          required
          defaultValue={teacher.name}
        />
        <Field
          name="email"
          label="E-mail"
          required
          type="email"
          defaultValue={teacher.email}
        />
        <Field
          name="phone"
          label="Telefone"
          required
          defaultValue={teacher.phone}
        />
        <div className="field-pair">
          <Field
            name="belt"
            label="Faixa"
            required
            options={belts}
            defaultValue={teacher.belt}
          />
          <Field
            name="degree"
            label="Grau"
            required
            type="number"
            defaultValue={String(teacher.degree)}
          />
        </div>
        <ImageFileField
          name="picture"
          label="Foto"
          currentUrl={teacher.picture}
        />
      </Section>
      <Section title="Informações profissionais">
        <Field
          name="gymId"
          label="Academia"
          required
          options={gyms.map((x) => ({ label: x.name, value: x._id }))}
          defaultValue={teacher.gymIds[0]}
        />
        <Field
          name="unityId"
          label="Unidade"
          required
          options={units.map((x) => ({
            label: x.name ?? x.address,
            value: x._id,
          }))}
          defaultValue={teacher.unityIds[0]}
        />
        <Field
          name="role"
          label="Função"
          required
          defaultValue={teacher.role}
        />
        <div className="field-pair">
          <Field
            name="classType"
            label="Modalidade"
            required
            options={teacherModalities}
            defaultValue={teacher.classType}
          />
          <Field
            name="userType"
            label="Permissão"
            required
            options={[
              { label: "Professor", value: "Normal" },
              { label: "Administrador", value: "Admin" },
            ]}
            defaultValue={teacher.userType}
          />
        </div>
      </Section>
    </Shell>
  );
}

export function EditUnitForm({ unityId }: { unityId: Id<"unities"> }) {
  const unit = useQuery(api.unities.getUnityById, { unityId });
  const gyms = useQuery(api.gyms.getAllGyms);
  const update = useMutation(api.unities.updateUnity);
  const submit = useSubmit("/unidades");
  if (unit === undefined || gyms === undefined)
    return <LoadingForm title="Editar Unidade" />;
  if (!unit) return <MissingForm title="Editar Unidade" />;
  return (
    <Shell
      title="Editar Unidade"
      breadcrumb="Unidades / Editar Unidade"
      backHref="/unidades"
      saveLabel="Salvar alterações"
      {...submit}
      onSubmit={async (data) =>
        submit.run(() => update({ unityId, ...unitFormValues(data, unit) }))
      }
    >
      <UnitFields key={unityId} gyms={gyms} unit={unit} />
    </Shell>
  );
}

const weekDays = [
  ["Monday", "Seg"],
  ["Tuesday", "Ter"],
  ["Wednesday", "Qua"],
  ["Thursday", "Qui"],
  ["Friday", "Sex"],
  ["Saturday", "Sáb"],
  ["Sunday", "Dom"],
] as const;
export function EditClassForm({ classId }: { classId: Id<"classes"> }) {
  const item = useQuery(api.classes.getClassById, { classId });
  const gyms = useQuery(api.gyms.getAllGyms);
  const units = useQuery(api.unities.getAllUnities);
  const teachers = useQuery(api.teachers.getAllTeachers);
  const update = useMutation(api.classes.updateClass);
  const submit = useSubmit("/aulas");
  if (
    item === undefined ||
    gyms === undefined ||
    units === undefined ||
    teachers === undefined
  )
    return <LoadingForm title="Editar Aula" />;
  if (!item) return <MissingForm title="Editar Aula" />;
  return (
    <Shell
      title="Editar Aula"
      breadcrumb="Aulas / Editar Aula"
      backHref="/aulas"
      saveLabel="Salvar alterações"
      {...submit}
      onSubmit={async (d) =>
        submit.run(() =>
          update({
            classId,
            gymIds: [d.get("gymId") as Id<"gyms">],
            unityIds: [d.get("unityId") as Id<"unities">],
            teacherIds: [d.get("teacherId") as Id<"teachers">],
            classType: String(d.get("classType")) as "GI",
            level: String(d.get("level")) as "Beginner",
            startHour: String(d.get("startHour")),
            duration: String(d.get("duration")),
            weekDays: d.getAll("weekDays") as (
              | "Monday"
              | "Tuesday"
              | "Wednesday"
              | "Thursday"
              | "Friday"
              | "Saturday"
              | "Sunday"
            )[],
          }),
        )
      }
    >
      <Section title="Informações da aula">
        <Field
          name="gymId"
          label="Academia"
          required
          options={gyms.map((x) => ({ label: x.name, value: x._id }))}
          defaultValue={item.gymIds[0]}
        />
        <Field
          name="unityId"
          label="Unidade"
          required
          options={units.map((x) => ({
            label: x.name ?? x.address,
            value: x._id,
          }))}
          defaultValue={item.unityIds[0]}
        />
        <Field
          name="teacherId"
          label="Professor"
          required
          options={teachers.map((x) => ({ label: x.name, value: x._id }))}
          defaultValue={item.teacherIds[0]}
        />
        <div className="field-pair">
          <Field
            name="classType"
            label="Modalidade"
            required
            options={[
              { label: "GI", value: "GI" },
              { label: "NOGI", value: "NOGI" },
            ]}
            defaultValue={item.classType}
          />
          <Field
            name="level"
            label="Nível"
            required
            options={[
              { label: "Iniciante", value: "Beginner" },
              { label: "Avançado", value: "Advanced" },
            ]}
            defaultValue={item.level}
          />
        </div>
      </Section>
      <Section title="Recorrência e horário">
        <Field
          name="startHour"
          label="Horário de início"
          required
          type="time"
          defaultValue={item.startHour}
        />
        <Field
          name="duration"
          label="Duração"
          required
          defaultValue={item.duration}
        />
        <fieldset className="weekday-field">
          <legend>Dias da semana *</legend>
          {weekDays.map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                name="weekDays"
                value={value}
                defaultChecked={item.weekDays.includes(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </Section>
    </Shell>
  );
}

export function EditAcademyForm() {
  const uploadImage = useImageUpload();
  const gyms = useQuery(api.gyms.getAllGyms);
  const gym = gyms?.[0];
  const update = useMutation(api.gyms.updateGym);
  const submit = useSubmit("/academia");
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (gym) setKey(1);
  }, [gym]);
  if (gyms === undefined)
    return (
      <AdminShell title="Editar Academia">
        <main className="management-content">
          <div className="students-empty">
            <strong>Carregando academia...</strong>
          </div>
        </main>
      </AdminShell>
    );
  if (!gym)
    return (
      <AdminShell title="Editar Academia">
        <main className="management-content">
          <div className="students-empty">
            <strong>Nenhuma academia cadastrada</strong>
          </div>
        </main>
      </AdminShell>
    );
  return (
    <Shell
      key={key}
      title="Editar Academia"
      breadcrumb="Academia / Editar Academia"
      backHref="/academia"
      saveLabel="Salvar alterações"
      {...submit}
      onSubmit={async (d) =>
        submit.run(async () =>
          update({
            gymId: gym._id,
            teamName: String(d.get("teamName") ?? ""),
            name: String(d.get("name")),
            cnpj: String(d.get("cnpj")),
            phone: String(d.get("phone")),
            email: String(d.get("email")),
            founded: String(d.get("founded")),
            branding: {
              logoUrl: (await uploadImage(d, "logoUrl")) || undefined,
              primaryColor: String(d.get("primaryColor")) || undefined,
              secondaryColor: String(d.get("secondaryColor")) || undefined,
            },
          }),
        )
      }
    >
      <Section title="Dados da academia">
        <Field
          name="name"
          label="Nome da academia"
          required
          defaultValue={gym.name}
        />
        <Field
          name="teamName"
          label="Equipe"
          placeholder="Nome da equipe"
          defaultValue={gym.teamName}
        />
        <Field name="cnpj" label="CNPJ" required defaultValue={gym.cnpj} />
        <div className="field-pair">
          <Field
            name="phone"
            label="Telefone"
            required
            defaultValue={gym.phone}
          />
          <Field
            name="email"
            label="E-mail"
            required
            type="email"
            defaultValue={gym.email}
          />
        </div>
        <Field
          name="founded"
          label="Fundação"
          required
          type="date"
          defaultValue={gym.founded}
        />
      </Section>
      <Section title="Branding">
        <ImageFileField
          name="logoUrl"
          label="Logo"
          currentUrl={gym.branding.logoUrl}
        />
        <Field
          name="primaryColor"
          label="Cor primária"
          defaultValue={gym.branding.primaryColor}
        />
        <Field
          name="secondaryColor"
          label="Cor secundária"
          defaultValue={gym.branding.secondaryColor}
        />
      </Section>
    </Shell>
  );
}
