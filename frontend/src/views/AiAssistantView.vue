<template>
  <div class="ai-page">
    <!-- 顶栏 -->
    <header class="ai-header">
      <div class="ai-header-left">
        <div class="ai-logo">
          <el-icon :size="18"><MagicStick /></el-icon>
        </div>
        <div>
          <h2>AI 智能助手 · 小团</h2>
          <p>可以帮你查询部门、职位与员工信息，温柔又靠谱~</p>
        </div>
      </div>
      <div class="ai-header-actions">
        <el-button v-if="streaming" plain @click="stopStreaming">
          <el-icon><VideoPause /></el-icon>
          停止生成
        </el-button>
        <el-button plain @click="newChat">
          <el-icon><RefreshLeft /></el-icon>
          新对话
        </el-button>
      </div>
    </header>

    <!-- 消息区 -->
    <div ref="listRef" class="ai-messages">
      <!-- 空状态 / 快捷提问 -->
      <div v-if="!messages.length" class="ai-welcome">
        <div class="welcome-avatar">
          <el-icon :size="26"><MagicStick /></el-icon>
        </div>
        <h3>你好呀，我是小团 👋</h3>
        <p>你想了解哪些部门、职位或员工呢？可以试试：</p>
        <div class="suggestions">
          <button
            v-for="q in suggestions"
            :key="q"
            class="suggestion-item"
            @click="sendSuggestion(q)"
          >
            {{ q }}
          </button>
        </div>
      </div>

      <template v-else>
        <div
          v-for="(msg, idx) in messages"
          :key="msg.id"
          class="msg-row"
          :class="msg.role"
        >
          <div class="msg-avatar" :class="msg.role">
            <template v-if="msg.role === 'assistant'">
              <el-icon :size="16"><MagicStick /></el-icon>
            </template>
            <template v-else>
              <span>{{ userNameText }}</span>
            </template>
          </div>

          <div class="msg-main">
            <div class="msg-bubble" :class="msg.role">
              <!-- 用户消息：纯文本 -->
              <template v-if="msg.role === 'user'">
                <div class="msg-text">{{ msg.content }}</div>
              </template>

              <!-- 助手消息：渲染 Markdown；流式时末尾加光标 -->
              <template v-else>
                <span
                  v-if="!msg.content && streaming && idx === messages.length - 1"
                  class="typing-dots"
                ><i></i><i></i><i></i></span>
                <template v-else>
                  <div class="md-body" v-html="renderMarkdown(msg.content)"></div>
                  <span
                    v-if="streaming && idx === messages.length - 1"
                    class="stream-cursor"
                  ></span>
                </template>
              </template>
            </div>

            <!-- 助手消息操作 -->
            <div v-if="msg.role === 'assistant' && !isStreamingLast(idx)" class="msg-actions">
              <button class="msg-action-btn" title="复制" @click="copyMessage(msg.content)">
                <el-icon :size="14"><CopyDocument /></el-icon>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 输入区 -->
    <footer class="ai-input">
      <el-input
        v-model="input"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        resize="none"
        placeholder="输入你的问题，Enter 发送，Shift + Enter 换行"
        :disabled="streaming"
        @keydown.enter.exact.prevent="send"
      />
      <el-button
        type="primary"
        class="send-btn"
        :disabled="!canSend"
        :loading="streaming"
        @click="send"
      >
        <el-icon v-if="!streaming"><Promotion /></el-icon>
        发送
      </el-button>
    </footer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MagicStick,
  Promotion,
  RefreshLeft,
  VideoPause,
  CopyDocument,
} from '@element-plus/icons-vue'
import { streamChat } from '../api/ai'
import { renderMarkdown } from '../utils/markdown'
import { getUser } from '../utils/auth'

const CHAT_ID_KEY = 'oa_ai_chat_id'
const MESSAGES_KEY = 'oa_ai_messages'

const messages = ref([])
const input = ref('')
const streaming = ref(false)
const chatId = ref('')
const listRef = ref()
let abortController = null

const user = getUser()
const userNameText = computed(() => {
  const name = user?.name || user?.email || '我'
  return name.slice(0, 1).toUpperCase()
})

const canSend = computed(() => input.value.trim() !== '' && !streaming.value)

const suggestions = [
  '公司有哪些部门？',
  '目前有哪些职位？',
  '帮我查询所有员工',
]

// ---------- 会话 id ----------

function genChatId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `chat-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

// ---------- 持久化 ----------

function loadState() {
  const savedId = localStorage.getItem(CHAT_ID_KEY)
  chatId.value = savedId || genChatId()
  if (!savedId) localStorage.setItem(CHAT_ID_KEY, chatId.value)

  try {
    const raw = localStorage.getItem(MESSAGES_KEY)
    messages.value = raw ? JSON.parse(raw) : []
  } catch {
    messages.value = []
  }
}

function saveMessages() {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.value))
}

// ---------- 发送与流式接收 ----------

async function send() {
  if (!canSend.value) return
  const text = input.value.trim()
  input.value = ''
  messages.value.push({ id: Date.now(), role: 'user', content: text })
  // 预置一条空助手消息，流式内容往里追加
  messages.value.push({ id: Date.now() + 1, role: 'assistant', content: '' })
  saveMessages()
  await nextTick()
  scrollToBottom()

  streaming.value = true
  abortController = new AbortController()

  try {
    await streamChat({
      prompt: text,
      chatId: chatId.value,
      signal: abortController.signal,
      onChunk: (chunk) => {
        const last = messages.value[messages.value.length - 1]
        last.content += chunk
        scrollToBottom()
      },
    })
  } catch (e) {
    if (e?.name === 'AbortError') {
      // 用户主动停止：若为空则移除空助手消息
      const last = messages.value[messages.value.length - 1]
      if (last?.role === 'assistant' && !last.content) messages.value.pop()
      else last.content += '\n\n（已停止生成）'
    } else {
      const last = messages.value[messages.value.length - 1]
      if (last?.role === 'assistant') {
        last.content = last.content || '抱歉，出错了：'
        last.content += `\n\n> ${e?.message || '网络异常，请稍后重试'}`
      } else {
        ElMessage.error(e?.message || '请求失败')
      }
    }
  } finally {
    streaming.value = false
    abortController = null
    saveMessages()
    scrollToBottom()
  }
}

function sendSuggestion(q) {
  if (streaming.value) return
  input.value = q
  send()
}

function stopStreaming() {
  abortController?.abort()
}

function newChat() {
  if (streaming.value) stopStreaming()
  messages.value = []
  chatId.value = genChatId()
  localStorage.setItem(CHAT_ID_KEY, chatId.value)
  saveMessages()
  input.value = ''
}

function isStreamingLast(idx) {
  return streaming.value && idx === messages.value.length - 1
}

// ---------- 复制 / 滚动 ----------

async function copyMessage(content) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

onMounted(() => {
  loadState()
  scrollToBottom()
})

onBeforeUnmount(() => {
  abortController?.abort()
})
</script>

<style scoped>
.ai-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #fff;
  border: 1px solid var(--oa-border);
  border-radius: 10px;
  overflow: hidden;
}

/* 顶栏 */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--oa-border);
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ai-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #5b8def);
}

.ai-header-left h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
}

.ai-header-left p {
  margin-top: 3px;
  font-size: 12px;
  color: #8f959e;
}

.ai-header-actions {
  display: flex;
  gap: 10px;
}

/* 消息区 */
.ai-messages {
  flex: 1;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  background: #fafbfc;
}

/* 欢迎态 */
.ai-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px;
  text-align: center;
}

.welcome-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 18px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #5b8def);
  margin-bottom: 16px;
}

.ai-welcome h3 {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}

.ai-welcome p {
  margin-top: 8px;
  font-size: 13px;
  color: #8f959e;
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 18px;
}

.suggestion-item {
  padding: 8px 14px;
  font-size: 13px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.suggestion-item:hover {
  background: var(--el-color-primary-light-8);
  border-color: var(--el-color-primary-light-5);
}

/* 消息行 */
.msg-row {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.msg-row.user {
  flex-direction: row-reverse;
}

.msg-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.msg-avatar.assistant {
  background: linear-gradient(135deg, #2563eb, #5b8def);
}

.msg-avatar.user {
  background: #a0c1f5;
}

.msg-main {
  max-width: 76%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.msg-row.user .msg-main {
  align-items: flex-end;
}

.msg-bubble {
  padding: 10px 14px;
  font-size: 14px;
  line-height: 1.7;
  border-radius: 12px;
  word-break: break-word;
}

.msg-bubble.user {
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #3b74ec);
  border-top-right-radius: 4px;
}

.msg-bubble.assistant {
  color: #1f2329;
  background: #fff;
  border: 1px solid var(--oa-border);
  border-top-left-radius: 4px;
}

.msg-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 助手消息内 Markdown */
.md-body {
  min-width: 0;
}

.md-body :deep(p) {
  margin: 0 0 8px;
}

.md-body :deep(p:last-child) {
  margin-bottom: 0;
}

.md-body :deep(h1),
.md-body :deep(h2),
.md-body :deep(h3),
.md-body :deep(h4) {
  margin: 10px 0 8px;
  font-weight: 600;
  color: #1f2329;
  line-height: 1.4;
}

.md-body :deep(h1) { font-size: 18px; }
.md-body :deep(h2) { font-size: 16px; }
.md-body :deep(h3) { font-size: 15px; }
.md-body :deep(h4) { font-size: 14px; }

.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 4px 0 8px;
  padding-left: 22px;
}

.md-body :deep(li) {
  margin: 2px 0;
}

.md-body :deep(code) {
  padding: 1px 5px;
  font-size: 12.5px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  color: #d63384;
  background: #f6f8fa;
  border-radius: 4px;
}

.md-body :deep(pre) {
  margin: 8px 0;
  padding: 12px;
  overflow-x: auto;
  background: #f6f8fa;
  border: 1px solid var(--oa-border);
  border-radius: 8px;
}

.md-body :deep(pre code) {
  padding: 0;
  color: #1f2329;
  background: none;
}

.md-body :deep(blockquote) {
  margin: 8px 0;
  padding: 6px 12px;
  color: #646a73;
  border-left: 3px solid var(--el-color-primary-light-5);
  background: #f6f8fa;
  border-radius: 4px;
}

.md-body :deep(hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--oa-border);
}

.md-body :deep(table) {
  margin: 8px 0;
  border-collapse: collapse;
  font-size: 13px;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}

.md-body :deep(th),
.md-body :deep(td) {
  padding: 6px 12px;
  border: 1px solid var(--oa-border);
  white-space: nowrap;
}

.md-body :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

/* 流式光标 */
.stream-cursor {
  display: inline-block;
  width: 8px;
  height: 15px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--el-color-primary);
  animation: blink 1s step-start infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

/* 输入中三圆点 */
.typing-dots {
  display: inline-flex;
  gap: 4px;
}

.typing-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a9aeb8;
  animation: typing 1.2s infinite ease-in-out;
}

.typing-dots i:nth-child(2) { animation-delay: 0.2s; }
.typing-dots i:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-4px); opacity: 1; }
}

/* 复制按钮 */
.msg-actions {
  margin-top: 4px;
}

.msg-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  color: #8f959e;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.msg-action-btn:hover {
  background: #e9effd;
  color: var(--el-color-primary);
}

/* 输入区 */
.ai-input {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--oa-border);
  background: #fff;
}

.ai-input :deep(.el-textarea__inner) {
  padding: 10px 14px;
  line-height: 1.6;
  box-shadow: 0 0 0 1px var(--oa-border) inset;
}

.ai-input :deep(.el-textarea__inner:focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.send-btn {
  flex-shrink: 0;
  height: 40px;
}
</style>
