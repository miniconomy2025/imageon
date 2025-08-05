import React, { useState } from 'react'
import Avatar from '../Avatar/Avatar'
import Button from '../Button/Button'
import './Post.css'
import { useNavigate, useParams } from 'react-router-dom'
import { Pages } from '../../pages/pageRouting'

interface Author {
  name: string
  avatar?: string | null
}

interface PostProps extends React.HTMLAttributes<HTMLDivElement> {
  author: Author
  content: string
  timestamp: string | Date
  likes?: number
  comments?: number
  shares?: number
  onLike?: (liked: boolean) => void
  onComment?: () => void
  onShare?: () => void
  className?: string
}

const Post: React.FC<PostProps> = ({ 
  author,
  content,
  timestamp,
  likes = 0,
  comments = 0,
  shares = 0,
  onLike,
  onComment,
  onShare,
  className = '',
  ...props 
}) => {
  const [isLiked, setIsLiked] = useState<boolean>(false)
  const [likeCount, setLikeCount] = useState<number>(likes)

  const navigate = useNavigate();

  const handleLike = (): void => {
    setIsLiked(!isLiked)
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1)
    onLike && onLike(!isLiked)
  }

  const formatTime = (date: Date | string): string => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m`
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
    return `${Math.floor(minutes / 1440)}d`
  }

  return (
    <div className={`post ${className}`} {...props}>
      <div className="post__header">
        <Avatar 
          src={author.avatar || undefined} 
          alt={author.name}
          fallbackText={author.name}
          size="medium"
        />
        <div className="post__author-info">
          <h4 onClick={() => { navigate(Pages.profilePage.replace(':username', author.name)) }} className="post__author-name">{author.name}</h4>
          <span className="post__timestamp">{formatTime(timestamp)}</span>
        </div>
      </div>
      
      <div className="post__content">
        {content}
      </div>
      
      <div className="post__actions">
        <Button
          variant="outline"
          size="small"
          onClick={handleLike}
          className={`post__action ${isLiked ? 'post__action--liked' : ''}`}
        >
          ❤️ {likeCount}
        </Button>
        
        <Button
          variant="outline"
          size="small"
          onClick={onShare}
          className="post__action"
        >
          💬 {comments}
        </Button>
      </div>
    </div>
  )
}

export default Post
