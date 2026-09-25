import { afterEach, expect, test } from "vitest";
import { closeTestApp, startTestApp, type TestContext } from "../helpers/app.js";
import {
  assistantText,
  buildWorkbuddyPrompt,
  parseVerifyResult,
  prettyConfig,
  stripCodeFence,
  withGatewayKey,
  readExportDraft,
} from "../../web/src/export/workbuddy.js";

let ctx: TestContext | undefined;

afterEach(async () => {
  if (ctx) await closeTestApp(ctx);
  ctx = undefined;
});

test("workbuddy export keeps json and rejects a failed check", () => {
  expect(stripCodeFence("```json\n[{\"id\":\"default\"}]\n```")).toBe("[{\"id\":\"default\"}]");
  expect(assistantText({
    content: [{ type: "text", text: "[{\"id\":\"default\"}]" }],
  })).toBe("[{\"id\":\"default\"}]");
  expect(prettyConfig("[{\"id\":\"default\"}]")).toBe(`[
  {
    "id": "default"
  }
]`);
  expect(parseVerifyResult("{\"ok\":true}")).toEqual({ ok: true });
  expect(parseVerifyResult("{\"ok\":false,\"errors\":[\"default: name\"]}")).toEqual({
    ok: false,
    errors: ["default: name"],
  });
  expect(parseVerifyResult("not json").ok).toBe(false);
  expect(buildWorkbuddyPrompt({
    rules: "rules",
    catalogJson: "[]",
    origin: "http://127.0.0.1:8080",
    generationId: "gen-1",
  })).toContain("http://127.0.0.1:8080/v1/chat/completions");
  expect(buildWorkbuddyPrompt({
    rules: "rules",
    catalogJson: "[]",
    origin: "http://127.0.0.1:8080",
    generationId: "gen-1",
  })).toContain("<GATEWAY_ACCESS_KEY>");
  expect(buildWorkbuddyPrompt({
    rules: "rules",
    catalogJson: "[]",
    origin: "http://127.0.0.1:8080",
    generationId: "gen-a",
  })).not.toBe(buildWorkbuddyPrompt({
    rules: "rules",
    catalogJson: "[]",
    origin: "http://127.0.0.1:8080",
    generationId: "gen-b",
  }));
  expect(withGatewayKey('[{"apiKey":"<GATEWAY_ACCESS_KEY>"}]', "local-gateway-key")).toBe(
    '[{"apiKey":"local-gateway-key"}]',
  );
  expect(readExportDraft(JSON.stringify({
    origin: "http://127.0.0.1:8080",
    config: '[{"apiKey":"<GATEWAY_ACCESS_KEY>"}]',
    errors: [],
    phase: "passed",
  }))?.phase).toBe("passed");
  expect(readExportDraft(JSON.stringify({
    origin: "http://127.0.0.1:8080",
    config: '[{"apiKey":"secret"}]',
    errors: [],
    phase: "passed",
  }))).toBeUndefined();
});

test("gateway key is available to the local copy action", async () => {
  ctx = await startTestApp({ config: { gatewayAccessKey: "copy-gateway-key" } });
  const response = await fetch(`${ctx.url}/v0/management/gateway_access_key`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ api_key: "copy-gateway-key" });
});
