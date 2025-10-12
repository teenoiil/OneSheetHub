// register.js
import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
  getFirestore, 
  setDoc, 
  doc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.querySelector(".register-form");
  
  // กล่องแสดงข้อความ (success/error)
  const msgBox = document.createElement("p");
  msgBox.style.textAlign = "center";
  msgBox.style.marginTop = "10px";
  registerForm.appendChild(msgBox);

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // ดึงค่า email / password / confirm
    const inputs = registerForm.querySelectorAll("input");
    const email = inputs[0].value.trim();
    const password = inputs[1].value;
    const confirm = inputs[2].value;

    if (!email || !password || !confirm) {
      return showMessage("⚠️ กรุณากรอกข้อมูลให้ครบทุกช่อง", "red");
    }

    if (password.length < 6) {
      return showMessage("🔒 รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", "red");
    }

    if (password !== confirm) {
      return showMessage("❌ รหัสผ่านไม่ตรงกัน", "red");
    }

    showMessage("⏳ กำลังสมัครสมาชิก...", "#6a1b9a");

    try {
      // ✅ สร้างบัญชีใน Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // ✅ เพิ่มข้อมูลผู้ใช้ใน Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        role: "user"
      });

      showMessage("✅ สมัครสมาชิกสำเร็จ! กำลังไปหน้าเข้าสู่ระบบ...", "green");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } 
    catch (err) {
      console.error(err);
      let message = "❌ ไม่สามารถสมัครสมาชิกได้";

      // แปลง error ของ Firebase ให้อ่านง่าย
      switch (err.code) {
        case "auth/email-already-in-use":
          message = "📧 อีเมลนี้ถูกใช้งานแล้ว";
          break;
        case "auth/invalid-email":
          message = "⚠️ รูปแบบอีเมลไม่ถูกต้อง";
          break;
        case "auth/weak-password":
          message = "🔒 รหัสผ่านอ่อนเกินไป (อย่างน้อย 6 ตัวอักษร)";
          break;
        case "auth/network-request-failed":
          message = "🌐 การเชื่อมต่อขัดข้อง โปรดลองอีกครั้ง";
          break;
      }
      showMessage(message, "red");
    }
  });

  function showMessage(text, color) {
    msgBox.style.color = color;
    msgBox.textContent = text;
  }
});
