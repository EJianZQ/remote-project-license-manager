<template>
  <main class="auth-layout">
    <router-view />
  </main>
</template>

<style scoped>
.auth-layout {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 32px 18px;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 34%),
    var(--app-bg);
}
</style>
