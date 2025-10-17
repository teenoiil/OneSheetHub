import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import firebaseConfig from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const viewerContainer = document.getElementById("viewerContainer");
const messageBox = document.getElementById("messageBox");
const pageInfo = document.getElementById("pageInfo");
const toolbar = document.querySelector(".toolbar");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const watermark = document.querySelector(".watermark");
let pdfViewer;

const showMessage = (msg) => {
  toolbar.style.display = "none";
  viewerContainer.style.display = "none";
  messageBox.style.display = "block";
  messageBox.textContent = msg;
  console.log("💬", msg);
};

const updatePageInfo = () => {
  if (pdfViewer && pdfViewer.pagesCount) {
    pageInfo.textContent = `หน้า ${pdfViewer.currentPageNumber} / ${pdfViewer.pagesCount}`;
  }
};


prevBtn.onclick = () => {
  if (pdfViewer && pdfViewer.currentPageNumber > 1) {
    pdfViewer.currentPageNumber--;
    updatePageInfo();
  }
};
nextBtn.onclick = () => {
  if (pdfViewer && pdfViewer.currentPageNumber < pdfViewer.pagesCount) {
    pdfViewer.currentPageNumber++;
    updatePageInfo();
  }
};


onAuthStateChanged(auth, async (user) => {
  if (!user) return showMessage("⚠️ กรุณาเข้าสู่ระบบก่อน");

  try {
    const fileId = new URLSearchParams(window.location.search).get("id");
    if (!fileId) return showMessage("❌ ไม่พบรหัสไฟล์ใน URL");

    showMessage("⏳ กำลังโหลดเอกสาร...");

    const token = await user.getIdToken(true);
    const streamUrl = `https://us-central1-project-sharesheet2.cloudfunctions.net/streamFile?fileId=${encodeURIComponent(fileId)}`;

    const response = await fetch(streamUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`ไม่สามารถโหลดไฟล์ (HTTP ${response.status})`);
    const pdfData = await response.arrayBuffer();

    messageBox.style.display = "none";
    viewerContainer.style.display = "block";
    toolbar.style.display = "flex";

    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const eventBus = new pdfjsViewer.EventBus();
    const linkService = new pdfjsViewer.PDFLinkService({ eventBus });

    pdfViewer = new pdfjsViewer.PDFViewer({ container: viewerContainer, eventBus, linkService });
    linkService.setViewer(pdfViewer);
    pdfViewer.setDocument(pdf);
    linkService.setDocument(pdf, null);

    eventBus.on("pagesinit", () => {
      pdfViewer.currentScaleValue = "page-width";
      updatePageInfo();
    });

    viewerContainer.addEventListener("pagechange", updatePageInfo, true);


    watermark.textContent = `ห้ามบันทึก/คัดลอก เอกสาร\n${user.email}`;

    console.log("✅ โหลด PDF สำเร็จ:", pdf.numPages, "หน้า");

  } catch (err) {
    console.error("❌ [PDF Error]:", err);
    showMessage("เกิดข้อผิดพลาด: " + err.message);
  }
});


const forbiddenKeys = ['s','p','c','x','a','u','i'];
document.addEventListener('keydown', e => {
  if (e.ctrlKey && forbiddenKeys.includes(e.key.toLowerCase())) { e.preventDefault(); alert(" คำสั่งถูกป้องกัน"); }
  if (e.key === 'F12') { e.preventDefault(); alert(" เปิด DevTools ไม่ได้"); }
});
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('copy', e => e.preventDefault());
document.addEventListener('cut', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('mousedown', e => { if(e.detail>1) e.preventDefault(); });


window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => e.preventDefault());


let devtoolsOpen = false;
const threshold = 160;
const checkDevTools = () => {
  const widthDiff = window.outerWidth - window.innerWidth > threshold;
  const heightDiff = window.outerHeight - window.innerHeight > threshold;
  if(widthDiff || heightDiff) { devtoolsOpen = true; location.reload(); }
};
setInterval(checkDevTools, 1000);


window.addEventListener('beforeprint', e => e.preventDefault());
window.addEventListener('keyup', e => {
  if (e.ctrlKey && e.key.toLowerCase() === 'p') e.preventDefault();
});
