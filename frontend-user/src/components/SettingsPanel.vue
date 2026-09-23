<template>
  <Teleport to="body">
    <Transition name="settings-fade">
      <div v-if="open" class="settings-overlay" @click.self="$emit('update:open', false)">
        <div class="settings-panel" :style="panelStyle" role="dialog" aria-label="阅读设置">
          <div class="settings-panel__header">
            <span class="settings-panel__title">阅读设置</span>
            <button class="settings-panel__close" title="关闭" @click="$emit('update:open', false)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div class="settings-panel__body">
            <label class="setting-item">
              <div class="setting-item__text">
                <span class="setting-item__label">自动打开上次的文件</span>
                <span class="setting-item__desc">重新进入阅读器时，自动加载上次阅读的文件</span>
              </div>
              <input
                type="checkbox" class="setting-item__switch"
                :checked="settings.autoOpenLastFile"
                @change="onChange('autoOpenLastFile', ($event.target as HTMLInputElement).checked)"
              />
            </label>

            <label class="setting-item">
              <div class="setting-item__text">
                <span class="setting-item__label">记住阅读位置</span>
                <span class="setting-item__desc">下次打开同一文件时，自动回到上次阅读的页码</span>
              </div>
              <input
                type="checkbox" class="setting-item__switch"
                :checked="settings.rememberPage"
                @change="onChange('rememberPage', ($event.target as HTMLInputElement).checked)"
              />
            </label>

            <label class="setting-item">
              <div class="setting-item__text">
                <span class="setting-item__label">恢复缩放比例</span>
                <span class="setting-item__desc">下次打开同一文件时，自动恢复上次使用的缩放</span>
              </div>
              <input
                type="checkbox" class="setting-item__switch"
                :checked="settings.rememberScale"
                @change="onChange('rememberScale', ($event.target as HTMLInputElement).checked)"
              />
            </label>
          </div>

          <div class="settings-panel__footer">
            <span class="settings-panel__note">设置仅保存在本机浏览器中</span>
            <button class="settings-panel__reset" @click="$emit('reset')">清除全部记录</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ViewerSettings } from '@/utils/storage'

const props = defineProps<{
  open: boolean
  settings: ViewerSettings
  /** 面板锚点（工具栏齿轮按钮），用于定位 */
  anchorEl: HTMLElement | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  change: [key: keyof ViewerSettings, value: boolean]
  reset: []
}>()

/** 相对触发按钮定位，避免遮挡工具栏 */
const panelStyle = computed(() => {
  const el = props.anchorEl
  if (!el) return {}
  const rect = el.getBoundingClientRect()
  return {
    top: `${rect.bottom + 8}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`,
  }
})

function onChange(key: keyof ViewerSettings, value: boolean) {
  emit('change', key, value)
}
</script>

<style lang="scss" scoped>
.settings-overlay {
  position: fixed; inset: 0; z-index: 900;
}
.settings-panel {
  position: fixed; z-index: 901;
  width: 320px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  &__header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
  }
  &__title { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); }
  &__close {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px;
    border: none; background: transparent;
    color: var(--text-tertiary); cursor: pointer;
    border-radius: var(--radius-sm); transition: all 0.2s;
    &:hover { background: var(--bg-color); color: var(--text-primary); }
  }
  &__body { padding: 4px 0; }
  &__footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px;
    border-top: 1px solid var(--border-color);
    background: #fafafa;
  }
  &__note { font-size: var(--font-size-sm); color: var(--text-tertiary); }
  &__reset {
    border: none; background: transparent;
    color: var(--primary-color); font-size: var(--font-size-sm);
    cursor: pointer; padding: 2px 4px;
    &:hover { color: var(--primary-active); text-decoration: underline; }
  }
}

.setting-item {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 16px; cursor: pointer;
  transition: background 0.2s;
  &:hover { background: var(--bg-color); }
  &__text { display: flex; flex-direction: column; gap: 2px; }
  &__label { font-size: var(--font-size-base); color: var(--text-primary); }
  &__desc { font-size: var(--font-size-sm); color: var(--text-tertiary); line-height: 1.4; }
  &__switch {
    appearance: none; flex-shrink: 0;
    width: 38px; height: 22px; border-radius: 11px;
    background: #d9d9d9; cursor: pointer; position: relative;
    transition: background 0.2s;
    &::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: left 0.2s;
    }
    &:checked { background: var(--primary-color); }
    &:checked::after { left: 18px; }
  }
}

.settings-fade-enter-active, .settings-fade-leave-active { transition: opacity 0.18s ease; }
.settings-fade-enter-from, .settings-fade-leave-to { opacity: 0; }
</style>
