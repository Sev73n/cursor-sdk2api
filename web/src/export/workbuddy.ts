export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function assistantText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const content = (body as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const record = part as { type?: unknown; text?: unknown };
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function buildWorkbuddyPrompt(input: {
  rules: string;
  catalogJson: string;
  origin: string;
  generationId: string;
}): string {
  return `你是配置生成器。只输出一个 JSON 数组。不要 Markdown，不要解释。
本次生成编号：${input.generationId}
生成编号只用于区分本次请求，不要写入 JSON。

规则文档是唯一的字段规则。文档里出现的模型名只是例子，不得当作名单。
模型名单、参数 id、允许值、默认变体只以目录 JSON 为准。
目录里的每个模型恰好生成一条。目录外的 id 不要输出。

规则文档：
${input.rules}

目录 JSON（GET /v1/models 的 data，已去掉屏蔽模型）：
${input.catalogJson}

网关 origin：${input.origin}

硬性要求：
- 顶层必须是 JSON 数组，不要包成对象。
- 禁止出现 availableModels、relatedModels、temperature、onlyReasoning、cursor_model_params、maxOutputTokens。
- 每条 url 必须是 ${input.origin}/v1/chat/completions
- apiKey 必须是字符串 <GATEWAY_ACCESS_KEY>，不要写真实密钥。
- vendor 必须是 Custom，useCustomProtocol 必须是 true。
- supportsToolCall 与 supportsImages 都是 true。
- id 使用目录 id。name 使用 display_name，没有 display_name 时用 id。
- 参数 id 正好是 effort 时，supportsReasoning 为 true，并写 reasoning。supportedEfforts 按目录 values 的 value 原样、按原顺序复制。defaultEffort 取 isDefault 变体里 effort 的值；没有 isDefault 且只有一个变体时用那个变体；多个变体都没有 isDefault 时不要猜，supportsReasoning 设为 false 且不要写 reasoning。
- 参数 id 是 reasoning_effort 或 reasoning，或没有思考参数时，supportsReasoning 为 false，不要写 reasoning。
- 不要把 minimal、max、xhigh、extra-high 互相替换。
- 目录参数里有 context 时，按默认变体的 context 值填写 maxInputTokens：256k=256000，272k=272000，300k=300000，500k=500000，1m=1000000。没有 context 参数就不要写 maxInputTokens。没有 isDefault 且无法确定唯一变体时，不要写 maxInputTokens。`;
}

export function buildWorkbuddyVerifyPrompt(input: {
  rules: string;
  catalogJson: string;
  origin: string;
  candidate: string;
  generationId: string;
}): string {
  return `你是配置校验器。不要改写配置。只输出一个 JSON 对象，不要 Markdown。
本次校验编号：${input.generationId}
校验编号只用于区分本次请求，不要写入 JSON。

通过时只输出：
{"ok":true}

失败时只输出：
{"ok":false,"errors":["具体问题"]}

每条 error 指出模型 id 和违反的规则。

规则文档：
${input.rules}

目录 JSON：
${input.catalogJson}

网关 origin：${input.origin}

待校验文本：
${input.candidate}

按这个清单判断，有一条不满足就是失败：
1. 待校验文本能解析成 JSON 数组。
2. 数组里的 id 集合与目录 id 集合完全一致，没有重复。
3. 每个 id 都在目录里。
4. 全文不包含 availableModels、relatedModels、temperature、onlyReasoning、cursor_model_params、maxOutputTokens。
5. 每条的 vendor、useCustomProtocol、supportsToolCall、supportsImages、url、apiKey 符合规则文档和上面的 origin。apiKey 必须正好是 <GATEWAY_ACCESS_KEY>。
6. name 等于该模型的 display_name；目录没有 display_name 时等于 id。
7. 思考字段只按该模型目录里的参数 id 判断，不按规则文档中的例子模型判断。
8. 打开 reasoning 时，supportedEfforts 与目录 values 的 value 原样且顺序一致；defaultEffort 来自 isDefault 变体。不得替换别名。
9. maxInputTokens 只在目录有 context 且能确定默认变体时出现，并且等于该变体 context 的映射值。`;
}

export function parseVerifyResult(text: string): { ok: true } | { ok: false; errors: string[] } {
  try {
    const parsed = JSON.parse(stripCodeFence(text)) as { ok?: unknown; errors?: unknown };
    if (parsed.ok === true) return { ok: true };
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    return { ok: false, errors: errors.length > 0 ? errors : ["校验结果不是通过。"] };
  } catch {
    return { ok: false, errors: ["校验结果不是 JSON。"] };
  }
}

export interface ExportDraft {
  origin: string;
  config: string;
  errors: string[];
  phase: "passed" | "failed";
}

export function readExportDraft(raw: string | null): ExportDraft | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<ExportDraft>;
    const phase = parsed.phase === "passed" || parsed.phase === "failed" ? parsed.phase : undefined;
    const config = typeof parsed.config === "string" ? parsed.config : "";
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors.filter((item): item is string => typeof item === "string")
      : [];
    if (!phase || (phase === "passed" && !config.includes("<GATEWAY_ACCESS_KEY>"))) return undefined;
    return {
      origin: typeof parsed.origin === "string" && parsed.origin.trim() ? parsed.origin : "",
      config,
      errors,
      phase,
    };
  } catch {
    return undefined;
  }
}

export function withGatewayKey(config: string, apiKey: string): string {
  return config.replaceAll("<GATEWAY_ACCESS_KEY>", apiKey);
}

export function prettyConfig(text: string): string | undefined {
  try {
    const parsed = JSON.parse(stripCodeFence(text)) as unknown;
    if (!Array.isArray(parsed)) return undefined;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return undefined;
  }
}
