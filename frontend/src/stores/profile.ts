/**
 * 档案领域 store（模块 A）：单档案模式 + localStorage 持久化。
 * 后端（@pa/server）就绪后可将 save 切为 API 调用，契约已对齐 @pa/shared。
 */
import type { CareerCardData, JournalDraft, Profile } from '@pa/shared'
import { buildCareerCard } from '@pa/shared/career'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { buildDemoProfile, buildEmptyProfile, uid } from '@/data/seed'

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
}

/** 生成 id（localStorage 版用；与 server crypto.randomUUID 格式无关） */
function makeId(): string {
  return uid('it')
}

export const useProfileStore = defineStore('profile', () => {
  // 首次启动不预置示例档案：空档案开始（演示数据仅"重置为演示"时生成）
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

  /** 整体重置为 demo 数据 */
  function resetToDemo(): void {
    profile.value = buildDemoProfile()
    saveProfile(profile.value)
  }

  /** 清空为空白档案（仍保留默认姓名占位） */
  function resetEmpty(): void {
    const demo = buildDemoProfile()
    profile.value = {
      ...demo,
      full_name: '',
      headline: undefined,
      email: undefined,
      phone: undefined,
      summary: undefined,
      skills: [],
      experiences: [],
      education: [],
      projects: [],
      journal: [],
    }
    saveProfile(profile.value)
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
    resetToDemo,
    resetEmpty,
  }
})
