import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth'
import { getFirestore } from "firebase/firestore";
//import { getAnalytics } from "firebase/analytics";


const firebaseConfig = {
  apiKey: "AIzaSyBx3URRwSSTKZivSXs24AoTat8etj6qa-0",
  authDomain: "deskdazzle.firebaseapp.com",
  projectId: "deskdazzle",
  storageBucket: "deskdazzle.appspot.com",
  messagingSenderId: "428181540252",
  appId: "1:428181540252:web:4d7bbf922fc8dfeec2cc59",
  measurementId: "G-LD790BD89S"
};

const app = initializeApp(firebaseConfig);
//const analytics = getAnalytics(app);

export const auth = getAuth(app)
export const db = getFirestore(app);
