/** Split `full` into chunks that each fit a fixed-height speech box. Breaks on a
 *  space when it can, so a word isn't cut in half. The element must already be
 *  the on-screen text node (same width, same fixed height, overflow hidden). */
export function pagesForBox(el: HTMLElement, full: string): string[] {
  if (!full) return ['']
  // Width isn't known yet (first layout). One page; a resize pass splits it.
  if (el.clientHeight < 8 || el.clientWidth < 8) return [full]
  const prev = el.textContent
  const fits = (sample: string) => {
    el.textContent = sample
    return el.scrollHeight <= el.clientHeight + 1
  }
  const longest = (text: string) => {
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (fits(text.slice(0, mid))) lo = mid
      else hi = mid - 1
    }
    return lo
  }
  const pages: string[] = []
  let rest = full
  let guard = 0
  while (rest && guard++ < 40) {
    if (fits(rest)) {
      pages.push(rest)
      break
    }
    let cut = longest(rest)
    if (cut < rest.length) {
      const space = rest.lastIndexOf(' ', cut)
      if (space > 0) cut = space
    }
    if (cut <= 0) cut = 1
    const piece = rest.slice(0, cut).trimEnd()
    const next = rest.slice(cut).trimStart()
    if (!piece || next === rest) {
      pages.push(rest)
      break
    }
    pages.push(piece)
    rest = next
  }
  el.textContent = prev
  return pages.length ? pages : ['']
}

export function samePages(a: string[] | null, b: string[]) {
  return !!a && a.length === b.length && a.every((p, i) => p === b[i])
}
