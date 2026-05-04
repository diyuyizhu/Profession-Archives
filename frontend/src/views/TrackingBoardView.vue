<template>
  <div class="space-y-6">
    <!-- Header -->
    <div
      class="card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20"
    >
      <div class="card-body">
        <h1 class="card-title text-3xl glow-text">投递看板</h1>
        <p class="text-primary/70">追踪你的求职进度，一览所有投递状态</p>
      </div>
    </div>

    <!-- Quick Add Application -->
    <div class="card bg-neutral border border-primary/20">
      <div class="card-body">
        <h2 class="card-title">快速添加投递</h2>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            v-model="selectedProfile"
            class="select select-bordered bg-neutral/50 border-primary/30"
          >
            <option value="">选择档案</option>
            <option value="default">默认档案</option>
          </select>
          <input
            v-model="newApp.job_title"
            type="text"
            placeholder="职位名称"
            class="input input-bordered bg-neutral/50 border-primary/30"
          />
          <input
            v-model="newApp.company"
            type="text"
            placeholder="公司名称"
            class="input input-bordered bg-neutral/50 border-primary/30"
          />
          <button @click="addApplication" class="btn btn-primary">
            添加投递
          </button>
        </div>
      </div>
    </div>

    <!-- Board Grid -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Applied Column -->
      <div class="space-y-4">
        <h3 class="font-bold text-lg text-info flex items-center gap-2">
          📤 已投递
        </h3>
        <div class="space-y-3">
          <div
            v-for="app in applications.filter((a) => a.status === 'applied')"
            :key="app.id"
            class="card bg-neutral border border-info/30 shadow"
          >
            <div class="card-body p-4">
              <h4 class="font-bold text-info">{{ app.job_title }}</h4>
              <p class="text-sm text-primary/70">{{ app.company }}</p>
              <div class="card-actions justify-end mt-2">
                <button
                  @click="updateStatus(app.id, 'interviewing')"
                  class="btn btn-xs btn-info btn-outline"
                >
                  进面试
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Interviewing Column -->
      <div class="space-y-4">
        <h3 class="font-bold text-lg text-warning flex items-center gap-2">
          💬 面试中
        </h3>
        <div class="space-y-3">
          <div
            v-for="app in applications.filter(
              (a) => a.status === 'interviewing',
            )"
            :key="app.id"
            class="card bg-neutral border border-warning/30 shadow"
          >
            <div class="card-body p-4">
              <h4 class="font-bold text-warning">{{ app.job_title }}</h4>
              <p class="text-sm text-primary/70">{{ app.company }}</p>
              <div class="card-actions justify-end gap-1 mt-2">
                <button
                  @click="updateStatus(app.id, 'offer')"
                  class="btn btn-xs btn-success btn-outline"
                >
                  获得offer
                </button>
                <button
                  @click="updateStatus(app.id, 'rejected')"
                  class="btn btn-xs btn-error btn-outline"
                >
                  被拒
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Offer Column -->
      <div class="space-y-4">
        <h3 class="font-bold text-lg text-success flex items-center gap-2">
          🎉 收offer
        </h3>
        <div class="space-y-3">
          <div
            v-for="app in applications.filter((a) => a.status === 'offer')"
            :key="app.id"
            class="card bg-neutral border border-success/30 shadow"
          >
            <div class="card-body p-4">
              <h4 class="font-bold text-success">{{ app.job_title }}</h4>
              <p class="text-sm text-primary/70">{{ app.company }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Rejected Column -->
      <div class="space-y-4">
        <h3 class="font-bold text-lg text-error flex items-center gap-2">
          ❌ 被拒
        </h3>
        <div class="space-y-3">
          <div
            v-for="app in applications.filter((a) => a.status === 'rejected')"
            :key="app.id"
            class="card bg-neutral border border-error/30 shadow"
          >
            <div class="card-body p-4">
              <h4 class="font-bold text-error">{{ app.job_title }}</h4>
              <p class="text-sm text-primary/70">{{ app.company }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  listApplications,
  createApplication,
  updateApplicationStatus,
  ApplicationRecord,
  ApplicationPayload,
} from "../services/api";

const selectedProfile = ref("");
const applications = ref<ApplicationRecord[]>([]);
const isLoading = ref(false);

const newApp = ref<ApplicationPayload>({
  profile_id: "",
  job_title: "",
  company: "",
  status: "applied",
});

const loadApplications = async () => {
  try {
    const data = await listApplications();
    applications.value = data;
  } catch (error) {
    console.error(error);
  }
};

const addApplication = async () => {
  if (!newApp.value.job_title || !newApp.value.company) {
    alert("请填写职位和公司");
    return;
  }

  isLoading.value = true;
  try {
    await createApplication({
      ...newApp.value,
      profile_id: selectedProfile.value || "default",
    });
    newApp.value = {
      profile_id: "",
      job_title: "",
      company: "",
      status: "applied",
    };
    await loadApplications();
  } catch (error) {
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};

const updateStatus = async (appId: string, newStatus: string) => {
  try {
    await updateApplicationStatus(appId, newStatus);
    await loadApplications();
  } catch (error) {
    console.error(error);
  }
};

onMounted(() => {
  loadApplications();
});
</script>

<style scoped></style>
