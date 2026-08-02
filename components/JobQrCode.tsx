/** Deterministic QR-style placeholder for demo / print (not a scannable code). */
export function JobQrCode({
  jobId,
  size = 112,
  className = "",
}: {
  jobId: string;
  size?: number;
  className?: string;
}) {
  const seed = jobId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const cells = 11;
  const cellSize = size / cells;

  const isFilled = (row: number, col: number) => {
    if (row < 3 && col < 3) return true;
    if (row < 3 && col >= cells - 3) return true;
    if (row >= cells - 3 && col < 3) return true;
    return (seed * (row + 1) * (col + 7) + row * col) % 5 < 2;
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`QR code for ${jobId}`}
    >
      <rect width={size} height={size} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
      {Array.from({ length: cells }, (_, row) =>
        Array.from({ length: cells }, (_, col) =>
          isFilled(row, col) ? (
            <rect
              key={`${row}-${col}`}
              x={col * cellSize + 1}
              y={row * cellSize + 1}
              width={cellSize - 2}
              height={cellSize - 2}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}
