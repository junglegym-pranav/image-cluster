const hiddenHost = (() => {
  if (typeof document === 'undefined') return null
  const div = document.createElement('div')
  div.style.cssText =
    'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;visibility:hidden;'
  document.body.appendChild(div)
  return div
})()

function extractPathData(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
  const paths = doc.querySelectorAll('path')
  if (paths.length === 0) return null
  const d = Array.from(paths)
    .map(p => p.getAttribute('d'))
    .filter(Boolean)
    .join(' ')
  const viewBox =
    doc.documentElement.getAttribute('viewBox') ||
    `0 0 ${doc.documentElement.getAttribute('width') || 100} ${
      doc.documentElement.getAttribute('height') || 100
    }`
  return { d, viewBox }
}

function mountProbePath(d, viewBox) {
  const svgNS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(svgNS, 'svg')
  svg.setAttribute('viewBox', viewBox)
  const path = document.createElementNS(svgNS, 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  hiddenHost.appendChild(svg)
  return { svg, path }
}

// Binary-search outward in 8 directions to find nearest edge distance.
function computeEdgeDist(point, path, svg, maxStep) {
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707],
  ]
  let minD = Infinity
  const pt = svg.createSVGPoint()
  for (const [dx, dy] of dirs) {
    let lo = 0, hi = maxStep
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      pt.x = point.x + dx * mid
      pt.y = point.y + dy * mid
      if (path.isPointInFill(pt)) lo = mid
      else hi = mid
    }
    minD = Math.min(minD, lo)
  }
  return minD
}

export function samplePointsInSVG(svgString, count, padding = 0.02) {
  if (!hiddenHost) return { points: [], viewBox: '0 0 100 100' }

  const parsed = extractPathData(svgString)
  if (!parsed) return { points: [], viewBox: '0 0 100 100' }

  const { d, viewBox } = parsed
  const { svg, path } = mountProbePath(d, viewBox)

  try {
    const bbox = path.getBBox()
    if (bbox.width === 0 || bbox.height === 0) return { points: [], viewBox }

    const padX = bbox.width * padding
    const padY = bbox.height * padding
    const minX = bbox.x + padX
    const maxX = bbox.x + bbox.width - padX
    const minY = bbox.y + padY
    const maxY = bbox.y + bbox.height - padY

    const area = bbox.width * bbox.height
    const idealSpacing = Math.sqrt(area / count) * 0.78

    const points = []
    const maxAttempts = count * 100
    let attempts = 0
    const svgPoint = svg.createSVGPoint()

    while (points.length < count && attempts < maxAttempts) {
      attempts++
      svgPoint.x = minX + Math.random() * (maxX - minX)
      svgPoint.y = minY + Math.random() * (maxY - minY)

      if (!path.isPointInFill(svgPoint)) continue

      const relaxFactor = 1 - attempts / maxAttempts
      const minDist = idealSpacing * relaxFactor

      let tooClose = false
      for (const p of points) {
        const dx = p.x - svgPoint.x
        const dy = p.y - svgPoint.y
        if (dx * dx + dy * dy < minDist * minDist) { tooClose = true; break }
      }
      if (tooClose) continue

      points.push({ x: svgPoint.x, y: svgPoint.y })
    }

    // Compute edge distance for each point and normalise to [0, 1]
    const maxStep = Math.min(bbox.width, bbox.height) / 2
    const rawDists = points.map(p => computeEdgeDist(p, path, svg, maxStep))
    const maxDist = Math.max(...rawDists, 1)

    return {
      points: points.map((p, i) => ({
        ...p,
        edgeDist: rawDists[i] / maxDist,
      })),
      viewBox,
    }
  } finally {
    hiddenHost.removeChild(svg)
  }
}
