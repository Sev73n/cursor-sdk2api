import { useEffect, useState } from "react";
import { catalogConfigSnippet } from "../model-config";
import { Button } from "../bflabs/Button";
import { CountUp } from "../bflabs/CountUp";
import { modelLooksLikeFable5 } from "../fable5";
import { hrefFor } from "../nav";
import { identityLabel, type RosterItem } from "../roster";
import type { ModelParameter, ModelPayload } from "../types";
import { PageFrame } from "./shared";

export function ModelsPage({
  t,
  roster,
  activeId,
  blockedIds,
  blockError,
  blockBusy,
  onActive,
  onRefresh,
  onCopy,
  onBlock,
}: {
  t: {
    kicker: string;
    title: string;
    desc: string;
    pick: string;
    refresh: string;
    refreshing: string;
    listed: string;
    blocked: string;
    block: string;
    unblock: string;
    copy: string;
    emptyAccounts: string;
    accounts: string;
    testing: string;
    noModels: string;
    noneBlocked: string;
    blockedHint: string;
    params: string;
    variants: string;
    defaultVariant: string;
    noParams: string;
    allowed: string;
    stale: string;
    unavailable: string;
    missingFromCatalog: string;
  };
  roster: RosterItem[];
  activeId: string;
  blockedIds: string[];
  blockError: string;
  blockBusy: boolean;
  onActive: (id: string) => void;
  onRefresh: (id: string) => void;
  onCopy: (value: string) => void;
  onBlock: (id: string, blocked: boolean) => void;
}) {
  const active = roster.find((item) => item.id === activeId);
  const catalog = active?.models?.data ?? [];
  const blocked = new Set(blockedIds);
  const listed = catalog.filter((model) => !blocked.has(model.id));
  const blockedElsewhere = blockedIds.filter((id) => !catalog.some((model) => model.id === id));
  const [selectedId, setSelectedId] = useState("");
  const selected = catalog.find((model) => model.id === selectedId);
  const catalogIds = catalog.map((model) => model.id).join("\n");

  useEffect(() => {
    const ids = catalogIds ? catalogIds.split("\n") : [];
    const hidden = new Set(blockedIds);
    if (selectedId && ids.includes(selectedId)) return;
    const next = ids.find((id) => !hidden.has(id)) ?? ids[0] ?? "";
    if (next !== selectedId) setSelectedId(next);
  }, [activeId, blockedIds, catalogIds, selectedId]);

  return (
    <PageFrame
      kicker={t.kicker}
      title={t.title}
      actions={
        <Button
          variant="primary"
          size="sm"
          disabled={!active || active.testState === "testing"}
          onClick={() => active && onRefresh(active.id)}
        >
          {active?.testState === "testing" ? t.refreshing : t.refresh}
        </Button>
      }
    >
      <p className="page-meta">{t.desc}</p>
      <label className="field page-field">
        <span>{t.pick}</span>
        <select value={activeId} onChange={(event) => onActive(event.target.value)}>
          {roster.length === 0 ? <option value="">{t.emptyAccounts}</option> : null}
          {roster.map((item) => (
            <option key={item.id} value={item.id}>{identityLabel(item.account, item.keyHint)}</option>
          ))}
        </select>
      </label>
      {roster.length === 0 ? <p className="empty"><a href={hrefFor("accounts")}>{t.accounts}</a></p> : null}
      {active?.models?.status === "stale" ? <p className="runtime-hint" role="status">{t.stale}</p> : null}
      {active?.models?.status === "unavailable" ? <p className="runtime-hint" role="status">{t.unavailable}</p> : null}
      {blockError ? <p className="field-error" role="alert">{blockError}</p> : null}
      <dl className="overview">
        <div><dt>{t.listed}</dt><dd><CountUp value={listed.length} /></dd></div>
        <div><dt>{t.blocked}</dt><dd><CountUp value={blockedIds.length} /></dd></div>
      </dl>
      {!active?.models && active ? <p className="empty">{t.testing}</p> : null}
      {active?.models && catalog.length === 0 ? <p className="empty">{t.noModels}</p> : null}
      <div className="model-board">
        <ul className="model-list">
          {catalog.map((model) => {
            const isBlocked = blocked.has(model.id);
            return (
              <li key={model.id} className="model-row">
                <ModelButton model={model} pressed={selected?.id === model.id} blocked={isBlocked} onSelect={setSelectedId} />
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={blockBusy}
                  onClick={() => onBlock(model.id, !isBlocked)}
                >
                  {isBlocked ? t.unblock : t.block}
                </Button>
              </li>
            );
          })}
        </ul>
        <ModelDetail t={t} model={selected} onCopy={onCopy} />
      </div>
      {blockedElsewhere.length > 0 ? (
        <>
          <h2 className="subhead">{t.blocked}</h2>
          <p className="runtime-hint">{t.blockedHint}</p>
          <ul className="model-list">
            {blockedElsewhere.map((id) => (
              <li key={id} className="model-row">
                <div className="model">
                  <span>
                    <span className="mn">{id}</span>
                    <span className="sub">{t.missingFromCatalog}</span>
                  </span>
                </div>
                <Button variant="secondary" size="sm" disabled={blockBusy} onClick={() => onBlock(id, false)}>{t.unblock}</Button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </PageFrame>
  );
}

function ModelButton({
  model,
  pressed,
  blocked,
  onSelect,
}: {
  model: ModelPayload;
  pressed: boolean;
  blocked: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button type="button" className={pressed ? "model is-on" : blocked ? "model is-blocked" : "model"} aria-pressed={pressed} onClick={() => onSelect(model.id)}>
      <span>
        <span className="mn">{model.display_name || model.id}</span>
        <span className="sub">{model.id}</span>
      </span>
      {modelLooksLikeFable5(model.id, model.display_name) ? <span className="tag">Fable 5</span> : null}
    </button>
  );
}

function ModelDetail({
  t,
  model,
  onCopy,
}: {
  t: {
    copy: string;
    params: string;
    variants: string;
    defaultVariant: string;
    noParams: string;
    allowed: string;
  };
  model?: ModelPayload;
  onCopy: (value: string) => void;
}) {
  if (!model) return null;
  const parameters = model.parameters ?? [];
  const variants = model.variants ?? [];
  return (
    <section className="model-detail">
      <header className="model-detail-head">
        <div>
          <h2>{model.display_name || model.id}</h2>
          <p className="sub">{model.id}</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" size="sm" onClick={() => onCopy(catalogConfigSnippet(model))}>{t.copy}</Button>
        </div>
      </header>
      {model.description ? <p className="runtime-hint">{model.description}</p> : null}
      <h3 className="subhead">{t.params}</h3>
      {parameters.length === 0 ? <p className="empty">{t.noParams}</p> : null}
      <dl className="detail-list">
        {parameters.map((parameter) => (
          <div key={parameter.id}>
            <dt>{parameter.displayName || parameter.id}</dt>
            <dd>
              <span className="sub">{parameter.id}</span>
              <ParameterValues parameter={parameter} allowed={t.allowed} />
            </dd>
          </div>
        ))}
      </dl>
      {variants.length > 0 ? (
        <>
          <h3 className="subhead">{t.variants}</h3>
          <table className="route-map">
            <thead>
              <tr>
                <th>{t.variants}</th>
                <th>{t.params}</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant, index) => (
                <tr key={`${variant.displayName ?? "variant"}-${index}`}>
                  <th>
                    {variant.displayName || model.id}
                    {variant.isDefault ? <span className="tag"> {t.defaultVariant}</span> : null}
                  </th>
                  <td className="mono">{(variant.params ?? []).map((item) => `${item.id}=${item.value}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </section>
  );
}

function ParameterValues({ parameter, allowed }: { parameter: ModelParameter; allowed: string }) {
  const values = parameter.values ?? [];
  if (values.length === 0) return null;
  return (
    <span className="param-values">
      <span className="tag">{allowed}</span>
      {values.map((item) => (
        <code key={item.value}>{item.displayName && item.displayName !== item.value ? `${item.displayName} (${item.value})` : item.value}</code>
      ))}
    </span>
  );
}
