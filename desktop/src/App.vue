<script setup lang="ts">
import { ref } from "vue";
import ArchiveEntryView from "./views/ArchiveEntryView.vue";
import JobInputView from "./views/JobInputView.vue";
import ProfileManagerView from "./views/ProfileManagerView.vue";
import TrackingBoardView from "./views/TrackingBoardView.vue";

const activeView = ref<"archive" | "job" | "tracking" | "manager">("archive");
const lastProfileId = ref<number | null>(null);
const lastDraftSummary = ref("");
</script>

<template>
  <main class="shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Profession Archives</p>
        <h1>本地化职业档案与岗位特化简历</h1>
        <p class="lede">
          先把个人经历拆成可复用资产，再让 JD 输入直接驱动简历草稿和投递记录。
        </p>
      </div>
      <div class="stats">
        <article>
          <span>当前档案</span>
          <strong>{{ lastProfileId ?? "未保存" }}</strong>
        </article>
        <article>
          <span>最新草稿</span>
          <strong>{{ lastDraftSummary || "等待生成" }}</strong>
        </article>
      </div>
    </section>

    <nav class="tabs">
      <button
        :class="{ active: activeView === 'archive' }"
        @click="activeView = 'archive'"
      >
        档案录入
      </button>
      <button
        :class="{ active: activeView === 'job' }"
        @click="activeView = 'job'"
      >
        JD 输入
      </button>
      <button
        :class="{ active: activeView === 'tracking' }"
        @click="activeView = 'tracking'"
      >
        投递看板
      </button>
      <button
        :class="{ active: activeView === 'manager' }"
        @click="activeView = 'manager'"
      >
        档案管理
      </button>
    </nav>

    <ArchiveEntryView
      v-if="activeView === 'archive'"
      @saved="lastProfileId = $event"
    />
    <JobInputView
      v-else-if="activeView === 'job'"
      @drafted="lastDraftSummary = $event"
    />
    <TrackingBoardView v-else-if="activeView === 'tracking'" />
    <ProfileManagerView v-else />
  </main>
</template>

<style scoped>
:global(*) {
  box-sizing: border-box;
}

:global(body) {
  margin: 0;
  min-height: 100vh;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  background:
    radial-gradient(
      circle at top left,
      rgba(56, 189, 248, 0.22),
      transparent 28%
    ),
    radial-gradient(
      circle at top right,
      rgba(251, 191, 36, 0.16),
      transparent 24%
    ),
    linear-gradient(180deg, #050816 0%, #091224 52%, #04070f 100%);
  color: #eef2ff;
}

.shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 36px 20px 48px;
  display: grid;
  gap: 20px;
}

.hero {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 20px;
  padding: 28px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 12, 24, 0.7);
}

.eyebrow {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 12px;
  color: #7dd3fc;
}

h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 52px);
  line-height: 1.05;
}

.lede {
  max-width: 62ch;
  color: #a9b4d0;
  margin-top: 14px;
}

.stats {
  display: grid;
  gap: 14px;
}

.stats article {
  padding: 18px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.stats span {
  display: block;
  color: #a9b4d0;
  margin-bottom: 6px;
}

.tabs {
  display: inline-flex;
  gap: 10px;
  padding: 8px;
  width: fit-content;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tabs button {
  border: 0;
  border-radius: 999px;
  padding: 10px 16px;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
}

.tabs button.active {
  background: #e2e8f0;
  color: #09111f;
}

@media (max-width: 860px) {
  .hero {
    grid-template-columns: 1fr;
  }
}
</style>
