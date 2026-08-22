type BrandMarkProps = {
  className?: string
  size?: 'md' | 'lg'
}

export default function BrandMark({ className = '', size = 'md' }: BrandMarkProps) {
  const classes = ['brand-mark', size === 'lg' ? 'lg' : '', className].filter(Boolean).join(' ')

  return (
    <span className={classes}>
      <img src="/maintenex-icon.png" alt="Maintenex" />
    </span>
  )
}
