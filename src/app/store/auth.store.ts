import { inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { FirebaseService } from '../core/services/firebase.service';
import { patchState } from '@ngrx/signals';

/**
 * `initialized` diventa true dopo il primo callback di `onAuthStateChanged`,
 * permettendo ai componenti di distinguere "non ancora verificato" da "non loggato".
 */
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  initialized: false,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState<AuthState>(initialState),

  withComputed(({ user }) => ({
    isLoggedIn: computed(() => user() !== null),
    uid: computed(() => user()?.uid ?? null),
    displayName: computed(() => user()?.displayName ?? user()?.email?.split('@')[0] ?? null),
    email: computed(() => user()?.email ?? null),
  })),

  withMethods((store) => {
    const fb = inject(FirebaseService);
    const router = inject(Router);

    return {
      /** Sottoscrive `onAuthStateChanged`; redirige a /login al logout. */
      initAuthListener(): void {
        onAuthStateChanged(fb.auth, (user) => {
          patchState(store, { user, initialized: true });
          if (!user) router.navigate(['/login']);
        });
      },

      /**
       * Effettua il login con email e password. Redirige a /dashboard in caso di successo.
       * @param email - Email dell'utente
       * @param password - Password dell'utente
       */
      async loginWithEmail(email: string, password: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const { user } = await signInWithEmailAndPassword(fb.auth, email, password);
          await saveProfile(fb, user);
          await router.navigate(['/dashboard']);
        } catch (err) {
          patchState(store, { error: mapFirebaseError(err) });
        } finally {
          patchState(store, { loading: false });
        }
      },

      /** Effettua il login con Google popup. Redirige a /dashboard in caso di successo. */
      async loginWithGoogle(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const { user } = await signInWithPopup(fb.auth, new GoogleAuthProvider());
          await saveProfile(fb, user);
          await router.navigate(['/dashboard']);
        } catch (err) {
          patchState(store, { error: mapFirebaseError(err) });
        } finally {
          patchState(store, { loading: false });
        }
      },

      /** Effettua il logout e redirige a /login. */
      async logout(): Promise<void> {
        await signOut(fb.auth);
        patchState(store, { user: null });
        await router.navigate(['/login']);
      },

      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),

  withHooks({
    onInit(store) {
      store.initAuthListener();
    },
  }),
);

/**
 * Scrive/aggiorna il profilo utente in Firestore con merge, così lastLogin è sempre fresco.
 * @param fb - Istanza del FirebaseService
 * @param user - Oggetto User di Firebase Auth
 */
async function saveProfile(fb: FirebaseService, user: User): Promise<void> {
  await setDoc(
    doc(fb.firestore, `users/${user.uid}`),
    {
      email: user.email,
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
      lastLogin: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Mappa i codici errore Firebase Auth in messaggi italiani user-friendly.
 * @param err - Errore catturato (tipicamente un FirebaseError)
 * @returns Messaggio di errore localizzato in italiano
 */
function mapFirebaseError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/user-not-found': 'Utente non trovato',
    'auth/wrong-password': 'Password non corretta',
    'auth/invalid-email': 'Email non valida',
    'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
    'auth/popup-closed-by-user': 'Accesso annullato',
  };
  return map[code] ?? 'Errore di accesso. Riprova.';
}
