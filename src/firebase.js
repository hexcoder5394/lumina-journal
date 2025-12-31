import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// CONFIG FROM YOUR FINANCE TOOL (BudgetFlow)
const firebaseConfig = {
  apiKey: "AIzaSyDyei09fjMoVuRokuzILkYNqxKO3Vb_YYE",
  authDomain: "budgetplanner-596f2.firebaseapp.com",
  projectId: "budgetplanner-596f2",
  storageBucket: "budgetplanner-596f2.firebasestorage.app",
  messagingSenderId: "373345934569",
  appId: "1:373345934569:web:89ef9dd95d2c790b94a478"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);