import React from 'react'
import './Input.css'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  error?: string
  label?: string
  size?: 'small' | 'medium' | 'large'
  className?: string
  icon?: React.ReactNode
}

const Input: React.FC<InputProps> = ({ 
  type = 'text',
  placeholder = '',
  value,
  onChange,
  error = '',
  label = '',
  size = 'medium',
  disabled = false,
  className = '',
  icon,
  ...props 
}) => {
  const baseClass = 'input-group'
  const sizeClass = `input-group--${size}`
  const errorClass = error ? 'input-group--error' : ''
  const disabledClass = disabled ? 'input-group--disabled' : ''
  
  const groupClass = `${baseClass} ${sizeClass} ${errorClass} ${disabledClass} ${className}`.trim()

  return (
    <div className={groupClass}>
      {label && <label className="input__label">{label}</label>}
      <div className="input__wrapper">
        {icon && <div className="input__icon">{icon}</div>}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={`input ${icon ? 'input--with-icon' : ''}`}
          {...props}
        />
      </div>
      {error && <span className="input__error">{error}</span>}
    </div>
  )
}

export default Input
