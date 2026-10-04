// Presentation templates for the class infographic.
//
// The engine (TypeScript) writes every decision into /data.json: which classes appear, colors, fonts, geometry
// and the poster arrangement. This file only draws. Geometry numbers are points at natural size.

#let data = json("/data.json")
#let L = data.layout
#let C = data.colors
#let O = data.options
#let fs = O.fontScale
#let u(x) = x * 1pt

#let ink = rgb(C.ink)
#let muted = rgb(C.muted)
#let accent = rgb(C.accent)
#let page-fill = if C.transparent { none } else { rgb(C.background) }
#let card-fill = if C.transparent { none } else { rgb(C.cardFill) }
#let banner-fill = rgb(C.bannerFill)
#let banner-ink = rgb(C.bannerInk)
#let heading-font = data.fonts.heading
#let body-font = data.fonts.body

#set text(font: body-font, fill: ink, size: 7pt, hyphenate: true, lang: "en")
#set par(leading: 0.42em, spacing: 0.7em)

// ---------------------------------------------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------------------------------------------

#let rich(spans) = {
  for s in spans {
    let t = [#s.text]
    if s.at("bold", default: false) { t = strong(t) }
    if s.at("italic", default: false) { t = emph(t) }
    t
  }
}

#let paragraphs(paras) = {
  for p in paras { par(rich(p)) }
}

#let icon(path, size) = box(baseline: 18%, image(path, height: size))

#let hatch(c) = tiling(size: (3.2pt, 3.2pt), {
  place(line(start: (0%, 100%), end: (100%, 0%), stroke: 0.9pt + c))
  place(line(start: (-50%, 50%), end: (50%, -50%), stroke: 0.9pt + c))
  place(line(start: (50%, 150%), end: (150%, 50%), stroke: 0.9pt + c))
})

// One row of up to five squares. Values below `lo` are solid; between `lo` and `hi` hatched. A half value draws a
// half-width square, as in the original design.
#let rating-bar(r, sq, gap) = {
  let parts = ()
  for i in range(5) {
    let solid = calc.clamp(r.lo - i, 0.0, 1.0)
    let hatched = calc.clamp(r.hi - i, 0.0, 1.0) - solid
    if solid + hatched > 0 {
      parts.push(box(width: sq * (solid + hatched), height: sq, {
        if solid > 0 { place(box(width: sq * solid, height: sq, fill: rgb(r.color))) }
        if hatched > 0 { place(dx: sq * solid, box(width: sq * hatched, height: sq, fill: hatch(rgb(r.color)))) }
      }))
    }
  }
  if parts.len() == 0 { box(width: sq * 0.2, height: sq) } else { stack(dir: ltr, spacing: gap, ..parts) }
}

// Shrinks text until it fits the box (down to `min` of the requested size).
#let fit-text(body, width, height, size, min: 0.7, track: false) = context {
  let chosen = size * min
  for k in range(12) {
    let f = 1 - k * (1 - min) / 11
    let m = measure(block(width: width, text(size: size * f, body)))
    if m.height <= height {
      chosen = size * f
      break
    }
  }
  let fitted = block(width: width, text(size: chosen, body))
  let measured = measure(fitted)
  if track {
    [#metadata((kind: "text", size: chosen.pt() * calc.min(1, height / measured.height), page: here().page())) <sizing>]
  }
  block(width: width, height: height, {
    if measured.height > height {
      scale(height / measured.height * 100%, origin: left + top, reflow: true, fitted)
    } else { fitted }
  })
}

// Scales content down (never up) so it is at most `width` wide.
#let fit-width(body, width) = context {
  let m = measure(body)
  if m.width <= width { body } else { scale(width / m.width * 100%, origin: left + top, reflow: true, body) }
}

#let banner(label, size) = box(
  fill: banner-fill,
  inset: (x: 0.7em, top: 0.55em, bottom: 0.5em),
  text(font: heading-font, size: size, fill: banner-ink, upper(label)),
)

// ---------------------------------------------------------------------------------------------------------------
// Class card
// ---------------------------------------------------------------------------------------------------------------

#let header-row(c, g) = {
  set text(fill: ink)
  text(font: heading-font, size: u(g.nameSize) * fs, upper(c.name))
  h(5pt)
  for p in c.keyIcons { icon(p, u(g.iconSize) * fs); h(2pt) }
  if c.tradIcons.len() > 0 {
    h(3pt)
    for p in c.tradIcons { icon(p, u(g.iconSize) * 0.92 * fs); h(1.2pt) }
  }
  if c.casting != none {
    h(3pt)
    box(baseline: -8%, text(size: u(g.smallSize) * 1.3 * fs, c.casting + " caster"))
  }
  if c.badge != none {
    h(4pt)
    box(
      baseline: 5%,
      fill: accent,
      radius: 2pt,
      inset: (x: 3pt, y: 2pt),
      text(size: u(g.smallSize) * fs, weight: "bold", fill: white, upper(c.badge)),
    )
  }
}

#let ratings-block(c, g) = {
  set text(size: u(g.smallSize) * fs)
  let rows = ()
  for r in c.ratings {
    rows.push(box(text(fill: ink, r.label)))
    rows.push(rating-bar(r, u(g.square), u(g.squareGap)))
  }
  grid(
    columns: (auto, auto),
    column-gutter: 4pt,
    row-gutter: u(g.rowGap),
    align: (right + horizon, left + horizon),
    ..rows,
  )
}

#let features(c) = {
  for (i, f) in c.features.enumerate() {
    if i > 0 {
      v(0.5pt)
      line(length: 62%, stroke: 1.1pt + ink)
      v(0.5pt)
    }
    par[#strong[#f.title:] #rich(f.body)]
  }
}

#let art-area(c, g) = {
  let H = u(g.height)
  let W = u(g.artW)
  if c.art.kind == "image" {
    place(bottom + left, box(width: W, height: H, context {
      let natural = measure(image(c.art.path, height: H))
      let img = if natural.width > W { image(c.art.path, width: W) } else { image(c.art.path, height: H) }
      align(bottom + center, img)
    }))
  } else if c.art.kind == "emblem" {
    let r = W * 0.42
    let cy = u(g.boxY) + (H - u(g.boxY)) / 2
    place(dx: W / 2 - r + u(g.boxX) * 0.15, dy: cy - r, circle(
      radius: r,
      fill: if card-fill == none { none } else { card-fill },
      stroke: u(g.stroke) + ink,
      align(center + horizon, image(c.art.path, width: r * 1.3, height: r * 1.3)),
    ))
  }
}

#let card(c, g) = {
  let W = u(g.width)
  let H = u(g.height)
  let bx = u(g.boxX)
  let by = u(g.boxY)
  let top = by + 11pt
  let body-top = by + 38pt * calc.max(1, fs)
  let footer-h = if O.stats { 15pt * fs } else { 0pt }
  let body-bottom = H - 8pt - footer-h
  box(width: W, height: H, {
    place(dx: bx, dy: by, rect(width: W - bx, height: H - by, stroke: u(g.stroke) + ink, fill: card-fill))
    art-area(c, g)
    place(dx: u(g.contentX), dy: top, fit-width(header-row(c, g), W - u(g.contentX) - u(g.textPadRight)))
    place(dx: u(g.contentX), dy: body-top, fit-text(
      fit-width(ratings-block(c, g), u(g.textX - g.contentX - 8)), u(g.textX - g.contentX - 8), body-bottom - body-top, u(g.smallSize) * fs,
    ))
    if O.stats {
      place(
        dx: u(g.contentX),
        dy: body-bottom + 5pt,
        fit-text(
          text(fill: muted, [#c.hp HP/level · #c.source]),
          W - u(g.contentX) - u(g.textPadRight), footer-h - 3pt, u(g.smallSize) * 0.95 * fs,
        ),
      )
    }
    place(dx: u(g.textX), dy: body-top - 1pt, fit-text(
      features(c),
      W - u(g.textX) - u(g.textPadRight),
      body-bottom - body-top,
      u(g.bodySize) * fs, track: true,
    ))
  })
}

// ---------------------------------------------------------------------------------------------------------------
// Sections, legend and notices
// ---------------------------------------------------------------------------------------------------------------

#let section-width(cols) = {
  let S = L.section
  u(2 * S.pad + cols * L.card.width + (cols - 1) * S.gapX)
}

#let section-block(s, cols, height: auto) = {
  let S = L.section
  block(width: section-width(cols), height: height, stroke: u(S.stroke) + ink, breakable: false, {
    place(top + left, banner(s.label, u(S.bannerSize) * fs))
    pad(top: u(S.header + S.pad), x: u(S.pad), bottom: u(S.pad), grid(
      columns: (u(L.card.width),) * cols,
      column-gutter: u(S.gapX),
      row-gutter: u(S.gapY),
      ..s.cards.map(c => card(c, L.card)),
    ))
  })
}

#let legend-box(title, body) = block(width: 100%, stroke: 2pt + ink, breakable: false, {
  banner(title, 9.5pt * fs)
  pad(x: 9pt, top: 7pt, bottom: 9pt, {
    set text(size: 7.2pt * fs)
    body
  })
})

#let small-heading(t) = text(font: heading-font, size: 7.5pt * fs, upper(t))

#let legend-items(lg) = {
  let items = ()
  items.push(legend-box(lg.howToUse.title, {
    paragraphs(lg.howToUse.body)
    for r in lg.ratings {
      v(3pt)
      rating-bar((lo: 5, hi: 5, color: r.color), 9pt, 2pt)
      linebreak()
      small-heading(r.label)
      linebreak()
      rich(r.body)
    }
  }))
  items.push(legend-box(lg.attributes.title, grid(
    columns: (auto, 1fr),
    column-gutter: 6pt,
    row-gutter: 5pt,
    align: horizon,
    ..lg.attributes.items.map(it => (icon(it.icon, 12pt), it.label)).flatten(),
  )))
  items.push(legend-box(lg.traditions.title, grid(
    columns: (auto, 1fr),
    column-gutter: 6pt,
    row-gutter: 5pt,
    align: horizon,
    ..lg.traditions.items.map(it => (icon(it.icon, 11pt), it.label)).flatten(),
  )))
  items.push(legend-box(lg.casting.title, {
    for it in lg.casting.items {
      small-heading(it.label)
      linebreak()
      rich(it.body)
      parbreak()
    }
  }))
  items.push(legend-box(lg.choice.title, {
    rating-bar((lo: 2, hi: 4, color: C.ink), 9pt, 2pt)
    parbreak()
    paragraphs(lg.choice.body)
  }))
  if lg.credits != none {
    items.push(legend-box(lg.credits.title, {
      for it in lg.credits.items {
        small-heading(it.role)
        linebreak()
        it.names
        parbreak()
      }
    }))
  }
  items
}

// Greedy masonry: each item goes into the currently shortest column.
#let masonry(items, n, width, gutter) = context {
  let n = int(n)
  let colw = (width - gutter * (n - 1)) / n
  let heights = range(n).map(_ => 0pt)
  let cols = range(n).map(_ => ())
  for it in items {
    let b = block(width: colw, it)
    let h = measure(b).height
    let lowest = calc.min(..heights)
    let i = heights.position(x => x == lowest)
    cols.at(i).push(b)
    heights.at(i) += h + gutter
  }
  grid(columns: (colw,) * n, column-gutter: gutter, ..cols.map(c => stack(spacing: gutter, ..c)))
}

#let legend-block(width, cols) = masonry(legend-items(data.legend), cols, width, 12pt)

#let notices(width) = if data.notices.len() > 0 {
  block(width: width, {
    set text(size: u(L.poster.noticeSize) * fs, fill: muted)
    set par(spacing: 0.5em)
    for n in data.notices { par(rich(n)) }
  })
}

// ---------------------------------------------------------------------------------------------------------------
// Poster
// ---------------------------------------------------------------------------------------------------------------

#let band-block(b, band, height: auto) = {
  if b.kind == "section" { section-block(data.sections.at(b.index), b.cols, height: height) } else {
    legend-block(u(band.width), calc.max(1, int(calc.round(band.width / 300))))
  }
}

#let poster() = {
  let A = L.arrangement
  let gap = u(L.section.between)
  let content = context {
    // Measure every band, then stretch the last section of shorter bands so all bands end level.
    let heights = A.bands.map(band => {
      band.blocks.map(b => measure(band-block(b, band)).height).sum(default: 0pt) + gap * (band.blocks.len() - 1)
    })
    let tallest = calc.max(0pt, ..heights)
    let columns = A.bands.enumerate().map(((i, band)) => {
      let extra = tallest - heights.at(i)
      let stretch = band.blocks.enumerate().filter(((_, b)) => b.kind == "section").map(((j, _)) => j)
      let target = if stretch.len() > 0 { stretch.last() } else { none }
      stack(spacing: gap, ..band.blocks.enumerate().map(((j, b)) => {
        if j == target and extra > 0pt {
          band-block(b, band, height: measure(band-block(b, band)).height + extra)
        } else { band-block(b, band) }
      }))
    })
    block(width: u(A.width), {
      set align(left + top)
      let title = box(text(font: heading-font, size: u(L.poster.titleSize) * fs, upper(data.meta.title)))
      let date = box(text(font: heading-font, size: u(L.poster.asOfSize) * fs, [Accurate as of #data.meta.asOf]))
      if measure(title).width + measure(date).width + 20pt <= u(A.width) {
        grid(columns: (1fr, auto), column-gutter: 20pt, align: (left + bottom, right + bottom), title, date)
      } else {
        fit-width(title, u(A.width))
        v(4pt)
        align(right, fit-width(date, u(A.width)))
      }
      v(u(L.poster.titleGap))
      stack(dir: ltr, spacing: gap, ..columns)
      if data.notices.len() > 0 {
        v(10pt)
        notices(u(A.width))
      }
    })
  }
  if L.page.width == none {
    set page(width: auto, height: auto, margin: u(L.page.margin), fill: page-fill)
    [#metadata((kind: "page", scale: 1, coverage: 1)) <sizing>]
    content
  } else {
    set page(width: u(L.page.width), height: u(L.page.height), margin: u(L.page.margin), fill: page-fill)
    let avail-w = u(L.page.width - 2 * L.page.margin)
    let avail-h = u(L.page.height - 2 * L.page.margin)
    context {
      let m = measure(content)
      let s = calc.min(avail-w / m.width, avail-h / m.height)
      [#metadata((kind: "page", scale: s, coverage: s * s * (m.width / avail-w) * (m.height / avail-h))) <sizing>]
      align(center + horizon, scale(s * 100%, reflow: true, content))
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Booklet
// ---------------------------------------------------------------------------------------------------------------

#let booklet() = {
  set page(
    width: u(L.page.width),
    height: u(L.page.height),
    margin: u(L.page.margin),
    fill: page-fill,
    footer: if O.pageNumbers {
      context align(center, text(size: 8pt * fs, fill: muted, counter(page).display()))
    },
  )
  let content-w = u(L.page.width - 2 * L.page.margin)
  let g = L.card
  fit-width(text(font: heading-font, size: 26pt * fs, upper(data.meta.title)), content-w)
  v(2pt)
  align(right, text(font: heading-font, size: 9pt * fs, [Accurate as of #data.meta.asOf]))
  v(10pt)
  if data.legend != none {
    legend-block(content-w, L.legendCols)
  }
  if data.notices.len() > 0 {
    v(10pt)
    notices(content-w)
  }
  for s in data.sections {
    pagebreak(weak: true)
    table(
      columns: (1fr,) * L.cols,
      column-gutter: u(L.section.gapX),
      row-gutter: u(L.section.gapY),
      stroke: none,
      inset: 0pt,
      table.header(repeat: O.repeatSectionTitles,
        table.cell(colspan: L.cols, align(center, banner(s.label, 14pt * fs))),
      ),
      ..s.cards.map(c => table.cell(breakable: false, scale(L.cardScale * 100%, reflow: true, card(c, g)))),
    )
  }
}

#if L.kind == "poster" { poster() } else { booklet() }
