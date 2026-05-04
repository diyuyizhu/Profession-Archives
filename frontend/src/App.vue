<template>
  <div class="min-h-screen app-shell">
    <!-- Header Navigation -->
    <nav class="nav-shell sticky top-0 z-40">
      <div class="nav-inner">
        <div class="brand">
          <span class="brand-mark">PA</span>
          <span class="brand-text">Profession Archives</span>
        </div>
        <div class="nav-actions">
          <label class="search-pill">
            <span class="search-icon">⌕</span>
            <input type="text" placeholder="搜索档案" />
          </label>
          <button class="icon-btn" title="设置">⚙️</button>
        </div>
      </div>
    </nav>

    <!-- Tabs Navigation -->
    <div class="tab-strip sticky top-16 z-30">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="['tab-pill', currentTab === tab.id ? 'is-active' : '']"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto p-4 md:p-8">
      <component :is="currentView" />
    </main>

    <!-- Footer -->
    <footer class="footer-shell">
      <p>© 2026 Profession Archives · 你的职业资产管理器</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ArchiveEntryView from "./views/ArchiveEntryView.vue";
import TrackingBoardView from "./views/TrackingBoardView.vue";
import ProfileManagerView from "./views/ProfileManagerView.vue";

const tabs = [
  { id: "archive", label: "档案录入", icon: "📝" },
  { id: "tracking", label: "投递看板", icon: "📊" },
  { id: "profile", label: "档案管理", icon: "👤" },
];

const currentTab = ref("archive");

const currentView = computed(() => {
  switch (currentTab.value) {
    case "tracking":
      return TrackingBoardView;
    case "profile":
      return ProfileManagerView;
    default:
      return ArchiveEntryView;
  }
});
</script>

<style scoped></style>
