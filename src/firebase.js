// Firebase setup for DocuTrack.
//
// 1. Go to https://console.firebase.google.com, create a free project.
// 2. In the project, go to Build > Firestore Database > Create database
//    (start in "test mode" for development, lock it down before real use —
//    see the security rules note at the bottom of this file).
// 3. Go to Project Settings > General > Your apps > Add app > Web app.
// 4. Copy the config values Firebase gives you into a ".env" file at the
//    project root (copy ".env.example" to ".env" and fill it in).

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// DocuTrack stores each "collection" (requests, staff, notifications,
// settings) as a single Firestore document holding a JSON array — this
// mirrors the shape the app already expects, so the rest of the app code
// barely has to change from the artifact version.

export async function loadCollection(key) {
  const snap = await getDocs(collection(db, "docutrack_" + key));
  const items = [];
  snap.forEach((d) => items.push(d.data()));
  return items;
}

export async function saveItem(key, item) {
  await setDoc(doc(db, "docutrack_" + key, item.id || item.ref || item.username), item);
}

export async function deleteItem(key, id) {
  await deleteDoc(doc(db, "docutrack_" + key, id));
}

export async function saveSingleton(key, value) {
  await setDoc(doc(db, "docutrack_" + key, "config"), { value });
}

export async function loadSingleton(key) {
  const items = await loadCollection(key);
  return items[0] || null;
}

export function subscribeCollection(key, callback) {
  return onSnapshot(collection(db, "docutrack_" + key), (snap) => {
    const items = [];
    snap.forEach((d) => items.push(d.data()));
    callback(items);
  });
}

/*
SECURITY RULES — paste this into Firebase Console > Firestore Database > Rules
before putting real student data in this app:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /docutrack_requests/{id} {
      allow read, write: if true;
    }
    match /docutrack_staff/{id} {
      allow read, write: if true;
    }
    match /docutrack_notifications/{id} {
      allow read, write: if true;
    }
    match /docutrack_settings/{id} {
      allow read, write: if true;
    }
    match /docutrack_owner/{id} {
      allow read, write: if true;
    }
    match /docutrack_auditlog/{id} {
      allow read, write: if true;
    }
    match /docutrack_surveys/{id} {
      allow read, write: if true;
    }
  }
}

This starter setup is fine for a thesis pilot with a small trusted group.
Before any real production rollout, add Firebase Authentication for staff
accounts instead of the current custom username/password check, and update
these rules to require an authenticated staff user for writes.
*/
