import { initializeApp } from "firebase/app";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy,
    Timestamp,
    updateDoc,
    arrayUnion,
    getDoc,
    setDoc,
    getDocs,
    limit,
    startAfter,
    writeBatch
} from "firebase/firestore";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
    sendPasswordResetEmail
} from "firebase/auth";
import { firebaseConfig } from "./firebaseConfig";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth(app);

export {
  db,
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  Timestamp,
  updateDoc,
  arrayUnion,
  getDoc,
  getDocs,
  limit,
  startAfter,
  writeBatch,
  auth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
};