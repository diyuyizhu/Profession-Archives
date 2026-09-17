/**
 * 档案领域 store（模块 A）：单档案模式 + localStorage 持久化。
 * 后端（@pa/server）就绪后可将 save 切为 API 调用，契约已对齐 @pa/shared。
 */
import type { CareerCardData, JournalDraft, Profile } from '@pa/shared'
import { buildCareerCard } from '@pa/shared/career'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { buildEmptyProfile, uid } from '@/data/seed'
import { postToBridge } from '@/lib/bridge'

const STORAGE_KEY = 'pa-profile-v1'

export type { JournalDraft }

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Profile
  } catch {
    return null
  }
}

function saveProfile(profile: Profile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  // 同步填表所需摘要到桥（插件填充表单用；桥离线静默失败）
  postToBridge('/api/bridge/sync', {
    profileSummary: {
      full_name: profile.full_name ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      headline: profile.headline ?? '',
      summary: profile.summary ?? '',
    },
  })
}

/** 生成 id（localStorage 版用；与 server crypto.randomUUID 格式无关） */
function makeId(): string {
  return uid('it')
}

export const useProfileStore = defineStore('profile', () => {
  // 首次启动不预置示例档案：空档案开始，用户从零录入
  const profile = ref<Profile>(loadProfile() ?? buildEmptyProfile())

  const careerCard = computed<CareerCardData>(() => buildCareerCard(profile.value))
  const hasCustomData = ref(loadProfile() !== null)

  /** 是否为空档案（未录入任何内容，仅用于提示） */
  const isEmpty = computed(() => {
    const p = profile.value
    return (
      !p.full_name ||
      (p.skills.length === 0 &&
        p.experiences.length === 0 &&
        p.education.length === 0 &&
        p.projects.length === 0 &&
        p.journal.length === 0)
    )
  })

  /** 保存档案基础信息（姓名/头衔/联系方式/简介） */
  function saveBasics(patch: Partial<Pick<Profile, 'full_name' | 'headline' | 'email' | 'phone' | 'summary'>>): void {
    const p = profile.value
    profile.value = {
      ...p,
      ...patch,
      updated_at: new Date().toISOString(),
    }
    saveProfile(profile.value)
  }

  /** 新建日记 / 成就 / 里程碑（A1） */
  function addJournalEntry(draft: JournalDraft): void {
    const ts = new Date().toISOString()
    const entry = {
      id: makeId(),
      ...draft,
      attachments: [] as string[],
      created_at: ts,
      updated_at: ts,
    }
    profile.value = {
      ...profile.value,
      journal: [entry, ...profile.value.journal],
      updated_at: ts,
    }
    saveProfile(profile.value)
  }

  /** 删除一条日记 / 成就 / 里程碑 */
  function removeJournalEntry(id: string): void {
    profile.value = {
      ...profile.value,
      journal: profile.value.journal.filter((e) => e.id !== id),
      updated_at: new Date().toISOString(),
    }
    saveProfile(profile.value)
  }

  /** 编辑一条原子记录（A1） */
  function updateJournalEntry(id: string, patch: Partial<JournalDraft>): void {
    const ts = new Date().toISOString()
    profile.value = {
      ...profile.value,
      journal: profile.value.journal.map((e) =>
        e.id === id ? { ...e, ...patch, updated_at: ts } : e,
      ),
      updated_at: ts,
    }
    saveProfile(profile.value)
  }

  /** 清空为空白档案（保留档案 id，用户从零开始） */
  function resetEmpty(): void {
    profile.value = buildEmptyProfile()
    saveProfile(profile.value)
  }

  /** 简历导入结果写入档案（merge 追加 / overwrite 清空重填） */
  function importResume(
    parsed: {
      full_name?: string
      email?: string
      phone?: string
      headline?: string
      summary?: string
      skills?: Array<{ name: string; category?: string; level?: number }>
      experiences?: Array<{ role: string; company?: string; description_md?: string; start_date?: string; end_date?: string }>
      education?: Array<{ school: string; degree?: string; major?: string; start_date?: string; end_date?: string }>
      projects?: Array<{ name: string; summary?: string; description_md?: string }>
    },
    mode: 'merge' | 'overwrite',
  ): void {
    const p = profile.value
    const ts = new Date().toISOString()
    const srcSkills = parsed.skills ?? []
    const srcExp = parsed.experiences ?? []
    const srcEdu = parsed.education ?? []
    const srcProj = parsed.projects ?? []

    const skills = [
      ...(mode === 'overwrite' ? [] : p.skills),
      ...srcSkills.map((s) => ({ id: makeId(), name: s.name, category: s.category, level: s.level, tags: [] as string[] })),
    ]
    const experiences = [
      ...(mode === 'overwrite' ? [] : p.experiences),
      ...srcExp.map((e) => ({ id: makeId(), role: e.role, company: e.company, description_md: e.description_md ?? '', tags: [] as string[], start_date: e.start_date, end_date: e.end_date })),
    ]
    const education = [
      ...(mode === 'overwrite' ? [] : p.education),
      ...srcEdu.map((e) => ({ id: makeId(), school: e.school, degree: e.degree, major: e.major, start_date: e.start_date, end_date: e.end_date, description: undefined as string | undefined })),
    ]
    const projects = [
      ...(mode === 'overwrite' ? [] : p.projects),
      ...srcProj.map((pr) => ({ id: makeId(), name: pr.name, summary: pr.summary, description_md: pr.description_md ?? '', tags: [] as string[], attachments: [] as string[] })),
    ]

    profile.value = {
      ...p,
      full_name: parsed.full_name || p.full_name,
      headline: parsed.headline ?? p.headline,
      email: parsed.email ?? p.email,
      phone: parsed.phone ?? p.phone,
      summary: parsed.summary ?? p.summary,
      skills,
      experiences,
      education,
      projects,
      updated_at: ts,
    }
    saveProfile(profile.value)
  }

  /** 把档案摘要推给本地桥（插件填表用）；启动时调一次，避免桥侧摘要过期 */
  function syncToBridge(): void {
    const p = profile.value
    postToBridge('/api/bridge/sync', {
      profileSummary: {
        full_name: p.full_name ?? '',
        email: p.email ?? '',
        phone: p.phone ?? '',
        headline: p.headline ?? '',
        summary: p.summary ?? '',
      },
    })
  }

  return {
    profile,
    careerCard,
    hasCustomData,
    isEmpty,
    saveBasics,
    addJournalEntry,
    updateJournalEntry,
    removeJournalEntry,
    resetEmpty,
    importResume,
    syncToBridge,
  }
})
