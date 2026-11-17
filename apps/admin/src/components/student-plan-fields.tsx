"use client";

import Link from "next/link";
import { academyToday, getStudentPlan, PLAN_MONTHS, type StudentPlan } from "@mybjj/backend/convex/lib/studentPlans";

export function readStudentPlan(data: FormData): StudentPlan {
  return {
    type: String(data.get("planType")) as StudentPlan["type"],
    startDate: String(data.get("planStartDate")), isActive: data.get("planActive") === "on"
  };
}

export function StudentPlanFields({plan, detailsHref}: {plan?: StudentPlan; detailsHref?: string}) {
  const current = plan ?? {...getStudentPlan({}), startDate: academyToday()};
  return <section className="management-section student-plan-section">
    <h2>Plano e situação do aluno</h2>
    <div className="management-fields">
      <label className="management-field"><span>Plano *</span><select name="planType" required defaultValue={current.type}>
        {Object.keys(PLAN_MONTHS).map(type=><option key={type} value={type}>{type}</option>)}
      </select></label>
      <label className="management-field"><span>Início do plano *</span><input name="planStartDate" type="date" required defaultValue={current.startDate}/></label>
      <label className="account-access-option"><input name="planActive" type="checkbox" defaultChecked={current.isActive}/>
        Aluno ativo (plano ativo)
      </label>
      <p className="account-access-help">A situação do aluno é controlada pela academia. Os pagamentos são registrados separadamente.</p>
      {detailsHref&&<Link className="card-action" href={detailsHref}>Ver detalhes e histórico de pagamentos</Link>}
    </div>
  </section>;
}
