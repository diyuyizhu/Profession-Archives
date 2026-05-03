<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { createArchive, type ArchivePayload } from "../services/api";

const emit = defineEmits<{
  saved: [profileId: number];
}>();

const form = reactive<ArchivePayload>({
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  summary: "",
  education: [{ school: "" }],
  skills: [{ name: "", category: "", tags: [] }],
  experiences: [
    {
      role: "",
      company: "",
      description_md: "",
      tags: [],
      start_date: "",
      end_date: "",
    },
  ],
  projects: [
    {
      name: "",
      summary: "",
      description_md: "",
      tags: [],
      attachments: [],
    },
  ],
});

const status = ref("等待保存");
const educationText = ref("");

const payloadPreview = computed(() => JSON.stringify(form, null, 2));

async function handleSave() {
  status.value = "正在保存档案...";
  const response = await createArchive(form);
  status.value = `档案已保存，ID ${response.id}`;
  emit("saved", response.id);
}
</script>

<template>
  <section class="panel">
    <header class="panel-header">
      <h2>档案录入</h2>
      <p>把个人信息、经历、项目和技能原子化录入，后续才能快速组装简历。</p>
    </header>

    <div class="form-grid">
      <label>
        <span>姓名</span>
        <input v-model="form.full_name" placeholder="张三" />
      </label>
      <label>
        <span>标题</span>
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
      <span>个人摘要</span>
      <textarea
        v-model="form.summary"
        rows="4"
        placeholder="一句话介绍你的核心能力。"
      />
    </label>

    <div class="stack">
      <div class="section-title">
        <h3>教育经历</h3>
        <small>支持后续扩展为多条记录</small>
      </div>
      <label>
        <span>教育 JSON 草稿</span>
        <textarea
          v-model="educationText"
          rows="4"
          placeholder='[{"school":"示例大学","degree":"本科"}]'
        />
      </label>
    </div>

    <div class="section-title">
      <h3>预览</h3>
      <small>当前是表单骨架，后续会拆成更细的可编辑列表。</small>
    </div>
    <pre class="preview">{{ payloadPreview }}</pre>

    <footer class="actions">
      <span class="status">{{ status }}</span>
      <button type="button" @click="handleSave">保存档案</button>
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
.section-title h3 {
  margin: 0;
}

.panel-header p,
.section-title small,
.status {
  color: #a9b4d0;
}

.form-grid {
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
  min-height: 180px;
  overflow: auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

button {
  border: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #7dd3fc, #38bdf8);
  color: #062033;
  padding: 12px 18px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
