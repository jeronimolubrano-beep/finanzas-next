export function Logo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background */}
      <rect width="200" height="200" rx="24" fill="#f4f4ff" />

      {/* Letter G */}
      <text
        x="30"
        y="140"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="110"
        fontWeight="bold"
        fill="#06083f"
      >
        GL
      </text>

      {/* Horizontal lines through letters (stripe effect) */}
      {[60, 75, 90, 105, 120].map((y) => (
        <rect key={y} x="20" y={y} width="160" height="4" fill="#f4f4ff" opacity="0.7" />
      ))}
    </svg>
  )
}

export function LogoNavbar({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="200" height="200" rx="24" fill="rgba(255,255,255,0.1)" />
      <text
        x="30"
        y="140"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="110"
        fontWeight="bold"
        fill="white"
      >
        GL
      </text>
      {[60, 75, 90, 105, 120].map((y) => (
        <rect key={y} x="20" y={y} width="160" height="4" fill="#06083f" opacity="0.4" />
      ))}
    </svg>
  )
}
