// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
  apiKey: "AIzaSyBjTuINyt8OoqQAvK35aWowQYPmlhOstZ8",
  authDomain: "session-feedback-413e3.firebaseapp.com",
  projectId: "session-feedback-413e3",
  storageBucket: "session-feedback-413e3.firebasestorage.app",
  messagingSenderId: "1063510460369",
  appId: "1:1063510460369:web:0779fefee382473680c2f0",
  measurementId: "G-S4Z39YY475"
};
// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Secondary app to allow privileged actions without disturbing current session
const secondaryApp = initializeApp(firebaseConfig, 'secondary');

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
