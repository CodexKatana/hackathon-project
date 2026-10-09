
import React, { useState } from "react";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  auth,
  googleProvider,
  firebaseConfigured,
} from "./firebase";

import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signup, setSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleGoogleLogin = async () => {
    setError("");
    setMessage("");

    if (!firebaseConfigured) {
      setError("Add your Firebase credentials to .env.local first.");
      return;
    }

    setLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!firebaseConfigured) {
      setError("Firebase is not configured yet.");
      return;
    }

    setLoading(true);

    try {
      if (signup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setMessage("");

    if (!email) {
      setError("Enter your email address first.");
      return;
    }

    if (!firebaseConfigured) {
      setError("Firebase is not configured yet.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("If the account exists, a reset email will be sent.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="sp-login-page">
      <div className="sp-login-container">

        <div className="sp-login-visual">
          <div className="sp-video-container">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster=""
            >
              <source
                src="/videos/smartpool-demo.mp4"
                type="video/mp4"
              />
            </video>

            <div className="sp-video-overlay">
              <div className="sp-brand">🚕 smartpool.</div>

              <div className="sp-visual-text">
                <span className="sp-tag">SMARTER MOBILITY</span>
                <h1>
                  Your route.
                  <br />
                  <span>Our ride.</span>
                </h1>
                <p>
                  Share the journey, not the extra miles.
                </p>
              </div>

              <div className="sp-corridor">
                📍 Pune — Mumbai Expressway
              </div>
            </div>
          </div>
        </div>

        <div className="sp-login-form-panel">
          <div className="sp-form-content">

            <div className="sp-mobile-brand">
              🚕 smartpool.
            </div>

            <div className="sp-welcome">
              <span className="sp-eyebrow">
                WELCOME TO SMARTPOOL
              </span>

              <h2>
                {signup ? "Create account" : "Welcome back"}
                <span>.</span>
              </h2>

              <p>
                {signup
                  ? "Create your account to start sharing rides."
                  : "Sign in to continue your journey."}
              </p>
            </div>

            {!firebaseConfigured && (
              <div className="sp-error">
                Firebase setup is incomplete. Add your real
                credentials to frontend/.env.local.
              </div>
            )}

            {error && <div className="sp-error">{error}</div>}
            {message && <div className="sp-success">{message}</div>}

            <button
              className="sp-google-btn"
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <span className="sp-google-icon">G</span>
              Continue with Google
            </button>

            <div className="sp-divider">
              <span>or continue with email</span>
            </div>

            <form onSubmit={handleEmailLogin}>
              <label>Email address</label>

              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label>Password</label>

              <div className="sp-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {!signup && (
                <div className="sp-forgot">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                className="sp-submit-btn"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : signup
                  ? "Create account →"
                  : "Sign in →"}
              </button>
            </form>

            <div className="sp-signup">
              {signup
                ? "Already have an account?"
                : "Don't have an account?"}

              <button
                type="button"
                onClick={() => {
                  setSignup(!signup);
                  setError("");
                  setMessage("");
                }}
              >
                {signup ? "Sign in" : "Create account"}
              </button>
            </div>

            <div className="sp-footer">
              © 2026 SmartPool · Pune–Mumbai Corridor
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
