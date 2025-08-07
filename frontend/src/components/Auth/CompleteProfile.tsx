import React, { useState, useEffect } from "react";
import { authService } from "../../services/auth";
import "./Auth.css";

interface CompleteProfileProps {
  user: any;
  onProfileComplete: (user: any) => void;
}

const CompleteProfile: React.FC<CompleteProfileProps> = ({
  user,
  onProfileComplete,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [username, setUsername] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Check username availability when username changes
  useEffect(() => {
    const checkUsername = async () => {
      if (username.length < 3) {
        setUsernameError("Username must be at least 3 characters");
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setUsernameError(
          "Username can only contain letters, numbers, and underscores"
        );
        return;
      }

      setIsCheckingUsername(true);
      setUsernameError(null);

      try {
        const isAvailable = await authService.checkUsername(username);
        if (!isAvailable) {
          setUsernameError("Username is already taken");
        }
      } catch (error) {
        setUsernameError("Error checking username availability");
      } finally {
        setIsCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!displayName.trim()) {
      setError("Display name is required");
      setIsLoading(false);
      return;
    }

    if (!username.trim()) {
      setError("Username is required");
      setIsLoading(false);
      return;
    }

    if (usernameError) {
      setError("Please fix the username errors");
      setIsLoading(false);
      return;
    }

    try {
      const updatedUser = await authService.completeProfile(
        {
          displayName: displayName.trim(),
          username: username.trim(),
          summary: summary.trim(),
        },
        user.idToken
      );

      onProfileComplete(updatedUser);
    } catch (error) {
      console.error("Profile completion error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to complete profile"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Complete Your Profile</h1>
        <p>Please provide your preferred name, username, and bio to continue</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              type="text"
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your preferred name"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="username-input-container">
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="Enter your username"
                required
                disabled={isLoading}
                className={usernameError ? "error" : ""}
              />
              {isCheckingUsername && (
                <div className="checking-username">Checking...</div>
              )}
            </div>
            {usernameError && (
              <div className="field-error">{usernameError}</div>
            )}
            <small>
              Username can only contain letters, numbers, and underscores
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="summary">Bio</label>
            <textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Tell us about yourself (optional)"
              rows={3}
              maxLength={500}
              disabled={isLoading}
            />
            <small>{summary.length}/500 characters</small>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !!usernameError || isCheckingUsername}
          >
            {isLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              "Complete Profile"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
