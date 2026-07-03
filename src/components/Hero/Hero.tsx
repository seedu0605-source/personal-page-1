import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import DeviceFrame from './DeviceFrame'
import { devices } from '../../data/devices'
import styles from './Hero.module.css'

// true 로 두면 카메라가 없어도(권한 거부·미지원) 화면에 '테스트 얼굴' 패턴을 띄워
// 웹캠 효과를 미리 볼 수 있다. 배포 기본값은 false — 카메라 없으면 정적 PNG 화면 유지.
const DEBUG_TEST_PATTERN = true

// + 버튼으로 추가할 수 있는 기기 이미지 풀. (아이폰/갤럭시 PNG 를 넣으면 그대로 확장됨)
const ADDABLE = devices.map((d) => d.image)
const MAX_EXTRAS = 30

// 이미지 → 화면(디스플레이) 영역. 추가된 기기의 화면에 웹캠을 얹을 때 사용.
const SCREEN_BY_IMAGE: Record<string, { sx: number; sy: number; sw: number; sh: number }> = {}
devices.forEach((d) => {
  if (d.screen) SCREEN_BY_IMAGE[d.image] = d.screen
})

// 스크롤을 다 내렸을 때 각 기기가 쌓이는 '더미' 목표 위치.
const PILE = [
  { cx: 0.37, cy: 0.8, rot: -7 },
  { cx: 0.71, cy: 0.83, rot: 13 },
  { cx: 0.17, cy: 0.74, rot: -24 },
  { cx: 0.5, cy: 0.85, rot: 5 },
  { cx: 0.84, cy: 0.76, rot: 22 },
  { cx: 0.31, cy: 0.74, rot: -13 },
  { cx: 0.21, cy: 0.83, rot: -4 },
  { cx: 0.58, cy: 0.75, rot: 15 },
  { cx: 0.72, cy: 0.79, rot: -12 },
]

const ENGAGE = 0.992
const easeIn = (t: number) => t * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

function makeTestStream(): MediaStream | null {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 640
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.captureStream) return null
  const draw = () => {
    const w = canvas.width
    const h = canvas.height
    ctx.fillStyle = '#e9d9c9'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = 1
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo((w / 10) * i, 0); ctx.lineTo((w / 10) * i, h); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, (h / 10) * i); ctx.lineTo(w, (h / 10) * i); ctx.stroke()
    }
    ctx.fillStyle = '#3a2f2a'
    ctx.beginPath(); ctx.ellipse(w * 0.36, h * 0.4, 30, 20, 0, 0, 7); ctx.fill()
    ctx.beginPath(); ctx.ellipse(w * 0.64, h * 0.4, 30, 20, 0, 0, 7); ctx.fill()
    ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.45); ctx.lineTo(w * 0.44, h * 0.62)
    ctx.lineTo(w * 0.56, h * 0.62); ctx.closePath(); ctx.fill()
    ctx.lineWidth = 10; ctx.strokeStyle = '#7a2f2f'
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.68, 60, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke()
    requestAnimationFrame(draw)
  }
  draw()
  return canvas.captureStream(30)
}

type PhysicsApi = { addExtra: (el: HTMLDivElement) => void }

export default function Hero() {
  const heroRef = useRef<HTMLElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const faceRef = useRef<HTMLDivElement>(null)
  const frames = useRef<(HTMLDivElement | null)[]>([])
  const videos = useRef<(HTMLVideoElement | null)[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const [camReady, setCamReady] = useState(false)

  // + 버튼으로 추가된 기기들
  // zoom=1 이면 카메라 전체, >1 이면 (fx,fy) 위치의 랜덤 부분을 확대해 비춤.
  // dead=true 는 세게 던져 화면 밖으로 사라진 기기(다시 안 나옴).
  const [extras, setExtras] = useState<
    { id: number; image: string; zoom: number; fx: number; fy: number; dead?: boolean }[]
  >([])
  const [physicsOn, setPhysicsOn] = useState(false)
  const extraFrames = useRef<(HTMLDivElement | null)[]>([])
  const extraVideos = useRef<(HTMLVideoElement | null)[]>([])
  const physicsApiRef = useRef<PhysicsApi | null>(null)
  const spawnedRef = useRef(0) // 물리 바디가 만들어진 extra 개수
  const idRef = useRef(0)
  const poolRef = useRef(0)

  // 스크롤 낙하 + 바닥 쌓임 + 물리(드래그/추가)
  useEffect(() => {
    const hero = heroRef.current
    const face = faceRef.current
    const sticky = stickyRef.current
    if (!hero || !face || !sticky) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let scrollRaf = 0
    let physics: { stop: () => void } | null = null

    const anchor = (fr: DOMRect, i: number) => ({
      ax: fr.left + (devices[i].x / 100) * fr.width,
      ay: fr.top + (devices[i].y / 100) * fr.height,
    })

    const fallState = (i: number, p: number, vw: number, vh: number, fr: DOMRect) => {
      const d = devices[i]
      const pile = PILE[i]
      const { ax, ay } = anchor(fr, i)
      const tx = pile.cx * vw
      const ty = pile.cy * vh
      const delay = (1 - d.y / 100) * 0.14
      const lp = Math.min(Math.max((p - delay) / (1 - delay), 0), 1)
      return {
        ax, ay,
        x: ax + (tx - ax) * easeOut(lp),
        y: ay + (ty - ay) * easeIn(lp),
        rotDeg: d.rotation + (pile.rot - d.rotation) * lp,
      }
    }

    const applyScroll = (p: number) => {
      const fr = face.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      devices.forEach((_, i) => {
        const el = frames.current[i]
        if (!el) return
        const s = fallState(i, p, vw, vh, fr)
        el.style.transform =
          `translate(-50%, -50%) translate(${s.x - s.ax}px, ${s.y - s.ay}px) rotate(${s.rotDeg}deg)`
      })
    }

    const startPhysics = (p: number) => {
      const fr = face.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const engine = Matter.Engine.create()
      engine.gravity.y = 1.3

      type Item = { el: HTMLElement; body: Matter.Body; ax: number; ay: number; extraId?: number }
      const items: Item[] = []
      // 세게 던져 화면 밖으로 날아가는 중인 바디(벽 충돌 해제 + 안전망 제외)
      const escaping = new Set<number>()
      const THROW_SPEED = 12 // 이 속도 이상으로 놓으면 던져져 사라짐

      const makeBody = (w: number, h: number, x: number, y: number, deg: number) =>
        Matter.Bodies.rectangle(x, y, w, h, {
          angle: (deg * Math.PI) / 180,
          restitution: 0.35,
          friction: 0.7,
          frictionAir: 0.02,
          chamfer: { radius: Math.min(w, h) * 0.06 },
        })

      // 얼굴을 이루는 기본 9개 (현재 낙하 위치에서 이어받음)
      const baseBodies: Matter.Body[] = []
      devices.forEach((_, i) => {
        const el = frames.current[i]
        if (!el) return
        const w = el.offsetWidth
        const h = el.offsetHeight
        const s = fallState(i, p, vw, vh, fr)
        const body = makeBody(w, h, s.x, s.y, s.rotDeg)
        baseBodies.push(body)
        items.push({ el, body, ax: s.ax, ay: s.ay })
      })

      // 사방 벽(바닥·천장·좌·우)
      const t = 400
      const floor = Matter.Bodies.rectangle(vw / 2, vh + t / 2, vw * 3, t, { isStatic: true })
      const ceil = Matter.Bodies.rectangle(vw / 2, -t / 2, vw * 3, t, { isStatic: true })
      const wallL = Matter.Bodies.rectangle(-t / 2, vh / 2, t, vh * 4, { isStatic: true })
      const wallR = Matter.Bodies.rectangle(vw + t / 2, vh / 2, t, vh * 4, { isStatic: true })
      Matter.World.add(engine.world, [...baseBodies, floor, ceil, wallL, wallR])

      // 추가 기기 바디 생성(화면 위에서 떨어짐). anchor=(0,0): sticky 원점 기준.
      const addExtraBody = (el: HTMLElement) => {
        const w = el.offsetWidth || 120
        const h = el.offsetHeight || w * 2
        const x = vw * (0.28 + Math.random() * 0.44)
        const y = -h
        const body = makeBody(w, h, x, y, Math.random() * 40 - 20)
        Matter.World.add(engine.world, body)
        const extraId = el.dataset.id ? Number(el.dataset.id) : undefined
        items.push({ el, body, ax: 0, ay: 0, extraId })
      }
      extraFrames.current.forEach((el) => {
        if (el) addExtraBody(el)
      })
      spawnedRef.current = extraFrames.current.length
      physicsApiRef.current = { addExtra: addExtraBody }

      // 드래그
      const mouse = Matter.Mouse.create(sticky)
      const mev = mouse as unknown as {
        mousemove: EventListener; mousedown: EventListener
        mouseup: EventListener; mousewheel: EventListener
      }
      sticky.removeEventListener('wheel', mev.mousewheel)
      sticky.removeEventListener('DOMMouseScroll', mev.mousewheel)
      const mc = Matter.MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.18, render: { visible: false } },
      })
      Matter.World.add(engine.world, mc)
      face.classList.add(styles.grab)
      setPhysicsOn(true)

      // 놓는 순간 속도가 크면 '던져짐' 처리: 충돌 해제하고 화면 밖으로 날려보낸다.
      Matter.Events.on(mc, 'enddrag', (e: Matter.IEvent<Matter.MouseConstraint>) => {
        const body = (e as unknown as { body?: Matter.Body }).body
        if (!body) return
        const sp = Math.hypot(body.velocity.x, body.velocity.y)
        if (sp >= THROW_SPEED) {
          escaping.add(body.id)
          body.collisionFilter.mask = 0 // 벽·다른 기기를 통과
          Matter.Body.setVelocity(body, {
            x: body.velocity.x * 1.4,
            y: body.velocity.y * 1.4,
          })
        }
      })

      let raf = 0
      const RES = 0.5
      const step = () => {
        Matter.Engine.update(engine, 1000 / 60)
        // 안전망: 화면 밖으로 나가면 안으로 되돌리고 튕긴다 (던져진 기기는 제외)
        items.forEach((it) => {
          if (escaping.has(it.body.id)) return
          const b = it.body
          const bb = b.bounds
          let px = b.position.x, py = b.position.y
          let vx = b.velocity.x, vy = b.velocity.y
          let ch = false
          if (bb.min.x < 0) { px -= bb.min.x; if (vx < 0) vx = -vx * RES; ch = true }
          if (bb.max.x > vw) { px -= bb.max.x - vw; if (vx > 0) vx = -vx * RES; ch = true }
          if (bb.min.y < 0) { py -= bb.min.y; if (vy < 0) vy = -vy * RES; ch = true }
          if (bb.max.y > vh) { py -= bb.max.y - vh; if (vy > 0) vy = -vy * RES; ch = true }
          if (ch) {
            Matter.Body.setPosition(b, { x: px, y: py })
            Matter.Body.setVelocity(b, { x: vx, y: vy })
          }
        })
        items.forEach((it) => {
          it.el.style.transform =
            `translate(-50%, -50%) translate(${it.body.position.x - it.ax}px, ${it.body.position.y - it.ay}px) rotate(${it.body.angle}rad)`
        })
        // 던져져 화면을 완전히 벗어난 기기 제거
        for (let k = items.length - 1; k >= 0; k--) {
          const it = items[k]
          if (!escaping.has(it.body.id)) continue
          const bb = it.body.bounds
          if (bb.min.x > vw + 120 || bb.max.x < -120 || bb.min.y > vh + 120 || bb.max.y < -500) {
            Matter.World.remove(engine.world, it.body)
            escaping.delete(it.body.id)
            items.splice(k, 1)
            if (it.extraId != null) {
              const goneId = it.extraId
              setExtras((prev) => prev.map((ex) => (ex.id === goneId ? { ...ex, dead: true } : ex)))
            }
          }
        }
        raf = requestAnimationFrame(step)
      }
      step()

      physics = {
        stop: () => {
          cancelAnimationFrame(raf)
          face.classList.remove(styles.grab)
          physicsApiRef.current = null
          spawnedRef.current = 0
          setPhysicsOn(false)
          sticky.removeEventListener('mousemove', mev.mousemove)
          sticky.removeEventListener('mousedown', mev.mousedown)
          sticky.removeEventListener('mouseup', mev.mouseup)
          sticky.removeEventListener('touchmove', mev.mousemove)
          sticky.removeEventListener('touchstart', mev.mousedown)
          sticky.removeEventListener('touchend', mev.mouseup)
          Matter.World.clear(engine.world, false)
          Matter.Engine.clear(engine)
        },
      }
    }

    const render = () => {
      scrollRaf = 0
      const rect = hero.getBoundingClientRect()
      const travel = rect.height - window.innerHeight
      const p = travel > 0 ? Math.min(Math.max(-rect.top / travel, 0), 1) : 0
      if (!reduce.matches && p >= ENGAGE) {
        if (!physics) startPhysics(p)
        return
      }
      if (physics) { physics.stop(); physics = null }
      applyScroll(reduce.matches ? 0 : p)
    }

    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(render)
    }
    const onResize = () => {
      if (physics) { physics.stop(); physics = null }
      onScroll()
    }
    const onReduceChange = () => render()

    render()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })
    reduce.addEventListener('change', onReduceChange)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      reduce.removeEventListener('change', onReduceChange)
      if (scrollRaf) cancelAnimationFrame(scrollRaf)
      if (physics) physics.stop()
    }
  }, [])

  // 새 extra 가 추가되면(물리 모드일 때) 바디를 즉시 떨어뜨린다.
  useEffect(() => {
    if (!physicsApiRef.current) return
    for (let j = spawnedRef.current; j < extras.length; j++) {
      const el = extraFrames.current[j]
      if (el) physicsApiRef.current.addExtra(el)
    }
    spawnedRef.current = extras.length
  }, [extras, physicsOn])

  // 추가된 기기의 화면에도 웹캠 스트림 연결 (전체 영상 cover)
  useEffect(() => {
    if (!camReady || !streamRef.current) return
    extraVideos.current.forEach((v) => {
      if (v && !v.srcObject) {
        v.srcObject = streamRef.current
        v.play().catch(() => {})
      }
    })
  }, [extras, camReady])

  const addDevice = () => {
    if (extras.length >= MAX_EXTRAS) return
    const image = ADDABLE[poolRef.current % ADDABLE.length]
    poolRef.current += 1
    // 대부분 랜덤한 부분을 확대해 비추고, 일부(약 25%)만 전체 얼굴
    const full = Math.random() < 0.25
    const zoom = full ? 1 : 1.8 + Math.random() * 1.4
    setExtras((prev) => [
      ...prev,
      { id: idRef.current++, image, zoom, fx: Math.random(), fy: Math.random() },
    ])
    // 물리 모드가 아니면 바닥(더미)으로 스크롤해 물리를 켠다
    if (!physicsApiRef.current) {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    }
  }

  // 웹캠 스트림 확보 (거부/미지원 시 폴백)
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      let stream: MediaStream | null = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
      } catch {
        stream = DEBUG_TEST_PATTERN ? makeTestStream() : null
      }
      if (!stream) return
      if (cancelled) {
        stream.getTracks().forEach((tr) => tr.stop())
        return
      }
      streamRef.current = stream
      setCamReady(true)
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((tr) => tr.stop())
    }
  }, [])

  // 화면 창 정렬: 9개 화면이 하나의 얼굴을 이루도록 각 영상의 크기/오프셋 계산.
  useEffect(() => {
    if (!camReady) return
    const face = faceRef.current
    if (!face) return
    videos.current.forEach((v) => {
      if (v && streamRef.current) {
        v.srcObject = streamRef.current
        v.play().catch(() => {})
      }
    })
    const compute = () => {
      const fr = face.getBoundingClientRect()
      const fw = fr.width
      const fh = fr.height
      const rects = devices.map((d, i) => {
        const el = frames.current[i]
        if (!el || !d.screen) return null
        const dw = el.offsetWidth
        const dh = el.offsetHeight
        const left = (d.x / 100) * fw - dw / 2
        const top = (d.y / 100) * fh - dh / 2
        return {
          sx: left + d.screen.sx * dw,
          sy: top + d.screen.sy * dh,
          sw: d.screen.sw * dw,
          sh: d.screen.sh * dh,
        }
      })
      const valid = rects.filter((r): r is NonNullable<typeof r> => r !== null)
      if (!valid.length) return
      const minX = Math.min(...valid.map((r) => r.sx))
      const minY = Math.min(...valid.map((r) => r.sy))
      const maxX = Math.max(...valid.map((r) => r.sx + r.sw))
      const maxY = Math.max(...valid.map((r) => r.sy + r.sh))
      const cbW = maxX - minX
      const cbH = maxY - minY
      devices.forEach((_, i) => {
        const v = videos.current[i]
        const r = rects[i]
        if (!v || !r) return
        v.style.width = `${cbW}px`
        v.style.height = `${cbH}px`
        v.style.left = `${minX - r.sx}px`
        v.style.top = `${minY - r.sy}px`
      })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(face)
    window.addEventListener('resize', compute)
    const t = window.setTimeout(compute, 200)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
      window.clearTimeout(t)
    }
  }, [camReady])

  return (
    <section ref={heroRef} className={styles.hero}>
      {/* 기기 추가 버튼 */}
      <button className={styles.addBtn} type="button" onClick={addDevice} aria-label="기기 추가">
        <span aria-hidden="true">+</span>
      </button>

      {/* 전체 스크롤 영역은 300vh, 내부 화면은 100vh 동안 sticky 고정 */}
      <div ref={stickyRef} className={styles.sticky}>
        <p className={styles.copy}>
          Fragments of Work,
          <br />
          Assembled as Identity.
        </p>

        {/* 중앙 — 9개 기기로 조합된 얼굴. 스크롤 시 낙하해 바닥에 쌓이고,
            바닥에서는 드래그·추가할 수 있다. */}
        <div className={styles.stage}>
          <div ref={faceRef} className={styles.face}>
            {devices.map((device, i) => (
              <DeviceFrame
                key={device.id}
                device={device}
                showScreen={camReady}
                frameRef={(el) => { frames.current[i] = el }}
                videoRef={(el) => { videos.current[i] = el }}
              />
            ))}
          </div>
        </div>

        {/* 추가된 기기 레이어 (물리 모드에서만 보임) */}
        <div className={`${styles.extraLayer} ${physicsOn ? styles.on : ''}`}>
          {extras.map((ex, j) => {
            if (ex.dead) return null
            const s = SCREEN_BY_IMAGE[ex.image]
            return (
              <div
                key={ex.id}
                className={styles.extra}
                data-id={ex.id}
                ref={(el) => { extraFrames.current[j] = el }}
              >
                <img src={ex.image} alt="" draggable={false} />
                {camReady && s && (
                  <div
                    className={styles.screen}
                    style={{
                      left: `${s.sx * 100}%`,
                      top: `${s.sy * 100}%`,
                      width: `${s.sw * 100}%`,
                      height: `${s.sh * 100}%`,
                    }}
                  >
                    <video
                      className={styles.coverVideo}
                      ref={(el) => { extraVideos.current[j] = el }}
                      style={{
                        width: `${ex.zoom * 100}%`,
                        height: `${ex.zoom * 100}%`,
                        left: `${-ex.fx * (ex.zoom - 1) * 100}%`,
                        top: `${-ex.fy * (ex.zoom - 1) * 100}%`,
                      }}
                      autoPlay
                      muted
                      playsInline
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className={styles.meta}>
          <span>Industrial Design Portfolio</span>
          <span>2024–2026</span>
        </div>
      </div>
    </section>
  )
}
