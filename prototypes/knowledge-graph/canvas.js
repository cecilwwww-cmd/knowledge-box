const TAU = Math.PI * 2
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const reduce = matchMedia('(prefers-reduced-motion: reduce)')
const fade = (value, start, end) => {
  const fraction = clamp((value - start) / (end - start), 0, 1)
  return fraction * fraction * (3 - 2 * fraction)
}

function random(seed) {
  return () => {
    seed = Math.imul(1664525, seed) + 1013904223 | 0
    return (seed >>> 0) / 4294967296
  }
}

export function createCanvas(canvas, tooltip, onSelect, onFocus, { preserveResize = false } = {}) {
  const ctx = canvas.getContext('2d')
  let graph, nodes = [], edges = [], active, hover, drag, scope, matches
  let width = 0, height = 0, resolution = 1
  let camera = { x: 0, y: 0, zoom: 1 }, goal = null
  let fitZoom = 1, clickTimer
  let headingHits = [], branchLayout
  let layout, last = 0, frame
  const events = new AbortController()
  const on = (name, listener, options) => canvas.addEventListener(name, listener, { ...options, signal: events.signal })
  let visibleTypes = { tree: true, nav: true }
  const fingers = new Map()
  let pinch = null

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const oldWidth = width, oldHeight = height
    width = rect.width
    height = rect.height
    resolution = Math.min(2, devicePixelRatio || 1)
    canvas.width = Math.round(width * resolution)
    canvas.height = Math.round(height * resolution)
    if (preserveResize && oldWidth && oldHeight) {
      for (const target of [camera, goal]) {
        if (!target) continue
        const selection = active?.headings.length && target.zoom / fitZoom > 1.45 && point(active, target)
        if (selection && selection.x >= 0 && selection.x <= oldWidth) {
          const x = selection.x * width / oldWidth
          target.x += branchViewportX(x) - selection.x
        } else {
          target.x += (width - oldWidth) / 2
        }
        target.y += (height - oldHeight) / 2
      }
    } else fit(false)
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)

  function setGraph(next, keepView = false) {
    const previous = keepView ? graph : null
    const previousScope = scope
    graph = next
    const seeded = random(97)
    const subgroups = new Map()
    for (const node of graph.nodes.values()) {
      const existing = previous?.nodes.get(node.id)
      if (existing) {
        const { x, y, ax, ay } = existing
        Object.assign(node, { x, y, ax, ay, vx: 0, vy: 0 })
        continue
      }
      if (node.group === -1) {
        Object.assign(node, { x: 0, y: 0, ax: 0, ay: 0, vx: 0, vy: 0 })
        continue
      }
      const angle = -2.65 + TAU * node.group / Math.max(2, graph.clusters.length)
      const distance = graph.clusters.length === 1 ? 60 : 218
      const group = graph.clusters[node.group]
      let x = Math.cos(angle) * distance
      let y = Math.sin(angle) * distance * .73
      if (node !== group) {
        const parent = graph.nodes.get(node.parentId)
        const branch = parent && parent !== group ? parent.id : node.id
        if (!subgroups.has(branch)) subgroups.set(branch, [seeded() * TAU, 36 + seeded() * 45])
        const [branchAngle, branchDist] = subgroups.get(branch)
        x += Math.cos(branchAngle) * branchDist
        y += Math.sin(branchAngle) * branchDist
        const variation = Math.sqrt(seeded()) * (node.children.length ? 25 : 98)
        const jitter = seeded() * TAU
        x += Math.cos(jitter) * variation
        y += Math.sin(jitter) * variation
      }
      Object.assign(node, { x, y, ax: x, ay: y, vx: 0, vy: 0 })
    }
    active = hover = null
    clearTimeout(clickTimer)
    setScope(previous ? previousScope : null, false)
    if (!previous) {
      layout.tick(nodes.length > 700 ? 18 : 76)
      fit(false)
    }
  }

  function setScope(ids, fitView = true) {
    scope = ids
    nodes = [...graph.nodes.values()].filter(node => !scope || scope.has(node.id))
    edges = graph.edges.filter(edge => !scope || scope.has(edge.from.id) && scope.has(edge.to.id))
    layout = makeLayout()
    hover = null
    headingHits = []
    branchLayout = null
    tooltip.hidden = true
    if (fitView) fit()
  }

  function fit(smooth = true) {
    if (!nodes.length || !width || !height) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of nodes) {
      minX = Math.min(minX, node.x); maxX = Math.max(maxX, node.x)
      minY = Math.min(minY, node.y); maxY = Math.max(maxY, node.y)
    }
    const zoom = clamp(Math.min((width - 94) / (maxX - minX + 80), (height - 130) / (maxY - minY + 85)), .15, 1.45)
    fitZoom = zoom
    const x = width / 2 - (maxX + minX) / 2 * zoom
    const y = height / 2 + 14 - (maxY + minY) / 2 * zoom
    if (smooth && !reduce.matches) goal = { x, y, zoom }
    else { goal = null; camera = { x, y, zoom } }
  }

  function center(node) {
    const zoom = camera.zoom
    goal = { x: width / 2 - node.x * zoom, y: height / 2 - node.y * zoom, zoom }
    if (reduce.matches) { camera = goal; goal = null }
  }

  function zoomAt(px, py, scale, smooth = false) {
    const old = smooth && goal ? goal : camera
    const zoom = clamp(old.zoom * scale, .14, Math.max(5, fitZoom * 5))
    const next = {
      x: px - (px - old.x) * zoom / old.zoom,
      y: py - (py - old.y) * zoom / old.zoom,
      zoom,
    }
    if (smooth && !reduce.matches) goal = next
    else { camera = next; goal = null }
  }

  function makeLayout() {
    const { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } = globalThis.d3
    const links = edges.filter(edge => edge.type === 'tree').map(({ from, to }) => ({
      source: from,
      target: to,
      distance: from.group === to.group ? (to.children.length ? 83 : 64) : 205,
    }))
    return forceSimulation(nodes).stop()
      .alphaDecay(.04)
      .velocityDecay(.48)
      .force('tree', forceLink(links).distance(link => link.distance).strength(.34))
      .force('charge', forceManyBody().strength(node => node.children.length ? -95 : -58).distanceMax(185))
      .force('clearance', forceCollide(node => node.children.length ? 17 : 12).iterations(2))
      .force('cluster-x', forceX(node => node.ax).strength(.105))
      .force('cluster-y', forceY(node => node.ay).strength(.105))
  }

  const point = (node, view = camera) => ({
    x: node.x * view.zoom + view.x,
    y: node.y * view.zoom + view.y,
  })
  const radius = node => clamp((node.depth === 0 ? 8 : node.children.length ? 6.5 : 3.8) * Math.sqrt(camera.zoom), 2, 13)
  function paintEdges(focal) {
    for (const { from, to, type } of edges) {
      if (!visibleTypes[type]) continue
      const a = point(from), b = point(to)
      const strong = focal === from || focal === to
      const navigates = type === 'nav'
      ctx.strokeStyle = strong ? (navigates ? '#527b68' : '#87928b')
        : (hover ? '#e9ede8' : navigates ? '#a5b5ab' : '#d2d8d3')
      ctx.lineWidth = strong ? 1.35 : .85
      ctx.setLineDash(navigates ? [3, 4] : [])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      if (navigates) {
        ctx.quadraticCurveTo((a.x + b.x) / 2 - (b.y - a.y) * .15,
          (a.y + b.y) / 2 + (b.x - a.x) * .15, b.x, b.y)
      } else ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  const overlaps = (a, b) =>
    a.x < b.x + b.w + 4 && a.x + a.w > b.x - 4 && Math.abs(a.y - b.y) < 15
  const around = (origin, angle, distance) => ({
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  })
  const branchViewportX = x => {
    const margin = Math.min(width * .42, 174)
    return clamp(x, margin, width - margin)
  }

  function paintHeadings(node, level) {
    headingHits = []
    const sectionAlpha = fade(level, 1.45, 2.05)
    const subsectionAlpha = fade(level, 2.45, 3.25)
    if (!sectionAlpha || !node?.headings.length) {
      branchLayout = null
      return
    }

    const origin = point(node)
    if (branchLayout?.node !== node) {
      const parent = graph.nodes.get(node.parentId)
      const gapAngle = parent
        ? Math.atan2(parent.y - node.y, parent.x - node.x)
        : origin.x < width / 2 ? Math.PI : 0
      branchLayout = { node, gapAngle }
    }
    const count = node.headings.length
    const gap = clamp(TAU / (count + 1) * 1.4, Math.PI / 5, Math.PI)
    const step = count > 1 ? (TAU - gap) / (count - 1) : 0
    const firstAngle = branchLayout.gapAngle + (count > 1 ? gap / 2 : Math.PI)
    const ring = Math.max(clamp(Math.min(width, height) * .19, 66, 112), count * 5.5)
    const labels = []

    function branch(heading, from, to, angle, alpha) {
      if (!alpha) return
      const isSection = heading.level === 2
      ctx.globalAlpha = alpha
      ctx.strokeStyle = isSection ? '#859b8e' : '#a2b1a8'
      ctx.lineWidth = isSection ? 1.15 : .9
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
      ctx.fillStyle = isSection ? '#456854' : '#6a8375'
      ctx.beginPath()
      ctx.arc(to.x, to.y, isSection ? 4 : 3, 0, TAU)
      ctx.fill()
      if (to.x < -10 || to.y < -10 || to.x > width + 10 || to.y > height + 10) return
      labels.push({ heading, to, angle, alpha })
    }

    for (const [index, heading] of node.headings.entries()) {
      const angle = firstAngle + index * step
      const section = around(origin, angle, ring)
      const isSection = heading.level === 2
      branch(heading, origin, section, angle, isSection ? sectionAlpha : subsectionAlpha)
      if (!subsectionAlpha || heading.children.length === 0) continue
      const children = heading.children
      const span = Math.min(step * .74 || Math.PI * .78, Math.PI * .78)
      const childStep = children.length > 1 ? Math.min(.38, span / (children.length - 1)) : 0
      const outerRing = Math.max(ring + 74, 24 / (childStep || 1))
      children.forEach((child, childIndex) => {
        const childAngle = angle + (childIndex - (children.length - 1) / 2) * childStep
        branch(child, section, around(origin, childAngle, outerRing), childAngle, subsectionAlpha)
      })
    }

    // Section labels take priority when an outer branch runs close to the first ring.
    labels.sort((a, b) => a.heading.level - b.heading.level)
    const occupied = []
    for (const { heading, to, angle, alpha } of labels) {
      const isSection = heading.level === 2
      ctx.font = `${isSection ? 600 : 400} 12px "Microsoft YaHei", sans-serif`
      const maxWidth = clamp(width * .28, 96, 180)
      const fullTitle = heading.title
      let label = fullTitle
      if (ctx.measureText(label).width > maxWidth) {
        let prefix = ''
        for (const char of fullTitle) {
          if (ctx.measureText(prefix + char + '…').width > maxWidth) break
          prefix += char
        }
        label = prefix + '…'
      }
      const w = ctx.measureText(label).width
      const sides = [to.x + 8, to.x - w - 8]
      if (Math.cos(angle) < 0) sides.reverse()
      const y = to.y + 4
      const box = sides.map(x => ({ x, y, w })).find(candidate =>
        candidate.x >= 4 && candidate.x + w <= width - 4 &&
        !occupied.some(other => overlaps(candidate, other)))
      if (box) {
        occupied.push(box)
        ctx.globalAlpha = alpha
        ctx.fillStyle = isSection ? '#456854' : '#6a8375'
        ctx.strokeStyle = '#fafbf9'
        ctx.lineWidth = 3
        ctx.strokeText(label, box.x, y)
        ctx.fillText(label, box.x, y)
      }
      if (alpha > .15) headingHits.push({ node, heading, ...to, labelX: box?.x, w: box ? w : 0 })
    }
    ctx.globalAlpha = 1
    return occupied
  }

  function paintNodes(focal, headingLabels = []) {
    const captions = []
    const adjacent = new Set(focal ? [...focal.links.keys()].filter(id => {
      const link = focal.links.get(id)
      return visibleTypes.tree && link.tree || visibleTypes.nav && (link.in || link.out)
    }) : [])
    for (const node of nodes) {
      const p = point(node)
      if (p.x < -50 || p.y < -50 || p.x > width + 50 || p.y > height + 50) continue
      const r = radius(node)
      const selected = node === active
      const emphasized = node === focal || selected
      const highlighted = emphasized || adjacent.has(node.id) || !!matches?.has(node.id)
      const dimmed = !highlighted && (hover || matches)
      ctx.fillStyle = emphasized ? '#315946' : dimmed ? '#a7afaa' : '#414944'
      ctx.beginPath(); ctx.arc(p.x, p.y, emphasized ? r + 1.25 : r, 0, TAU); ctx.fill()
      if (selected) {
        ctx.strokeStyle = '#92aa9c'
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, TAU); ctx.stroke()
      }
      const level = camera.zoom / fitZoom
      const priority = node === hover ? 5 : selected ? 4 : adjacent.has(node.id) ? 3 : node.children.length ? 2 : 1
      const alpha = priority > 1 || adjacent.has(node.id) ? 1 : fade(level, 1.05, 1.65)
      if (alpha > 0) captions.push({ node, p, r, priority, alpha })
    }
    captions.sort((a, b) => b.priority - a.priority)
    const filled = []
    for (const { node, p, r, priority, alpha } of captions) {
      const label = node.title.length > 17 ? node.title.slice(0, 16) + '…' : node.title
      const isActive = priority >= 4
      ctx.font = `${isActive ? 700 : 500} ${isActive ? 14 : 12}px "Microsoft YaHei", sans-serif`
      const w = ctx.measureText(label).width
      const x = p.x + r + w + 12 < width ? p.x + r + 8 : p.x - r - w - 8
      const y = p.y - (isActive ? 13 : 2)
      const box = { x, y, w }
      if (p.y < 70 || p.y > height - 38 || x < 5 ||
          (!isActive && headingLabels.some(entry => overlaps(box, entry))) ||
          filled.some(entry => overlaps(box, entry))) continue
      filled.push(box)
      ctx.globalAlpha = alpha
      ctx.strokeStyle = '#fafbf9'
      ctx.lineWidth = 3.4
      ctx.lineJoin = 'round'
      ctx.strokeText(label, x, y)
      ctx.fillStyle = isActive ? '#274738' : '#66726a'
      ctx.fillText(label, x, y)
    }
    ctx.globalAlpha = 1
  }

  function render(time) {
    frame = requestAnimationFrame(render)
    if (!width || !height || document.hidden || time - last < 24) return
    last = time
    if (goal) {
      for (const key of ['x', 'y', 'zoom']) camera[key] += (goal[key] - camera[key]) * .19
      if (Math.abs(goal.x - camera.x) + Math.abs(goal.y - camera.y) + Math.abs(goal.zoom - camera.zoom) < .04) {
        camera = goal
        goal = null
      }
    }
    const focal = hover || active
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0)
    ctx.clearRect(0, 0, width, height)
    paintEdges(focal)
    const headingLabels = paintHeadings(active, camera.zoom / fitZoom)
    paintNodes(focal, headingLabels)
  }
  frame = requestAnimationFrame(render)

  function position(event) {
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function hit(p) {
    let best, near = Infinity
    for (const node of nodes) {
      const spot = point(node)
      const distance = Math.hypot(spot.x - p.x, spot.y - p.y)
      if (distance < near && distance <= Math.max(12, radius(node) + 5)) { best = node; near = distance }
    }
    return best
  }

  function hitHeading(p) {
    return headingHits.find(({ x, y, labelX, w }) =>
      Math.hypot(p.x - x, p.y - y) <= 9 ||
      (w > 0 && Math.abs(p.y - y) <= 9 && p.x >= labelX - 3 && p.x <= labelX + w + 3))
  }

  function pinchGeometry() {
    const [a, b] = fingers.values()
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, size: Math.hypot(a.x - b.x, a.y - b.y) }
  }

  on('pointerdown', event => {
    if (event.button !== 0 || fingers.size >= 2) return
    const p = position(event)
    fingers.set(event.pointerId, p)
    canvas.setPointerCapture(event.pointerId)
    tooltip.hidden = true
    goal = null
    if (fingers.size === 2) {
      if (drag?.node) { drag.node.fx = null; drag.node.fy = null }
      drag = null
      pinch = pinchGeometry()
      return
    }
    const section = hitHeading(p)
    drag = { ...p, startX: p.x, startY: p.y, section, node: section ? null : hit(p), moved: false }
    canvas.classList.add('drag')
  })
  on('pointermove', event => {
    const p = position(event)
    if (fingers.has(event.pointerId)) fingers.set(event.pointerId, p)
    if (pinch && fingers.size === 2) {
      const shape = pinchGeometry()
      if (pinch.size > 0) zoomAt(pinch.x, pinch.y, shape.size / pinch.size)
      camera.x += shape.x - pinch.x; camera.y += shape.y - pinch.y
      pinch = shape
    } else if (drag) {
      if (Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4) drag.moved = true
      if (!drag.moved) return
      if (drag.node) {
        const node = drag.node
        node.x = node.fx = (p.x - camera.x) / camera.zoom
        node.y = node.fy = (p.y - camera.y) / camera.zoom
        if (!reduce.matches) layout.alpha(.18).tick(1)
      } else {
        camera.x += p.x - drag.x; camera.y += p.y - drag.y
      }
      drag.x = p.x; drag.y = p.y
    } else if (event.pointerType === 'mouse') {
      const section = hitHeading(p)
      hover = section?.node ?? hit(p)
      canvas.style.cursor = hover ? 'pointer' : ''
      tooltip.hidden = !hover
      if (hover) {
        tooltip.textContent = section?.heading.title ?? hover.title
        tooltip.style.left = `${clamp(p.x + 12, 5, width - tooltip.offsetWidth - 5)}px`
        tooltip.style.top = `${clamp(p.y + 15, 5, height - tooltip.offsetHeight - 5)}px`
      }
    }
  })
  const release = event => {
    if (!fingers.has(event.pointerId)) return
    fingers.delete(event.pointerId)
    pinch = null
    if (drag?.node) { drag.node.fx = null; drag.node.fy = null }
    if (event.type === 'pointerup' && drag && !drag.moved) {
      const { section, node } = drag
      if (section || node) clearTimeout(clickTimer)
      if (section) onSelect(section.node, section.heading)
      else if (node) clickTimer = setTimeout(() => onSelect(node), 245)
    }
    drag = null
    canvas.classList.remove('drag')
  }
  on('pointerup', release)
  on('pointercancel', release)
  on('pointerleave', () => { hover = null; tooltip.hidden = true })
  on('dblclick', event => {
    const p = position(event)
    if (hitHeading(p)) return
    const node = hit(p)
    if (node) { clearTimeout(clickTimer); onFocus(node) }
  })
  on('wheel', event => {
    event.preventDefault()
    const p = position(event)
    zoomAt(p.x, p.y, Math.exp(clamp(-event.deltaY, -140, 140) * .002), true)
  }, { passive: false })

  function zoomSelection(scale) {
    const p = active?.headings.length ? point(active, goal ?? camera) : null
    const visible = p && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height
    zoomAt(visible ? p.x : width / 2, visible ? p.y : height / 2, scale, true)
    if (visible && scale > 1 && (goal ?? camera).zoom / fitZoom > 1.45) {
      const view = goal ?? camera
      const marginY = Math.min(height * .4, 180)
      view.x += branchViewportX(p.x) - p.x
      view.y += clamp(p.y, marginY, height - marginY) - p.y
    }
  }

  return {
    setGraph, setScope, center, fit, zoom: zoomSelection,
    select: node => { active = node },
    highlight: ids => { matches = ids },
    edgeType: (type, enabled) => { visibleTypes[type] = enabled },
    destroy: () => {
      clearTimeout(clickTimer)
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      events.abort()
      layout?.stop()
      tooltip.hidden = true
    },
  }
}
