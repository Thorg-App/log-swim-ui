/**
 * Determines if the user is scrolling upward by comparing the previous and current
 * scroll positions. A threshold prevents false triggers from sub-pixel rendering
 * or momentum scroll artifacts.
 */
function isScrollingUp(
  lastScrollTop: number,
  currentScrollTop: number,
  threshold: number
): boolean {
  const delta = lastScrollTop - currentScrollTop
  return delta > threshold
}

export { isScrollingUp }
