import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const localCatalog = JSON.parse(fs.readFileSync(path.join(root, "data/catalog.json"), "utf8"));

const localUsers = new Map();
const localSessions = new Map();
const localDocs = new Map(localCatalog.map(d => [d.id, { ...d }]));
const localPosts = new Map();
const localInteractions = new Map();

localUsers.set("viet@vshare.local", {
  id: "user_viet",
  email: "viet@vshare.local",
  displayName: "Việt",
  passwordHash: "$2a$12$K8/g.dG6L86E1Z.pG3u.lOaB4PjO8Wv0h5F/pZk3J9z8e4b7c6d5e",
  role: "member",
  status: "active",
  bio: "Thành viên VShare",
  createdAt: new Date().toISOString()
});
localUsers.set("admin@vshare.local", {
  id: "user_admin",
  email: "admin@vshare.local",
  displayName: "Quản trị viên",
  passwordHash: "$2a$12$K8/g.dG6L86E1Z.pG3u.lOaB4PjO8Wv0h5F/pZk3J9z8e4b7c6d5e",
  role: "admin",
  status: "active",
  bio: "Quản trị viên VShare",
  createdAt: new Date().toISOString()
});

export function isFirebaseConfigured() {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

let fbApp = null;
let fbDb = null;

export function db() {
  if (!isFirebaseConfigured()) throw new Error("Firebase chưa được cấu hình trong môi trường local.");
  return fbDb;
}

export async function getDb() {
  if (!isFirebaseConfigured()) return null;
  if (!fbDb) {
    try {
      const fbAdmin = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      if (fbAdmin.getApps().length) {
        fbApp = fbAdmin.getApps()[0];
      } else {
        fbApp = fbAdmin.initializeApp({
          credential: fbAdmin.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
          projectId: process.env.FIREBASE_PROJECT_ID,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
        });
      }
      fbDb = getFirestore(fbApp);
    } catch {
      return null;
    }
  }
  return fbDb;
}

export async function listDocuments({ ownerId, includeUnavailable = false } = {}) {
  const db = await getDb();
  if (db) {
    let query = db.collection("documents");
    if (ownerId) query = query.where("ownerId", "==", ownerId);
    const snapshot = await query.get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((doc) => includeUnavailable || doc.available === true)
      .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  }

  return [...localDocs.values()]
    .filter((doc) => includeUnavailable || doc.available === true)
    .filter((doc) => !ownerId || doc.ownerId === ownerId)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function getDocument(documentId, includeUnavailable = false) {
  const db = await getDb();
  if (db) {
    const snapshot = await db.collection("documents").doc(documentId).get();
    if (!snapshot.exists) return null;
    const document = { id: snapshot.id, ...snapshot.data() };
    return includeUnavailable || document.available === true ? document : null;
  }
  const doc = localDocs.get(documentId);
  if (!doc) return null;
  return includeUnavailable || doc.available === true ? doc : null;
}

export async function saveDocument(document) {
  const db = await getDb();
  const id = document.id || `doc_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const saved = { id, ...document };
  if (db) {
    const { id: docId, ...data } = saved;
    await db.collection("documents").doc(docId).set(data, { merge: true });
  }
  localDocs.set(id, saved);
  return saved;
}

export async function seedDocuments(documents) {
  const db = await getDb();
  if (db) {
    const batch = db.batch();
    for (const document of documents) {
      const { id, ...data } = document;
      batch.set(db.collection("documents").doc(id), data, { merge: true });
    }
    await batch.commit();
  }
  for (const doc of documents) {
    localDocs.set(doc.id, doc);
  }
}

export async function findUserByEmail(email) {
  const db = await getDb();
  const normEmail = email.toLowerCase().trim();
  if (db) {
    const snapshot = await db.collection("users").where("email", "==", normEmail).limit(1).get();
    if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
  return localUsers.get(normEmail) || null;
}

export async function getUser(userId) {
  const db = await getDb();
  if (db) {
    const snapshot = await db.collection("users").doc(userId).get();
    if (snapshot.exists) return { id: snapshot.id, ...snapshot.data() };
  }
  for (const u of localUsers.values()) {
    if (u.id === userId) return u;
  }
  return null;
}

export async function createUser(data, id) {
  const db = await getDb();
  const userId = id || `user_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  const user = { id: userId, ...data };
  if (db) {
    await db.collection("users").doc(userId).set(data, { merge: true });
  }
  localUsers.set(data.email.toLowerCase(), user);
  return user;
}

export async function createSession(data) {
  const db = await getDb();
  const sessionId = `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const session = { id: sessionId, ...data };
  if (db) {
    await db.collection("sessions").doc(sessionId).set(data);
  }
  localSessions.set(sessionId, session);
  return sessionId;
}

export async function getSession(sessionId) {
  const db = await getDb();
  if (db) {
    const snapshot = await db.collection("sessions").doc(sessionId).get();
    if (snapshot.exists) return { id: snapshot.id, ...snapshot.data() };
  }
  return localSessions.get(sessionId) || null;
}

export async function revokeSession(sessionId) {
  const db = await getDb();
  if (db) {
    await db.collection("sessions").doc(sessionId).set({ revoked: true, revokedAt: new Date().toISOString() }, { merge: true });
  }
  const sess = localSessions.get(sessionId);
  if (sess) sess.revoked = true;
}

export async function savePost(post) {
  const db = await getDb();
  const id = post.id || `post_${Date.now()}`;
  const saved = { id, ...post };
  if (db) {
    await db.collection("posts").doc(id).set(post, { merge: true });
  }
  localPosts.set(id, saved);
  return saved;
}

export async function listTopContributors(limit = 5) {
  const db = await getDb();
  if (db) {
    const [postsSnapshot, usersSnapshot] = await Promise.all([
      db.collection("posts").where("status", "==", "published").get(),
      db.collection("users").where("status", "==", "active").get(),
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

  return [
    { userId: "user_admin", displayName: "Quản trị viên", avatarUrl: "", bio: "Quản trị viên VShare", role: "admin", postCount: 4, latestPostAt: new Date().toISOString() },
    { userId: "user_viet", displayName: "Việt", avatarUrl: "", bio: "Thành viên VShare", role: "member", postCount: 2, latestPostAt: new Date().toISOString() }
  ];
}

export async function saveInteraction(userId, documentId, type, enabled) {
  const id = `${userId}_${documentId}_${type}`;
  const db = await getDb();
  if (db) {
    const reference = db.collection("documentInteractions").doc(id);
    if (!enabled) {
      await reference.delete();
      return { enabled: false };
    }
    await reference.set({ userId, documentId, type, createdAt: new Date().toISOString() });
    return { enabled: true };
  }
  if (!enabled) {
    localInteractions.delete(id);
    return { enabled: false };
  }
  localInteractions.set(id, { userId, documentId, type, createdAt: new Date().toISOString() });
  return { enabled: true };
}

export async function incrementDownload(documentId) {
  const db = await getDb();
  if (db) {
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("documents").doc(documentId).update({ downloadCount: FieldValue.increment(1) });
  }
}
