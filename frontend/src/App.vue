<template>
  <div class="min-h-screen bg-gradient-to-br from-base via-neutral to-base">
    <!-- Header Navigation -->
    <nav
      class="navbar bg-base/80 backdrop-blur sticky top-0 z-40 border-b border-primary/20"
    >
      <div class="flex-1">
        <div class="btn btn-ghost text-xl font-bold glow-text">
          📊 Profession Archives
        </div>
      </div>
      <div class="flex-none gap-2">
        <div class="form-control">
          <input
            type="text"
            placeholder="搜索档案..."
            class="input input-bordered input-sm w-24 md:w-auto bg-neutral/50 border-primary/30"
          />
        </div>
        <div class="dropdown dropdown-end">
          <label tabindex="0" class="btn btn-ghost btn-circle avatar">
            <div
              class="w-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center"
            >
              <span class="text-sm">⚙️</span>
            </div>
          </label>
          <ul
            tabindex="0"
            class="dropdown-content z-[1] menu p-2 shadow bg-base border border-primary/20 rounded-box w-52"
          >
            <li><a @click="currentTab = 'profile'">个人设置</a></li>
            <li><a>帮助</a></li>
            <li><a>关于</a></li>
          </ul>
        </div>
      </div>
    </nav>

    <!-- Tabs Navigation -->
    <div
      class="tabs tabs-bordered bg-neutral/30 border-primary/20 sticky top-16 z-30"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="currentTab = tab.id"
        :class="[
          'tab',
          currentTab === tab.id ? 'tab-active text-primary' : 'text-primary/60',
        ]"
      >
        {{ tab.icon }} {{ tab.label }}
      </button>
    </div>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto p-4 md:p-8">
      <component :is="currentView" />
    </main>

    <!-- Footer -->
    <footer
      class="footer footer-center p-10 bg-neutral/50 border-t border-primary/20 mt-20"
    >
      <aside>
        <p class="text-primary/70">
          © 2026 Profession Archives - 你的职业资产管理器
        </p>
      </aside>
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
