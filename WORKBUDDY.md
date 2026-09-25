# WorkBuddy 自定义模型生成规则

给 WorkBuddy 增加 Cursor 网关模型时按本文件生成条目。目标是调用参数和 Cursor 目录一致，并且不改动 WorkBuddy 自带模型。

模型名单以当前账号的 `GET /v1/models` 为准，不要抄旧清单。`id` 必须是目录里的 id，例如 `grok-4.7`，不能用显示名。

## 文件形状

WorkBuddy 的自定义模型是一个 JSON 数组。不要包成 `{ "models": [...], "availableModels": [...] }`。

禁止写入：

- `availableModels`：下拉列表会只剩这里列出的 id，自带模型消失。
- `relatedModels`：轻量任务和深思考任务会被改派，自带模型的场景路由跟着失效。`lite`、`reasoning` 会生效；`vision`、`longContext`、`subagent` 仍是预留字段。
- `temperature`：网关收下后不传给 `@cursor/sdk`。
- `onlyReasoning`：客户端会强制走思考模式。目录参数名不是 `effort` 的模型会因此 502。

密钥用网关的 `GATEWAY_ACCESS_KEY`，不要写 Cursor User API Key，也不要把真实密钥提交进仓库。

## 每条模型

```json
{
  "id": "<catalog id>",
  "name": "<display name>",
  "vendor": "Custom",
  "url": "http://127.0.0.1:8080/v1/chat/completions",
  "apiKey": "<GATEWAY_ACCESS_KEY>",
  "supportsToolCall": true,
  "supportsImages": true,
  "supportsReasoning": false,
  "useCustomProtocol": true
}
```

`url` 必须是完整的 `/v1/chat/completions`。`useCustomProtocol: true` 时，WorkBuddy 按这个地址原样请求，不会再拼一次路径。

`supportsImages: true` 只表示接受图片。图片必须是 base64；远程 `image_url` 返回 422。工具名必须匹配 `[a-zA-Z0-9_-]{1,128}`，否则返回 422。

## 思考强度

网关把客户端的 `reasoning_effort` 字段改写成 SDK 参数 id `effort`。只有目录里的参数 id 正好是 `effort` 时，才能打开思考。

| 目录里的参数 id | `supportsReasoning` | 结果 |
|---|---|---|
| `effort` | `true`，并写 `reasoning` | 档位会传到 Cursor |
| `reasoning_effort` | `false`，不要写 `reasoning` | 不传参数，走该模型的默认档。打开会 502：`Invalid parameters for registry model` |
| `reasoning` | `false`，不要写 `reasoning` | 同上 |
| 没有思考参数 | `false` | 同上 |

`reasoning` 只在第一行使用：

```json
"supportsReasoning": true,
"reasoning": {
  "defaultEffort": "<默认档的值>",
  "supportedEfforts": ["<目录 values 的原样列表>"],
  "canDisableThinking": false
}
```

`supportedEfforts` 必须逐字复制目录里的 `values`。`defaultEffort` 用该模型 `isDefault` 变体里的对应值。不要把 `minimal`、`max`、`xhigh`、`extra-high` 互相替换。

当前账号里，参数名是 `effort` 的例子：`claude-opus-5-5`、`claude-fable-5-1`、`muse-spark-1.3`。参数名是 `reasoning_effort` 的例子：`grok-4.7`、`gemini-3.8-flash`。参数名是 `reasoning` 的例子：`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`。Composer 2.5 只有 `fast`，思考必须关闭。新模型先看目录，不要沿用这张例子表。

WorkBuddy 的 JSON 不能发送 `cursor_model_params`，所以不能从这里单独改 `context` 或 `fast`。思考关闭且不写 `reasoning` 时，Cursor 使用目录里的默认变体。`grok-4.7` 的默认变体是 `context=500k`、`reasoning_effort=high`、`fast=true`。

## 上下文和最大输出

`maxInputTokens` 只告诉 WorkBuddy 这个模型可以接收多长输入，不会切换 Cursor 的上下文档位。

目录有 `context` 参数时，按默认变体填写：

| 目录值 | `maxInputTokens` |
|---|---|
| `256k` | `256000` |
| `272k` | `272000` |
| `300k` | `300000` |
| `500k` | `500000` |
| `1m` | `1000000` |

目录没有 `context` 参数时，不要猜，省略 `maxInputTokens`。

`maxOutputTokens` 同样省略，除非 Cursor 自己的模型页写了最大输出。账号目录和 [Grok 4.7 文档](https://cursor.com/docs/models/grok-4-7) 都没有这个数。256K / 500K 是上下文窗口，不是最大输出。输入超过 256K 后按长上下文计价，上限 500K。网关不按 `max_tokens` 截断生成。

WorkBuddy 界面里的上下文窗口默认 200K，会在请求发出前截断历史。把它调大才会用到模型的长窗口，超过 256K 输入会加倍计费。Max 模式、快速 / 均衡 / 极致、全局 `reasoningEffort` 不属于这个数组。

## 添加前核对

1. 用网关密钥请求 `GET /v1/models`，确认 id、参数 id、允许值、默认变体。
2. 目录里有，不代表这个账号地区能调用。地区不支持时 Cursor 返回 “not supported in your region”。
3. 按上面的规则生成一条，追加进现有数组。
4. 确认整份文件里没有 `availableModels` 和 `relatedModels`。
