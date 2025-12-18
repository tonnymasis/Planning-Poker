// Import the functions you need from the SDKs you need
import { getFirestore } from "firebase/firestore";
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyClak8B8a3mM1AmSSNrvP2HA813FX9SfTI",
    authDomain: "planning-poker-ec39c.firebaseapp.com",
    projectId: "planning-poker-ec39c",
    storageBucket: "planning-poker-ec39c.firebasestorage.app",
    messagingSenderId: "894616736768",
    appId: "1:894616736768:web:4627f84965d7fd832174e5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
