<script setup lang="ts">
/**
 * 个人名片（A5）：经典黑白名片，两种主题（白卡 paper / 黑卡 ink）。
 * - 内容由档案实时聚合（姓名 / 头衔 / 标签 / 联系方式）
 * - 导出：当前主题的静态 HTML（银行卡比例，可打印 / 可部署）
 */
import { computed, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
const profile = computed(() => store.profile)
const card = computed(() => store.careerCard)

/** 名片主题：paper = 白卡黑字（默认）；ink = 黑卡白字 */
type CardThemeKey = 'paper' | 'ink'
const cardTheme = ref<CardThemeKey>('paper')

const CARD_THEMES: Record<CardThemeKey, { label: string; desc: string }> = {
  paper: { label: '白卡', desc: '白底黑字' },
  ink: { label: '黑卡', desc: '黑底白字' },
}

/** 主题配色（平面经典黑白，无渐变无光效） */
const themeStyle = computed(() => {
  if (cardTheme.value === 'paper') {
    return {
      cardBg: '#ffffff',
      ink: '#111827',
      inkSoft: 'rgba(17,24,39,0.55)',
      inkFaint: 'rgba(17,24,39,0.35)',
      line: 'rgba(17,24,39,0.35)',
      avatarBg: '#111827',
      avatarInk: '#ffffff',
    }
  }
  return {
    cardBg: '#111827',
    ink: '#ffffff',
    inkSoft: 'rgba(255,255,255,0.62)',
    inkFaint: 'rgba(255,255,255,0.4)',
    line: 'rgba(255,255,255,0.35)',
    avatarBg: '#ffffff',
    avatarInk: '#111827',
  }
})

/** 卡片内容 */
const frontContent = computed(() => {
  const p = profile.value
  return {
    name: p.full_name,
    headline: p.headline,
    email: p.email,
    phone: p.phone,
    topTags: card.value.tagCloud.slice(0, 4).map((t) => t.name),
  }
})

/** 统计摘要 */
const stats = computed(() => [
  { label: '技能', value: profile.value.skills.length },
  { label: '项目', value: profile.value.projects.length },
  { label: '经历', value: profile.value.experiences.length },
  { label: '成就', value: card.value.journalByType.achievement.length },
])

/** 时间线圆点灰阶（按类型深浅区分） */
const timelineDot: Record<string, string> = {
  experience: 'bg-neutral-900',
  education: 'bg-neutral-400',
  milestone: 'bg-neutral-700',
  project: 'bg-neutral-300',
}

/** 导出：银行卡比例（1.586）正面名片 HTML，独立可部署 */
function exportCard(): void {
  const f = frontContent.value
  const esc = (s: string | undefined | null): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const m = themeStyle.value
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(f.name)} · 名片</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f9fafb; font-family:'Inter','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif; }
  .card {
    width:min(85.6mm, 92vw); aspect-ratio:1.586;
    border-radius:3.5mm;
    background:${m.cardBg};
    border:0.3mm solid ${m.ink};
    padding:5.5mm 6mm;
    color:${m.ink};
    display:flex; flex-direction:column; justify-content:space-between;
    box-shadow:0 4px 16px rgba(17,24,39,0.12);
    overflow:hidden; position:relative;
  }
  .top { display:flex; align-items:flex-start; justify-content:space-between; }
  .brand { font-size:3.2mm; font-weight:700; letter-spacing:0.06em; color:${m.ink}; }
  .brand-sub { font-size:1.9mm; color:${m.inkFaint}; margin-top:0.8mm; letter-spacing:0.04em; }
  .avatar { width:9.5mm; height:9.5mm; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:4.6mm; font-weight:700; color:${m.avatarInk}; background:${m.avatarBg}; }
  .name { font-size:6mm; font-weight:700; letter-spacing:0.03em; color:${m.ink}; }
  .headline { font-size:3mm; color:${m.inkSoft}; margin-top:1.2mm; }
  .tags { display:flex; gap:1.6mm; flex-wrap:wrap; margin-top:2.6mm; }
  .tag { font-size:2.1mm; color:${m.inkSoft}; border:0.2mm solid ${m.line}; border-radius:1.6mm; padding:0.7mm 2mm; }
  .contact { font-size:2.4mm; color:${m.inkSoft}; display:flex; gap:4mm; margin-top:3mm; }
  .foot { font-size:1.8mm; color:${m.inkFaint}; letter-spacing:0.05em; margin-top:2.4mm; }
</style>
</head>
<body>
<div class="card">
  <div class="top">
    <div>
      <div class="brand">PROFESSION ARCHIVES</div>
      <div class="brand-sub">生涯名片 · LOCAL-FIRST</div>
    </div>
    <div class="avatar">${esc(f.name.slice(0, 1))}</div>
  </div>

  <div>
    <div class="name">${esc(f.name)}</div>
    ${f.headline ? `<div class="headline">${esc(f.headline)}</div>` : ''}
    <div class="tags">
      ${f.topTags.map((t) => `<span class="tag">#${esc(t)}</span>`).join('')}
    </div>
    <div class="contact">
      ${f.email ? `<span>✉ ${esc(f.email)}</span>` : ''}
      ${f.phone ? `<span>☎ ${esc(f.phone)}</span>` : ''}
    </div>
  </div>

  <div class="foot">${esc(f.name)} · 由 Profession-Archives 生成</div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  // 文件名消毒：去掉 Windows 非法字符，避免下载失败
  const safeName = String(f.name || 'career-card').replace(/[/\\:*?"<>|]/g, '_')
  a.href = url
  a.download = `${safeName}-名片.html`
  a.click()
  // 延时撤销：立即 revoke 可能中断某些浏览器的下载
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 切换主题 */
function toggleTheme(): void {
  cardTheme.value = cardTheme.value === 'paper' ? 'ink' : 'paper'
}
</script>

<template>
  <div class="relative min-h-full">
    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部操作 -->
      <PageHeader code="A5" title="对外名片" desc="经典黑白 · 由档案实时生成 · 可导出静态 HTML">
        <SecondaryButton @click="toggleTheme">
          {{ cardTheme === 'paper' ? '切换黑卡' : '切换白卡' }}
        </SecondaryButton>
        <PrimaryButton :disabled="store.isEmpty" @click="exportCard">导出名片 HTML</PrimaryButton>
      </PageHeader>

      <!-- ═══════ 名片预览 ═══════ -->
      <section class="flex flex-col items-center py-8">
        <!-- 主题切换 -->
        <div class="mb-8 flex flex-wrap justify-center gap-2">
          <button
            v-for="(meta, key) in CARD_THEMES"
            :key="key"
            class="rounded-full border px-4 py-1.5 text-[13px] transition-colors"
            :class="
              cardTheme === key
                ? 'border-neutral-900 bg-neutral-900 text-white'
                : 'border-neutral-300 bg-white text-neutral-500 hover:border-neutral-900 hover:text-neutral-900'
            "
            @click="cardTheme = key as CardThemeKey"
          >
            {{ meta.label }}
            <span class="ml-1 text-[11px] opacity-60">{{ meta.desc }}</span>
          </button>
        </div>

        <!-- 平面名片（浅灰底衬托） -->
        <div class="w-full rounded-xl bg-neutral-50 p-10">
          <div
            class="mx-auto w-[440px] max-w-full cursor-pointer select-none rounded-xl border shadow-[0_4px_16px_rgba(17,24,39,0.12)]"
            :style="{
              aspectRatio: '1.586',
              background: themeStyle.cardBg,
              borderColor: themeStyle.ink,
              color: themeStyle.ink,
            }"
          >
            <div class="flex h-full flex-col justify-between p-8">
              <div class="flex items-start justify-between">
                <div>
                  <div class="text-[16px] font-bold tracking-[0.06em]">
                    PROFESSION ARCHIVES
                  </div>
                  <div class="mt-1 text-[10px] tracking-[0.04em]" :style="{ color: themeStyle.inkFaint }">
                    生涯名片 · LOCAL-FIRST
                  </div>
                </div>
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
                  :style="{ background: themeStyle.avatarBg, color: themeStyle.avatarInk }"
                >
                  {{ (profile.full_name || '?').slice(0, 1) }}
                </div>
              </div>

              <div>
                <div class="heading-tight text-[34px] leading-none tracking-[0.03em]">
                  {{ profile.full_name || '未命名' }}
                </div>
                <div v-if="profile.headline" class="mt-2 text-[15px]" :style="{ color: themeStyle.inkSoft }">
                  {{ profile.headline }}
                </div>
                <div v-if="card.tagCloud.length" class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="t in card.tagCloud.slice(0, 4)"
                    :key="t.name"
                    class="rounded-full border px-2.5 py-0.5 text-[11px]"
                    :style="{ borderColor: themeStyle.line, color: themeStyle.inkSoft }"
                  >
                    #{{ t.name }}
                  </span>
                </div>
                <div
                  v-if="profile.email || profile.phone"
                  class="mt-4 flex gap-5 text-[12px]"
                  :style="{ color: themeStyle.inkSoft }"
                >
                  <span v-if="profile.email">✉ {{ profile.email }}</span>
                  <span v-if="profile.phone">☎ {{ profile.phone }}</span>
                </div>
              </div>

              <div class="text-[10px] tracking-[0.05em]" :style="{ color: themeStyle.inkFaint }">
                {{ profile.full_name || '未命名' }} · 由 Profession-Archives 生成
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 text-[11px] text-neutral-400">
          当前主题：{{ CARD_THEMES[cardTheme].label }} · 编辑档案即实时更新此名片
        </div>
      </section>

      <!-- ═══════ 档案折叠区 ═══════ -->
      <section class="mt-10">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="heading-tight text-[16px] tracking-wide text-neutral-900">名片内容来自档案</h2>
          <span class="text-xs text-neutral-400">编辑档案即实时更新此名片</span>
        </div>

        <!-- 统计 -->
        <div class="grid grid-cols-4 divide-x divide-neutral-200">
          <div v-for="s in stats" :key="s.label" class="px-4 py-4 text-center">
            <div class="font-mono-data text-lg font-bold text-neutral-900">{{ s.value }}</div>
            <div class="mt-0.5 text-[11px] text-neutral-500">{{ s.label }}</div>
          </div>
        </div>

        <!-- summary -->
        <div v-if="profile.summary" class="card-glass p-5">
          <div class="mb-2 text-[11px] font-medium tracking-widest text-neutral-400">关于我</div>
          <p class="text-[13.5px] leading-relaxed text-neutral-700">{{ profile.summary }}</p>
        </div>

        <!-- 技能 -->
        <div v-if="profile.skills.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-neutral-400">技能图谱</div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="skill in profile.skills"
              :key="skill.id"
              class="rounded-full border border-neutral-300 bg-neutral-50 px-3.5 py-1.5 text-[12.5px] text-neutral-700"
            >
              {{ skill.name }}
              <span v-if="skill.category" class="ml-1.5 text-[10.5px] text-neutral-400">
                {{ skill.category }}
              </span>
            </span>
          </div>
        </div>

        <!-- 项目作品集 -->
        <div v-if="profile.projects.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-neutral-400">
            项目作品集
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              v-for="proj in profile.projects"
              :key="proj.id"
              class="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
            >
              <div class="text-[13.5px] font-semibold text-neutral-900">{{ proj.name }}</div>
              <p class="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                {{ proj.description_md }}
              </p>
              <div v-if="proj.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="tag in proj.tags"
                  :key="tag"
                  class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10.5px] text-neutral-500"
                >
                  #{{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 生涯时间线 -->
        <div v-if="card.timeline.length" class="card-glass mt-4 p-5">
          <div class="mb-4 text-[11px] font-medium tracking-widest text-neutral-400">
            生涯时间线
          </div>
          <div class="relative space-y-0 border-l border-neutral-200 pl-5">
            <div
              v-for="(item, i) in card.timeline"
              :key="`${item.kind}-${item.date}-${item.title}-${i}`"
              class="relative pb-5 last:pb-0"
            >
              <span
                class="absolute -left-[27px] top-1 h-2 w-2 rounded-full border-2 border-white"
                :class="timelineDot[item.kind] ?? 'bg-neutral-400'"
              />
              <div class="flex flex-wrap items-baseline gap-2">
                <span class="heading-tight text-[13.5px] text-neutral-900">{{ item.title }}</span>
                <span v-if="item.subtitle" class="text-[12px] text-neutral-400">
                  {{ item.subtitle }}
                </span>
                <span class="ml-auto font-mono text-[11px] text-neutral-400">
                  {{ item.date }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 成就 -->
        <div v-if="card.journalByType.achievement.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-neutral-400">成就</div>
          <div class="space-y-2.5">
            <div
              v-for="a in card.journalByType.achievement"
              :key="a.id"
              class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] font-medium text-neutral-900">{{ a.title }}</span>
                <span class="shrink-0 font-mono text-[10.5px] text-neutral-400">
                  {{ a.occurred_at }}
                </span>
              </div>
              <p v-if="a.content_md" class="mt-1 text-[12.5px] leading-relaxed text-neutral-500">
                {{ a.content_md }}
              </p>
            </div>
          </div>
        </div>

        <!-- 页脚 -->
        <div class="mt-6 text-center text-[11px] text-neutral-400">
          由 Profession-Archives 生成 · 本地优先 · 数据归你所有
        </div>
      </section>
    </div>
  </div>
</template>
