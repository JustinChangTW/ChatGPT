import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';

export type AppUserRole = 'admin' | 'member' | 'guest';

export async function getCurrentUserRole(): Promise<AppUserRole> {
  if (!auth?.currentUser || !db) return 'guest';
  const uid = auth.currentUser.uid;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    await setDoc(
      doc(db, 'users', uid),
      {
        role: 'member',
        roleUpdatedAt: serverTimestamp()
      },
      { merge: true }
    );
    return 'member';
  }
  const rawRole = snap.data()?.role;
  if (rawRole === 'admin' || rawRole === 'member') return rawRole;
  return 'member';
}

export async function requireAdminRole(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const role = await getCurrentUserRole();
  if (role !== 'admin') return { ok: false, reason: '僅限管理者操作。請先在 users/{uid}.role 設定為 admin。' };
  return { ok: true };
}
