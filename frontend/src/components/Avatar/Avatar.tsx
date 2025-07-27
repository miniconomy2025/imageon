import React from 'react'
import './Avatar.css'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  size?: 'small' | 'medium' | 'large' | 'xlarge'
  fallbackText?: string
  online?: boolean
  className?: string
}

const Avatar: React.FC<AvatarProps> = ({ 
  src, 
  alt = 'User avatar', 
  size = 'medium',
  fallbackText = '?',
  online = false,
  className = '',
  onClick,
  ...props 
}) => {
  const baseClass = 'avatar'
  const sizeClass = `avatar--${size}`
  const onlineClass = online ? 'avatar--online' : ''
  const clickableClass = onClick ? 'avatar--clickable' : ''
  
  const avatarClass = `${baseClass} ${sizeClass} ${onlineClass} ${clickableClass} ${className}`.trim()

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement
    const nextSibling = target.nextSibling as HTMLElement
    target.style.display = 'none'
    if (nextSibling) {
      nextSibling.style.display = 'flex'
    }
  }

  return (
    <div className={avatarClass} onClick={onClick} {...props}>
      {src && (
        <img 
          src={src} 
          alt={alt} 
          className="avatar__image"
          onError={handleError}
        />
      )}
      <div className="avatar__fallback" style={{ display: src ? 'none' : 'flex' }}>
        {fallbackText.charAt(0).toUpperCase()}
      </div>
      {online && <div className="avatar__status"></div>}
    </div>
  )
}

export default Avatar
