import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan = document.getElementById('userEmail');
  onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      userEmailSpan.textContent = user.email;
      userEmailSpan.style.display = 'inline';
    } else {
      userEmailSpan.textContent = '-';
      window.location.href = 'login.html';
    }
  });
});
