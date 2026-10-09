
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import { onAuthStateChanged, signOut } from "firebase/auth";

import App from "./App.jsx";
import LoginPage from "./auth/LoginPage.jsx";
import { auth, firebaseConfigured } from "./auth/firebase.js";

import "./index.css";

function SmartPool() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Do not start Firebase authentication with missing credentials.
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("Firebase authentication error:", error);
        setUser(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      alert("Logout failed. Please try again.");
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#111111",
          color: "#f5c451",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Arial, sans-serif",
          fontSize: "22px",
          fontWeight: "bold",
        }}
      >
        Loading SmartPool...
      </div>
    );
  }

  // ORIGINAL LOGIN AND SIGNUP PAGE
  if (!user) {
    return <LoginPage />;
  }

  // ORIGINAL SMARTPOOL DASHBOARD
  return (
    <>
      <App />

      <button
        type="button"
        onClick={handleLogout}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 99999,
          padding: "12px 24px",
          background: "#f5c451",
          color: "#111111",
          border: "none",
          borderRadius: "12px",
          fontSize: "14px",
          fontWeight: "bold",
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
        }}
      >
        Logout
      </button>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SmartPool />
  </React.StrictMode>
);
