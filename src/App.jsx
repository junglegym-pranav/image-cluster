import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, useTexture } from '@react-three/drei'
import {
  generateCubePoints, generateCrossCubesPoints, generateSpherePoints,
  generateTunnelPoints, generatePyramidPoints, generateTorusPoints,
  generateDiamondPoints, generateCylinderPoints, generateHousePoints,
  generateRingPoints, generateArrowPoints, generateStepsPoints,
  generateArchPoints, generateStarPoints, generateRocketPoints,
  generateDNAPoints, generateLetterAPoints,
  generateTeapotPoints, loadSuzannePoints, loadModelFromBuffer,
} from './shapes3d/generators'
import suzanneUrl from './assets/models/suzanne.glb'
import './App.css'

// ─── Assets ───────────────────────────────────────────────────────────────────

const mediaModules = import.meta.glob(
  './assets/media/*.{png,jpg,jpeg,webp,gif,avif}',
  { import: 'default', eager: true },
)
const images = Object.values(mediaModules)

// ─── Shape catalogue ──────────────────────────────────────────────────────────

const shapes3d = [
  { id: 'cube',        label: 'Cube',     type: '3d', generator: generateCubePoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polygon points="50,8 88,30 88,70 50,92 12,70 12,30"/><line x1="50" y1="8" x2="50" y2="50"/><line x1="88" y1="30" x2="50" y2="50"/><line x1="12" y1="30" x2="50" y2="50"/></svg>` },
  { id: 'cross-cubes', label: 'Cross',    type: '3d', generator: generateCrossCubesPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"><rect x="28" y="28" width="44" height="44" rx="2"/><rect x="72" y="36" width="20" height="20" rx="2"/><rect x="36" y="8" width="20" height="20" rx="2"/><rect x="8" y="36" width="20" height="20" rx="2"/></svg>` },
  { id: 'pyramid',     label: 'Pyramid',  type: '3d', generator: generatePyramidPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polygon points="50,10 90,82 10,82"/><line x1="50" y1="10" x2="50" y2="62"/><line x1="10" y1="82" x2="50" y2="62"/><line x1="90" y1="82" x2="50" y2="62"/></svg>` },
  { id: 'diamond',     label: 'Diamond',  type: '3d', generator: generateDiamondPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polygon points="50,6 94,50 50,94 6,50"/><line x1="50" y1="6" x2="50" y2="94"/><line x1="6" y1="50" x2="94" y2="50"/></svg>` },
  { id: 'cylinder',    label: 'Cylinder', type: '3d', generator: generateCylinderPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5"><ellipse cx="50" cy="24" rx="36" ry="14"/><ellipse cx="50" cy="76" rx="36" ry="14"/><line x1="14" y1="24" x2="14" y2="76"/><line x1="86" y1="24" x2="86" y2="76"/></svg>` },
  { id: 'torus',       label: 'Torus',    type: '3d', generator: generateTorusPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5"><ellipse cx="50" cy="50" rx="40" ry="18"/><ellipse cx="50" cy="50" rx="18" ry="8"/></svg>` },
  { id: 'house',       label: 'House',    type: '3d', generator: generateHousePoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><rect x="14" y="52" width="72" height="40"/><polygon points="50,10 86,52 14,52"/></svg>` },
  { id: 'ring',        label: 'Ring',     type: '3d', generator: generateRingPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5"><ellipse cx="50" cy="50" rx="42" ry="18"/><ellipse cx="50" cy="50" rx="18" ry="8"/></svg>` },
  { id: 'sphere',      label: 'Sphere',   type: '3d', generator: generateSpherePoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5"><circle cx="50" cy="50" r="40"/><ellipse cx="50" cy="50" rx="40" ry="15"/></svg>` },
  { id: 'tunnel',      label: 'Tunnel',   type: '3d', generator: generateTunnelPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"><rect x="12" y="18" width="76" height="64" rx="2"/><rect x="28" y="32" width="44" height="36" rx="1"/><line x1="12" y1="18" x2="28" y2="32"/><line x1="88" y1="18" x2="72" y2="32"/><line x1="12" y1="82" x2="28" y2="68"/><line x1="88" y1="82" x2="72" y2="68"/></svg>` },
  { id: 'arrow',       label: 'Arrow',    type: '3d', generator: generateArrowPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><line x1="50" y1="88" x2="50" y2="22"/><polygon points="50,8 26,40 74,40"/></svg>` },
  { id: 'steps',       label: 'Steps',    type: '3d', generator: generateStepsPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polyline points="10,82 10,56 36,56 36,36 62,36 62,18 90,18"/><line x1="10" y1="82" x2="90" y2="82"/><line x1="36" y1="82" x2="36" y2="56"/><line x1="62" y1="82" x2="62" y2="36"/></svg>` },
  { id: 'arch',        label: 'Arch',     type: '3d', generator: generateArchPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polyline points="12,90 12,22 88,22 88,90"/><line x1="12" y1="22" x2="88" y2="22"/></svg>` },
  { id: 'star',        label: 'Star',     type: '3d', generator: generateStarPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"><polygon points="50,8 61,36 92,36 68,56 77,86 50,68 23,86 32,56 8,36 39,36"/></svg>` },
  { id: 'rocket',      label: 'Rocket',   type: '3d', generator: generateRocketPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M50,8 C50,8 70,28 70,58 L30,58 C30,28 50,8 50,8Z"/><rect x="30" y="58" width="40" height="22" rx="2"/><polygon points="18,80 30,60 30,80"/><polygon points="82,80 70,60 70,80"/></svg>` },
  { id: 'dna',         label: 'DNA',      type: '3d', generator: generateDNAPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5"><path d="M30,10 Q70,30 30,50 Q70,70 30,90" /><path d="M70,10 Q30,30 70,50 Q30,70 70,90" /><line x1="30" y1="30" x2="70" y2="30"/><line x1="30" y1="50" x2="70" y2="50"/><line x1="30" y1="70" x2="70" y2="70"/></svg>` },
  { id: 'letter-a',   label: 'Letter A', type: '3d', generator: generateLetterAPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><polyline points="50,8 84,88"/><polyline points="50,8 16,88"/><line x1="28" y1="58" x2="72" y2="58"/></svg>` },
  { id: 'teapot',     label: 'Teapot',   type: '3d', generator: generateTeapotPoints,
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M20,60 Q16,48 20,38 Q28,24 50,24 Q72,24 80,38 Q84,48 80,60 Z"/><path d="M80,42 Q92,38 92,50 Q92,62 80,56"/><ellipse cx="50" cy="62" rx="32" ry="8"/><path d="M34,24 Q30,14 38,12"/><path d="M50,24 Q50,14 50,12"/><path d="M66,24 Q70,14 62,12"/></svg>` },
  { id: 'suzanne',    label: 'Suzanne',  type: '3d-async', loader: (count) => loadSuzannePoints(suzanneUrl, count),
    icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><ellipse cx="50" cy="44" rx="28" ry="30"/><path d="M22,44 Q8,36 10,22 Q12,14 22,18"/><path d="M78,44 Q92,36 90,22 Q88,14 78,18"/><ellipse cx="42" cy="52" rx="6" ry="4"/><ellipse cx="58" cy="52" rx="6" ry="4"/><path d="M38,66 Q50,74 62,66"/></svg>` },
]

// ─── Three.js scene components ────────────────────────────────────────────────

function CursorManager({ hovering }) {
  const { gl } = useThree()
  useFrame(() => {
    gl.domElement.style.cursor = hovering ? 'pointer' : 'default'
  })
  return null
}

function ImageSprite({ src, position, height, wiggleAmp, onHover, onUnhover, onClick }) {
  const ref     = useRef()
  const texture = useTexture(src)

  const ox  = useRef(Math.random() * Math.PI * 2)
  const oy  = useRef(Math.random() * Math.PI * 2)
  const oz  = useRef(Math.random() * Math.PI * 2)
  const spd = useRef(0.14 + Math.random() * 0.14)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    const a = wiggleAmp
    ref.current.position.set(
      position[0] + Math.sin(t * spd.current        + ox.current) * a,
      position[1] + Math.cos(t * spd.current * 0.81 + oy.current) * a * 0.7,
      position[2] + Math.sin(t * spd.current * 0.63 + oz.current) * a * 0.4,
    )
  })

  const aspect        = texture.image?.naturalWidth / texture.image?.naturalHeight || 1
  const clampedAspect = Math.min(2.6, Math.max(0.4, aspect))
  const w = height * clampedAspect

  return (
    <sprite
      ref={ref}
      position={position}
      scale={[w, height, 1]}
      onClick={e => { e.stopPropagation(); onClick() }}
      onPointerOver={e => { e.stopPropagation(); onHover() }}
      onPointerOut={e => { e.stopPropagation(); onUnhover() }}
    >
      <spriteMaterial map={texture} toneMapped={false} fog={false} />
    </sprite>
  )
}

function ClusterScene({ points, imageSize, edgeMin, wiggleAmp, onImageClick }) {
  const [hovering, setHovering] = useState(false)

  const sprites = points.map((pt, i) => {
    const imgIdx = i % images.length
    const h = imageSize * (edgeMin + (1 - edgeMin) * pt.edgeDist)
    return (
      <Suspense key={i} fallback={null}>
        <ImageSprite
          src={images[imgIdx]}
          position={[pt.x, pt.y, pt.z]}
          height={h}
          wiggleAmp={wiggleAmp}
          onHover={() => setHovering(true)}
          onUnhover={() => setHovering(false)}
          onClick={() => onImageClick(imgIdx)}
        />
      </Suspense>
    )
  })

  return (
    <>
      <CursorManager hovering={hovering} />
      {sprites}
    </>
  )
}

// ─── Sidebar accordion section ────────────────────────────────────────────────

function SidebarSection({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="sidebar-section">
      <button className="section-toggle" onClick={() => setOpen(o => !o)}>
        <span>{title}</span>
        <span className={`section-arrow${open ? ' open' : ''}`}>›</span>
      </button>
      {open && <div className="section-content">{children}</div>}
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ index, onClose, onPrev, onNext }) {
  const handleKey = useCallback(e => {
    if (e.key === 'Escape')     onClose()
    if (e.key === 'ArrowLeft')  onPrev()
    if (e.key === 'ArrowRight') onNext()
  }, [onClose, onPrev, onNext])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" onClick={e => { e.stopPropagation(); onClose() }}>×</button>
      <button className="lb-prev"  onClick={e => { e.stopPropagation(); onPrev()  }}>‹</button>
      <img
        className="lb-img"
        src={images[index]}
        alt=""
        onClick={e => e.stopPropagation()}
        draggable={false}
      />
      <button className="lb-next" onClick={e => { e.stopPropagation(); onNext() }}>›</button>
      <div className="lb-count">{index + 1} / {images.length}</div>
    </div>
  )
}

// ─── Slider ───────────────────────────────────────────────────────────────────

function Slider({ label, value, displayValue, min, max, step, onChange }) {
  return (
    <div className="slider-group">
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-val">{displayValue ?? value}</span>
      </div>
      <input type="range" min={min} max={max} step={step}
        value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024

export default function App() {
  const [shapeId,      setShapeId]      = useState(shapes3d[0].id)
  const [lbIndex,      setLbIndex]      = useState(null)
  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [customModels, setCustomModels] = useState([])

  // ── Slider state ──────────────────────────────────────────────────
  const [imageSize,  setImageSize]  = useState(50)
  const [density,    setDensity]    = useState(280)
  const [shapeScale, setShapeScale] = useState(2.2)
  const [wiggleAmp,  setWiggleAmp]  = useState(8.0)
  const [edgePct,    setEdgePct]    = useState(100)
  const edgeMin = edgePct / 100

  const controlsRef = useRef()

  const allShapes = useMemo(() => [...shapes3d, ...customModels], [customModels])
  const activeShape = useMemo(
    () => allShapes.find(s => s.id === shapeId) ?? allShapes[0],
    [allShapes, shapeId],
  )

  // ── 3D model upload ───────────────────────────────────────────────
  const handleModelUpload = useCallback(async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    try {
      const buffer = await file.arrayBuffer()
      const id     = `custom3d-${Date.now()}`
      const label  = file.name.replace(/\.(glb|gltf)$/i, '')
      setCustomModels(prev => [...prev, {
        id, label,
        type: '3d-async',
        loader: (count) => loadModelFromBuffer(buffer, count),
        icon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"><path d="M50,16 L82,34 L82,66 L50,84 L18,66 L18,34 Z"/><line x1="50" y1="16" x2="50" y2="50"/><line x1="82" y1="34" x2="50" y2="50"/><line x1="18" y1="34" x2="50" y2="50"/></svg>`,
      }])
      setShapeId(id)
    } catch (err) {
      alert('Could not read model. Please use a valid GLB or GLTF file.')
      console.error(err)
    }
  }, [])

  const removeCustomModel = useCallback((id, e) => {
    e.stopPropagation()
    setCustomModels(prev => prev.filter(s => s.id !== id))
    setShapeId(prev => prev === id ? shapes3d[0].id : prev)
  }, [])

  // ── Camera snap ───────────────────────────────────────────────────
  function snapCamera() {
    const ctrl = controlsRef.current
    if (!ctrl) return
    ctrl.setAzimuthalAngle(Math.PI / 5)
    ctrl.setPolarAngle(Math.PI / 2.8)
    ctrl.update()
  }

  // ── Points ────────────────────────────────────────────────────────
  const effectiveDensity = isMobile ? Math.min(density, 80) : density

  const [points,       setPoints]  = useState([])
  const [loadingAsync, setLoading] = useState(false)

  useEffect(() => {
    if (!activeShape || images.length === 0) { setPoints([]); return }

    let cancelled = false

    async function compute() {
      let raw
      if (activeShape.type === '3d-async') {
        setLoading(true)
        try {
          raw = await activeShape.loader(effectiveDensity)
        } catch (err) {
          console.error('Failed to load shape:', err)
          raw = []
        }
      } else {
        raw = activeShape.generator(effectiveDensity)
      }

      if (cancelled) return
      const scaled = shapeScale === 1
        ? raw
        : raw.map(p => ({ ...p, x: p.x * shapeScale, y: p.y * shapeScale, z: p.z * shapeScale }))
      setPoints(scaled)
      setLoading(false)
    }

    compute()
    return () => { cancelled = true; setLoading(false) }
  }, [activeShape, effectiveDensity, shapeScale])

  // ── Render ────────────────────────────────────────────────────────
  if (images.length === 0) {
    return (
      <div className="empty-state">
        <h1>Image Cluster</h1>
        <p>Drop images into <code>src/assets/media/</code> to get started.</p>
      </div>
    )
  }

  return (
    <div className={`app ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <button className="mobile-toggle" onClick={() => setSidebarOpen(o => !o)} title="Menu">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {sidebarOpen && <h1>Image Cluster</h1>}
          <button
            className="collapse-btn"
            onClick={() => setSidebarOpen(o => !o)}
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <div className="sidebar-body">
          <p className="muted">{images.length} images</p>

          <SidebarSection title="3D Shapes">
            <div className="shape-grid">
              {shapes3d.map(s => (
                <button key={s.id}
                  className={`shape-btn ${s.id === shapeId ? 'active' : ''}`}
                  onClick={() => { setShapeId(s.id); setTimeout(snapCamera, 50) }}
                  title={s.label}
                >
                  <div className="shape-thumb" dangerouslySetInnerHTML={{ __html: s.icon }} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>

            {customModels.length > 0 && (
              <div className="shape-grid" style={{ marginTop: 8 }}>
                {customModels.map(s => (
                  <button key={s.id}
                    className={`shape-btn ${s.id === shapeId ? 'active' : ''}`}
                    onClick={() => { setShapeId(s.id); setTimeout(snapCamera, 50) }}
                    title={s.label}
                  >
                    <div className="shape-thumb" dangerouslySetInnerHTML={{ __html: s.icon }} />
                    <span className="custom-label">{s.label}</span>
                    <span className="remove-btn" onClick={e => removeCustomModel(s.id, e)} title="Remove">×</span>
                  </button>
                ))}
              </div>
            )}

            <label className="upload-btn">
              + Upload 3D Model (GLB)
              <input type="file" accept=".glb,.gltf" onChange={handleModelUpload} />
            </label>
          </SidebarSection>

          <SidebarSection title="Settings">
            <Slider label="Image size"   value={imageSize}  min={12}  max={70}  step={1}    onChange={setImageSize}
              displayValue={`${imageSize}px`} />
            <Slider label="Density"      value={density}    min={20}  max={280} step={5}    onChange={setDensity}
              displayValue={density} />
            <Slider label="Shape scale"  value={shapeScale} min={0.3} max={2.2} step={0.05} onChange={setShapeScale}
              displayValue={`${shapeScale.toFixed(1)}×`} />
            <Slider label="Wiggle"       value={wiggleAmp}  min={0}   max={8}   step={0.25} onChange={setWiggleAmp}
              displayValue={wiggleAmp.toFixed(1)} />
            <Slider label="Edge falloff" value={edgePct}    min={0}   max={100} step={5}    onChange={setEdgePct}
              displayValue={`${edgePct}%`} />
          </SidebarSection>

          <SidebarSection title="Help" defaultOpen={false}>
            <div className="hint" style={{ marginTop: 0, paddingTop: 0, border: 'none' }}>
              Drag to orbit · Scroll to zoom<br />
              Pinch to zoom on touch devices<br />
              Click any image to open lightbox<br />
              ← → arrows or buttons to navigate
            </div>
          </SidebarSection>
        </div>
      </aside>

      {/* ── 3-D canvas ──────────────────────────────────────────── */}
      <main className="stage" style={{ position: 'relative' }}>
        <Canvas
          dpr={[1, Math.min(window.devicePixelRatio, 2)]}
          camera={{ position: [180, 130, 620], fov: 55, near: 10, far: 3000 }}
          gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
        >
          <color attach="background" args={['#0a0a0a']} />
          <fog attach="fog" args={['#0a0a0a', isMobile ? 700 : 900, isMobile ? 1600 : 2200]} />
          <ClusterScene
            points={points}
            imageSize={imageSize}
            edgeMin={edgeMin}
            wiggleAmp={wiggleAmp}
            onImageClick={idx => setLbIndex(idx)}
          />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={60}
            maxDistance={1500}
          />
        </Canvas>

        {loadingAsync && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 50,
          }}>
            <span style={{
              fontSize: 12, color: '#6366f1', letterSpacing: '0.8px',
              textTransform: 'uppercase', fontWeight: 600,
              background: 'rgba(10,10,10,0.75)', padding: '6px 14px',
              borderRadius: 6, backdropFilter: 'blur(4px)',
            }}>Loading…</span>
          </div>
        )}
      </main>

      {/* ── Lightbox ─────────────────────────────────────────────── */}
      {lbIndex !== null && (
        <Lightbox
          index={lbIndex}
          onClose={() => setLbIndex(null)}
          onPrev={() => setLbIndex(p => (p - 1 + images.length) % images.length)}
          onNext={() => setLbIndex(p => (p + 1) % images.length)}
        />
      )}
    </div>
  )
}
