/**
 * 站点主题设置
 * - 预设主题：通过 CSS 变量切换（亮/暗/护眼）
 * - 自定义 CSS：写入 src/styles/custom.css，构建时注入
 * - 设置存储：src/data/theme.json
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const REPO_ROOT = process.cwd()
const THEME_FILE = path.join(REPO_ROOT, 'src', 'data', 'theme.json')
const CUSTOM_CSS_FILE = path.join(REPO_ROOT, 'src', 'styles', 'custom.css')

export interface ThemePreset {
  id: string
  name: string
  css: string
}

/** 预设主题（CSS 变量覆盖） */
export const PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: '默认',
    css: `:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --muted: #666666;
  --accent: #4f46e5;
}`,
  },
  {
    id: 'dark',
    name: '暗色',
    css: `:root {
  --bg: #0f172a;
  --text: #e2e8f0;
  --muted: #94a3b8;
  --accent: #818cf8;
}`,
  },
  {
    id: 'sepia',
    name: '护眼',
    css: `:root {
  --bg: #faf6f0;
  --text: #3d3228;
  --muted: #8a7f72;
  --accent: #a16207;
}`,
  },
]

export interface ThemeSettings {
  preset: string
  customCss: string
}

export async function getThemeSettings(): Promise<ThemeSettings> {
  try {
    const raw = await fs.readFile(THEME_FILE, 'utf8')
    const data = JSON.parse(raw)
    return {
      preset: data.preset || 'default',
      customCss: data.customCss || '',
    }
  } catch {
    return { preset: 'default', customCss: '' }
  }
}

export async function saveThemeSettings(settings: ThemeSettings): Promise<ThemeSettings> {
  const preset = PRESETS.find((p) => p.id === settings.preset) ? settings.preset : 'default'
  const customCss = typeof settings.customCss === 'string' ? settings.customCss : ''

  await fs.mkdir(path.dirname(THEME_FILE), { recursive: true })
  await fs.writeFile(THEME_FILE, JSON.stringify({ preset, customCss }, null, 2), 'utf8')

  // 自定义 CSS 写入独立文件（构建时引用）
  await fs.mkdir(path.dirname(CUSTOM_CSS_FILE), { recursive: true })
  await fs.writeFile(CUSTOM_CSS_FILE, customCss, 'utf8')

  // 提交 git
  try {
    execSync('git add src/data/theme.json src/styles/custom.css && git commit -m "cms: update theme"', {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    })
  } catch {
    // ignore
  }

  return { preset, customCss }
}

/** 构建期主题 CSS（供布局引用） */
export function buildThemeCss(settings: ThemeSettings): string {
  const preset = PRESETS.find((p) => p.id === settings.preset) || PRESETS[0]
  return `${preset.css}\n${settings.customCss || ''}`
}
