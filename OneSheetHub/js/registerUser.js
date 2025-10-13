import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { app } from "./firebaseConfig.js";

const auth = getAuth(app);
const db = getFirestore(app);


async function registerUser(email, password, displayName, photoURL) {
  try {
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName, photoURL });
    
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

