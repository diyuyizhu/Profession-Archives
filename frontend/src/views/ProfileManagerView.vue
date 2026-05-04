<template>
  <div class="space-y-6">
    <!-- Header -->
    <div
      class="card bg-gradient-to-r from-accent/10 to-primary/10 border border-primary/20"
    >
      <div class="card-body">
        <h1 class="card-title text-3xl glow-text">档案管理</h1>
        <p class="text-primary/70">管理和编辑你的所有职业档案</p>
      </div>
    </div>

    <!-- Profile List & Detail Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Profile List -->
      <div class="card bg-neutral border border-primary/20">
        <div class="card-body">
          <h2 class="card-title mb-4">我的档案</h2>
          <div class="space-y-2 max-h-96 overflow-y-auto">
            <button
              v-for="profile in profiles"
              :key="profile.id"
              @click="selectProfile(profile)"
              :class="[
                'btn btn-block justify-start text-left',
                selectedProfile?.id === profile.id
                  ? 'btn-primary'
                  : 'btn-ghost btn-outline border-primary/30',
              ]"
            >
              <div>
                <div class="font-bold">{{ profile.full_name }}</div>
                <div class="text-xs opacity-70">{{ profile.headline }}</div>
              </div>
            </button>
          </div>
          <button
            @click="refreshProfiles"
            class="btn btn-outline btn-sm mt-4 w-full"
          >
            刷新
          </button>
        </div>
      </div>

      <!-- Profile Detail -->
      <div v-if="selectedProfile" class="lg:col-span-2 space-y-4">
        <!-- Basic Info -->
        <div class="card bg-neutral border border-primary/20">
          <div class="card-body">
            <h3 class="card-title">基本信息</h3>
            <div class="form-control">
              <label class="label"><span class="label-text">姓名</span></label>
              <input
                v-model="editForm.full_name"
                type="text"
                class="input input-bordered bg-neutral/50 border-primary/30"
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"
                  ><span class="label-text">职位</span></label
                >
                <input
                  v-model="editForm.headline"
                  type="text"
                  class="input input-bordered bg-neutral/50 border-primary/30"
                />
              </div>
              <div class="form-control">
                <label class="label"
                  ><span class="label-text">邮箱</span></label
                >
                <input
                  v-model="editForm.email"
                  type="email"
                  class="input input-bordered bg-neutral/50 border-primary/30"
                />
              </div>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">电话</span></label>
              <input
                v-model="editForm.phone"
                type="tel"
                class="input input-bordered bg-neutral/50 border-primary/30"
              />
            </div>
            <div class="form-control">
              <label class="label"
                ><span class="label-text">个人总结</span></label
              >
              <textarea
                v-model="editForm.summary"
                class="textarea textarea-bordered bg-neutral/50 border-primary/30 h-20"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="grid grid-cols-2 gap-4">
          <div class="stat bg-neutral border border-info/20 rounded">
            <div class="stat-title text-info">技能数量</div>
            <div class="stat-value text-info">
              {{ selectedProfile.skills.length }}
            </div>
          </div>
          <div class="stat bg-neutral border border-warning/20 rounded">
            <div class="stat-title text-warning">工作经历</div>
            <div class="stat-value text-warning">
              {{ selectedProfile.experiences.length }}
            </div>
          </div>
          <div class="stat bg-neutral border border-success/20 rounded">
            <div class="stat-title text-success">项目数</div>
            <div class="stat-value text-success">
              {{ selectedProfile.projects.length }}
            </div>
          </div>
          <div class="stat bg-neutral border border-secondary/20 rounded">
            <div class="stat-title text-secondary">教育背景</div>
            <div class="stat-value text-secondary">
              {{ selectedProfile.education.length }}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-4">
          <button
            @click="saveProfile"
            :disabled="isSaving"
            class="btn btn-primary flex-1"
          >
            <span v-if="isSaving" class="loading loading-spinner"></span>
            保存修改
          </button>
          <button @click="cancelEdit" class="btn btn-outline flex-1">
            取消
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else
        class="lg:col-span-2 card bg-neutral/50 border border-primary/20"
      >
        <div class="card-body items-center justify-center min-h-96">
          <h3 class="text-xl text-primary/50">选择档案开始编辑</h3>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  listProfiles,
  getProfile,
  updateProfile,
  ProfileDetail,
  ProfileUpdate,
} from "../services/api";

const profiles = ref<ProfileDetail[]>([]);
const selectedProfile = ref<ProfileDetail | null>(null);
const isSaving = ref(false);

const editForm = ref<ProfileUpdate>({
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  summary: "",
});

const refreshProfiles = async () => {
  try {
    const data = await listProfiles();
    profiles.value = data;
  } catch (error) {
    console.error(error);
  }
};

const selectProfile = async (profile: ProfileDetail) => {
  selectedProfile.value = profile;
  editForm.value = {
    full_name: profile.full_name,
    headline: profile.headline,
    email: profile.email,
    phone: profile.phone,
    summary: profile.summary,
  };
};

const saveProfile = async () => {
  if (!selectedProfile.value) return;

  isSaving.value = true;
  try {
    await updateProfile(selectedProfile.value.id, editForm.value);
    alert("档案已更新");
    await refreshProfiles();
  } catch (error) {
    console.error(error);
    alert("保存失败");
  } finally {
    isSaving.value = false;
  }
};

const cancelEdit = () => {
  if (selectedProfile.value) {
    editForm.value = {
      full_name: selectedProfile.value.full_name,
      headline: selectedProfile.value.headline,
      email: selectedProfile.value.email,
      phone: selectedProfile.value.phone,
      summary: selectedProfile.value.summary,
    };
  }
};

onMounted(() => {
  refreshProfiles();
});
</script>

<style scoped></style>
