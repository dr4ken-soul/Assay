/**
 * Skeleton shimmer.
 *
 * The only pending state in the app. There are no spinners anywhere.
 * @param className Width, height and any spacing, passed through to the bar.
 * @returns The shimmering bar.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`shimmer h-2 rounded-sm bg-bench-secondary ${className}`} />
}

/**
 * A block of shimmer lines, used for a column awaiting its answer.
 * @param lines How many lines to draw.
 * @returns The shimmer block.
 */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-1.5" data-testid="skeleton">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className="w-full" />
      ))}
    </div>
  )
}

/**
 * A shimmer block with deliberately uneven line widths, for a running column.
 * @param seed A number that shifts the pattern, so columns do not look cloned.
 * @returns The shimmer block.
 */
export function RunningSkeleton({ seed = 0 }: { seed?: number }) {
  const pattern = [96, 72, 88, 61, 84]
  return (
    <div className="space-y-2" data-testid="running-skeleton">
      {pattern.map((_, index) => (
        <div
          key={index}
          style={{ width: `${pattern[(index + seed) % pattern.length]}%` }}
          className="shimmer h-2 overflow-hidden rounded-sm bg-bench-secondary"
        />
      ))}
    </div>
  )
}
