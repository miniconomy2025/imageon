import React, { useState } from 'react'
import { Button, Avatar, Card, Input, Post, PostComposer } from './components'
import './App.css'

interface Author {
  name: string
  avatar?: string | null
}

interface PostData {
  id: number
  author: Author
  content: string
  timestamp: Date
  likes: number
  comments: number
  shares: number
}

const App: React.FC = () => {
  const [posts, setPosts] = useState<PostData[]>([
    {
      id: 1,
      author: { name: 'John Doe', avatar: null },
      content: 'Just launched my new React social media app! 🚀 What do you think?',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      likes: 12,
      comments: 3,
      shares: 1
    },
    {
      id: 2,
      author: { name: 'Jane Smith', avatar: null },
      content: 'Beautiful sunset today! Nature never fails to amaze me. 🌅',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      likes: 24,
      comments: 7,
      shares: 3
    }
  ])

  const currentUser: Author = { name: 'You', avatar: null }

  const handleNewPost = (content: string): void => {
    const newPost: PostData = {
      id: posts.length + 1,
      author: currentUser,
      content,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      shares: 0
    }
    setPosts([newPost, ...posts])
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Social Media App</h1>
        <div className="app__user">
          <Avatar fallbackText="You" size="small" />
          <span>Welcome back!</span>
        </div>
      </header>

      <main className="app__main">
        <div className="app__feed">
          <PostComposer 
            user={currentUser}
            onPost={handleNewPost}
          />
          
          {posts.map(post => (
            <Post
              key={post.id}
              author={post.author}
              content={post.content}
              timestamp={post.timestamp}
              likes={post.likes}
              comments={post.comments}
              shares={post.shares}
              onLike={(liked) => console.log('Liked:', liked)}
              onComment={() => console.log('Comment clicked')}
              onShare={() => console.log('Share clicked')}
            />
          ))}
        </div>

        <aside className="app__sidebar">
          <Card padding="medium">
            <h3>Component Demo</h3>
            <div className="demo-section">
              <h4>Buttons</h4>
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="danger" size="small">Danger</Button>
            </div>
            
            <div className="demo-section">
              <h4>Avatars</h4>
              <Avatar fallbackText="A" size="small" />
              <Avatar fallbackText="B" size="medium" online />
              <Avatar fallbackText="C" size="large" />
            </div>
            
            <div className="demo-section">
              <h4>Input</h4>
              <Input 
                label="Search" 
                placeholder="Type to search..." 
                icon="🔍"
              />
            </div>
          </Card>
        </aside>
      </main>
    </div>
  )
}

export default App
