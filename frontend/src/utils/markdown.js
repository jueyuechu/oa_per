/**
 * 轻量级 Markdown 渲染器（无第三方依赖）。
 * 策略：先把原始文本做 HTML 转义（防 XSS），再做 Markdown 结构转换，
 * 这样即使模型输出里夹带 <script> 等原始 HTML，也只会被当作普通文本展示。
 *
 * 支持：标题、段落、加粗/斜体、行内代码、代码块、表格、有序/无序列表、引用、分隔线、链接。
 */

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// 行内格式（text 已做 HTML 转义）
function renderInline(text) {
  return text
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
}

// 表格分隔行：仅由 | - : 空格组成，且包含 |
function isTableSeparator(line) {
  return line.includes('|') && /^[\s|:-]+$/.test(line.trim())
}

// 是否为块级结构起始行（用于终止段落收集）
function isBlockStart(line) {
  const t = line.trim()
  return (
    /^```/.test(t) ||
    /^#{1,6}\s+/.test(t) ||
    /^\s*[-*+]\s+/.test(t) ||
    /^\s*\d+\.\s+/.test(t) ||
    /^\s*>\s?/.test(t) ||
    /^\s*([-*_])\s*(\1\s*){2,}$/.test(t) ||
    t.includes('|')
  )
}

// 按 | 分割一行表格，去掉首尾可能的 |
function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|')
}

function renderTable(lines, start) {
  const header = splitRow(lines[start])
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    const c = cell.trim()
    if (c.startsWith(':') && c.endsWith(':')) return 'center'
    if (c.endsWith(':')) return 'right'
    if (c.startsWith(':')) return 'left'
    return ''
  })
  const alignStyle = (idx) => (aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '')

  const body = []
  let i = start + 2
  while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
    body.push(splitRow(lines[i]))
    i++
  }

  const thead = `<thead><tr>${header
    .map((c, idx) => `<th${alignStyle(idx)}>${renderInline(escapeHtml(c.trim()))}</th>`)
    .join('')}</tr></thead>`
  const tbody = `<tbody>${body
    .map(
      (row) =>
        `<tr>${header
          .map((_, idx) => `<td${alignStyle(idx)}>${renderInline(escapeHtml(row[idx]?.trim() || ''))}</td>`)
          .join('')}</tr>`,
    )
    .join('')}</tbody>`

  return { html: `<table>${thead}${tbody}</table>`, next: i }
}

/**
 * 将 Markdown 文本渲染为安全的 HTML 字符串。
 * @param {string} src 原始 Markdown
 * @returns {string} HTML
 */
export function renderMarkdown(src) {
  if (!src) return ''
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 围栏代码块
    const fence = line.match(/^```(\w*)\s*$/)
    if (fence) {
      const lang = fence[1]
      const buf = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      i++ // 跳过结束 ```
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : ''
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    // 空行
    if (line.trim() === '') {
      i++
      continue
    }

    // 表格（表头下一行是分隔行）
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const result = renderTable(lines, i)
      out.push(result.html)
      i = result.next
      continue
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`)
      i++
      continue
    }

    // 分隔线
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      out.push('<hr/>')
      i++
      continue
    }

    // 引用
    if (/^\s*>\s?/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(`<blockquote><p>${renderInline(escapeHtml(buf.join('<br/>')))}</p></blockquote>`)
      continue
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*+]\s+/, ''))
        i++
      }
      out.push(`<ul>${buf.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join('')}</ul>`)
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
        i++
      }
      out.push(`<ol>${buf.map((item) => `<li>${renderInline(escapeHtml(item))}</li>`).join('')}</ol>`)
      continue
    }

    // 段落：收集到空行或下一个块级结构为止
    const buf = [line]
    i++
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    out.push(`<p>${renderInline(escapeHtml(buf.join('<br/>')))}</p>`)
  }

  return out.join('')
}
