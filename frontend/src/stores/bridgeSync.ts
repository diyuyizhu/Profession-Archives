/**
 * 本地桥同步 store（模块 D）：从桥 inbox 拉取插件采集的数据，合并到看板。
 * 两种同步模式：
 * - direct：一键全部合并（排除不了脏数据）
 * - select：先预览 inbox，勾选要保留的条目，确认后合并勾选、丢弃其余
 * 供「插件配对」页与「投递看板」页共用。
 */
import type { ApplicationStatus } from '@pa/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useApplicationStore } from '@/stores/application'
import { bridgeRequest } from '@/lib/bridge'

const KEY = 'pa-bridge-sync-mode-v1'

export type SyncMode = 'direct' | 'select'

/** 桥 inbox 条目（对齐 bridge.rs 的 BridgeItem） */
export interface BridgeInboxItem {
  type: 'job' | 'application' | 'form-mapping'
  id?: string
  company?: string
  title?: string
  url?: string
  jd?: string
  channel?: string
  tags?: string[]
  collected_at?: string
  application_id?: string
  status?: string
  applied_at?: string
  note?: string
  origin?: string
  field_key?: string
  target_field?: string
}

function loadMode(): SyncMode {
  try {
    return localStorage.getItem(KEY) === 'select' ? 'select' : 'direct'
  } catch {
    return 'direct'
  }
}

export const useBridgeSyncStore = defineStore('bridgeSync', () => {
  const syncMode = ref<SyncMode>(loadMode())
  const inboxItems = ref<BridgeInboxItem[]>([])
  const syncing = ref(false)
  const msg = ref('')
  const showPreview = ref(false)
  const selectedIds = ref<Set<string>>(new Set())

  const itemCount = computed(() => inboxItems.value.length)

  function persistMode(): void {
    try {
      localStorage.setItem(KEY, syncMode.value)
    } catch {
      /* ignore */
    }
  }

  function setMode(mode: SyncMode): void {
    syncMode.value = mode
    persistMode()
  }

  /** 给每条 inbox 条目生成 key（preview 列表在弹窗打开期间不变，index 即稳定唯一） */
  function itemKey(item: BridgeInboxItem, index: number): string {
    return `${item.type}-${index}`
  }

  /** 拉取 inbox（bridgeRequest 自动带 Bearer token；错误上抛由调用方提示） */
  async function fetchInbox(): Promise<BridgeInboxItem[]> {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    try {
      const items = await bridgeRequest<BridgeInboxItem[]>('/api/bridge/inbox', { signal: ctrl.signal })
      inboxItems.value = items
      return items
    } finally {
      clearTimeout(t)
    }
  }

  /** 把若干条目合并到看板，返回 { jobCount, appCount, dropped } */
  function mergeItems(items: BridgeInboxItem[]): { jobCount: number; appCount: number; dropped: number } {
    const appStore = useApplicationStore()
    let jobCount = 0
    let appCount = 0
    let dropped = 0
    for (const it of items) {
      if (it.type === 'job') {
        if (it.title) {
          appStore.addApplication({
            company: it.company || '未知公司',
            title: it.title,
            status: 'backlog',
            notes: '',
            tags: it.tags ?? [],
            groups: [],
            url: it.url,
            jd: it.jd,
            channel: it.channel,
          })
          jobCount++
        } else {
          dropped++
        }
      } else if (it.type === 'application') {
        const status = (it.status ?? 'applied') as string
        const matched = appStore.applications.find(
          (a) =>
            (it.application_id && a.id === it.application_id) ||
            (it.company && it.title && a.company === it.company && a.title === it.title),
        )
        if (matched) {
          try {
            appStore.transition(matched.id, status as ApplicationStatus, it.note)
            appCount++
          } catch {
            dropped++
          }
        } else if (it.title || it.company) {
          // 匹配不到本地投递：按 company/title 新建一条「已投」记录，不静默丢失
          appStore.addApplication({
            company: it.company || '未知公司',
            title: it.title || '未命名岗位',
            status: 'applied',
            notes: it.note ?? '',
            tags: [],
            groups: [],
            applied_at: it.applied_at,
          })
          appCount++
        } else {
          dropped++
        }
      }
      // form-mapping 不合并到看板（桥侧已保留，不随 clear 清除）
    }
    return { jobCount, appCount, dropped }
  }

  /** 清空 inbox（bridgeRequest 自动带 token；失败静默，不阻塞同步流程） */
  async function clearInbox(): Promise<void> {
    try {
      await bridgeRequest('/api/bridge/inbox/clear', { method: 'POST' })
    } catch {
      /* ignore */
    }
  }

  /** 直接同步：拉取 → 全部合并 → 清空 */
  async function syncDirect(): Promise<void> {
    syncing.value = true
    msg.value = ''
    try {
      const items = await fetchInbox()
      if (!items.length) {
        msg.value = '无新采集数据'
        return
      }
      const { jobCount, appCount, dropped } = mergeItems(items)
      await clearInbox()
      msg.value =
        `已同步：${jobCount} 个岗位, ${appCount} 个状态更新` +
        (dropped ? `；丢弃 ${dropped} 条` : '')
    } catch (e) {
      msg.value = `同步失败：${e instanceof Error ? e.message : '桥离线或请求超时'}`
    } finally {
      syncing.value = false
    }
  }

  /** 选择模式：拉取并打开预览 */
  async function openPreview(): Promise<void> {
    syncing.value = true
    msg.value = ''
    try {
      const items = await fetchInbox()
      if (!items.length) {
        msg.value = '无新采集数据'
        return
      }
      // 默认全选（用户取消勾选 = 排除脏数据）
      selectedIds.value = new Set(items.map((it, i) => itemKey(it, i)))
      showPreview.value = true
    } catch (e) {
      msg.value = `拉取失败：${e instanceof Error ? e.message : '桥离线或请求超时'}`
    } finally {
      syncing.value = false
    }
  }

  function toggleSelect(key: string): void {
    const next = new Set(selectedIds.value)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedIds.value = next
  }

  function selectAll(): void {
    selectedIds.value = new Set(inboxItems.value.map((it, i) => itemKey(it, i)))
  }

  function clearSelection(): void {
    selectedIds.value = new Set()
  }

  /** 选择模式确认：合并勾选的，丢弃其余，清空 inbox */
  async function confirmSelected(): Promise<void> {
    syncing.value = true
    msg.value = ''
    try {
      const keep = inboxItems.value.filter((it, i) => selectedIds.value.has(itemKey(it, i)))
      const { jobCount, appCount, dropped: mergeDropped } = mergeItems(keep)
      const dropped = inboxItems.value.length - keep.length + mergeDropped
      await clearInbox()
      showPreview.value = false
      msg.value =
        `已同步：${jobCount} 个岗位, ${appCount} 个状态更新` +
        (dropped ? `；丢弃 ${dropped} 条` : '')
    } catch (e) {
      msg.value = `同步失败：${e instanceof Error ? e.message : '桥离线或请求超时'}`
    } finally {
      syncing.value = false
    }
  }

  function closePreview(): void {
    showPreview.value = false
  }

  return {
    syncMode,
    inboxItems,
    syncing,
    msg,
    showPreview,
    selectedIds,
    itemCount,
    itemKey,
    setMode,
    syncDirect,
    openPreview,
    toggleSelect,
    selectAll,
    clearSelection,
    confirmSelected,
    closePreview,
  }
})
