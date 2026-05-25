<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const message = useMessage()
const errorText = ref('')
const { t } = useI18n()

const form = reactive({
  username: '',
  password: '',
})

async function handleSubmit() {
  errorText.value = ''

  try {
    await auth.login(form.username, form.password)
    message.success(t('login.success'))
    await router.push((route.query.redirect as string) || '/dashboard')
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : t('login.failed')
  }
}
</script>

<template>
  <section class="login-card apple-card">
    <div class="login-heading">
      <div class="login-mark">L</div>
      <h1>{{ t('login.title') }}</h1>
      <p>{{ t('login.subtitle') }}</p>
    </div>

    <n-form class="login-form" @keyup.enter="handleSubmit">
      <n-form-item :label="t('login.username')">
        <n-input v-model:value="form.username" size="large" placeholder="admin" autofocus />
      </n-form-item>
      <n-form-item :label="t('login.password')">
        <n-input v-model:value="form.password" size="large" type="password" show-password-on="click" :placeholder="t('login.passwordPlaceholder')" />
      </n-form-item>

      <n-alert v-if="errorText" type="error" :bordered="false">{{ errorText }}</n-alert>

      <n-button type="primary" size="large" block :loading="auth.loading" @click="handleSubmit">{{ t('login.submit') }}</n-button>
    </n-form>
  </section>
</template>

<style scoped>
.login-card {
  width: min(100%, 430px);
  padding: 34px;
}

.login-heading {
  text-align: center;
}

.login-mark {
  display: grid;
  width: 54px;
  height: 54px;
  margin: 0 auto 18px;
  place-items: center;
  color: #fff;
  background: #1d1d1f;
  border-radius: 18px;
  font-size: 26px;
  font-weight: 800;
}

h1 {
  margin: 0;
  color: var(--text-main);
  font-size: 28px;
  font-weight: 760;
}

p {
  margin: 10px 0 28px;
  color: var(--text-secondary);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@media (max-width: 480px) {
  .login-card {
    padding: 26px 20px;
    border-radius: 16px;
  }

  .login-mark {
    width: 48px;
    height: 48px;
    margin-bottom: 14px;
    border-radius: 16px;
    font-size: 23px;
  }

  h1 {
    font-size: 24px;
  }

  p {
    margin-bottom: 22px;
    font-size: 14px;
  }
}
</style>
