// firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 從 Firebase Console 複製來的設定
const firebaseConfig = {
  apiKey: "AIzaSyBzIuGIG4jmUe146rexK51UNvA2dn3xnT8",
  authDomain: "fir-f51b8.firebaseapp.com",
  projectId: "fir-f51b8",
  storageBucket: "fir-f51b8.appspot.com",  // ✅ 修正這裡
  messagingSenderId: "904534740293",
  appId: "1:904534740293:web:c571f1f69b004c0b15022c",
  measurementId: "G-5WGVD478EE"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Firestore
export const db = getFirestore(app);

// 初始化 Authentication（Google 登入）
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, provider);
