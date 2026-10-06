# dsh-reasoning · 思考等级

通用适配测试版。

这是 DeepSeek Harness Host 插件，复用原生模型菜单与会话 reasoning effort 选择，不需要另建 Web 应用。当前版本尚未完成全部上游协议与跨机器实装验证，勿视为全模型兼容承诺。

## 自动适配

- 从当前 `dsh-llm-pi-ai` 配置发现供应商与模型，不依赖供应商名字、安装盘符、密钥路径。
- 原有 `reasoningEfforts`（包括 `false`）优先保留；不改变默认模型、默认等级、密钥或 endpoint。
- OpenAI Completions / Responses 的 GPT-5、GPT-6 家族：候选四档 low / medium / high / xhigh。
- Anthropic Messages 的较新 Claude Opus / Sonnet：候选 low / medium / high。实际序列化由原生适配器负责，其 effort 或 budget 映射还须按模型确认。
- Grok 4.5：候选 low / medium / high；Grok 4.6、4.7：额外提供 xhigh。规则只匹配这些明确版本，依据 [xAI 推理文档](https://docs.x.ai/developers/model-capabilities/text/reasoning)。不把多代理模式等同于推理深度。
- 未知模型或未知协议：不自动声明能力；可以按服务文档添加用户覆盖。
- 新增供应商和模型后订阅 `app-boot/config-reload` 重新扫描。候选识别不发送网络请求，不自动消耗 API 用量。

**规则候选不是上游验证。** 网关可能接受却忽略参数，也可能拒绝。开启候选后选择不兼容等级可能导致下一次请求失败；遇到错误请先切回服务默认。

## 安装到其他电脑

需要支持 `configEditor`、`appReady`、`dsh-llm-pi-ai` 的 Harness（当前本机安装版已核实这些接口）。其他版本兼容性尚待验证。

优先使用目标 Harness 的插件管理器安装本插件目录或打包文件。若目标安装没有插件管理器，使用其自带 pnpm 把本包加入目标 profile 的 dependencies，再把 `dsh-reasoning` 登记到 `dsh.profile.bundles`。不要覆盖整个 profile 文件，不要照搬本机绝对路径。

本包无 npm runtime dependencies、无 install scripts、无 Client bundle。使用普通文件包安装而不是 link 可避免依赖源码目录；本机目前仍使用 link 开发安装。Host 代码替换后可能需要重启。插件只提供能力声明，菜单由 Harness 自带 UI 渲染。

## 插件配置

在目标 profile patch 添加插件行覆盖（保留其他配置）：

```yaml
- id: local-reasoning-levels
  name: 'dsh-reasoning'
  config:
    autoDetect: true
    logReport: true
    # routesFile: '/path/on/this/computer/model-overrides.json'
```

`autoDetect: false` 关闭后续自动候选迁移；它不会删除此前已持久化的声明。`logReport: true` 输出不含密钥、地址和 headers 的能力报告。报告的 declared 仅代表已有配置，不代表服务测试通过。

可选 JSON 覆盖格式：

```json
{"your-provider":{"your-model":{"low":"low","high":"high"},"non-reasoning-model":false}}
```

覆盖用于尚无能力声明的模型；已有声明仍优先。允许 off / minimal / low / medium / high / xhigh / max。只有 off 可以映射为 null，表示不发送推理参数。不要为不知道的模型猜测能力。

## 持久化与卸载

通过 `configEditor.edit` 验证、原子保存、热更新模型配置；迁移是幂等的。卸载插件不会自动清除已写入的 `reasoningEfforts`。恢复时先在会话菜单选服务默认，再只移除相关模型的能力块。不要恢复旧的整个 providers 快照，以免覆盖之后新增的供应商。

## 验证记录与限制

- 16 项自动发现、多供应商、原生目录能力优先、配置保留、并发协议修改保护、就绪信号、热适配、生命周期和报告脱敏测试全部通过。
- 最新 tgz 包在独立临时目录解压后正常加载；无外部 runtime dependencies，三类模型在不同供应商名下的模拟自动迁移通过。这不是第二台电脑实装证明。
- 安装版真实 GPT 适配器本地 SSE 捕获：四档正确进入 `reasoning_effort`，服务默认省略该字段。
- 用户确认本机 CCTQ-Plus / gpt-6.1-sol 原生菜单出现且选择有效；该结果仅覆盖单模型第一版。
- 该模型五次极短上游请求均 HTTP 200，总报告用量 75 tokens；不证明网关实际采用等级。
- 米醋 Claude Opus / Sonnet 测试返回上游 503（无可用凭证），兼容性不明。后续批量任务未取得可靠完整结果，不能声明其他供应商已验证。
- 安装版 Claude Opus 5.5 本地请求捕获：low / medium / high 映射到 `thinking.type=enabled` 和 2048 / 8192 / 16384 的 token budget，不发送 `output_config`；适配器同时增大 `max_tokens`。这是预算控制，不应宣称等同原生 adaptive effort。
- 重启后通用版自动迁移已在当前 Host 生效：5 个供应商路由、11 个模型声明全部通过安装版适配器解析；用户确认 GPT、Claude、Grok 三类桌面菜单均显示等级且切换正常。
- Grok 官方版本能力已有文档依据，但当前中转服务实际请求兼容性仍未知。第二台机器/其他 Harness 版本的实装未验证；不能承诺任意模型或中转都兼容。

## 本地测试

```sh
node --test test/*.test.js
```

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
