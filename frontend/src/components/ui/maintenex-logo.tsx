type MaintenexLogoProps = {
  className?: string
}

export default function MaintenexLogo({ className = '' }: MaintenexLogoProps) {
  return (
    <img
      src="/maintenex-icon.png"
      alt="Maintenex"
      className={`maintenex-logo ${className}`.trim()}
    />
  )
}
