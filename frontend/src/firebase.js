// Firebase Configuration for Quendoo AI Dashboard
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDDq8d2QSp1w_Tl3KpmN8PQEsXqEv_j_pM",
  authDomain: "quendoo-ai-dashboard.firebaseapp.com",
  projectId: "quendoo-ai-dashboard",
  storageBucket: "quendoo-ai-dashboard.firebasestorage.app",
  messagingSenderId: "222402522800",
  appId: "1:222402522800:web:2e3ec7a1a82a7b8f9ab5c4"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore
export const db = getFirestore(app)

export default app
