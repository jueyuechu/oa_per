import { getToken, clearLogin } from '../utils/auth'
import router from '../router'

const BASE = import.meta.env.VITE_API_BASE || '/api'

/**
 * 以流式方式请求 AI 助手。
 * 后端接口返回的是 text/html 的纯文本流（非标准 JSON Result），
 * 因此这里用原生 fetch + ReadableStream 逐段读取，而不是走 axios 拦截器。
 *
 * @param {Object} opts
 * @param {string} opts.prompt  用户问题
 * @param {string} opts.chatId  会话 id（后端以此维护上下文记忆）
 * @param {AbortSignal} [opts.signal] 中止信号（用于“停止生成”）
 * @param {(text: string) => void} opts.onChunk 每收到一段文本时回调
 */
export async function streamChat({ prompt, chatId, signal, onChunk }) {
  const params = new URLSearchParams({ prompt, chatId })
  const response = await fetch(`${BASE}/admin/ai/service?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${getToken() || ''}` },
    signal,
  })

  // 登录失效：与 request.js 拦截器保持一致的跳转逻辑
  if (response.status === 401) {
    clearLogin()
    if (router.currentRoute.value.path !== '/login') {
      router.replace('/login')
    }
    throw new Error('登录已失效，请重新登录')
  }

  if (!response.ok) {
    let message = `请求失败（${response.status}）`
    try {
      const data = JSON.parse(await response.text())
      if (data?.message) message = data.message
    } catch {
      /* 非 JSON 响应时保留默认错误信息 */
    }
    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('当前浏览器不支持流式读取')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')

  // 空闲超时兜底：后端流若被异常切断（比如没发终止分块就断连），浏览器会一直等不到
  // 结束信号，导致上层 streaming 永远为 true、输入框被禁用。这里超过阈值未收到数据
  // 就主动取消读取，让 read() 返回 done，从而正常走完流程并复位 UI。
  const IDLE_TIMEOUT = 30_000
  let idleTimer = null
  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      reader.cancel().catch(() => {})
    }, IDLE_TIMEOUT)
  }

  try {
    resetIdleTimer()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      resetIdleTimer()
      onChunk(decoder.decode(value, { stream: true }))
    }
    // 冲刷解码器缓冲，防止多字节字符被截断
    const rest = decoder.decode()
    if (rest) onChunk(rest)
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    reader.releaseLock()
  }
}
