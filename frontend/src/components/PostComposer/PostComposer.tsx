import React, { useState } from 'react'
import Avatar from '../Avatar/Avatar'
import Button from '../Button/Button'
import './PostComposer.css'

interface User {
  name: string
  avatar?: string | null
}

interface PostComposerProps extends React.HTMLAttributes<HTMLDivElement> {
  user: User
  placeholder?: string
  onPost?: (content: string) => void
  className?: string
}

const PostComposer: React.FC<PostComposerProps> = ({ 
  user,
  placeholder = "What's on your mind?",
  onPost,
  className = '',
  ...props 
}) => {
  const [content, setContent] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (content.trim()) {
      onPost && onPost(content)
      setContent('')
      setIsExpanded(false)
    }
  }

  const handleTextareaFocus = (): void => {
    setIsExpanded(true)
  }

  const handleCancel = (): void => {
    setContent('')
    setIsExpanded(false)
  }

  return (
    <div className={`post-composer ${className}`} {...props}>
      <div className="post-composer__header">
        <Avatar 
          src={user.avatar || undefined} 
          alt={user.name}
          fallbackText={user.name}
          size="medium"
        />
        <form onSubmit={handleSubmit} className="post-composer__form">
          <textarea
            className="post-composer__textarea"
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={handleTextareaFocus}
            rows={isExpanded ? 4 : 1}
          />
          {isExpanded && (
            <div className="post-composer__actions">
              <Button
                type="button"
                variant="secondary"
                size="small"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="small"
                disabled={!content.trim()}
              >
                Post
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export default PostComposer
