import React from 'react'
import './Card.css'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'secondary'
  shadow?: boolean
  padding?: 'none' | 'small' | 'medium' | 'large'
  className?: string
}

const Card: React.FC<CardProps> = ({ 
  children, 
  variant = 'default',
  shadow = true,
  padding = 'medium',
  className = '',
  onClick,
  ...props 
}) => {
  const baseClass = 'card'
  const variantClass = `card--${variant}`
  const shadowClass = shadow ? 'card--shadow' : ''
  const paddingClass = `card--padding-${padding}`
  const clickableClass = onClick ? 'card--clickable' : ''
  
  const cardClass = `${baseClass} ${variantClass} ${shadowClass} ${paddingClass} ${clickableClass} ${className}`.trim()

  return (
    <div className={cardClass} onClick={onClick} {...props}>
      {children}
    </div>
  )
}

export default Card
