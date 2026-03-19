import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBvCk2kOBofW1xGoRj4xh3uRbAy99qECwk",
  authDomain: "agrosystem-e484e.firebaseapp.com",
  projectId: "agrosystem-e484e",
  storageBucket: "agrosystem-e484e.firebasestorage.app",
  messagingSenderId: "281017108690",
  appId: "1:281017108690:web:77cb5a191813810895850b",
  measurementId: "G-3HNZHBKN1K"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const storage = getStorage(app);
const firestore = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, storage, firestore, auth };
