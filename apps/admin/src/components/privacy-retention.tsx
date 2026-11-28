"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Doc, Id } from "@mybjj/backend/convex/_generated/dataModel";
import { reminderRetentionTrigger } from "@mybjj/backend/convex/lib/privacy";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import {
  dateLabel,
  field,
  privacyDate,
  privacyError,
  type PrivacyScope,
} from "@/utils/privacy";

type Rule = Doc<"retentionRules">;
type Category = Rule["category"];

const categories: Record<Category, string> = {
  reminders: "Lembretes de mensalidade",
  unlinkedPhotos: "Uploads de fotos sem vínculo",
  studentRecords: "Cadastros, fotos de perfil, presenças e graduações",
  studentPayments: "Mensalidades dos alunos",
  portalBilling: "Assinatura e cobrança do portal",
  backups: "Backups e exportações",
  requests: "Solicitações de privacidade",
};
const dispositions: Record<Rule["disposition"], string> = {
  review: "Revisar caso a caso",
  delete: "Eliminar",
  anonymize: "Anonimizar",
  minimize: "Remover conteúdo excedente",
};

function DraftForm({
  gymId,
  category,
  latest,
  onSaved,
  onCancel,
}: PrivacyScope & {
  category: Category;
  latest: Rule | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const save = useMutation(api.privacy.saveRetentionDraft);
  const [baseVersion] = useState(latest?.version ?? 0);
  const [disposition, setDisposition] = useState<Rule["disposition"]>(
    latest?.disposition ?? (category === "reminders" ? "minimize" : "review"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reminder = category === "reminders";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const period = field(data, "days");
    setBusy(true);
    setError("");
    try {
      await save({
        gymId,
        category,
        baseVersion,
        purpose: field(data, "purpose"),
        storageLocation: field(data, "location"),
        startEvent: field(data, "start"),
        retentionDays: period === "" ? undefined : Number(period),
        disposition,
        exceptions: field(data, "exceptions"),
      });
      onSaved();
    } catch (cause) {
      setError(privacyError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="privacy-subsection">
      <h3>Novo rascunho</h3>
      <div className="privacy-fields">
        <label className="management-field">
          <b>Finalidade</b>
          <input
            name="purpose"
            defaultValue={
              latest?.purpose ??
              (reminder ? "Enviar lembretes e evitar disparos duplicados" : "")
            }
            maxLength={300}
            required
          />
        </label>
        <label className="management-field">
          <b>Onde os dados ficam</b>
          <input
            name="location"
            defaultValue={
              latest?.storageLocation ?? (reminder ? "Convex e Resend" : "")
            }
            maxLength={300}
            required
          />
        </label>
        <label className="management-field">
          <b>Início do prazo</b>
          <input
            name="start"
            defaultValue={
              reminder ? reminderRetentionTrigger : latest?.startEvent
            }
            readOnly={reminder}
            maxLength={180}
            required
          />
        </label>
        <label className="management-field">
          <b>Prazo em dias</b>
          <input
            name="days"
            defaultValue={latest?.retentionDays}
            type="number"
            min={0}
            max={36525}
            step={1}
            required={reminder && disposition === "minimize"}
          />
        </label>
        <label className="management-field">
          <b>Destino</b>
          <select
            value={disposition}
            onChange={(event) =>
              setDisposition(event.target.value as Rule["disposition"])
            }
          >
            {Object.entries(dispositions)
              .filter(
                ([value]) =>
                  !reminder || value === "minimize" || value === "review",
              )
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="management-field">
        <b>Exceções de conservação</b>
        <textarea
          name="exceptions"
          defaultValue={latest?.exceptions}
          maxLength={1000}
          rows={3}
        />
      </label>
      {error && (
        <p role="alert" className="privacy-error">
          {error}
        </p>
      )}
      <div className="privacy-actions">
        <button type="submit" className="button primary" disabled={busy}>
          Salvar rascunho
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar edição
        </button>
      </div>
    </form>
  );
}

function ReminderPreview({
  gymId,
  ruleId,
  hasExceptions,
}: {
  gymId: Id<"gyms">;
  ruleId: Id<"retentionRules">;
  hasExceptions: boolean;
}) {
  const [asOf, setAsOf] = useState<number>();
  const preview = usePaginatedQuery(
    api.privacy.previewReminderCleanup,
    asOf ? { gymId, ruleId, asOf } : "skip",
    { initialNumItems: 25 },
  );
  const loading =
    preview.status === "LoadingFirstPage" || preview.status === "LoadingMore";
  const label = hasExceptions
    ? preview.results.length === 1
      ? "candidato à revisão"
      : "candidatos à revisão"
    : preview.results.length === 1
      ? "lembrete elegível"
      : "lembretes elegíveis";

  return (
    <section
      className="privacy-subsection"
      aria-labelledby="privacy-preview-heading"
    >
      <h3 id="privacy-preview-heading">Prévia de limpeza dos lembretes</h3>
      <p>
        Simula a remoção do destinatário, do assunto e da mensagem após o prazo
        da regra. O registro de envio continua disponível. A prévia considera o
        prazo e a janela de reenvio. As exceções documentadas exigem revisão
        manual.
      </p>
      <div className="privacy-actions">
        <button
          type="button"
          className="button secondary"
          disabled={asOf !== undefined && loading}
          onClick={() => setAsOf(Date.now())}
        >
          {asOf ? "Atualizar prévia" : "Simular limpeza"}
        </button>
      </div>
      {asOf !== undefined && (
        <>
          <p role="status">
            {loading
              ? "Verificando lembretes…"
              : `${preview.results.length} ${label}${preview.status === "Exhausted" ? "" : " nas páginas carregadas"}. Nenhum dado foi alterado.`}
          </p>
          {preview.results.length > 0 && (
            <div className="privacy-table-wrap">
              <table className="privacy-table">
                <thead>
                  <tr>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Envio</th>
                    <th scope="col">Fim da retenção</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.results.map((row) => (
                    <tr key={row.id}>
                      <td>{dateLabel(row.dueDate)}</td>
                      <td>
                        {row.status === "sent"
                          ? "Aceito para envio"
                          : "Falha registrada"}
                      </td>
                      <td>{privacyDate.format(row.eligibleAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(preview.status === "CanLoadMore" ||
            preview.status === "LoadingMore") && (
            <div className="privacy-actions">
              <button
                type="button"
                className="button secondary"
                disabled={loading}
                onClick={() => preview.loadMore(25)}
              >
                Verificar mais lembretes
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RuleWorkspace({
  gymId,
  category,
  latest,
  approved,
}: PrivacyScope & {
  category: Category;
  latest: Rule | null;
  approved: Rule | null;
}) {
  const approve = useMutation(api.privacy.approveRetentionRule);
  const history = usePaginatedQuery(
    api.privacy.retentionHistory,
    { gymId, category },
    { initialNumItems: 10 },
  );
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function publish(ruleId: Id<"retentionRules">) {
    setBusy(true);
    setError("");
    try {
      await approve({ gymId, ruleId });
    } catch (cause) {
      setError(privacyError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel privacy-panel"
      aria-labelledby="privacy-rule-heading"
    >
      <div className="privacy-heading">
        <div>
          <h2 id="privacy-rule-heading">{categories[category]}</h2>
          <p>
            {approved
              ? `Versão aprovada v${approved.version}`
              : "Nenhuma versão aprovada"}
          </p>
        </div>
        <div className="privacy-actions">
          {!editing && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(true)}
            >
              Novo rascunho
            </button>
          )}
          {!editing && latest?.status === "draft" && (
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void publish(latest._id)}
            >
              Aprovar v{latest.version}
            </button>
          )}
        </div>
      </div>
      {editing && (
        <DraftForm
          gymId={gymId}
          category={category}
          latest={latest}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}
      {category === "unlinkedPhotos" && (
        <p>O Convex já limpa uploads de alunos sem vínculo após 24 horas.</p>
      )}
      {error && (
        <p role="alert" className="privacy-error">
          {error}
        </p>
      )}
      <div className="privacy-subsection">
        <h3>Histórico de versões</h3>
        {history.status === "LoadingFirstPage" ? (
          <p role="status">Carregando versões…</p>
        ) : (
          !history.results.length && <p>Nenhuma versão registrada.</p>
        )}
        {history.results.map((rule) => (
          <details
            className="privacy-version"
            key={rule._id}
            open={rule._id === latest?._id ? true : undefined}
          >
            <summary>
              v{rule.version} ·{" "}
              {rule._id === approved?._id
                ? "Aprovada, vigente"
                : rule.status === "approved"
                  ? "Aprovada, substituída"
                  : "Rascunho"}{" "}
              · {dispositions[rule.disposition]}
            </summary>
            <dl className="privacy-fields privacy-facts">
              <div>
                <dt>Finalidade</dt>
                <dd>{rule.purpose}</dd>
              </div>
              <div>
                <dt>Armazenamento</dt>
                <dd>{rule.storageLocation}</dd>
              </div>
              <div>
                <dt>Início do prazo</dt>
                <dd>{rule.startEvent}</dd>
              </div>
              <div>
                <dt>Prazo</dt>
                <dd>
                  {rule.retentionDays === undefined
                    ? "A definir"
                    : `${rule.retentionDays} dias`}
                </dd>
              </div>
              <div>
                <dt>Exceções</dt>
                <dd>{rule.exceptions || "—"}</dd>
              </div>
              <div>
                <dt>Criada por</dt>
                <dd>
                  {rule.authoredByName} ·{" "}
                  {privacyDate.format(rule._creationTime)}
                </dd>
              </div>
              {rule.approvedAt !== undefined && (
                <div>
                  <dt>Aprovada por</dt>
                  <dd>
                    {rule.approvedByName} ·{" "}
                    {privacyDate.format(rule.approvedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </details>
        ))}
        {(history.status === "CanLoadMore" ||
          history.status === "LoadingMore") && (
          <div className="privacy-actions">
            <button
              type="button"
              className="button secondary"
              disabled={history.status === "LoadingMore"}
              onClick={() => history.loadMore(10)}
            >
              Carregar versões anteriores
            </button>
          </div>
        )}
      </div>
      {category === "reminders" &&
        gymId &&
        (approved?.disposition === "minimize" &&
        approved.retentionDays !== undefined ? (
          <ReminderPreview
            key={approved._id}
            gymId={gymId}
            ruleId={approved._id}
            hasExceptions={Boolean(approved.exceptions)}
          />
        ) : (
          <p>
            Aprove uma regra de remoção do conteúdo para habilitar a prévia de
            limpeza dos lembretes.
          </p>
        ))}
    </section>
  );
}

export function PrivacyRetention({ gymId }: PrivacyScope) {
  const rules = useQuery(api.privacy.listRetention, { gymId });
  const [category, setCategory] = useState<Category>();
  const selected =
    rules?.find((rule) => rule.category === category) ?? rules?.[0];
  return (
    <>
      <section
        className="panel privacy-panel"
        aria-labelledby="privacy-retention-heading"
      >
        <h2 id="privacy-retention-heading">Tabela de retenção</h2>
        <p>
          Documente os prazos e as exceções. A aprovação registra a versão
          vigente da regra. A limpeza desta área funciona em modo de simulação.
        </p>
        {rules ? (
          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">Prazo aprovado</th>
                  <th scope="col">Destino aprovado</th>
                  <th scope="col">Última versão</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.category}>
                    <td>
                      <button
                        type="button"
                        className={`button ${rule.category === selected?.category ? "primary" : "secondary"}`}
                        aria-pressed={rule.category === selected?.category}
                        onClick={() => setCategory(rule.category)}
                      >
                        {categories[rule.category]}
                      </button>
                    </td>
                    <td>
                      {rule.approved?.retentionDays === undefined
                        ? "—"
                        : `${rule.approved.retentionDays} dias`}
                    </td>
                    <td>
                      {rule.approved
                        ? dispositions[rule.approved.disposition]
                        : "—"}
                    </td>
                    <td>
                      {rule.latest
                        ? `v${rule.latest.version} · ${rule.latest.status === "draft" ? "Rascunho" : "Aprovada"}`
                        : "A definir"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p role="status">Carregando regras…</p>
        )}
      </section>
      {selected && (
        <RuleWorkspace key={selected.category} gymId={gymId} {...selected} />
      )}
    </>
  );
}
