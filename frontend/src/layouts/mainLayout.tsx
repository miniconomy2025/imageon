import React from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import './layout.css'
import { Avatar } from '../components'
import { useGetCurrentUser } from '../hooks/useGetCurrentUser'
import { Pages } from '../pages/pageRouting'
import { SideBar } from '../components/Sidebar/sideBar'

const Layout: React.FC = () => {
  return (
    <div className="app">
      <header className="app__header">

      </header>
      <main className="app__main">
        <SideBar />
        <div className="main-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout