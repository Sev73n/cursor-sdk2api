import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { catalogConfigSnippet } from "../../src/catalog/model-config.js";
import { api, closeTestApp, startTestApp, type TestContext } from "../helpers/app.js";

let ctx: TestContext | undefined;

afterEach(async () => {
  if (ctx) await closeTestApp(ctx);
  ctx = undefined;
});

const catalog = {
  ok: true as const,
  models: [
    {
      id: "claude-sonnet-4-6",
      displayName: "Sonnet 4.6",
      description: "Balanced",
      parameters: [{ id: "fast", displayName: "Fast", values: [{ value: "true" }, { value: "false" }] }],
      variants: [{ displayName: "Sonnet", isDefault: true, params: [{ id: "fast", value: "false" }] }],
    },
    { id: "grok-4.6", displayName: "Grok 4.6" },
  ],
};

test("operator blocklist is omitted from GET /v1/models and kept for probe and direct calls", async () => {
  const stateDir = mkdtempSync(join(tmpdir(), "cursor-sdk2api-blocklist-"));
  ctx = await startTestApp({
    config: { stateDir },
    sdk: {
      scripts: [[{ type: "text", chunks: ["still runs"] }]],
      models: catalog,
      modelsByApiKey: { "block-secret-key": catalog },
      accountsByApiKey: { "block-secret-key": { ok: true, identity: { apiKeyName: "block-account" } } },
    },
  });

  const open = await api(ctx, "/v1/models");
  const openBody = (await open.json()) as { data: Array<{ id: string; parameters?: unknown }> };
  expect(openBody.data.map((model) => model.id)).toEqual(["claude-sonnet-4-6", "grok-4.6"]);

  const blocked = await api(ctx, "/v0/management/models/blocklist", {
    method: "PUT",
    body: JSON.stringify({ id: "claude-sonnet-4-6", blocked: true }),
  });
  expect(blocked.status).toBe(200);
  expect(await blocked.json()).toEqual({ ids: ["claude-sonnet-4-6"] });
  const mode = statSync(join(stateDir, "model-blocklist.json")).mode & 0o777;
  if (process.platform !== "win32") expect(mode).toBe(0o600);

  const hidden = (await (await api(ctx, "/v1/models")).json()) as {
    data: Array<{ id: string; parameters?: Array<{ id: string }> }>;
  };
  expect(hidden.data.map((model) => model.id)).toEqual(["grok-4.6"]);

  const created = await fetch(`${ctx.url}/v0/management/accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: "block-secret-key" }),
  });
  const { account } = (await created.json()) as { account: { id: string } };
  const probe = await fetch(`${ctx.url}/v0/management/accounts/probe?id=${encodeURIComponent(account.id)}`);
  const probeBody = (await probe.json()) as { models: { data: Array<{ id: string; parameters?: unknown }> } };
  expect(probeBody.models.data.map((model) => model.id)).toEqual(["claude-sonnet-4-6", "grok-4.6"]);
  expect(probeBody.models.data[0]?.parameters).toEqual([
    { id: "fast", displayName: "Fast", values: [{ value: "true" }, { value: "false" }] },
  ]);

  const called = await api(ctx, "/v1/messages", {
    method: "POST",
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 32,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  expect(called.status).toBe(200);

  await closeTestApp(ctx);
  ctx = await startTestApp({ config: { stateDir }, sdk: { models: catalog } });
  const restored = (await (await api(ctx, "/v1/models")).json()) as { data: Array<{ id: string }> };
  expect(restored.data.map((model) => model.id)).toEqual(["grok-4.6"]);

  const invalid = await api(ctx, "/v0/management/models/blocklist", {
    method: "PUT",
    body: JSON.stringify({ id: "../secret", blocked: true }),
  });
  expect(invalid.status).toBe(400);

  const cleared = await api(ctx, "/v0/management/models/blocklist", {
    method: "PUT",
    body: JSON.stringify({ id: "claude-sonnet-4-6", blocked: false }),
  });
  expect(await cleared.json()).toEqual({ ids: [] });
  const visible = (await (await api(ctx, "/v1/models")).json()) as { data: Array<{ id: string }> };
  expect(visible.data.map((model) => model.id)).toEqual(["claude-sonnet-4-6", "grok-4.6"]);
});

test("copy snippet uses the default variant parameters", () => {
  expect(catalogConfigSnippet({
    id: "claude-sonnet-4-6",
    variants: [
      { isDefault: false, params: [{ id: "fast", value: "true" }] },
      { isDefault: true, params: [{ id: "fast", value: "false" }] },
    ],
  })).toBe(JSON.stringify({
    model: "claude-sonnet-4-6",
    cursor_model_params: [{ id: "fast", value: "false" }],
  }, null, 2));
  expect(catalogConfigSnippet({
    id: "grok-4.6",
    variants: [
      { params: [{ id: "effort", value: "low" }] },
      { params: [{ id: "effort", value: "high" }] },
    ],
  })).toBe(JSON.stringify({ model: "grok-4.6" }, null, 2));
});
