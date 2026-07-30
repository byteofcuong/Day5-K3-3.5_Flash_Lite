import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

function firebaseApp() {
  if (getApps().length) return getApps()[0];
  if (!isFirebaseConfigured()) throw new Error("Firebase chưa được cấu hình.");
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });
}

export function db() {
  return getFirestore(firebaseApp());
}

export async function listDocuments({ ownerId, includeUnavailable = false } = {}) {
  let query = db().collection("documents");
  if (ownerId) query = query.where("ownerId", "==", ownerId);
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((doc) => includeUnavailable || doc.available === true)
    .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
}

export async function getDocument(documentId, includeUnavailable = false) {
  const snapshot = await db().collection("documents").doc(documentId).get();
  if (!snapshot.exists) return null;
  const document = { id: snapshot.id, ...snapshot.data() };
  return includeUnavailable || document.available === true ? document : null;
}

export async function saveDocument(document) {
  const reference = document.id ? db().collection("documents").doc(document.id) : db().collection("documents").doc();
  const { id, ...data } = document;
  await reference.set(data, { merge: true });
  return { id: reference.id, ...data };
}

export async function seedDocuments(documents) {
  const batch = db().batch();
  for (const document of documents) {
    const { id, ...data } = document;
    batch.set(db().collection("documents").doc(id), data, { merge: true });
  }
  await batch.commit();
}

export async function findUserByEmail(email) {
  const snapshot = await db().collection("users").where("email", "==", email.toLowerCase()).limit(1).get();
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function getUser(userId) {
  const snapshot = await db().collection("users").doc(userId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createUser(data, id) {
  const reference = id ? db().collection("users").doc(id) : db().collection("users").doc();
  await reference.set(data, { merge: true });
  return { id: reference.id, ...data };
}

export async function createSession(data) {
  const reference = db().collection("sessions").doc();
  await reference.set(data);
  return reference.id;
}

export async function getSession(sessionId) {
  const snapshot = await db().collection("sessions").doc(sessionId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function revokeSession(sessionId) {
  await db().collection("sessions").doc(sessionId).set({ revoked: true, revokedAt: new Date().toISOString() }, { merge: true });
}

export async function savePost(post) {
  const reference = post.id ? db().collection("posts").doc(post.id) : db().collection("posts").doc();
  const { id, ...data } = post;
  await reference.set(data, { merge: true });
  return { id: reference.id, ...data };
}

export async function listTopContributors(limit = 5) {
  const [postsSnapshot, usersSnapshot] = await Promise.all([
    db().collection("posts").where("status", "==", "published").get(),
    db().collection("users").where("status", "==", "active").get(),
  ]);
  const users = new Map(usersSnapshot.docs.map((snapshot) => [
    snapshot.id,
    { id: snapshot.id, ...snapshot.data() },
  ]));
  const activity = new Map();
  for (const snapshot of postsSnapshot.docs) {
    const post = snapshot.data();
    if (!post.authorId || !users.has(post.authorId)) continue;
    const current = activity.get(post.authorId) || { postCount: 0, latestPostAt: "" };
    current.postCount += 1;
    current.latestPostAt = String(post.createdAt || "") > current.latestPostAt
      ? String(post.createdAt || "")
      : current.latestPostAt;
    activity.set(post.authorId, current);
  }
  return [...activity.entries()]
    .map(([userId, stats]) => {
      const user = users.get(userId);
      return {
        userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || "",
        bio: user.bio || "",
        role: user.role,
        ...stats,
      };
    })
    .sort((a, b) => b.postCount - a.postCount || b.latestPostAt.localeCompare(a.latestPostAt))
    .slice(0, Math.min(10, Math.max(1, Number(limit) || 5)));
}

export async function saveInteraction(userId, documentId, type, enabled) {
  const id = `${userId}_${documentId}_${type}`;
  const reference = db().collection("documentInteractions").doc(id);
  if (!enabled) {
    await reference.delete();
    return { enabled: false };
  }
  await reference.set({ userId, documentId, type, createdAt: new Date().toISOString() });
  return { enabled: true };
}

export async function incrementDownload(documentId) {
  await db().collection("documents").doc(documentId).update({ downloadCount: FieldValue.increment(1) });
}

export async function uploadDocumentFile(path, buffer, contentType) {
  if (!process.env.FIREBASE_STORAGE_BUCKET) throw new Error("FIREBASE_STORAGE_BUCKET chưa được cấu hình.");
  const file = getStorage(firebaseApp()).bucket().file(path);
  await file.save(buffer, { contentType, resumable: false });
  return file.name;
}
