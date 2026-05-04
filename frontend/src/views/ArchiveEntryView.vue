<template>
  <div class="page-wrap">
    <!-- Hero Section -->
    <section class="hero-card">
      <div class="hero-grid">
        <div>
          <p class="hero-kicker">档案录入</p>
          <h1 class="hero-title">创建档案</h1>
          <p class="hero-subtitle">
            一次录入，快速生成可针对岗位特化的简历基础库。
          </p>
          <div class="hero-tags">
            <span>本地优先</span>
            <span>结构化</span>
            <span>可复用</span>
          </div>
        </div>
        <div class="hero-steps">
          <div class="step-card">
            <p class="step-title">01 基本信息</p>
            <p class="step-desc">姓名、职位、联系方式</p>
          </div>
          <div class="step-card">
            <p class="step-title">02 能力模块</p>
            <p class="step-desc">技能、教育、经历、项目</p>
          </div>
          <div class="step-card">
            <p class="step-title">03 生成草稿</p>
            <p class="step-desc">自动匹配 JD 关键词</p>
          </div>
        </div>
      </div>
      <div class="hero-glow"></div>
    </section>

    <!-- Form Section -->
    <div class="form-grid">
      <!-- Basic Info Card -->
      <section class="section-card section-wide">
        <header class="section-header">
          <div>
            <h2>基本信息</h2>
            <p>先确认你的身份与联系方式，后续可一键复用。</p>
          </div>
          <span class="section-badge">必填优先</span>
        </header>
        <div class="field-grid">
          <label class="field">
            <span>姓名 *</span>
            <input
              v-model="form.full_name"
              type="text"
              placeholder="请输入全名"
              required
            />
          </label>
          <label class="field">
            <span>职位</span>
            <input
              v-model="form.headline"
              type="text"
              placeholder="后端工程师 / 产品经理"
            />
          </label>
          <label class="field">
            <span>邮箱</span>
            <input v-model="form.email" type="email" placeholder="you@email.com" />
          </label>
          <label class="field">
            <span>电话</span>
            <input v-model="form.phone" type="tel" placeholder="+86 138xxxx" />
          </label>
          <label class="field field-wide">
            <span>个人总结</span>
            <textarea
              v-model="form.summary"
              placeholder="一句话概括你的能力边界与优势"
            ></textarea>
          </label>
        </div>
      </section>

      <!-- Skills Card -->
      <section class="section-card">
        <header class="section-header">
          <div>
            <h2>技能</h2>
            <p>按领域拆解你的能力资产。</p>
          </div>
          <button @click="addSkill" class="ghost-btn">+ 添加</button>
        </header>
        <div class="stack">
          <div v-for="(skill, idx) in form.skills" :key="idx" class="stack-card">
            <input v-model="skill.name" type="text" placeholder="技能名称" />
            <input v-model="skill.category" type="text" placeholder="分类" />
            <button @click="removeSkill(idx)" class="ghost-btn">移除</button>
          </div>
        </div>
      </section>

      <!-- Education Card -->
      <section class="section-card">
        <header class="section-header">
          <div>
            <h2>教育</h2>
            <p>学历与关键时间线，保持简洁。</p>
          </div>
          <button @click="addEducation" class="ghost-btn">+ 添加</button>
        </header>
        <div class="stack">
          <div v-for="(edu, idx) in form.education" :key="idx" class="stack-card">
            <input v-model="edu.school" type="text" placeholder="学校" />
            <input v-model="edu.degree" type="text" placeholder="学位" />
            <input v-model="edu.start_date" type="month" />
            <button @click="removeEducation(idx)" class="ghost-btn">移除</button>
          </div>
        </div>
      </section>

      <!-- Experience & Projects Card -->
      <section class="section-card section-wide">
        <header class="section-header">
          <div>
            <h2>经历与项目</h2>
            <p>突出可验证成果，避免长段落。</p>
          </div>
        </header>
        <div class="dual-tabs">
          <div class="tab-column">
            <div class="tab-title">
              <span>工作经历</span>
              <button @click="addExperience" class="ghost-btn">+ 添加</button>
            </div>
            <div class="stack">
              <div
                v-for="(exp, idx) in form.experiences"
                :key="`exp-${idx}`"
                class="stack-card"
              >
                <input v-model="exp.role" type="text" placeholder="职位" />
                <input v-model="exp.company" type="text" placeholder="公司" />
                <textarea v-model="exp.description_md" placeholder="职责描述"></textarea>
                <button @click="removeExperience(idx)" class="ghost-btn">移除</button>
              </div>
            </div>
          </div>
          <div class="tab-column">
            <div class="tab-title">
              <span>项目</span>
              <button @click="addProject" class="ghost-btn">+ 添加</button>
            </div>
            <div class="stack">
              <div
                v-for="(proj, idx) in form.projects"
                :key="`proj-${idx}`"
                class="stack-card"
              >
                <input v-model="proj.name" type="text" placeholder="项目名称" />
                <input v-model="proj.summary" type="text" placeholder="简介" />
                <textarea v-model="proj.description_md" placeholder="项目描述"></textarea>
                <button @click="removeProject(idx)" class="ghost-btn">移除</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Submit Button -->
    <div class="action-bar">
      <button class="ghost-btn">取消</button>
      <button @click="submitArchive" :disabled="isLoading" class="primary-btn">
        <span v-if="isLoading" class="loading loading-spinner"></span>
        保存档案
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { createArchive, ProfilePayload } from "../services/api";

const isLoading = ref(false);

const form = ref<ProfilePayload>({
  full_name: "",
  headline: "",
  email: "",
  phone: "",
  summary: "",
  education: [],
  skills: [],
  experiences: [],
  projects: [],
});

const addSkill = () => {
  form.value.skills.push({ name: "", category: "", tags: [] });
};

const removeSkill = (idx: number) => {
  form.value.skills.splice(idx, 1);
};

const addEducation = () => {
  form.value.education.push({
    school: "",
    degree: "",
    major: "",
    start_date: "",
    end_date: "",
  });
};

const removeEducation = (idx: number) => {
  form.value.education.splice(idx, 1);
};

const addExperience = () => {
  form.value.experiences.push({
    role: "",
    company: "",
    description_md: "",
    tags: [],
    start_date: "",
    end_date: "",
  });
};

const removeExperience = (idx: number) => {
  form.value.experiences.splice(idx, 1);
};

const addProject = () => {
  form.value.projects.push({
    name: "",
    summary: "",
    description_md: "",
    tags: [],
    attachments: [],
  });
};

const removeProject = (idx: number) => {
  form.value.projects.splice(idx, 1);
};

const submitArchive = async () => {
  if (!form.value.full_name) {
    alert("请填写姓名");
    return;
  }

  isLoading.value = true;
  try {
    await createArchive(form.value);
    alert("档案已保存！");
    // Reset form
    form.value = {
      full_name: "",
      headline: "",
      email: "",
      phone: "",
      summary: "",
      education: [],
      skills: [],
      experiences: [],
      projects: [],
    };
  } catch (error) {
    alert("保存失败，请重试");
    console.error(error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped></style>
