<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import {
  createApplication,
  listApplications,
  updateApplicationStatus,
  type ApplicationRecord,
  type ApplicationCreatePayload,
} from "../services/api";

const profileFilter = ref<number | undefined>(undefined);
const loading = ref(false);
const errorMessage = ref("");
const applications = ref<ApplicationRecord[]>([]);
const saving = ref(false);

const applicationForm = reactive<ApplicationCreatePayload>({
  profile_id: 1,
  company: "",
  title: "",
  status: "applied",
  job_description: "",
  job_url: "",
  snapshot_path: "",
  notes: "",
});

const columns = [
  { key: "applied", title: "已投递" },
  { key: "interviewing", title: "面试中" },
  { key: "rejected", title: "已回绝" },
  { key: "offer", title: "录用" },
] as const;

const groupedApplications = computed(() =>
  columns.map((column) => ({
    ...column,
    items: applications.value.filter(
      (application) => application.status === column.key,
    ),
  })),
);

async function loadApplications() {
  loading.value = true;
  errorMessage.value = "";
  try {
    applications.value = await listApplications(profileFilter.value);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "加载投递记录失败";
  } finally {
    loading.value = false;
  }
}

async function submitApplication() {
  saving.value = true;
  errorMessage.value = "";
  try {
    await createApplication({
      ...applicationForm,
      status: applicationForm.status || "applied",
      job_description: applicationForm.job_description || null,
      job_url: applicationForm.job_url || null,
      snapshot_path: applicationForm.snapshot_path || null,
      notes: applicationForm.notes || null,
    });

    applicationForm.company = "";
    applicationForm.title = "";
    applicationForm.job_description = "";
    applicationForm.job_url = "";
    applicationForm.snapshot_path = "";
    applicationForm.notes = "";
    applicationForm.status = "applied";
    await loadApplications();
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "创建投递记录失败";
  } finally {
    saving.value = false;
  }
}

async function advanceStatus(application: ApplicationRecord) {
  const nextStatus =
    application.status === "applied"
      ? "interviewing"
      : application.status === "interviewing"
        ? "offer"
        : application.status;

  if (nextStatus === application.status) {
    return;
  }

  await updateApplicationStatus(application.id, nextStatus);
  await loadApplications();
}

onMounted(() => {
  void loadApplications();
});
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>投递看板</h2>
      <p>
        四象限跟踪当前投递状态，支持新建投递、刷新看板，并从“已投递”推进到“面试中”和“录用”。
      </p>
    </header>

    <div class="grid">
      <div class="stack card-form">
        <div class="section-title">
          <h3>新增投递</h3>
          <small>录入岗位信息后立刻进入看板</small>
        </div>

        <div class="form-grid">
          <label>
            <span>档案 ID</span>
            <input
              v-model.number="applicationForm.profile_id"
              type="number"
              min="1"
            />
          </label>
          <label>
            <span>状态</span>
            <select v-model="applicationForm.status">
              <option value="applied">已投递</option>
              <option value="interviewing">面试中</option>
              <option value="rejected">已回绝</option>
              <option value="offer">录用</option>
            </select>
          </label>
          <label>
            <span>公司</span>
            <input v-model="applicationForm.company" placeholder="示例公司" />
          </label>
          <label>
            <span>岗位</span>
            <input
              v-model="applicationForm.title"
              placeholder="Python Backend Engineer"
            />
          </label>
        </div>

        <label>
          <span>JD 摘要</span>
          <textarea
            v-model="applicationForm.job_description"
            rows="4"
            placeholder="粘贴或简写岗位描述"
          />
        </label>

        <div class="form-grid">
          <label>
            <span>岗位链接</span>
            <input
              v-model="applicationForm.job_url"
              placeholder="https://..."
            />
          </label>
          <label>
            <span>岗位快照</span>
            <input
              v-model="applicationForm.snapshot_path"
              placeholder="/snapshots/job.html"
            />
          </label>
        </div>

        <label>
          <span>备注</span>
          <textarea
            v-model="applicationForm.notes"
            rows="3"
            placeholder="初筛、复盘、联系人等"
          />
        </label>

        <div class="form-actions">
          <button type="button" :disabled="saving" @click="submitApplication">
            {{ saving ? "保存中..." : "保存投递" }}
          </button>
        </div>
      </div>

      <div class="stack board-controls">
        <div class="toolbar">
          <label>
            <span>档案 ID 过滤</span>
            <input
              v-model.number="profileFilter"
              type="number"
              min="1"
              placeholder="留空查看全部"
            />
          </label>
          <button type="button" @click="loadApplications">刷新看板</button>
        </div>

        <p v-if="loading" class="hint">正在加载投递记录...</p>
        <p v-else-if="errorMessage" class="hint error">{{ errorMessage }}</p>
      </div>
    </div>

    <div class="board">
      <article
        v-for="column in groupedApplications"
        :key="column.key"
        class="column"
      >
        <header>
          <h3>{{ column.title }}</h3>
          <span>{{ column.items.length }}</span>
        </header>

        <div class="cards">
          <section
            v-for="application in column.items"
            :key="application.id"
            class="card"
          >
            <strong>{{ application.company }}</strong>
            <span>{{ application.title }}</span>
            <small>档案 ID: {{ application.profile_id }}</small>
            <small>更新于: {{ application.updated_at }}</small>
            <button
              v-if="
                application.status === 'applied' ||
                application.status === 'interviewing'
              "
              type="button"
              @click="advanceStatus(application)"
            >
              推进状态
            </button>
          </section>
        </div>
      </article>
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

.panel-header h2,
.column h3 {
  margin: 0;
}

.panel-header p,
.hint,
small {
  color: #a9b4d0;
}

.hint.error {
  color: #fca5a5;
}

.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 16px;
}

.stack {
  display: grid;
  gap: 12px;
}

.card-form,
.board-controls {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.section-title h3 {
  margin: 0;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

label {
  display: grid;
  gap: 8px;
}

input,
select,
textarea {
  width: 240px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  padding: 12px 14px;
  font: inherit;
}

.form-grid input,
.form-grid select {
  width: 100%;
}

textarea {
  width: 100%;
  resize: vertical;
}

button {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #93c5fd, #3b82f6);
  color: #051526;
  padding: 12px 18px;
  font-weight: 700;
  cursor: pointer;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
}

.board {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.column {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.column header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.column header span {
  min-width: 28px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
}

.cards {
  display: grid;
  gap: 12px;
}

.card {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(10, 16, 32, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.card strong {
  font-size: 15px;
}

.card button {
  justify-self: start;
  margin-top: 6px;
  background: linear-gradient(135deg, #6ee7b7, #10b981);
  color: #022315;
}

@media (max-width: 1100px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .board {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .toolbar,
  .form-grid {
    grid-template-columns: 1fr;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  input {
    width: 100%;
  }

  .card-form,
  .board-controls {
    padding: 14px;
  }

  .board {
    grid-template-columns: 1fr;
  }
}
</style>
