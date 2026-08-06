/**
 * 像素矩阵渲染引擎（纯 TS，canvas 2D，供 Vue 组件挂载使用）。
 *
 * 视觉：网格交叉点是一个个方形"像素"——默认近黑（融入背景），浅色网格线连接。
 * 交互：鼠标扫过的像素点亮为薄荷绿并缓慢衰减（能量轨迹），自带拖尾光感。
 */

export interface PixelMatrixOptions {
  /** 网格间距 px（= 像素间距） */
  spacing?: number
  /** 像素边长 px（正方形） */
  pixelSize?: number
  /** 像素默认颜色（未激活，融入背景） */
  restColor?: string
  /** 像素点亮颜色（激活） */
  activeColor?: string
  /** 网格线颜色 */
  lineColor?: string
  /** 点亮能量初始值 0–1 */
  energyOnHover?: number
  /** 能量衰减速度（每秒） */
  decayRate?: number
  /** 鼠标点亮半径 px */
  glowRadius?: number
  /** 鼠标连线（点亮像素与光标连线）半径 px，0 关闭 */
  mouseLinkRadius?: number
  /** 是否启用鼠标交互 */
  interactive?: boolean
}

interface Pixel {
  ax: number
  ay: number
  energy: number
  /** 与鼠标的实时距离（用于连线绘制） */
  dist: number
}

/** 像素位置索引：`x,y` → 数组下标，画网格线时 O(1) 查相邻点 */
type PixelIndex = Map<string, number>

interface CssColors {
  rest: string
  active: string
  line: string
  mouse: string
}

const DEFAULTS: Required<PixelMatrixOptions> = {
  spacing: 32,
  pixelSize: 5,
  restColor: 'rgba(0,0,0,0.85)',
  activeColor: '#32f08c',
  lineColor: 'rgba(237,239,242,0.14)',
  energyOnHover: 1,
  decayRate: 0.85,
  glowRadius: 70,
  mouseLinkRadius: 0,
  interactive: true,
}

/** 从 CSS 变量读取颜色（跟随主题） */
function readCssColors(): CssColors {
  const s = getComputedStyle(document.documentElement)
  const fallback: CssColors = {
    rest: 'rgba(0,0,0,0.85)',
    active: '#32f08c',
    line: 'rgba(237,239,242,0.14)',
    mouse: 'rgba(50,240,140,0.45)',
  }
  fallback.rest = s.getPropertyValue('--pa-px-rest').trim() || fallback.rest
  fallback.active = s.getPropertyValue('--pa-px-active').trim() || fallback.active
  fallback.line = s.getPropertyValue('--pa-px-line').trim() || fallback.line
  fallback.mouse = s.getPropertyValue('--pa-px-mouse').trim() || fallback.mouse
  return fallback
}

export class PixelMatrix {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private opts: Required<PixelMatrixOptions>
  private pixels: Pixel[] = []
  private index: PixelIndex = new Map()
  private mouse = { x: -9999, y: -9999, active: false }
  private css: CssColors
  private raf = 0
  private themeObserver: MutationObserver | null = null
  private boundResize = () => this.resize()
  private lastTime = 0

  constructor(canvas: HTMLCanvasElement, options: PixelMatrixOptions = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.opts = { ...DEFAULTS, ...options }
    this.css = readCssColors()
    this.resize()
    window.addEventListener('resize', this.boundResize)
    this.themeObserver = new MutationObserver(() => {
      this.css = readCssColors()
    })
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }

  /** 画布适配容器尺寸（含 devicePixelRatio） */
  private resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr))
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr))
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.rebuildGrid()
  }

  /** 按网格间距重建像素点阵 */
  private rebuildGrid() {
    const { spacing } = this.opts
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)
    this.pixels = []
    this.index = new Map()
    for (let x = spacing / 2; x < w; x += spacing) {
      for (let y = spacing / 2; y < h; y += spacing) {
        this.index.set(`${x},${y}`, this.pixels.length)
        this.pixels.push({ ax: x, ay: y, energy: 0, dist: Infinity })
      }
    }
  }

  onMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = e.clientX - rect.left
    this.mouse.y = e.clientY - rect.top
    this.mouse.active = true
    // 滑动时注入能量；静止时 mousemove 不再触发 → 无注入，能量自然衰减变暗
    this.energize()
  }

  onMouseLeave() {
    this.mouse.x = -9999
    this.mouse.y = -9999
    this.mouse.active = false
  }

  /** 给鼠标周围像素注入能量（falloff 衰减，能量累加上限 1） */
  private energize() {
    const { glowRadius, energyOnHover } = this.opts
    const r2 = glowRadius * glowRadius
    const pts = this.pixels
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!
      const dx = p.ax - this.mouse.x
      const dy = p.ay - this.mouse.y
      const d2 = dx * dx + dy * dy
      if (d2 < r2) {
        const falloff = 1 - Math.sqrt(d2) / glowRadius
        p.energy = Math.min(1, p.energy + falloff * energyOnHover * 0.3)
      }
    }
  }

  private draw = (time: number) => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastTime) / 1000)
    this.lastTime = now
    const { spacing, pixelSize, decayRate, mouseLinkRadius, interactive } = this.opts
    const w = this.canvas.width / (window.devicePixelRatio || 1)
    const h = this.canvas.height / (window.devicePixelRatio || 1)
    const { rest, active, line, mouse } = this.css
    const ctx = this.ctx
    const pts = this.pixels
    const n = pts.length
    const mouseActive = interactive && this.mouse.active

    ctx.clearRect(0, 0, w, h)

    // 1. 能量衰减（每帧）：滑动点亮由 onMouseMove→energize 事件驱动，
    //    此处只负责随时间变暗，静止时鼠标不再注入 → 逐渐熄灭
    for (let i = 0; i < n; i++) {
      const p = pts[i]!
      p.energy = Math.max(0, p.energy - decayRate * dt)
    }

    // 2. 计算与鼠标的距离（供连线绘制）
    for (let i = 0; i < n; i++) {
      const p = pts[i]!
      if (mouseActive) {
        const dx = p.ax - this.mouse.x
        const dy = p.ay - this.mouse.y
        p.dist = Math.sqrt(dx * dx + dy * dy)
      } else {
        p.dist = Infinity
      }
    }

    // 3. 网格线（浅色）：完整横纵线，穿过像素中心（从画布边缘到边缘）
    if (line) {
      ctx.strokeStyle = line
      ctx.lineWidth = 1
      ctx.globalAlpha = 1
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const p = pts[i]!
        const ri = this.index.get(`${p.ax + spacing},${p.ay}`)
        const di = this.index.get(`${p.ax},${p.ay + spacing}`)
        // 横向：从本像素中心到右邻像素中心（整条线穿过所有交点）
        if (ri !== undefined) {
          const r = pts[ri]!
          ctx.moveTo(p.ax, p.ay)
          ctx.lineTo(r.ax, r.ay)
        }
        // 纵向：从本像素中心到下邻像素中心
        if (di !== undefined) {
          const d = pts[di]!
          ctx.moveTo(p.ax, p.ay)
          ctx.lineTo(d.ax, d.ay)
        }
      }
      ctx.stroke()
    }

    // 4. 像素方块：默认近黑，能量越高越亮（薄荷绿）
    const half = pixelSize / 2
    for (let i = 0; i < n; i++) {
      const p = pts[i]!
      ctx.globalAlpha = 1
      if (p.energy > 0.01) {
        ctx.fillStyle = active
        ctx.globalAlpha = Math.min(1, 0.25 + p.energy * 0.75)
      } else {
        ctx.fillStyle = rest
        ctx.globalAlpha = 0.9
      }
      ctx.fillRect(p.ax - half, p.ay - half, pixelSize, pixelSize)
    }

    // 5. 鼠标连线（与点亮区域像素，可配置关闭）
    if (mouseActive && mouseLinkRadius > 0) {
      const mr2 = mouseLinkRadius * mouseLinkRadius
      ctx.strokeStyle = mouse
      ctx.lineWidth = 1
      for (let i = 0; i < n; i++) {
        const p = pts[i]!
        if (p.dist > mouseLinkRadius || p.energy < 0.05) continue
        ctx.globalAlpha = (1 - p.dist / mouseLinkRadius) * 0.6
        ctx.beginPath()
        ctx.moveTo(p.ax, p.ay)
        ctx.lineTo(this.mouse.x, this.mouse.y)
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1
    this.raf = requestAnimationFrame(this.draw)
  }

  start() {
    if (this.raf) return
    this.lastTime = performance.now()
    this.raf = requestAnimationFrame(this.draw)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.raf = 0
    window.removeEventListener('resize', this.boundResize)
    this.themeObserver?.disconnect()
    this.themeObserver = null
  }
}
