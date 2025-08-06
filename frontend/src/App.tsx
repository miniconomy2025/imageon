import React, { useState, useEffect } from "react";
import { Button, Avatar, Card, Input, Post, PostComposer } from "./components";
import Login from "./components/Auth/Login";
import CompleteProfile from "./components/Auth/CompleteProfile";
import { authService } from "./services/auth";
import "./App.css";

interface Author {
  name: string;
  avatar?: string | null;
}

interface PostData {
  id: number;
  author: Author;
  content: string;
  timestamp: Date;
  likes: number;
  comments: number;
  shares: number;
}

interface User {
  uid: string;
  email: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  needsProfile: boolean;
  idToken?: string;
}

type AppState = "loading" | "auth" | "complete-profile" | "main";

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("loading");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<PostData[]>([
    {
      id: 1,
      author: { name: "John Doe", avatar: null },
      content:
        "Just launched my new React social media app! 🚀 What do you think?",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      likes: 12,
      comments: 3,
      shares: 1,
    },
    {
      id: 2,
      author: { name: "Jane Smith", avatar: null },
      content: "Beautiful sunset today! Nature never fails to amaze me. 🌅",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      likes: 24,
      comments: 7,
      shares: 3,
    },
  ]);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          const userProfile = await authService.verifyToken(idToken);

          if (userProfile.needsProfile) {
            setCurrentUser({ ...userProfile, idToken });
            setAppState("complete-profile");
          } else {
            setCurrentUser({ ...userProfile, idToken });
            setAppState("main");
          }
        } catch (error) {
          console.error("Error verifying user:", error);
          setAppState("auth");
        }
      } else {
        setCurrentUser(null);
        setAppState("auth");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.needsProfile) {
      setAppState("complete-profile");
    } else {
      setAppState("main");
    }
  };

  const handleProfileComplete = (user: User) => {
    setCurrentUser(user);
    setAppState("main");
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setAppState("auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleNewPost = (content: string): void => {
    const newPost: PostData = {
      id: posts.length + 1,
      author: {
        name: currentUser?.displayName || currentUser?.username || "You",
        avatar: currentUser?.photoURL || null,
      },
      content,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      shares: 0,
    };
    setPosts([newPost, ...posts]);
  };

  // Loading state
  if (appState === "loading") {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication state
  if (appState === "auth") {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => {}} // We only have Google auth for now
      />
    );
  }

  // Profile completion state
  if (appState === "complete-profile" && currentUser) {
    return (
      <CompleteProfile
        user={currentUser}
        onProfileComplete={handleProfileComplete}
      />
    );
  }

  // Main app state
  return (
    <div className="app">
      <header className="app__header">
        <h1>ImageOn</h1>
        <div className="app__user">
          <Avatar
            fallbackText={
              currentUser?.displayName?.[0] || currentUser?.username?.[0] || "U"
            }
            size="small"
            src={currentUser?.photoURL || undefined}
          />
          <span>
            Welcome,{" "}
            {currentUser?.displayName || currentUser?.username || "User"}!
          </span>
          <Button variant="outline" size="small" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="app__main">
        <div className="app__feed">
          <PostComposer
            user={{
              name: currentUser?.displayName || currentUser?.username || "You",
              avatar: currentUser?.photoURL || null,
            }}
            onPost={handleNewPost}
          />

          {posts.map((post) => (
            <Post
              key={post.id}
              author={post.author}
              content={post.content}
              timestamp={post.timestamp}
              likes={post.likes}
              comments={post.comments}
              shares={post.shares}
              onLike={(liked) => console.log("Liked:", liked)}
              onComment={() => console.log("Comment clicked")}
              onShare={() => console.log("Share clicked")}
            />
          ))}
        </div>

        <aside className="app__sidebar">
          <Card padding="medium">
            <h3>Welcome to ImageOn!</h3>
            <p>
              You're now signed in with Google and ready to share your moments.
            </p>

            <div className="user-info">
              <h4>Your Profile</h4>
              <p>
                <strong>Name:</strong> {currentUser?.displayName}
              </p>
              <p>
                <strong>Username:</strong> @{currentUser?.username}
              </p>
              <p>
                <strong>Email:</strong> {currentUser?.email}
              </p>
            </div>
          </Card>
        </aside>
      </main>
    </div>
  );
};

export default App;
