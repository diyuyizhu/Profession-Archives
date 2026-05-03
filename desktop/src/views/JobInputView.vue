<script setup lang="ts">
import { computed, ref } from "vue";
import { generateResumeDraft } from "../services/api";

const emit = defineEmits<{
  drafted: [summary: string];
}>();

const profileId = ref<number>(1);
const templateKey = ref("technical-minimal");
const jobDescription = ref("");
const status = ref("等待输入 JD");
const result = ref<{
  matched_keywords: string[];
  selected_projects: unknown[];
  selected_experiences: unknown[];
  summary: string;
} | null>(null);

const keywordPreview = computed(
  () => result.value?.matched_keywords.slice(0, 8) ?? [],
);

async function handleDraft() {
  status.value = "正在生成简历草稿...";
  result.value = await generateResumeDraft({
    profile_id: profileId.value,
    job_description: jobDescription.value,
    template_key: templateKey.value,
  });
  status.value = "草稿已生成";
  emit("drafted", result.value.summary);
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>JD 输入</h2>
      <p>粘贴岗位要求后，后端会先提取关键词并给出简历草稿雏形。</p>
    </header>

    <div class="form-grid">
      <label>
        <span>档案 ID</span>
        <input v-model.number="profileId" type="number" min="1" />
      </label>
      <label>
        <span>模板</span>
        <select v-model="templateKey">
          <option value="technical-minimal">简约技术型</option>
          <option value="academic-research">学术科研型</option>
          <option value="functional-management">职能管理型</option>
        </select>
      </label>
    </div>

    <label class="stack">
      <span>岗位描述</span>
      <textarea
        v-model="jobDescription"
        rows="10"
        placeholder="在这里粘贴 JD，后续可接浏览器插件一键导入。"
      />
    </label>

    <div class="result-grid">
      <section>
        <h3>状态</h3>
        <p>{{ status }}</p>
      </section>
      <section>
        <h3>命中关键词</h3>
        <p v-if="keywordPreview.length">{{ keywordPreview.join(" / ") }}</p>
        <p v-else>生成后显示</p>
      </section>
    </div>

    <pre class="preview">{{
      result ? JSON.stringify(result, null, 2) : "等待生成结果"
    }}</pre>

    <footer class="actions">
      <button type="button" @click="handleDraft">生成简历草稿</button>
    </footer>
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
.result-grid h3 {
  margin: 0;
}

.panel-header p {
  color: #a9b4d0;
}

.form-grid,
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.stack {
  display: grid;
  gap: 10px;
}

label {
  display: grid;
  gap: 8px;
}

input,
select,
textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  padding: 12px 14px;
  font: inherit;
}

.preview {
  margin: 0;
  padding: 16px;
  min-height: 200px;
  overflow: auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.actions {
  display: flex;
  justify-content: flex-end;
}

button {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  color: #2b1b04;
  padding: 12px 18px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 720px) {
  .form-grid,
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
