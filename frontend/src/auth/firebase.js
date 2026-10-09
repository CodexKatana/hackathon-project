
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase Web App Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeaUFSMV7btJT5YHMOgYdh6CKRguE_laQ",
  authDomain: "smartpool-97507.firebaseapp.com",
  projectId: "smartpool-97507",
  storageBucket: "smartpool-97507.firebasestorage.app",
  messagingSenderId: "350684982646",
  appId: "1:350684982646:web:4c2061bf309f56a7f41e57",
  measurementId: "G-P9JPQW7XDR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

export const firebaseConfigured = true;
