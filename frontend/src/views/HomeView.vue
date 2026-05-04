<template>
  <section class="home-hero">
    <div class="home-copy">
      <p class="home-kicker">职业档案系统</p>
      <h1 class="home-title">让你的经历像资产一样被管理</h1>
      <p class="home-subtitle">
        一次录入，自动拆解为可复用模块。面对不同岗位，快速拼装最强简历。
      </p>
      <div class="home-actions">
        <button class="primary-btn">开始创建档案</button>
        <button class="ghost-btn">查看投递看板</button>
      </div>
      <div class="home-stats">
        <div>
          <p class="stat-value">3x</p>
          <p class="stat-label">简历生成效率</p>
        </div>
        <div>
          <p class="stat-value">100%</p>
          <p class="stat-label">本地私密存储</p>
        </div>
        <div>
          <p class="stat-value">∞</p>
          <p class="stat-label">多岗位复用</p>
        </div>
      </div>
    </div>
    <div class="home-figure">
      <div class="figure-frame">
        <img :src="managerImage" alt="Manager with tie" />
      </div>
      <div class="figure-card">
        <p class="figure-title">职业经理人画像</p>
        <p class="figure-desc">代表专注、专业、可复用的职业资产。</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import managerImage from "../assets/manager.svg";
</script>

<style scoped></style>
