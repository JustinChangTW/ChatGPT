import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export type FirebaseSessionFailReason = 'firebase-not-configured' | 'auth-failed';

export async function ensureFirebaseUser(): Promise<
  | { ok: true; uid: string; mode: 'existing' | 'anonymous' }
  | { ok: false; reason: FirebaseSessionFailReason; error?: string }
> {
  if (!auth) return { ok: false, reason: 'firebase-not-configured' };
  if (auth.currentUser) return { ok: true, uid: auth.currentUser.uid, mode: 'existing' };

  try {
    const cred = await signInAnonymously(auth);
    return { ok: true, uid: cred.user.uid, mode: 'anonymous' };
  } catch (err) {
    return {
      ok: false,
      reason: 'auth-failed',
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
