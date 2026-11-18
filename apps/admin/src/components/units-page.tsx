"use client";

import { api } from "@mybjj/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminShell } from "@/components/dashboard";

function Icon({ name }: { name: string }) {
  return (
    <Image
      src={`/figma-students/${name}`}
      alt=""
      width={16}
      height={16}
      aria-hidden
    />
  );
}
export function UnitsPage() {
  const units = useQuery(api.unities.getAllUnities);
  const gyms = useQuery(api.gyms.getAllGyms);
  const [search, setSearch] = useState("");
  const [gymId, setGymId] = useState("all");
  const gymById = useMemo(
    () => new Map((gyms ?? []).map((item) => [item._id, item])),
    [gyms],
  );
  const filtered = useMemo(
    () =>
      (units ?? []).filter((item) => {
        const gym = item.gymId ? gymById.get(item.gymId) : undefined;
        const term = search.trim().toLocaleLowerCase("pt-BR");
        return (
          (!term ||
            [item.name ?? "", item.address, gym?.name ?? ""].some((v) =>
              v.toLocaleLowerCase("pt-BR").includes(term),
            )) &&
          (gymId === "all" || item.gymId === gymId)
        );
      }),
    [units, gymById, search, gymId],
  );
  const action = (
    <>
      <Link className="button primary" href="/unidades/nova">
        <Image
          src="/figma-dashboard/plus.svg"
          alt=""
          width={14}
          height={14}
          aria-hidden
        />
        Adicionar Unidade
      </Link>
    </>
  );
  return (
    <AdminShell title="Unidades" actions={action}>
      <main className="units-content">
        <section className="filters-bar">
          <label className="search-field units-search">
            <Icon name="search.svg" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, endereço ou academia..."
              aria-label="Buscar unidades"
            />
          </label>
          <label className="filter-select">
            <span>Academia:</span>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)}>
              <option value="all">Todas</option>
              {(gyms ?? []).map((gym) => (
                <option value={gym._id} key={gym._id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
        </section>
        <section className="units-table-card">
          <div className="table-scroll">
            <table className="units-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Academia</th>
                  <th>Endereço</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const gym = item.gymId ? gymById.get(item.gymId) : undefined;
                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="unit-identity">
                          <span className="unit-symbol">U</span>
                          <div>
                            <strong>
                              {item.name ?? item.address.split(",")[0]}
                            </strong>
                            <small>Unidade</small>
                          </div>
                        </div>
                      </td>
                      <td>{gym?.name ?? "Sem academia"}</td>
                      <td>{item.address}</td>
                      <td>{item.phone || gym?.phone || "—"}</td>
                      <td className="unit-email">{gym?.email ?? "—"}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            href={`/unidades/${item._id}/editar`}
                            title="Editar unidade"
                          >
                            <Icon name="edit.svg" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {units === undefined || gyms === undefined ? (
            <div className="students-empty">
              <strong>Carregando unidades...</strong>
            </div>
          ) : filtered.length === 0 ? (
            <div className="students-empty">
              <strong>Nenhuma unidade encontrada</strong>
              <span>Unidades aparecerão aqui após serem adicionadas.</span>
            </div>
          ) : (
            <div className="students-pagination">
              <span>
                Mostrando {filtered.length} de {units.length} unidades
              </span>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
