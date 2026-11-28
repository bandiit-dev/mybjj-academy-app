"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import type { Doc, Id } from "@mybjj/backend/convex/_generated/dataModel";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAcademyDay } from "@/hooks/use-academy-day";
import {
  dateLabel,
  field,
  privacyDate,
  privacyError,
  type PrivacyScope,
} from "@/utils/privacy";

type Request = Doc<"privacyRequests">;
type Outcome = NonNullable<Request["outcome"]>;

const kinds = {
  access: "Acesso aos dados",
  correction: "Correção",
  deletion: "Exclusão",
};
const statuses = {
  received: "Recebida",
  verification: "Em verificação",
  review: "Em análise",
  completed: "Concluída",
};
const outcomes = {
  fulfilled: "Atendida",
  partial: "Atendida parcialmente",
  declined: "Indeferida",
};

const protocol = (id: Id<"privacyRequests">) => `LGPD-${id}`;

function RegistrationForm({
  gymId,
  onCreated,
  today,
}: PrivacyScope & {
  onCreated: (id: Id<"privacyRequests">) => void;
  today: string;
}) {
  const register = useMutation(api.privacy.registerRequest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [representation, setRepresentation] =
    useState<Request["representation"]>("self");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const id = await register({
        gymId,
        kind: field(data, "kind") as Request["kind"],
        requesterName: field(data, "name"),
        requesterEmail: field(data, "email"),
        representation,
        subjectName: field(data, "subjectName") || undefined,
        description: field(data, "description"),
        receivedOn: field(data, "receivedOn"),
        dueOn: field(data, "dueOn") || undefined,
      });
      form.reset();
      setRepresentation("self");
      onCreated(id);
    } catch (cause) {
      setError(privacyError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="panel privacy-panel"
      aria-labelledby="privacy-register-heading"
    >
      <h2 id="privacy-register-heading">Registrar solicitação</h2>
      <div className="privacy-fields">
        <label className="management-field">
          <b>Tipo</b>
          <select name="kind">
            {Object.entries(kinds).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="management-field">
          <b>Quem solicita</b>
          <select
            value={representation}
            onChange={(event) =>
              setRepresentation(event.target.value as Request["representation"])
            }
          >
            <option value="self">Titular</option>
            <option value="representative">Representante</option>
          </select>
        </label>
        <label className="management-field">
          <b>Nome do solicitante</b>
          <input name="name" maxLength={120} required />
        </label>
        <label className="management-field">
          <b>E-mail do solicitante</b>
          <input name="email" type="email" maxLength={254} required />
        </label>
        {representation === "representative" && (
          <label className="management-field">
            <b>Nome do titular</b>
            <input name="subjectName" maxLength={120} required />
          </label>
        )}
        <label className="management-field">
          <b>Data de recebimento</b>
          <input
            name="receivedOn"
            type="date"
            defaultValue={today}
            max={today}
            required
          />
        </label>
        <label className="management-field">
          <b>Prazo de resposta</b>
          <input name="dueOn" type="date" />
          <small>
            Em branco, pedidos de acesso recebem o prazo de até 15 dias.
          </small>
        </label>
      </div>
      <label className="management-field">
        <b>Resumo</b>
        <textarea name="description" maxLength={1000} rows={3} />
        <small>
          Inclua apenas as informações necessárias para localizar o pedido.
          Evite números de documentos e anexos.
        </small>
      </label>
      {error && (
        <p role="alert" className="privacy-error">
          {error}
        </p>
      )}
      <div className="privacy-actions">
        <button className="button primary" disabled={busy} type="submit">
          {busy ? "Registrando…" : "Gerar protocolo"}
        </button>
      </div>
    </form>
  );
}

function RequestDetails({
  gymId,
  requestId,
  onClose,
}: PrivacyScope & { requestId: Id<"privacyRequests">; onClose: () => void }) {
  const data = useQuery(api.privacy.requestDetails, { gymId, requestId });
  const update = useMutation(api.privacy.updateRequest);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const loaded = Boolean(data);
  useEffect(() => {
    if (loaded) heading.current?.focus();
  }, [loaded]);

  if (!data)
    return (
      <div className="panel privacy-panel" role="status">
        {data === undefined
          ? "Carregando solicitação…"
          : "Solicitação indisponível."}
      </div>
    );
  const { request, events, assignedToMe } = data;
  type Change = Parameters<typeof update>[0]["change"];
  const number = protocol(requestId);
  const receipt = `mailto:${encodeURIComponent(request.requesterEmail)}?subject=${encodeURIComponent(`Protocolo ${number}`)}&body=${encodeURIComponent(`Recebemos sua solicitação de privacidade. Seu protocolo de atendimento é ${number}.`)}`;

  async function change(updateRequest: Change) {
    setBusy(true);
    setError("");
    try {
      await update({
        gymId,
        requestId,
        revision: request.revision,
        change: updateRequest,
      });
    } catch (cause) {
      setError(privacyError(cause));
    } finally {
      setBusy(false);
    }
  }

  function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void change({
      type: "complete",
      outcome: field(data, "outcome") as Outcome,
      resolution: field(data, "resolution"),
    });
  }

  return (
    <section
      className="panel privacy-panel"
      aria-labelledby="privacy-request-heading"
    >
      <div className="privacy-heading">
        <div>
          <h2 id="privacy-request-heading" tabIndex={-1} ref={heading}>
            {kinds[request.kind]}
          </h2>
          <p className="privacy-protocol">{number}</p>
        </div>
        <button type="button" className="button secondary" onClick={onClose}>
          Fechar detalhes
        </button>
      </div>
      <dl className="privacy-fields privacy-facts">
        <div>
          <dt>Situação</dt>
          <dd>{statuses[request.status]}</dd>
        </div>
        <div>
          <dt>Solicitante</dt>
          <dd>
            {request.requesterName} ·{" "}
            {request.representation === "self" ? "Titular" : "Representante"}
          </dd>
        </div>
        <div>
          <dt>E-mail</dt>
          <dd>{request.requesterEmail}</dd>
        </div>
        {request.subjectName && (
          <div>
            <dt>Titular</dt>
            <dd>{request.subjectName}</dd>
          </div>
        )}
        <div>
          <dt>Responsável pelo atendimento</dt>
          <dd>{request.assignedToName}</dd>
        </div>
        <div>
          <dt>Recebida em</dt>
          <dd>{dateLabel(request.receivedOn)}</dd>
        </div>
        <div>
          <dt>Prazo de resposta</dt>
          <dd>{dateLabel(request.dueOn)}</dd>
        </div>
        {request.identityVerifiedAt !== undefined && (
          <div>
            <dt>Identidade verificada</dt>
            <dd>{privacyDate.format(request.identityVerifiedAt)}</dd>
          </div>
        )}
        {request.outcome && (
          <div>
            <dt>Resultado</dt>
            <dd>{outcomes[request.outcome]}</dd>
          </div>
        )}
      </dl>
      {request.description && (
        <div>
          <h3>Resumo</h3>
          <p className="privacy-text">{request.description}</p>
        </div>
      )}
      {request.resolution && (
        <div>
          <h3>Justificativa</h3>
          <p className="privacy-text">{request.resolution}</p>
        </div>
      )}
      <div className="privacy-actions">
        <a href={receipt} className="button secondary">
          Abrir confirmação por e-mail
        </a>
        {request.status !== "completed" && !assignedToMe && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => void change({ type: "assign" })}
          >
            Assumir atendimento
          </button>
        )}
        {request.status === "received" && (
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void change({ type: "verify" })}
          >
            Iniciar verificação
          </button>
        )}
      </div>
      {request.status === "verification" && (
        <div className="privacy-actions">
          <label className="privacy-check">
            <input
              type="checkbox"
              checked={verified}
              onChange={(event) => setVerified(event.target.checked)}
            />{" "}
            Confirmei a identidade e, quando aplicável, a representação.
          </label>
          <button
            type="button"
            className="button primary"
            disabled={busy || !verified}
            onClick={() =>
              void change({ type: "review", identityVerified: verified })
            }
          >
            Enviar para análise
          </button>
        </div>
      )}
      {(request.status === "review" || request.status === "verification") && (
        <form onSubmit={complete} className="privacy-subsection">
          <h3>
            {request.status === "verification"
              ? "Encerrar sem verificar identidade"
              : "Concluir solicitação"}
          </h3>
          <label className="management-field">
            <b>Resultado</b>
            <select name="outcome">
              {Object.entries(outcomes)
                .filter(
                  ([value]) =>
                    request.status === "review" || value === "declined",
                )
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label className="management-field">
            <b>Justificativa</b>
            <textarea name="resolution" rows={3} maxLength={1000} required />
          </label>
          <div className="privacy-actions">
            <button type="submit" className="button secondary" disabled={busy}>
              Salvar conclusão
            </button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="privacy-error">
          {error}
        </p>
      )}
      <div className="privacy-subsection">
        <h3>Atividade recente</h3>
        <ul className="privacy-events">
          {events.map((event) => (
            <li key={event._id}>
              <time dateTime={new Date(event._creationTime).toISOString()}>
                {privacyDate.format(event._creationTime)}
              </time>{" "}
              · {event.actorName} ·{" "}
              {event.kind === "assigned"
                ? "Assumiu o atendimento"
                : statuses[event.status]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function PrivacyRequests({ gymId }: PrivacyScope) {
  const today = useAcademyDay();
  const [filter, setFilter] = useState<Request["status"] | "">("");
  const [open, setOpen] = useState<Id<"privacyRequests">>();
  const requests = usePaginatedQuery(
    api.privacy.listRequests,
    { gymId, status: filter || undefined },
    { initialNumItems: 20 },
  );

  return (
    <>
      <RegistrationForm
        gymId={gymId}
        today={today}
        onCreated={(id) => {
          setOpen(id);
          setFilter("");
        }}
      />
      {open && (
        <RequestDetails
          key={open}
          gymId={gymId}
          requestId={open}
          onClose={() => setOpen(undefined)}
        />
      )}
      <section
        className="panel privacy-panel"
        aria-labelledby="privacy-queue-heading"
      >
        <div className="privacy-heading">
          <h2 id="privacy-queue-heading">Fila de solicitações</h2>
          <label className="management-field">
            <b>Situação</b>
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as typeof filter)
              }
            >
              <option value="">Todas</option>
              {Object.entries(statuses).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {requests.status === "LoadingFirstPage" ? (
          <p role="status">Carregando solicitações…</p>
        ) : requests.results.length ? (
          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th scope="col">Protocolo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Recebida</th>
                  <th scope="col">Prazo</th>
                  <th scope="col">Responsável</th>
                </tr>
              </thead>
              <tbody>
                {requests.results.map((request) => (
                  <tr key={request._id}>
                    <td>
                      <button
                        type="button"
                        className="button secondary privacy-protocol"
                        onClick={() => setOpen(request._id)}
                      >
                        {protocol(request._id)}
                      </button>
                    </td>
                    <td>{kinds[request.kind]}</td>
                    <td>{statuses[request.status]}</td>
                    <td>{dateLabel(request.receivedOn)}</td>
                    <td>
                      {dateLabel(request.dueOn)}
                      {request.status !== "completed" &&
                        request.dueOn &&
                        request.dueOn < today && (
                          <strong className="privacy-error">
                            {" "}
                            · Em atraso
                          </strong>
                        )}
                    </td>
                    <td>{request.assignedToName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhuma solicitação nesta situação.</p>
        )}
        {(requests.status === "CanLoadMore" ||
          requests.status === "LoadingMore") && (
          <div className="privacy-actions">
            <button
              type="button"
              className="button secondary"
              disabled={requests.status === "LoadingMore"}
              onClick={() => requests.loadMore(20)}
            >
              Carregar mais
            </button>
          </div>
        )}
      </section>
    </>
  );
}
