<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  getProfile,
  listProfiles,
  updateProfile,
  type ProfileDetail,
  type ProfileSummary,
  type ProfileUpdatePayload,
} from "../services/api";

const profiles = ref<ProfileSummary[]>([]);
const selectedProfileId = ref<number | null>(null);
const loading = ref(false);
const saving = ref(false);
const message = ref("等待加载档案列表");

const form = reactive<ProfileUpdatePayload>({
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  summary: "",
});

const selectedProfile = computed(
  () =>
    profiles.value.find((profile) => profile.id === selectedProfileId.value) ??
    null,
);

async function loadProfiles() {
  loading.value = true;
  message.value = "正在加载档案列表...";
  try {
    profiles.value = await listProfiles();
    if (!selectedProfileId.value && profiles.value.length > 0) {
      selectedProfileId.value = profiles.value[0].id;
      await loadProfile(profiles.value[0].id);
    }
    message.value =
      profiles.value.length > 0
        ? "已加载档案列表"
        : "当前没有档案，先去档案录入页新增一个";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "加载档案列表失败";
  } finally {
    loading.value = false;
  }
}

function syncForm(profile: ProfileDetail) {
  form.full_name = profile.full_name;
  form.headline = profile.headline ?? "";
  form.email = profile.email ?? "";
  form.phone = profile.phone ?? "";
  form.summary = profile.summary ?? "";
}

async function loadProfile(profileId: number) {
  loading.value = true;
  message.value = `正在加载档案 ${profileId}...`;
  try {
    const profile = await getProfile(profileId);
    selectedProfileId.value = profile.id;
    syncForm(profile);
    message.value = `已加载 ${profile.full_name}`;
  } catch (error) {
    message.value = error instanceof Error ? error.message : "加载档案失败";
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  if (!selectedProfileId.value) {
    message.value = "请先选择一个档案";
    return;
  }

  saving.value = true;
  message.value = "正在保存档案...";
  try {
    const updated = await updateProfile(selectedProfileId.value, {
      full_name: form.full_name || null,
      headline: form.headline || null,
      email: form.email || null,
      phone: form.phone || null,
      summary: form.summary || null,
    });
    syncForm(updated);
    await loadProfiles();
    message.value = "档案已保存";
  } catch (error) {
    message.value = error instanceof Error ? error.message : "保存档案失败";
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadProfiles();
});
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>档案管理</h2>
      <p>在这里编辑已有档案的基础信息，后续简历组装会直接复用这些内容。</p>
    </header>

    <div class="layout">
      <aside class="sidebar">
        <div class="toolbar">
          <button type="button" @click="loadProfiles">刷新列表</button>
        </div>

        <div class="profile-list">
          <button
            v-for="profile in profiles"
            :key="profile.id"
            type="button"
            class="profile-item"
            :class="{ active: profile.id === selectedProfileId }"
            @click="loadProfile(profile.id)"
          >
            <strong>{{ profile.full_name }}</strong>
            <small>{{ profile.headline || "未填写标题" }}</small>
          </button>
        </div>
      </aside>

      <div class="editor">
        <div class="status-bar">
          <span>{{ message }}</span>
          <span v-if="selectedProfile"
            >当前：{{ selectedProfile.full_name }}</span
          >
        </div>

        <div class="form-grid">
          <label>
            <span>姓名</span>
            <input v-model="form.full_name" placeholder="张三" />
          </label>
          <label>
            <span>头衔</span>
            <input v-model="form.headline" placeholder="后端工程师" />
          </label>
          <label>
            <span>邮箱</span>
            <input v-model="form.email" placeholder="name@example.com" />
          </label>
          <label>
            <span>电话</span>
            <input v-model="form.phone" placeholder="13800000000" />
          </label>
        </div>

        <label class="stack">
          <span>摘要</span>
          <textarea
            v-model="form.summary"
            rows="6"
            placeholder="写下你的核心能力、技术方向和求职目标。"
          />
        </label>

        <div class="actions">
          <button type="button" :disabled="saving" @click="saveProfile">
            {{ saving ? "保存中..." : "保存档案" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 20px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(10, 16, 32, 0.82);
  color: #eef2ff;
  backdrop-filter: blur(18px);
}

.panel-header h2 {
  margin: 0;
}

.panel-header p,
small,
.status-bar {
  color: #a9b4d0;
}

.layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 16px;
}

.sidebar,
.editor {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.sidebar {
  display: grid;
  gap: 14px;
}

.toolbar {
  display: flex;
  justify-content: flex-end;
}

.profile-list {
  display: grid;
  gap: 10px;
}

.profile-item {
  display: grid;
  gap: 4px;
  text-align: left;
  background: rgba(10, 16, 32, 0.9);
  color: #eef2ff;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.profile-item.active {
  border-color: rgba(125, 211, 252, 0.75);
  box-shadow: 0 0 0 1px rgba(125, 211, 252, 0.25) inset;
}

.editor {
  display: grid;
  gap: 16px;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.stack {
  display: grid;
  gap: 8px;
}

label {
  display: grid;
  gap: 8px;
}

input,
textarea,
button {
  font: inherit;
}

input,
textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  padding: 12px 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

button {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #f9a8d4, #f472b6);
  color: #3a0821;
  padding: 12px 18px;
  font-weight: 700;
  cursor: pointer;
}

.profile-item strong {
  font-size: 15px;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .status-bar {
    flex-direction: column;
  }
}
</style>
