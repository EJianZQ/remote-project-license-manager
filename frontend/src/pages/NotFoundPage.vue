<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <main class="not-found">
    <section class="apple-card">
      <p>404</p>
      <h1>{{ t('notFound.title') }}</h1>
      <router-link to="/dashboard">{{ t('notFound.backDashboard') }}</router-link>
    </section>
  </main>
</template>

<style scoped>
.not-found {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
  background: var(--app-bg);
}

section {
  width: min(420px, 100%);
  padding: 36px;
  text-align: center;
}

p {
  margin: 0 0 8px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 700;
}

h1 {
  margin: 0 0 22px;
  color: var(--text-main);
  font-size: 28px;
}

a {
  display: inline-flex;
  padding: 10px 18px;
  color: #fff;
  background: #1d1d1f;
  border-radius: 999px;
  font-weight: 700;
}
</style>
