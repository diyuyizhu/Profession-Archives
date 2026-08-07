<script setup lang="ts">
/**
 * 个人名片（A5）：银行卡比例的 3D 悬浮名片卡。
 * - 悬浮：鼠标移动追踪倾斜（perspective 视差），离开自动回正
 * - 翻面：点击拖拽 180° 翻转，正面 / 背面
 * - 质感：可切换材质（金属 / 全息 / 碳纤 / 玻璃），切换即时生效
 * - 导出：当前质感 + 正面的静态 HTML（A5 比例，可打印/部署）
 */
import { computed, ref } from 'vue'

import PageHeader from '@/components/PageHeader.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import SecondaryButton from '@/components/SecondaryButton.vue'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
const profile = computed(() => store.profile)
const card = computed(() => store.careerCard)

/** 3D 状态 */

/** 材质 */
type MaterialKey = 'metal' | 'holographic' | 'carbon' | 'glass'
const material = ref<MaterialKey>('holographic')

const MATERIALS: Record<MaterialKey, { label: string; desc: string }> = {
  metal: { label: '金属', desc: '拉丝金属质感' },
  holographic: { label: '全息', desc: '流光渐变质感' },
  carbon: { label: '碳纤', desc: '碳纤维编织质感' },
  glass: { label: '玻璃', desc: '磨砂玻璃质感' },
}

/** 卡片内容（正面） */
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

/* ── 鼠标追踪倾斜（离开回正）+ 点击翻面 ──
   性能：pointermove 只更新目标值，由单一 rAF 循环写 DOM style，
   不经 Vue 响应式 re-render；移除 transition 避免每帧动画堆积。 */
const cardEl = ref<HTMLElement | null>(null)

/** 目标角度（pointermove 只改这里，不触发渲染） */
const target = { x: 0, y: 0 }
/** 当前角度（rAF 插值逼近目标，实现平滑跟随） */
const current = { x: 0, y: 0 }
/** 翻转目标角度：0=正面，180=背面（点击翻面时切换） */
let targetFlip = 0
/** 当前翻转角度：rAF 插值从 0 平滑过渡到 180，形成旋转动画 */
let flipDeg = 0
const flipped = computed(() => flipDeg > 90)
let rafId = 0
let isDragging = false

function applyTransform(): void {
  const el = cardEl.value
  if (!el) return
  // 翻转过半时进入背面，两轴增量取反（完整 3D 镜像，跟随手感与正面一致）
  const dir = flipDeg > 90 ? -1 : 1
  el.style.transform = `rotateX(${current.x * dir}deg) rotateY(${flipDeg + current.y * dir}deg)`
}

function tick(): void {
  // 翻转角度与倾斜角度一起插值：点击翻面时 flipDeg 从 0→180 平滑旋转
  flipDeg += (targetFlip - flipDeg) * 0.12
  current.x += (target.x - current.x) * 0.18
  current.y += (target.y - current.y) * 0.18
  if (
    Math.abs(targetFlip - flipDeg) < 0.2 &&
    Math.abs(target.x - current.x) < 0.05 &&
    Math.abs(target.y - current.y) < 0.05
  ) {
    flipDeg = targetFlip
    current.x = target.x
    current.y = target.y
    applyTransform()
    rafId = 0
    return
  }
  applyTransform()
  rafId = requestAnimationFrame(tick)
}

function schedule(): void {
  if (!rafId) rafId = requestAnimationFrame(tick)
}

function onPointerMove(e: PointerEvent): void {
  if (isDragging) return
  const el = cardEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  // 大跟随范围：光标在卡片外 ±60% 仍有效，角度上限 32°
  const px = Math.max(-1.1, Math.min(1.1, (e.clientX - rect.left) / rect.width - 0.5)) * 1.45
  const py = Math.max(-1.1, Math.min(1.1, (e.clientY - rect.top) / rect.height - 0.5)) * 1.45
  target.x = -py * 24
  target.y = px * 24
  schedule()
}

function onPointerLeave(): void {
  if (isDragging) return
  target.x = 0
  target.y = 0
  schedule()
}

/** 点击翻面：切换翻转目标角度（0↔180），由 rAF 插值形成旋转动画 */
function toggleFace(): void {
  targetFlip = targetFlip > 90 ? 0 : 180
  target.x = 0
  target.y = 0
  current.x = 0
  current.y = 0
  schedule()
}

/* ── 质感样式 ──
   faceBg：正反两面的底层背景，负责遮挡另一面 —— 尤其玻璃材质半透明，
   若不设实底背景，翻到背面会透出正面的镜像内容。 */
const materialStyle = computed(() => {
  switch (material.value) {
    case 'metal':
      return {
        background:
          'linear-gradient(135deg, #2a2f38 0%, #181b21 30%, #3a414c 55%, #14161b 75%, #2b313b 100%)',
        faceBg:
          'linear-gradient(135deg, #2a2f38 0%, #181b21 30%, #3a414c 55%, #14161b 75%, #2b313b 100%)',
        borderColor: 'rgba(180,190,210,0.45)',
        glare: 'linear-gradient(115deg, rgba(255,255,255,0.32) 0%, transparent 22%, rgba(255,255,255,0.08) 45%, transparent 60%, rgba(255,255,255,0.18) 85%)',
        sheen: 'rgba(255,255,255,0.05)',
      }
    case 'holographic':
      return {
        background:
          'linear-gradient(135deg, #0c1a14 0%, #0a0b0d 40%, #12222a 70%, #0d1a24 100%)',
        faceBg:
          'linear-gradient(135deg, #0c1a14 0%, #0a0b0d 40%, #12222a 70%, #0d1a24 100%)',
        borderColor: 'rgba(50,240,140,0.35)',
        glare:
          'conic-gradient(from 210deg at 50% 50%, rgba(50,240,140,0.35), rgba(56,189,248,0.25), rgba(139,92,246,0.25), rgba(50,240,140,0.35))',
        sheen: 'rgba(50,240,140,0.06)',
      }
    case 'carbon':
      return {
        background:
          'repeating-linear-gradient(45deg, #101214 0 6px, #0c0e10 6px 12px)',
        faceBg:
          'repeating-linear-gradient(45deg, #101214 0 6px, #0c0e10 6px 12px)',
        borderColor: 'rgba(255,255,255,0.16)',
        glare: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
        sheen: 'rgba(255,255,255,0.03)',
      }
    case 'glass':
      return {
        // 移除 backdrop-filter：它在 3D transform 容器上会强制 flatten，
        // 破坏 preserve-3d，导致背面 face 的 backface-visibility 独立计算
        // 而被隐藏（反面显示空白）。改用半透明渐变面底模拟磨砂玻璃感。
        background:
          'linear-gradient(135deg, rgba(24,28,34,0.85) 0%, rgba(16,18,22,0.9) 40%, rgba(20,26,32,0.85) 100%)',
        faceBg:
          'linear-gradient(135deg, rgba(24,28,34,0.92) 0%, rgba(16,18,22,0.94) 40%, rgba(20,26,32,0.92) 100%)',
        borderColor: 'rgba(255,255,255,0.2)',
        glare: 'linear-gradient(115deg, rgba(255,255,255,0.2) 0%, transparent 45%)',
        sheen: 'rgba(255,255,255,0.08)',
      }
  }
})

/** 导出：银行卡比例（1.586）正面名片 HTML，独立可部署 */
function exportCard(): void {
  const f = frontContent.value
  const esc = (s: string | undefined | null): string =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const m = materialStyle.value
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(f.name)} · 名片</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0b0d; font-family:'Inter','Noto Sans SC','PingFang SC','Microsoft YaHei',sans-serif; }
  .card {
    width:min(85.6mm, 92vw); aspect-ratio:1.586;
    border-radius:3.5mm;
    background:${m.background};
    border:0.3mm solid ${m.borderColor};
    padding:5.5mm 6mm;
    color:#f5f9fe;
    display:flex; flex-direction:column; justify-content:space-between;
    box-shadow:0 8px 30px rgba(0,0,0,0.6), inset 0 0 18px ${m.sheen};
    overflow:hidden; position:relative;
  }
  .card::before {
    content:''; position:absolute; inset:0; background:${m.glare}; mix-blend-mode:screen; pointer-events:none;
  }
  .top { display:flex; align-items:flex-start; justify-content:space-between; }
  .brand { font-size:3.2mm; font-weight:700; letter-spacing:0.06em; background:linear-gradient(90deg,#3ee1a3,#32f08c 36%,#60f2bd 71.6%,#a0fde7); -webkit-background-clip:text; background-clip:text; color:transparent; }
  .brand-sub { font-size:1.9mm; color:rgba(245,249,254,0.45); margin-top:0.8mm; letter-spacing:0.04em; }
  .avatar { width:9.5mm; height:9.5mm; border-radius:50%; border:0.4mm solid ${m.borderColor}; display:flex; align-items:center; justify-content:center; font-size:4.6mm; font-weight:700; color:#32f08c; background:rgba(50,240,140,0.1); }
  .name { font-size:6mm; font-weight:700; letter-spacing:0.03em; }
  .headline { font-size:3mm; color:#60f2bd; margin-top:1.2mm; }
  .tags { display:flex; gap:1.6mm; flex-wrap:wrap; margin-top:2.6mm; }
  .tag { font-size:2.1mm; color:rgba(245,249,254,0.65); border:0.2mm solid rgba(255,255,255,0.14); border-radius:1.6mm; padding:0.7mm 2mm; }
  .contact { font-size:2.4mm; color:rgba(245,249,254,0.5); display:flex; gap:4mm; margin-top:3mm; }
  .foot { font-size:1.8mm; color:rgba(245,249,254,0.3); letter-spacing:0.05em; margin-top:2.4mm; }
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
</script>

<template>
  <div class="relative min-h-full">
    <div class="aura-layer" aria-hidden="true" />

    <div class="relative z-1 mx-auto max-w-4xl px-6 pb-16">
      <!-- 头部操作 -->
      <PageHeader code="A5" title="对外名片" desc="3D 悬浮 · 拖拽翻面 · 质感可换">
        <SecondaryButton @click="toggleFace">
          {{ flipped ? '翻回正面' : '翻到背面' }}
        </SecondaryButton>
        <PrimaryButton :disabled="store.isEmpty" @click="exportCard">导出名片 HTML</PrimaryButton>
      </PageHeader>

      <!-- ═══════ 3D 悬浮名片 ═══════ -->
      <section class="flex flex-col items-center py-8">
        <!-- 质感切换 -->
        <div class="mb-8 flex flex-wrap justify-center gap-2">
          <button
            v-for="(meta, key) in MATERIALS"
            :key="key"
            class="rounded-full border px-4 py-1.5 text-[13px] transition-colors"
            :class="
              material === key
                ? 'border-[rgba(50,240,140,0.6)] bg-[rgba(50,240,140,0.12)] text-[#32f08c]'
                : 'border-[rgba(255,255,255,0.1)] bg-[rgba(237,239,242,0.05)] text-[rgba(245,249,254,0.55)] hover:text-[#f5f9fe]'
            "
            @click="material = key as MaterialKey"
          >
            {{ meta.label }}
            <span class="ml-1 text-[11px] opacity-60">{{ meta.desc }}</span>
          </button>
        </div>

        <!-- 3D 场景 -->
        <div
          class="flex h-[440px] w-full items-center justify-center"
          style="perspective: 1200px"
        >
          <div
            ref="cardEl"
            class="relative w-[440px] max-w-full cursor-pointer select-none rounded-2xl border shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
            :style="{
              aspectRatio: '1.586',
              'transform-style': 'preserve-3d',
              willChange: 'transform',
              ...materialStyle,
            }"
            title="点击翻面"
            @pointermove="onPointerMove"
            @pointerleave="onPointerLeave"
            @click="toggleFace"
          >
            <!-- 光泽层 -->
            <div
              class="pointer-events-none absolute inset-0 rounded-2xl"
              :style="{ background: materialStyle.glare, 'mix-blend-mode': 'screen' }"
            />

            <!-- 正面 -->
            <div
              class="absolute inset-0 flex flex-col justify-between p-8"
              :style="{
                'backface-visibility': 'hidden',
                transform: 'rotateY(0deg)',
                background: materialStyle.faceBg,
                borderRadius: '16px',
              }"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="text-brand-gradient text-[16px] font-bold tracking-[0.06em]">
                    PROFESSION ARCHIVES
                  </div>
                  <div class="mt-1 text-[10px] tracking-[0.04em] text-[rgba(245,249,254,0.45)]">
                    生涯名片 · LOCAL-FIRST
                  </div>
                </div>
                <div
                  class="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-xl font-bold text-[#32f08c]"
                >
                  {{ (profile.full_name || '?').slice(0, 1) }}
                </div>
              </div>

              <div>
                <div class="heading-tight text-[34px] leading-none tracking-[0.03em] text-[#f5f9fe]">
                  {{ profile.full_name || '未命名' }}
                </div>
                <div v-if="profile.headline" class="mt-2 text-[15px] text-[#60f2bd]">
                  {{ profile.headline }}
                </div>
                <div v-if="card.tagCloud.length" class="mt-4 flex flex-wrap gap-2">
                  <span
                    v-for="t in card.tagCloud.slice(0, 4)"
                    :key="t.name"
                    class="rounded-full border border-[rgba(255,255,255,0.14)] px-2.5 py-0.5 text-[11px] text-[rgba(245,249,254,0.65)]"
                  >
                    #{{ t.name }}
                  </span>
                </div>
                <div v-if="profile.email || profile.phone" class="mt-4 flex gap-5 text-[12px] text-[rgba(245,249,254,0.5)]">
                  <span v-if="profile.email">✉ {{ profile.email }}</span>
                  <span v-if="profile.phone">☎ {{ profile.phone }}</span>
                </div>
              </div>

              <div class="text-[10px] tracking-[0.05em] text-[rgba(245,249,254,0.3)]">
                {{ profile.full_name || '未命名' }} · 由 Profession-Archives 生成
              </div>
            </div>

            <!-- 背面（180° 旋转） -->
            <div
              class="absolute inset-0 flex flex-col items-center justify-between p-8"
              :style="{
                'backface-visibility': 'hidden',
                transform: 'rotateY(180deg)',
                background: materialStyle.faceBg,
                borderRadius: '16px',
              }"
            >
              <div class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
                <div class="grid grid-cols-8 gap-[7px]">
                  <span v-for="i in 64" :key="i" class="h-[8px] w-[8px] rounded-[1px] bg-[#32f08c]" />
                </div>
              </div>

              <div class="relative flex flex-col items-center">
                <div
                  class="flex h-16 w-16 items-center justify-center rounded-xl border border-[rgba(50,240,140,0.5)] bg-[rgba(50,240,140,0.1)] text-3xl font-bold text-[#32f08c]"
                >
                  {{ (profile.full_name || '?').slice(0, 1) }}
                </div>
                <div class="mt-2.5 text-[12px] tracking-[0.08em] text-[rgba(245,249,254,0.4)]">
                  扫一扫，了解更多
                </div>
              </div>

              <div class="relative">
                <div class="mb-2.5 text-center text-[10px] tracking-[0.08em] text-[rgba(245,249,254,0.3)]">
                  关注领域
                </div>
                <div class="flex flex-wrap justify-center gap-2">
                  <span
                    v-for="t in card.tagCloud.slice(0, 8)"
                    :key="t.name"
                    class="rounded-full border border-[rgba(50,240,140,0.2)] bg-[rgba(50,240,140,0.06)] px-2.5 py-1 text-[11px] text-[#60f2bd]"
                  >
                    #{{ t.name }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 text-[11px] text-[rgba(245,249,254,0.35)]">
          点击卡片翻面 · 移动鼠标倾斜 · 当前质感：{{ MATERIALS[material].label }}
        </div>
      </section>

      <!-- ═══════ 档案折叠区 ═══════ -->
      <section class="mt-10">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="heading-tight text-[16px] tracking-wide text-[#f5f9fe]">名片内容来自档案</h2>
          <span class="text-xs text-[rgba(245,249,254,0.35)]">编辑档案即实时更新此名片</span>
        </div>

        <!-- 统计 -->
        <div class="grid grid-cols-4 divide-x divide-[rgba(255,255,255,0.08)]">
          <div v-for="s in stats" :key="s.label" class="px-4 py-4 text-center">
            <div class="font-mono-data text-lg font-bold text-[#32f08c]">{{ s.value }}</div>
            <div class="mt-0.5 text-[11px] text-[rgba(245,249,254,0.45)]">{{ s.label }}</div>
          </div>
        </div>

        <!-- summary -->
        <div v-if="profile.summary" class="card-glass p-5">
          <div class="mb-2 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">关于我</div>
          <p class="text-[13.5px] leading-relaxed text-[rgba(245,249,254,0.75)]">{{ profile.summary }}</p>
        </div>

        <!-- 技能 -->
        <div v-if="profile.skills.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">技能图谱</div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="skill in profile.skills"
              :key="skill.id"
              class="rounded-full border border-[rgba(50,240,140,0.25)] bg-[rgba(50,240,140,0.06)] px-3.5 py-1.5 text-[12.5px] text-[#60f2bd]"
            >
              {{ skill.name }}
              <span v-if="skill.category" class="ml-1.5 text-[10.5px] text-[rgba(245,249,254,0.35)]">
                {{ skill.category }}
              </span>
            </span>
          </div>
        </div>

        <!-- 项目作品集 -->
        <div v-if="profile.projects.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
            项目作品集
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              v-for="proj in profile.projects"
              :key="proj.id"
              class="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(237,239,242,0.04)] p-4"
            >
              <div class="text-[13.5px] font-semibold text-[#f5f9fe]">{{ proj.name }}</div>
              <p class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                {{ proj.description_md }}
              </p>
              <div v-if="proj.tags.length" class="mt-2 flex flex-wrap gap-1.5">
                <span
                  v-for="tag in proj.tags"
                  :key="tag"
                  class="rounded bg-[rgba(237,239,242,0.08)] px-1.5 py-0.5 text-[10.5px] text-[rgba(245,249,254,0.45)]"
                >
                  #{{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 生涯时间线 -->
        <div v-if="card.timeline.length" class="card-glass mt-4 p-5">
          <div class="mb-4 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">
            生涯时间线
          </div>
          <div class="relative space-y-0 border-l border-[rgba(50,240,140,0.2)] pl-5">
            <div
              v-for="(item, i) in card.timeline"
              :key="`${item.kind}-${item.date}-${item.title}-${i}`"
              class="relative pb-5 last:pb-0"
            >
              <span
                class="absolute -left-[27px] top-1 h-2 w-2 rounded-full border-2 border-[#0a0b0d]"
                :class="
                  item.kind === 'experience'
                    ? 'bg-[#38bdf8]'
                    : item.kind === 'education'
                      ? 'bg-[#a78bfa]'
                      : item.kind === 'milestone'
                        ? 'bg-[#32f08c]'
                        : 'bg-[#60f2bd]'
                "
              />
              <div class="flex flex-wrap items-baseline gap-2">
                <span class="heading-tight text-[13.5px] text-[#f5f9fe]">{{ item.title }}</span>
                <span v-if="item.subtitle" class="text-[12px] text-[rgba(245,249,254,0.4)]">
                  {{ item.subtitle }}
                </span>
                <span class="ml-auto font-mono text-[11px] text-[rgba(245,249,254,0.35)]">
                  {{ item.date }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 成就 -->
        <div v-if="card.journalByType.achievement.length" class="card-glass mt-4 p-5">
          <div class="mb-3 text-[11px] font-medium tracking-widest text-[rgba(245,249,254,0.35)]">成就</div>
          <div class="space-y-2.5">
            <div
              v-for="a in card.journalByType.achievement"
              :key="a.id"
              class="rounded-lg border border-[rgba(50,240,140,0.15)] bg-[rgba(50,240,140,0.04)] px-4 py-3"
            >
              <div class="flex items-center justify-between gap-3">
                <span class="text-[13px] font-medium text-[#f5f9fe]">{{ a.title }}</span>
                <span class="shrink-0 font-mono text-[10.5px] text-[rgba(245,249,254,0.35)]">
                  {{ a.occurred_at }}
                </span>
              </div>
              <p v-if="a.content_md" class="mt-1 text-[12.5px] leading-relaxed text-[rgba(245,249,254,0.55)]">
                {{ a.content_md }}
              </p>
            </div>
          </div>
        </div>

        <!-- 页脚 -->
        <div class="mt-6 text-center text-[11px] text-[rgba(245,249,254,0.3)]">
          由 Profession-Archives 生成 · 本地优先 · 数据归你所有
        </div>
      </section>
    </div>
  </div>
</template>
