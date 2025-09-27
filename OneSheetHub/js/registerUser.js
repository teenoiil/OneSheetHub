import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from "./firebaseConfig.js";

const auth = getAuth(app);
const db = getFirestore(app);

// ตัวอย่างฟังก์ชันสมัครสมาชิกและบันทึกข้อมูล user ลง Firestore
async function registerUser(email, password, displayName, photoURL) {
  try {
    // สมัครสมาชิกกับ Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // อัปเดตโปรไฟล์ใน Auth
    await updateProfile(user, { displayName, photoURL });
    // สร้างข้อมูล user ใน Firestore (collection 'users', id เป็น uid)
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      photoURL: photoURL || "",
      createdAt: new Date().toISOString()
    });
    alert("สมัครสมาชิกสำเร็จ!");
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
}

// ตัวอย่างการเรียกใช้
// registerUser("test1@gmail.com", "password123", "Sataporn Matroeng", "https://your-image-url.jpg");
