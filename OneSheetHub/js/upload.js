import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getAuth, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
  getFirestore, collection, addDoc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { 
  getStorage, ref, uploadBytes, getDownloadURL 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


onAuthStateChanged(auth, (user) => {
  if (!user) {
    alert("กรุณาเข้าสู่ระบบก่อนอัปโหลดชีท");
    window.location.href = "login.html";
  } else {
    document.getElementById("userEmail").textContent = user.email;
  }
});

const form = document.getElementById("uploadForm");
const previewImg = document.getElementById("previewImg");
const coverFileInput = document.getElementById("coverFile");
const sheetFileInput = document.getElementById("sheetFile");
const uploadMsg = document.getElementById("uploadMsg");


coverFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      previewImg.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = auth.currentUser;
  if (!user) {
    alert("กรุณาเข้าสู่ระบบก่อนอัปโหลด");
    return;
  }

  
  const year = document.getElementById("year").value;
  const semester = document.getElementById("semester").value;
  const faculty = document.getElementById("faculty").value;
  const major = document.getElementById("major").value;
  const sheetName = document.getElementById("sheetName").value.trim();
  const subjectCode = document.getElementById("subjectCode").value.trim();
  const author = document.getElementById("author").value.trim();
  const description = document.getElementById("description").value.trim();
  const price = parseFloat(document.getElementById("price").value);
  const coverFile = coverFileInput.files[0];
  const sheetFile = sheetFileInput.files[0];

  if (!sheetFile || !sheetName || !subjectCode) {
    alert("กรุณากรอกข้อมูลให้ครบและแนบไฟล์ชีท (PDF)");
    return;
  }

  uploadMsg.style.color = "black";
  uploadMsg.textContent = "⏳ กำลังอัปโหลด...";

  try {
    
    let coverUrl = ""; 
    if (coverFile) {
      const coverPath = `covers/${user.uid}_${Date.now()}_${coverFile.name}`;
      const coverRef = ref(storage, coverPath);
      await uploadBytes(coverRef, coverFile);
      coverUrl = await getDownloadURL(coverRef);
    }

    
    const sheetPath = `sheets/${user.uid}_${Date.now()}_${sheetFile.name}`;
    const sheetRef = ref(storage, sheetPath);
    await uploadBytes(sheetRef, sheetFile);
    const sheetURL = await getDownloadURL(sheetRef);

    
    await addDoc(collection(db, "sheets"), {
      sheetName,
      subjectCode,
      author,
      description,
      price,
      year,
      semester,
      faculty,
      major,
      ownerEmail: user.email,
      coverUrl,     
      sheetURL,
      storagePath: sheetPath,
      createdAt: new Date().toISOString()
    });

    uploadMsg.style.color = "green";
    uploadMsg.textContent = "✅ อัปโหลดสำเร็จ!";
    form.reset();
    previewImg.src = "../pic/placeholder.png";

  } catch (err) {
    console.error(err);
    uploadMsg.style.color = "red";
    uploadMsg.textContent = "❌ อัปโหลดล้มเหลว: " + err.message;
  }
});
