/**
 * AI 配置 store（模块 E1）：双模式（云端 DeepSeek / 本地 Ollama）+ E3 隐私授权。
 * localStorage 持久化；后端落地后 API Key 改加密存储 / 网关代理。
 */
import type { AIConfig, AIProvider } from '@pa/shared'
import { DEFAULT_AI_CONFIG } from '@pa/shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'

const KEY = 'pa-ai-config-v1'

/** 结构校验：逐字段 typeof 归一，坏数据回退默认值（与 application store 模式同级） */
function load(): AIConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_AI_CONFIG }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_AI_CONFIG }
    }
    const provider = parsed.provider === 'local' ? 'local' : 'cloud'
    const localOnly = parsed.localOnly === true
    return {
      provider: localOnly ? 'local' : provider,
      cloudEndpoint:
        typeof parsed.cloudEndpoint === 'string' && parsed.cloudEndpoint
          ? parsed.cloudEndpoint
          : DEFAULT_AI_CONFIG.cloudEndpoint,
      cloudModel:
        typeof parsed.cloudModel === 'string' && parsed.cloudModel
          ? parsed.cloudModel
          : DEFAULT_AI_CONFIG.cloudModel,
      cloudApiKey: typeof parsed.cloudApiKey === 'string' ? parsed.cloudApiKey : '',
      localEndpoint:
        typeof parsed.localEndpoint === 'string' && parsed.localEndpoint
          ? parsed.localEndpoint
          : DEFAULT_AI_CONFIG.localEndpoint,
      localModel:
        typeof parsed.localModel === 'string' && parsed.localModel
          ? parsed.localModel
          : DEFAULT_AI_CONFIG.localModel,
      dataExitConsented: parsed.dataExitConsented === true,
      localOnly,
    }
  } catch {
    return { ...DEFAULT_AI_CONFIG }
  }
}

export const useAIConfigStore = defineStore('aiConfig', () => {
  const config = ref<AIConfig>(load())

  function persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(config.value))
    } catch (err) {
      console.error('[aiConfig] 保存失败', err)
      throw err
    }
  }

  /** 切换来源：localOnly 开启时强制本地，手动选云端需先解除本地锁定 */
  function setProvider(provider: AIProvider): void {
    config.value.provider = provider
    if (provider === 'cloud' && config.value.localOnly) {
      config.value.localOnly = false
    }
    persist()
  }

  /** 更新配置并维持不变量：localOnly 强制 provider=local；选云端解除本地锁定 */
  function update(patch: Partial<AIConfig>): void {
    const next = { ...config.value, ...patch }
    if (next.localOnly) {
      next.provider = 'local'
    } else if (next.provider === 'cloud') {
      next.localOnly = false
    }
    config.value = next
    persist()
  }

  /** E3：云端授权（首次调用云端前必须为 true） */
  function consentDataExit(): void {
    config.value.dataExitConsented = true
    config.value.localOnly = false
    persist()
  }

  /** E3：全局仅用本地模型 */
  function setLocalOnly(on: boolean): void {
    config.value.localOnly = on
    if (on) config.value.provider = 'local'
    persist()
  }

  return { config, setProvider, update, consentDataExit, setLocalOnly }
})
