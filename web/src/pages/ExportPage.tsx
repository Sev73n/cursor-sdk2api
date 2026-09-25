import { useEffect, useState } from "react";
import { getGatewayAccessKey, getManagedModels, runAutoPrompt } from "../api";
import { Button } from "../bflabs/Button";
import { Tabs } from "../bflabs/Tabs";
import { WORKBUDDY_RULES } from "../export/rules";
import {
  assistantText,
  buildWorkbuddyPrompt,
  buildWorkbuddyVerifyPrompt,
  parseVerifyResult,
  prettyConfig,
  readExportDraft,
  stripCodeFence,
  withGatewayKey,
  type ExportDraft,
} from "../export/workbuddy";
import { hrefFor } from "../nav";
import type { RosterItem } from "../roster";
import type { ModelsPayload } from "../types";
import { PageFrame } from "./shared";

type Phase = "idle" | "generating" | "verifying" | "passed" | "failed";

const EXPORT_DRAFT_KEY = "csgw-export-workbuddy";

function initialExportDraft(): ExportDraft | undefined {
  try {
    return readExportDraft(window.localStorage.getItem(EXPORT_DRAFT_KEY));
  } catch {
    return undefined;
  }
}

export function ExportPage({
  t,
  roster,
  onCopy,
}: {
  t: {
    kicker: string;
    title: string;
    desc: string;
    origin: string;
    generate: string;
    generating: string;
    verifying: string;
    copy: string;
    copyHint: string;
    passed: string;
    failed: string;
    empty: string;
    accounts: string;
    preview: string;
    blockedNote: string;
    using: string;
    noAccount: string;
  };
  roster: RosterItem[];
  onCopy: (value: string) => void;
}) {
  const saved = initialExportDraft();
  const [origin, setOrigin] = useState(() => saved?.origin || window.location.origin);
  const [catalog, setCatalog] = useState<ModelsPayload>();
  const [loadError, setLoadError] = useState("");
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "idle");
  const [errors, setErrors] = useState<string[]>(saved?.errors ?? []);
  const [config, setConfig] = useState(saved?.config ?? "");
  const [runError, setRunError] = useState("");

  useEffect(() => {
    if (phase !== "passed" && phase !== "failed") return;
    try {
      window.localStorage.setItem(EXPORT_DRAFT_KEY, JSON.stringify({ origin, config, errors, phase }));
    } catch {
      // private mode
    }
  }, [origin, config, errors, phase]);

  useEffect(() => {
    let cancel = false;
    void getManagedModels()
      .then((next) => {
        if (!cancel) setCatalog(next);
      })
      .catch((error: unknown) => {
        if (!cancel) setLoadError(error instanceof Error ? error.message : "Request failed");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const ids = catalog?.data.map((model) => model.id) ?? [];
  const account = roster.find((item) => item.models?.data.some((model) => model.id === "default")) ?? roster[0];

  const generate = async () => {
    if (!catalog || ids.length === 0 || !account) return;
    setPhase("generating");
    setErrors([]);
    setConfig("");
    setRunError("");
    try {
      const catalogJson = JSON.stringify(catalog.data, null, 2);
      const generationId = crypto.randomUUID();
      const gatewayOrigin = origin.trim() || window.location.origin;
      const drafted = await runAutoPrompt(account.id, buildWorkbuddyPrompt({
        rules: WORKBUDDY_RULES,
        catalogJson,
        origin: gatewayOrigin,
        generationId,
      }));
      const candidate = stripCodeFence(assistantText(drafted));
      setPhase("verifying");
      const verdictBody = await runAutoPrompt(account.id, buildWorkbuddyVerifyPrompt({
        rules: WORKBUDDY_RULES,
        catalogJson,
        origin: gatewayOrigin,
        candidate,
        generationId,
      }));
      const verdict = parseVerifyResult(assistantText(verdictBody));
      if (verdict.ok) {
        setConfig(prettyConfig(candidate) ?? candidate);
        setPhase("passed");
        return;
      }
      setErrors(verdict.errors);
      setPhase("failed");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Request failed");
      setPhase("failed");
    }
  };

  const copyWithKey = async () => {
    setRunError("");
    try {
      const apiKey = await getGatewayAccessKey();
      onCopy(withGatewayKey(config, apiKey));
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Request failed");
    }
  };

  return (
    <PageFrame kicker={t.kicker} title={t.title}>
      <p className="page-meta">{t.desc}</p>
      <Tabs
        className="bf-tabs--bare"
        label="Channel"
        value="workbuddy"
        items={[{ value: "workbuddy", label: "WorkBuddy", content: null }]}
      />
      <label className="field page-field">
        <span>{t.origin}</span>
        <input value={origin} onChange={(event) => setOrigin(event.target.value)} spellCheck={false} />
      </label>
      {loadError ? <p className="field-error" role="alert">{loadError}</p> : null}
      {catalog && ids.length === 0 ? <p className="empty">{t.empty} <a href={hrefFor("accounts")}>{t.accounts}</a></p> : null}
      {ids.length > 0 ? (
        <>
          <h2 className="subhead">{t.preview}</h2>
          <p className="runtime-hint">{t.blockedNote}</p>
          <ul className="model-plain">
            {catalog?.data.map((model) => (
              <li key={model.id}>
                <strong>{model.display_name || model.id}</strong>
                <span className="sub">{model.id}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="sendrow">
        <Button
          variant="primary"
          size="sm"
          disabled={!account || ids.length === 0 || phase === "generating" || phase === "verifying"}
          loading={phase === "generating" || phase === "verifying"}
          onClick={() => void generate()}
        >
          {phase === "generating" ? t.generating : phase === "verifying" ? t.verifying : t.generate}
        </Button>
      </div>
      {account && ids.length > 0 ? <p className="runtime-hint">{t.using} {account.keyHint}</p> : null}
      {!account && ids.length > 0 ? <p className="empty">{t.noAccount} <a href={hrefFor("accounts")}>{t.accounts}</a></p> : null}
      {runError ? <p className="field-error" role="alert">{runError}</p> : null}
      {phase === "failed" && errors.length > 0 ? (
        <>
          <h2 className="subhead">{t.failed}</h2>
          <ul className="model-plain">
            {errors.map((error) => <li key={error}><span>{error}</span></li>)}
          </ul>
        </>
      ) : null}
      {phase === "passed" && config ? (
        <>
          <h2 className="subhead">{t.passed}</h2>
          <div className="sendrow">
            <Button variant="primary" size="sm" onClick={() => void copyWithKey()}>{t.copy}</Button>
          </div>
          <p className="runtime-hint">{t.copyHint}</p>
          <pre className="out page-out">{config}</pre>
        </>
      ) : null}
    </PageFrame>
  );
}
