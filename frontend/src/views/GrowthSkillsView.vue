<script setup lang="ts">
/**
 * 技能追踪（F3）：技能熟练度快照 + 演化轨迹。
 * - 每追加一次自评形成时间线
 * - 与档案 skills（level）可交叉对照
 */
import { computed, ref } from 'vue'

import Modal from '@/components/Modal.vue'
import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useProfileStore } from '@/stores/profile'
import { useSkillTrackStore } from '@/stores/skillTrack'

const track = useSkillTrackStore()
const profile = useProfileStore()

const showAdd = ref(false)
const addForm = ref({ skill: '', level: 3, note: '' })

/** 档案里的技能名（作为快速填充候选） */
const profileSkills = computed(() => profile.profile.skills.map((s) => s.name))

function openAdd(): void {
  addForm.value = { skill: '', level: 3, note: '' }
  showAdd.value = true
}

function saveAdd(): void {
  if (!addForm.value.skill.trim()) return
  track.addSnapshot({
    skill: addForm.value.skill.trim(),
    level: addForm.value.level,
    recorded_at: new Date().toISOString().slice(0, 10),
    note: addForm.value.note.trim() || undefined,
  })
  showAdd.value = false
}

const LEVEL_LABELS = ['', '入门', '基础', '进阶', '熟练', '精通']
function levelColor(level: number): string {
  return level >= 4 ? 'text-neutral-900' : level >= 3 ? 'text-neutral-700' : 'text-neutral-500'
}
</script>

<template>
  <div class="relative min-h-full">

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部 -->
      <PageHeader code="F3" title="技能追踪" :desc="`${track.total} 项技能 · 熟练度随时间演化`">
        <PrimaryButton @click="openAdd">＋ 记录自评</PrimaryButton>
      </PageHeader>

      <!-- 空态 -->
      <div
        v-if="!track.history.length"
        class="card-glass flex flex-col items-center justify-center gap-3 px-5 py-14 text-center"
      >
        <span class="text-3xl">📊</span>
        <div class="text-[14px] text-neutral-600">还没有技能记录</div>
        <div class="text-[12px] text-neutral-400">
          定期自评（1–5），观察熟练度成长曲线；档案里的技能会出现在下方候选
        </div>
      </div>

      <!-- 技能列表 -->
      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-for="item in track.history" :key="item.skill" class="card-glass p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="heading-tight text-[15px] text-neutral-900">{{ item.skill }}</span>
              <span
                class="rounded-full border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium"
                :class="levelColor(item.current)"
              >
                Lv.{{ item.current }}
              </span>
              <span class="text-[11px] text-neutral-400">{{ LEVEL_LABELS[item.current] }}</span>
            </div>
            <button
              class="text-[11px] text-neutral-400 hover:text-red-600"
              @click="track.clearSkill(item.skill)"
            >
              清空
            </button>
          </div>

          <!-- 演化轨迹 -->
          <div v-if="item.history.length" class="mt-4">
            <div class="flex items-end gap-1.5" style="height: 56px">
              <div
                v-for="(h, i) in item.history"
                :key="i"
                class="group relative flex-1"
                :title="`${h.recorded_at} · Lv.${h.level}${h.note ? ' · ' + h.note : ''}`"
              >
                <div
                  class="mx-auto w-full rounded-t"
                  :class="h.level >= 4 ? 'bg-neutral-900' : h.level === 3 ? 'bg-neutral-500' : 'bg-neutral-300'"
                  :style="{ height: `${Math.max(8, (h.level / 5) * 52)}px`, opacity: 0.85 }"
                />
              </div>
            </div>
            <div class="mt-1 flex justify-between">
              <span class="font-mono text-[9.5px] text-neutral-400">
                {{ item.history[0]!.recorded_at }}
              </span>
              <span class="font-mono text-[9.5px] text-neutral-400">
                {{ item.history[item.history.length - 1]!.recorded_at }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 记录自评弹窗 -->
      <Modal v-if="showAdd" title="记录技能自评" max-width="max-w-md" @close="showAdd = false">
        <form class="space-y-4" @submit.prevent="saveAdd">
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500">技能名 *</span>
              <input v-model="addForm.skill" class="input-trae" list="pa-skills" placeholder="如：渗透测试" />
              <datalist id="pa-skills">
                <option v-for="s in profileSkills" :key="s" :value="s" />
              </datalist>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500">熟练度</span>
              <div class="flex gap-1" role="group" aria-label="熟练度（1–5）">
                <button
                  v-for="n in 5"
                  :key="n"
                  type="button"
                  class="flex-1 rounded-lg border py-2 text-[13px] transition-colors"
                  :aria-pressed="addForm.level === n"
                  :aria-label="`${n} 级 · ${LEVEL_LABELS[n]}`"
                  :class="
                    addForm.level === n
                      ? 'border-neutral-900 bg-neutral-100 text-neutral-900'
                      : 'border-neutral-300 bg-neutral-50 text-neutral-500'
                  "
                  @click="addForm.level = n"
                >
                  {{ n }}<span class="ml-0.5 text-[10px]">{{ LEVEL_LABELS[n] }}</span>
                </button>
              </div>
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs text-neutral-500">备注</span>
              <input v-model="addForm.note" class="input-trae" placeholder="近期成果 / 学习进展…" />
            </label>

            <div class="flex items-center justify-end gap-3 pt-1">
              <SecondaryButton type="button" @click="showAdd = false">取消</SecondaryButton>
              <PrimaryButton type="submit" :disabled="!addForm.skill.trim()">保存</PrimaryButton>
            </div>
        </form>
      </Modal>
    </div>
  </div>
</template>
