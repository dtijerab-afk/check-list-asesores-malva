import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp
} from "firebase/firestore";
import { EvalSession } from "./constants";

const firebaseConfig = {
  apiKey: "AIzaSyDaUegcGuCzRXdro3akqpFFN-cNploVs-E",
  authDomain: "malva-evaluacion.firebaseapp.com",
  projectId: "malva-evaluacion",
  storageBucket: "malva-evaluacion.firebasestorage.app",
  messagingSenderId: "223572518464",
  appId: "1:223572518464:web:0844e9b4b05c5f414661a5"
};

const COL = "evaluaciones";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function fetchSessionsFromFirebase(): Promise<{
  sessions: EvalSession[];
  synced: boolean;
}> {
  try {
    const q = query(collection(db, COL), orderBy("created_at", "desc"));
    const snap = await getDocs(q);
    const sessions: EvalSession[] = snap.docs.map((d) => {
      const r = d.data();
      return {
        id: r.id,
        asesor: r.asesor,
        fecha: r.fecha,
        evaluador: r.evaluador,
        b1Score: r.b1Score ?? null,
        b2Score: r.b2Score ?? null,
        finalScore: r.finalScore ?? null,
        b1Data: r.b1Data || {},
        b2Data: r.b2Data || {},
        selBrands: r.selBrands || [],
        week: r.week,
        month: r.month,
        sigAsesor: r.sigAsesor || "",
        sigEvaluador: r.sigEvaluador || "",
        fireId: d.id
      };
    });
    localStorage.setItem("malva_sessions", JSON.stringify(sessions));
    return { sessions, synced: true };
  } catch (e) {
    console.error("Firebase load error:", e);
    try {
      const local = JSON.parse(localStorage.getItem("malva_sessions") || "[]");
      return { sessions: local, synced: false };
    } catch {
      return { sessions: [], synced: false };
    }
  }
}

export async function saveSessionToFirebase(session: EvalSession): Promise<boolean> {
  try {
    const data = {
      id: session.id,
      asesor: session.asesor,
      fecha: session.fecha,
      evaluador: session.evaluador,
      b1Score: session.b1Score,
      b2Score: session.b2Score,
      finalScore: session.finalScore,
      b1Data: session.b1Data,
      b2Data: session.b2Data,
      selBrands: session.selBrands,
      week: session.week,
      month: session.month,
      sigAsesor: session.sigAsesor,
      sigEvaluador: session.sigEvaluador,
      created_at: serverTimestamp()
    };
    const ref = await addDoc(collection(db, COL), data);
    session.fireId = ref.id;
    return true;
  } catch (e) {
    console.error("Firebase save error:", e);
    return false;
  }
}

export async function deleteSessionFromFirebase(session: EvalSession): Promise<boolean> {
  try {
    if (session.fireId) {
      await deleteDoc(doc(db, COL, session.fireId));
    } else {
      const q = query(collection(db, COL), where("id", "==", session.id));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    }
    return true;
  } catch (e) {
    console.error("Firebase delete error:", e);
    return false;
  }
}
