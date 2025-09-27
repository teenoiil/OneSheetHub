// functions/index.js
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { genCode, sha256 } from './lib/otp.js';
import { sendCodeMail } from './lib/mailer.js';

// === ใช้บักเก็ต firebasestorage.app ให้ตรงกับฝั่งอัปโหลด ===
const BUCKET_NAME = 'project-sharesheet2.firebasestorage.app';
initializeApp({ storageBucket: BUCKET_NAME });

const db = getFirestore();
const bucket = getStorage().bucket(BUCKET_NAME);

const ADMIN_KEY = defineSecret('ADMIN_KEY');
const MAIL_USER = defineSecret('MAIL_USER');
const MAIL_PASS = defineSecret('MAIL_PASS');

const CODE_TTL_MIN = 10;
const SIGNED_URL_TTL_MIN = 5;

function setCors(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // 👈 ต้องมี GET
  res.set('Access-Control-Max-Age', '3600');
}

/* ---------------- rotate: ออก OTP ให้ผู้ใช้ ---------------- */
export const rotate = onRequest({ secrets: [ADMIN_KEY, MAIL_USER, MAIL_PASS] }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const adminKeyHeader = req.headers['x-admin-key'];
    if (!adminKeyHeader || adminKeyHeader !== ADMIN_KEY.value()) {
      return res.status(401).send('Unauthorized');
    }

    const { fileId, toEmail } = req.body || {};
    if (!fileId || !toEmail) return res.status(400).send('Missing fileId or toEmail');

    const sheetRef = db.collection('sheets').doc(fileId);
    const sheetSnap = await sheetRef.get();
    if (!sheetSnap.exists) return res.status(404).send('fileId not found');
    const sheet = sheetSnap.data();

    const code = genCode(6);
    const codeSha = sha256(code);
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + CODE_TTL_MIN * 60 * 1000));

    await db.collection('oneTimeCodes').add({
      codeSha, fileId, expiresAt,
      maxUses: 1, usedCount: 0,
      issuedToEmail: toEmail,
      createdBy: 'admin',
      createdAt: Timestamp.now(),
    });

    await sendCodeMail(toEmail, code, sheet?.sheetName || '');
    return res.json({ ok: true, expiresAt: expiresAt.toDate().toISOString() });
  } catch (e) {
    console.error('rotate error:', e);
    return res.status(500).send('Server error');
  }
});

/* -------------- verify: ตรวจ OTP + บันทึก entitlement -------------- */
export const verify = onRequest({ secrets: [MAIL_USER] }, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');
    if (!token) return res.status(401).send('Missing token');

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { fileId, code } = req.body || {};
    if (!fileId || !code) return res.status(400).send('Missing fileId or code');

    const codeSha = sha256(code);
    const q = await db.collection('oneTimeCodes')
      .where('codeSha', '==', codeSha)
      .where('fileId', '==', fileId)
      .limit(1).get();

    if (q.empty) return res.status(400).send('รหัสไม่ถูกต้อง');
    const codeRef = q.docs[0].ref;

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(codeRef);
      const d = snap.data();
      const now = Timestamp.now();

      if (d.expiresAt.toMillis() < now.toMillis()) throw new Error('รหัสหมดอายุ');
      if ((d.usedCount || 0) >= (d.maxUses || 1)) throw new Error('รหัสถูกใช้แล้ว');

      const entRef = db.collection('entitlements').doc(`${uid}__${fileId}`);
      tx.set(entRef, {
        userId: uid, fileId, grantedAt: now,
        grantSource: 'code', codeRef: codeRef.path,
      });

      tx.update(codeRef, {
        usedCount: FieldValue.increment(1),
        lastUsedBy: uid, lastUsedAt: now,
      });
    });

    // ไม่ต้องคืนลิงก์แล้ว (ไปอ่านผ่าน streamFile)
    return res.json({ ok: true });
  } catch (e) {
    console.error('verify error:', e);
    const msg = /หมดอายุ|ถูกใช้แล้ว/.test(e.message) ? e.message : 'ตรวจรหัสล้มเหลว';
    return res.status(400).send(msg);
  }
});

/* -------------- geturl: (ถ้าจะใช้ที่อื่น) ยังเก็บไว้ได้ -------------- */
export const geturl = onRequest({}, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const authHeader = req.headers.authorization || '';
    const [, token] = authHeader.split(' ');
    if (!token) return res.status(401).send('Missing token');

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { fileId } = req.body || {};
    if (!fileId) return res.status(400).send('Missing fileId');

    const entitlementRef = db.collection('entitlements').doc(`${uid}__${fileId}`);
    const entSnap = await entitlementRef.get();
    if (!entSnap.exists) return res.status(403).send('คุณไม่มีสิทธิ์ดูชีทนี้');

    const sheetSnap = await db.collection('sheets').doc(fileId).get();
    const { storagePath } = sheetSnap.data() || {};
    if (!storagePath) return res.status(500).send('missing storagePath');

    const file = bucket.file(storagePath);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MIN * 60 * 1000,
    });

    return res.json({ ok: true, url });
  } catch (e) {
    console.error('geturl error:', e);
    return res.status(500).send('เกิดข้อผิดพลาด');
  }
});

/* -------------- streamFile: สตรีม PDF แบบตรวจสิทธิ์ -------------- */
export const streamFile = onRequest({}, async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).send('Missing token');

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const fileId = String(req.query.fileId || '').trim();
    if (!fileId) return res.status(400).send('Missing fileId');

    const entSnap = await db.collection('entitlements').doc(`${uid}__${fileId}`).get();
    if (!entSnap.exists) return res.status(403).send('คุณไม่มีสิทธิ์ดูไฟล์นี้');

    const sheetSnap = await db.collection('sheets').doc(fileId).get();
    const { storagePath } = sheetSnap.data() || {};
    if (!storagePath) return res.status(500).send('missing storagePath');

    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send('file not found');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline'); // ไม่บังคับ download
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    file.createReadStream()
      .on('error', (e) => {
        console.error('stream error:', e);
        if (!res.headersSent) res.status(500).end();
      })
      .pipe(res);

  } catch (e) {
    console.error('streamFile error:', e);
    return res.status(500).send('เกิดข้อผิดพลาด');
  }
});
