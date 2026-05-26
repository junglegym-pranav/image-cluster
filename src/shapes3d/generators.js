/**
 * 3D shape point generators.
 * Each returns { x, y, z, edgeDist }[] where edgeDist ∈ [0,1] drives image sizing.
 * All shapes fit inside a ≈ ±200 unit bounding box.
 *
 * Two generator flavours:
 *   Sync  — plain function, used directly in useMemo.
 *   Async — returns a Promise, shape.type === '3d-async'; App handles loading state.
 */

import * as THREE from 'three'
import { TeapotGeometry }     from 'three/examples/jsm/geometries/TeapotGeometry.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

// ─── Mesh surface sampler helpers ─────────────────────────────────────────────

function sampleMesh(mesh, count, scale = 1) {
  const sampler = new MeshSurfaceSampler(mesh).build()
  const pos    = new THREE.Vector3()
  const normal = new THREE.Vector3()
  return Array.from({ length: count }, () => {
    sampler.sample(pos, normal)
    // edgeDist: faces whose outward normal points away from the centroid are more
    // "surface-facing"; we approximate with a gentle random spread so images vary
    // slightly in size, giving an organic feel.
    const edgeDist = 0.6 + 0.4 * Math.abs(normal.y) + 0.1 * Math.random()
    return {
      x: pos.x * scale,
      y: pos.y * scale,
      z: pos.z * scale,
      edgeDist: Math.min(1, edgeDist),
    }
  })
}

// ─── Utah Teapot (synchronous — Three.js built-in geometry) ──────────────────

let _teapotSampler = null

/** Utah Teapot — built from Three.js TeapotGeometry, no file loading required. */
export function generateTeapotPoints(count) {
  if (!_teapotSampler) {
    const geo = new TeapotGeometry(110, 10)
    geo.computeVertexNormals()
    _teapotSampler = new MeshSurfaceSampler(new THREE.Mesh(geo)).build()
  }
  const pos    = new THREE.Vector3()
  const normal = new THREE.Vector3()
  return Array.from({ length: count }, () => {
    _teapotSampler.sample(pos, normal)
    const edgeDist = 0.55 + 0.45 * Math.abs(normal.y) + 0.08 * Math.random()
    return { x: pos.x, y: pos.y, z: pos.z, edgeDist: Math.min(1, edgeDist) }
  })
}

// ─── Suzanne (async — loaded from bundled GLB) ────────────────────────────────

/**
 * Loads the Suzanne GLB, merges its meshes, builds a surface sampler,
 * and returns sampled { x, y, z, edgeDist } points.
 * The model is ~1.4 scene units wide; we scale to ≈ 300 units.
 */
export async function loadSuzannePoints(url, count) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')

  const loader = new GLTFLoader()
  const gltf   = await loader.loadAsync(url)

  const geos = []
  gltf.scene.traverse(obj => {
    if (!obj.isMesh) return
    const geo = obj.geometry.clone()
    obj.updateWorldMatrix(true, false)
    geo.applyMatrix4(obj.matrixWorld)
    geos.push(geo)
  })

  const merged = mergeGeometries(geos, true)
  merged.computeVertexNormals()

  // Suzanne head fits in ≈ ±0.75 units; scale to ≈ ±145 scene units.
  return sampleMesh(new THREE.Mesh(merged), count, 190)
}

// ─── Generic GLB/GLTF loader (from ArrayBuffer — user uploads) ────────────────

/**
 * Parses a GLB/GLTF ArrayBuffer, merges all meshes, auto-centres and
 * auto-scales to fit in ±220 scene units, then samples surface points.
 */
export async function loadModelFromBuffer(buffer, count) {
  const { GLTFLoader }      = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js')

  const loader = new GLTFLoader()
  const gltf   = await new Promise((resolve, reject) =>
    loader.parse(buffer, '', resolve, reject),
  )

  const geos = []
  gltf.scene.traverse(obj => {
    if (!obj.isMesh) return
    const geo = obj.geometry.clone()
    obj.updateWorldMatrix(true, false)
    geo.applyMatrix4(obj.matrixWorld)
    geos.push(geo)
  })

  if (geos.length === 0) throw new Error('No meshes found in model')

  const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, true)
  merged.computeBoundingBox()

  const center = new THREE.Vector3()
  merged.boundingBox.getCenter(center)
  const size = new THREE.Vector3()
  merged.boundingBox.getSize(size)

  merged.translate(-center.x, -center.y, -center.z)
  merged.computeVertexNormals()

  const scale = 220 / Math.max(size.x, size.y, size.z, 0.001)
  return sampleMesh(new THREE.Mesh(merged), count, scale)
}

// ─── Primitive samplers ───────────────────────────────────────────────────────

// Square/rectangular face sampler.
// r1, r2 are orthogonal unit tangents; hA, hB are the two half-extents.
function rectSampler(cx, cy, cz, r1, r2, hA, hB = hA) {
  const area = 4 * hA * hB
  const fn = () => {
    const u = (Math.random() * 2 - 1) * hA
    const v = (Math.random() * 2 - 1) * hB
    const edgeDist = Math.max(0, 1 - Math.max(Math.abs(u) / hA, Math.abs(v) / hB))
    return {
      x: cx + u * r1[0] + v * r2[0],
      y: cy + u * r1[1] + v * r2[1],
      z: cz + u * r1[2] + v * r2[2],
      edgeDist,
    }
  }
  return { fn, area }
}

// Triangle face sampler using uniform barycentric coordinates.
function triSampler(ax, ay, az, bx, by, bz, cx, cy, cz) {
  // Cross product → face area
  const abx = bx - ax, aby = by - ay, abz = bz - az
  const acx = cx - ax, acy = cy - ay, acz = cz - az
  const area =
    0.5 *
    Math.sqrt(
      (aby * acz - abz * acy) ** 2 +
      (abz * acx - abx * acz) ** 2 +
      (abx * acy - aby * acx) ** 2,
    )
  const fn = () => {
    let s = Math.random(),
      t = Math.random()
    if (s + t > 1) { s = 1 - s; t = 1 - t }
    const u = 1 - s - t
    // min barycentric coord scaled to [0,1] gives natural falloff near edges
    const edgeDist = Math.max(0, Math.min(s, t, u) * 3)
    return {
      x: u * ax + s * bx + t * cx,
      y: u * ay + s * by + t * cy,
      z: u * az + s * bz + t * cz,
      edgeDist,
    }
  }
  return { fn, area }
}

// Draw `count` samples; each face is weighted by its area for uniform surface density.
function sampleWeighted(faces, count) {
  const total = faces.reduce((s, f) => s + f.area, 0)
  return Array.from({ length: count }, () => {
    let r = Math.random() * total
    for (const f of faces) {
      r -= f.area
      if (r <= 0) return f.fn()
    }
    return faces[faces.length - 1].fn()
  })
}

// ─── Generic box helper (any axis-aligned rectangular box) ───────────────────

function boxAllFaces(cx, cy, cz, hx, hy, hz) {
  return [
    rectSampler(cx,      cy + hy, cz,      [1,0,0], [0,0,1], hx, hz),  // +Y top
    rectSampler(cx,      cy - hy, cz,      [1,0,0], [0,0,1], hx, hz),  // -Y bottom
    rectSampler(cx + hx, cy,      cz,      [0,1,0], [0,0,1], hy, hz),  // +X right
    rectSampler(cx - hx, cy,      cz,      [0,1,0], [0,0,1], hy, hz),  // -X left
    rectSampler(cx,      cy,      cz + hz, [1,0,0], [0,1,0], hx, hy),  // +Z front
    rectSampler(cx,      cy,      cz - hz, [1,0,0], [0,1,0], hx, hy),  // -Z back
  ]
}

// ─── Cube helpers (used by Cube + Cross shapes) ───────────────────────────────

function cubeAllFaces(cx, cy, cz, S) {
  return [
    rectSampler(cx,     cy + S, cz,     [1,0,0], [0,0,1], S),
    rectSampler(cx,     cy - S, cz,     [1,0,0], [0,0,1], S),
    rectSampler(cx + S, cy,     cz,     [0,1,0], [0,0,1], S),
    rectSampler(cx - S, cy,     cz,     [0,1,0], [0,0,1], S),
    rectSampler(cx,     cy,     cz + S, [1,0,0], [0,1,0], S),
    rectSampler(cx,     cy,     cz - S, [1,0,0], [0,1,0], S),
  ]
}

function cubeFiveFaces(cx, cy, cz, S, excludeDir) {
  const all = {
    '+y': rectSampler(cx,     cy + S, cz,     [1,0,0], [0,0,1], S),
    '-y': rectSampler(cx,     cy - S, cz,     [1,0,0], [0,0,1], S),
    '+x': rectSampler(cx + S, cy,     cz,     [0,1,0], [0,0,1], S),
    '-x': rectSampler(cx - S, cy,     cz,     [0,1,0], [0,0,1], S),
    '+z': rectSampler(cx,     cy,     cz + S, [1,0,0], [0,1,0], S),
    '-z': rectSampler(cx,     cy,     cz - S, [1,0,0], [0,1,0], S),
  }
  return Object.entries(all)
    .filter(([k]) => k !== excludeDir)
    .map(([, f]) => f)
}

// ─── Exported shape generators ────────────────────────────────────────────────

/** Cube — 6 square faces, half-size 140. */
export function generateCubePoints(count) {
  return sampleWeighted(cubeAllFaces(0, 0, 0, 140), count)
}

/** Central cube (S=120) with three smaller cubes (s=72) on the +X, +Y, +Z faces. */
export function generateCrossCubesPoints(count) {
  const S = 120, s = 72
  return sampleWeighted([
    ...cubeAllFaces(0, 0, 0, S),
    ...cubeFiveFaces(S + s, 0,     0,     s, '-x'),
    ...cubeFiveFaces(0,     S + s, 0,     s, '-y'),
    ...cubeFiveFaces(0,     0,     S + s, s, '-z'),
  ], count)
}

/** Sphere — uniform surface distribution, radius 160. */
export function generateSpherePoints(count) {
  const R = 160
  return Array.from({ length: count }, () => {
    const u = Math.random() * 2 * Math.PI
    const v = Math.acos(2 * Math.random() - 1)
    return {
      x: R * Math.sin(v) * Math.cos(u),
      y: R * Math.sin(v) * Math.sin(u),
      z: R * Math.cos(v),
      edgeDist: 0.75 + Math.random() * 0.25,
    }
  })
}

/** Tunnel/corridor — four walls of a deep rectangular box (great for fly-through). */
export function generateTunnelPoints(count) {
  const W = 110, D = 260
  return sampleWeighted([
    rectSampler(0,  W, 0,  [1,0,0], [0,0,1], W, D),
    rectSampler(0, -W, 0,  [1,0,0], [0,0,1], W, D),
    rectSampler( W, 0, 0,  [0,0,1], [0,1,0], D, W),
    rectSampler(-W, 0, 0,  [0,0,1], [0,1,0], D, W),
  ], count)
}

/**
 * Pyramid — square base + four triangular faces.
 * Base at y = −110, apex at y = +150.
 */
export function generatePyramidPoints(count) {
  const W = 130   // base half-width
  const yBase = -110
  const yApex = 150

  const B = [
    [-W, yBase, -W],
    [ W, yBase, -W],
    [ W, yBase,  W],
    [-W, yBase,  W],
  ]
  const A = [0, yApex, 0]

  return sampleWeighted([
    // Base: two triangles covering the square
    triSampler(...B[0], ...B[1], ...B[2]),
    triSampler(...B[0], ...B[2], ...B[3]),
    // Four triangular sides
    triSampler(...A, ...B[0], ...B[1]),
    triSampler(...A, ...B[1], ...B[2]),
    triSampler(...A, ...B[2], ...B[3]),
    triSampler(...A, ...B[3], ...B[0]),
  ], count)
}

/**
 * Torus / donut — major radius R = 145, tube radius r = 58.
 * Outer edge of tube at ≈ 203 units from origin.
 */
export function generateTorusPoints(count) {
  const R = 145, r = 58
  // Corrected uniform sampling: accept/reject to compensate for outer-ring bias.
  const pts = []
  while (pts.length < count) {
    const u = Math.random() * 2 * Math.PI
    const v = Math.random() * 2 * Math.PI
    // Acceptance probability proportional to (R + r·cos u) / (R + r)
    if (Math.random() > (R + r * Math.cos(u)) / (R + r)) continue
    pts.push({
      x: (R + r * Math.cos(u)) * Math.cos(v),
      y: r * Math.sin(u),
      z: (R + r * Math.cos(u)) * Math.sin(v),
      edgeDist: 0.65 + 0.35 * Math.random(),
    })
  }
  return pts
}

/**
 * Diamond / octahedron — 8 equilateral triangular faces.
 * Vertices at ±170 on each axis.
 */
export function generateDiamondPoints(count) {
  const R = 170
  const top    = [ 0,  R,  0]
  const bottom = [ 0, -R,  0]
  const mid    = [[R,0,0], [0,0,R], [-R,0,0], [0,0,-R]]

  return sampleWeighted([
    ...mid.map((m, i) => triSampler(...top, ...m, ...mid[(i + 1) % 4])),
    ...mid.map((m, i) => triSampler(...bottom, ...mid[(i + 1) % 4], ...m)),
  ], count)
}

/**
 * Cylinder — top disk + bottom disk + curved side.
 * Radius 130, half-height 130.
 */
export function generateCylinderPoints(count) {
  const R = 130, H = 130
  const diskArea = Math.PI * R * R
  const sideArea = 2 * Math.PI * R * (2 * H)
  const total = 2 * diskArea + sideArea

  return Array.from({ length: count }, () => {
    const pick = Math.random() * total

    if (pick < diskArea) {
      // Top disk (uniform via square-root trick)
      const rr = R * Math.sqrt(Math.random())
      const theta = Math.random() * 2 * Math.PI
      return { x: rr * Math.cos(theta), y: H,  z: rr * Math.sin(theta), edgeDist: 1 - rr / R }
    }
    if (pick < 2 * diskArea) {
      // Bottom disk
      const rr = R * Math.sqrt(Math.random())
      const theta = Math.random() * 2 * Math.PI
      return { x: rr * Math.cos(theta), y: -H, z: rr * Math.sin(theta), edgeDist: 1 - rr / R }
    }
    // Curved side
    const theta = Math.random() * 2 * Math.PI
    const y = (Math.random() * 2 - 1) * H
    return { x: R * Math.cos(theta), y, z: R * Math.sin(theta), edgeDist: 0.6 + 0.4 * Math.random() }
  })
}

/**
 * House — a box (walls) topped by a triangular prism (roof).
 * Box: half-width W = 120, half-depth D = 100, wall height 0 → 130.
 * Roof ridge: at y = 210, running along the X axis.
 */
export function generateHousePoints(count) {
  const W = 120, D = 100
  const yFloor = -80, yWallTop = 80, yRidge = 200

  // Four walls (floor + ceiling omitted for open feel)
  const walls = [
    rectSampler(0,       (yFloor+yWallTop)/2, -D,  [1,0,0], [0,1,0], W, (yWallTop-yFloor)/2),
    rectSampler(0,       (yFloor+yWallTop)/2,  D,  [1,0,0], [0,1,0], W, (yWallTop-yFloor)/2),
    rectSampler(-W,      (yFloor+yWallTop)/2,  0,  [0,0,1], [0,1,0], D, (yWallTop-yFloor)/2),
    rectSampler( W,      (yFloor+yWallTop)/2,  0,  [0,0,1], [0,1,0], D, (yWallTop-yFloor)/2),
  ]

  // Roof: two rectangular sloping panels + two triangular gable ends
  // Roof ridge runs from (-W, yRidge, 0) to (W, yRidge, 0)
  // Front-left panel: ridge → front eave
  const ridgeL = [-W, yRidge, 0], ridgeR = [W, yRidge, 0]
  const eaveFL = [-W, yWallTop, -D], eaveFR = [W, yWallTop, -D]
  const eaveBL = [-W, yWallTop,  D], eaveBR = [W, yWallTop,  D]

  // Slope length for area calculation
  const slopeH = Math.sqrt((yRidge - yWallTop) ** 2 + D ** 2)

  const roofPanels = [
    rectSampler(0, (yRidge+yWallTop)/2, -D/2,  [1,0,0], [0, D/slopeH, -(yRidge-yWallTop)/slopeH], W, slopeH/2),
    rectSampler(0, (yRidge+yWallTop)/2,  D/2,  [1,0,0], [0, D/slopeH,  (yRidge-yWallTop)/slopeH], W, slopeH/2),
  ]

  // Gable triangles at x = ±W
  const gables = [
    triSampler(-W, yWallTop, -D,  -W, yWallTop,  D,  -W, yRidge, 0),
    triSampler( W, yWallTop, -D,   W, yRidge,    0,   W, yWallTop, D),
  ]

  return sampleWeighted([...walls, ...roofPanels, ...gables], count)
}

/**
 * Ring / flat torus — images arranged on a thick flat ring (like a CD).
 * Inner radius Ri = 70, outer radius Ro = 180, thickness half = 25.
 */
export function generateRingPoints(count) {
  const Ri = 70, Ro = 180, Ht = 25

  // Top / bottom annular faces + inner / outer cylindrical walls
  const pts = []

  // Helper: uniform point on annulus
  function annulusPt(y) {
    const r = Math.sqrt(Math.random() * (Ro * Ro - Ri * Ri) + Ri * Ri)
    const theta = Math.random() * 2 * Math.PI
    const edgeDist = 1 - Math.abs(r - (Ri + Ro) / 2) / ((Ro - Ri) / 2)
    return { x: r * Math.cos(theta), y, z: r * Math.sin(theta), edgeDist: Math.max(0, edgeDist) }
  }

  const topArea    = Math.PI * (Ro * Ro - Ri * Ri)
  const outerArea  = 2 * Math.PI * Ro * 2 * Ht
  const innerArea  = 2 * Math.PI * Ri * 2 * Ht
  const total      = 2 * topArea + outerArea + innerArea

  while (pts.length < count) {
    const pick = Math.random() * total
    if (pick < topArea)
      pts.push(annulusPt(Ht))
    else if (pick < 2 * topArea)
      pts.push(annulusPt(-Ht))
    else if (pick < 2 * topArea + outerArea) {
      const theta = Math.random() * 2 * Math.PI
      const y = (Math.random() * 2 - 1) * Ht
      pts.push({ x: Ro * Math.cos(theta), y, z: Ro * Math.sin(theta), edgeDist: 0.7 + 0.3 * Math.random() })
    } else {
      const theta = Math.random() * 2 * Math.PI
      const y = (Math.random() * 2 - 1) * Ht
      pts.push({ x: Ri * Math.cos(theta), y, z: Ri * Math.sin(theta), edgeDist: 0.6 + 0.3 * Math.random() })
    }
  }
  return pts
}

/**
 * Arrow — shaft box (pointing in +Z) capped by a four-sided pyramid head.
 * Total length ≈ 330 units (tail at z=−150, tip at z=180).
 */
export function generateArrowPoints(count) {
  const SW = 42                        // shaft half-width in X and Y
  const shaftZ1 = -150, shaftZ2 = 50  // shaft z extents
  const shaftMid = (shaftZ1 + shaftZ2) / 2
  const shaftHZ  = (shaftZ2 - shaftZ1) / 2
  const HW = 98                        // arrowhead base half-width
  const tipZ = 180

  // Four sides of the shaft + tail cap
  const shaft = [
    rectSampler(0,    SW,  shaftMid, [1,0,0], [0,0,1], SW, shaftHZ),
    rectSampler(0,   -SW,  shaftMid, [1,0,0], [0,0,1], SW, shaftHZ),
    rectSampler( SW,   0,  shaftMid, [0,0,1], [0,1,0], shaftHZ, SW),
    rectSampler(-SW,   0,  shaftMid, [0,0,1], [0,1,0], shaftHZ, SW),
    rectSampler(0,     0,  shaftZ1,  [1,0,0], [0,1,0], SW, SW),   // tail cap
  ]

  // Arrowhead: four triangles from corners of the base square to the tip
  const corners = [
    [-HW, -HW, shaftZ2],
    [ HW, -HW, shaftZ2],
    [ HW,  HW, shaftZ2],
    [-HW,  HW, shaftZ2],
  ]
  const head = [
    ...corners.map((c, i) => triSampler(0, 0, tipZ, ...c, ...corners[(i + 1) % 4])),
    // Flared collar face (annular square — approximated as two triangles)
    triSampler(...corners[0], ...corners[1], ...corners[2]),
    triSampler(...corners[0], ...corners[2], ...corners[3]),
  ]

  return sampleWeighted([...shaft, ...head], count)
}

/**
 * Staircase — three ascending steps, each a rectangular box.
 * Steps march diagonally from lower-left to upper-right.
 */
export function generateStepsPoints(count) {
  const hx = 52, hy = 34, hz = 95   // half-extents of each step

  return sampleWeighted([
    ...boxAllFaces(-90, -80, 0, hx, hy, hz),
    ...boxAllFaces(  0,   0, 0, hx, hy, hz),
    ...boxAllFaces( 90,  80, 0, hx, hy, hz),
  ], count)
}

/**
 * Arch / Portal — two tall pillars joined by a horizontal crossbar at the top.
 * Recognisable as a doorway or goal-post from any angle.
 */
export function generateArchPoints(count) {
  const depth   = 40
  const pillarW = 28, pillarH = 135
  const barW    = 68, barH    = 24
  const barY    = pillarH - barH            // crossbar sits flush with pillar tops

  return sampleWeighted([
    ...boxAllFaces(-90 - pillarW, 0,   0, pillarW, pillarH, depth),
    ...boxAllFaces( 90 + pillarW, 0,   0, pillarW, pillarH, depth),
    ...boxAllFaces(0,             barY, 0, barW + pillarW * 2, barH, depth),
  ], count)
}

/**
 * Extruded 5-pointed star.
 * Front/back faces triangulated by fan from centre; 10 side quads on the rim.
 */
export function generateStarPoints(count) {
  const R = 155, r = 65, D = 40, n = 5

  const verts = Array.from({ length: 2 * n }, (_, i) => {
    const angle  = (i * Math.PI / n) - Math.PI / 2
    const radius = i % 2 === 0 ? R : r
    return [radius * Math.cos(angle), radius * Math.sin(angle)]
  })

  const faces = []
  for (let i = 0; i < verts.length; i++) {
    const [ax, ay] = verts[i]
    const [bx, by] = verts[(i + 1) % verts.length]
    // Front and back fan triangles
    faces.push(triSampler(0, 0,  D,  ax, ay,  D,  bx, by,  D))
    faces.push(triSampler(0, 0, -D,  bx, by, -D,  ax, ay, -D))
    // Side quad (two triangles)
    faces.push(triSampler(ax, ay,  D,  ax, ay, -D,  bx, by, -D))
    faces.push(triSampler(ax, ay,  D,  bx, by, -D,  bx, by,  D))
  }

  return sampleWeighted(faces, count)
}

/**
 * Rocket — cylindrical body (approximated as octagonal prism) + cone nose + three fins.
 * Oriented with nose at the top (+Y).
 */
export function generateRocketPoints(count) {
  const R = 55, H = 160           // body radius and half-height
  const bodyBase = -H, bodyTop = H
  const noseH = 120               // nose cone height above bodyTop
  const finW = 90, finH = 100    // fin width (outward) and height
  const SIDES = 8                 // octagon approximation
  const faces = []

  // Body sides (octagonal prism)
  for (let i = 0; i < SIDES; i++) {
    const a0 = (i / SIDES) * 2 * Math.PI
    const a1 = ((i + 1) / SIDES) * 2 * Math.PI
    const x0 = R * Math.cos(a0), z0 = R * Math.sin(a0)
    const x1 = R * Math.cos(a1), z1 = R * Math.sin(a1)
    // Side quad as two triangles
    faces.push(triSampler(x0, bodyBase, z0,  x1, bodyBase, z1,  x1, bodyTop, z1))
    faces.push(triSampler(x0, bodyBase, z0,  x1, bodyTop,  z1,  x0, bodyTop, z0))
  }

  // Nose cone (triangular faces from body top ring to apex)
  const apex = [0, bodyTop + noseH, 0]
  for (let i = 0; i < SIDES; i++) {
    const a0 = (i / SIDES) * 2 * Math.PI
    const a1 = ((i + 1) / SIDES) * 2 * Math.PI
    faces.push(triSampler(
      ...apex,
      R * Math.cos(a0), bodyTop, R * Math.sin(a0),
      R * Math.cos(a1), bodyTop, R * Math.sin(a1),
    ))
  }

  // Three equally-spaced fins (flat triangles)
  for (let f = 0; f < 3; f++) {
    const angle = (f / 3) * 2 * Math.PI
    const nx = Math.cos(angle), nz = Math.sin(angle)
    const tipX = (R + finW) * nx, tipZ = (R + finW) * nz
    // Fin: triangle with base on the body side and tip pointing outward
    const topY  = bodyBase + finH
    const baseY = bodyBase
    faces.push(triSampler(
      R * nx, baseY, R * nz,
      tipX,   baseY, tipZ,
      R * nx, topY,  R * nz,
    ))
    // Back face of fin
    faces.push(triSampler(
      tipX,   baseY, tipZ,
      R * nx, topY,  R * nz,
      R * nx, baseY, R * nz,
    ))
  }

  return sampleWeighted(faces, count)
}

/**
 * DNA Double Helix — two intertwined helical ribbons approximated as
 * short rectangular segments wrapping around a central axis.
 */
export function generateDNAPoints(count) {
  const R = 90     // helix radius
  const pitch = 260 // height per full revolution
  const turns = 2  // number of turns
  const segs = 36  // segments per turn
  const ribbonW = 30 // width of each ribbon panel

  const totalSegs = segs * turns
  const faces = []

  for (let i = 0; i < totalSegs; i++) {
    // Strand A: starts at angle 0
    // Strand B: starts at angle π (offset by half turn)
    for (const phaseOffset of [0, Math.PI]) {
      const t0 = i / totalSegs
      const t1 = (i + 1) / totalSegs
      const a0 = t0 * turns * 2 * Math.PI + phaseOffset
      const a1 = t1 * turns * 2 * Math.PI + phaseOffset
      const y0 = t0 * pitch * turns - (pitch * turns) / 2
      const y1 = t1 * pitch * turns - (pitch * turns) / 2

      const x0 = R * Math.cos(a0), z0 = R * Math.sin(a0)
      const x1 = R * Math.cos(a1), z1 = R * Math.sin(a1)

      // Outward-facing ribbon panel (two triangles)
      faces.push(triSampler(x0, y0, z0,  x1, y1, z1,  x0 * (1 + ribbonW/R), y0, z0 * (1 + ribbonW/R)))
      faces.push(triSampler(x1, y1, z1,  x1 * (1 + ribbonW/R), y1, z1 * (1 + ribbonW/R),  x0 * (1 + ribbonW/R), y0, z0 * (1 + ribbonW/R)))
    }
  }

  return sampleWeighted(faces, count)
}

/**
 * Letter A — two diagonal legs + a horizontal crossbar, all rectangular boxes.
 */
export function generateLetterAPoints(count) {
  const depth = 38
  // Left leg: tilted via approximation as a thin rotated box
  // For simplicity: two tall narrow boxes angled like an A, plus a crossbar
  const legW = 22, legH = 150
  const spread = 100  // half-distance between leg bases

  // Approximate diagonal legs as slightly offset boxes stacked
  // Left leg: base at x=-spread, top at x=0
  const leftLegFaces = [
    ...boxAllFaces(-spread * 0.6,  -55, 0, legW, legH * 0.5, depth),
    ...boxAllFaces(-spread * 0.2,   55, 0, legW, legH * 0.35, depth),
  ]
  const rightLegFaces = [
    ...boxAllFaces( spread * 0.6,  -55, 0, legW, legH * 0.5, depth),
    ...boxAllFaces( spread * 0.2,   55, 0, legW, legH * 0.35, depth),
  ]
  const crossbar = boxAllFaces(0, -10, 0, spread * 0.5, 18, depth)

  return sampleWeighted([...leftLegFaces, ...rightLegFaces, ...crossbar], count)
}
