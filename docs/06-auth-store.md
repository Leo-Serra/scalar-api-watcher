# 06 — Auth Store (NgRx Signal Store)

---

## `auth.store.ts`

```typescript
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { signalStore, withState, withComputed, withMethods, withHooks } from '@ngrx/signals';
import { computed } from '@angular/core';
import {
  Auth,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
} from '@angular/fire/auth';
import { Firestore, doc, setDoc, serverTimestamp } from '@angular/fire/firestore';

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

  withMethods((store, auth = inject(Auth), firestore = inject(Firestore), router = inject(Router)) => ({

    // Inizializza listener auth state — chiamato in withHooks
    initAuthListener(): void {
      onAuthStateChanged(auth, (user) => {
        store._patchState({ user, initialized: true });
        if (!user) router.navigate(['/login']);
      });
    },

    async loginWithEmail(email: string, password: string): Promise<void> {
      store._patchState({ loading: true, error: null });
      try {
        const { user } = await signInWithEmailAndPassword(auth, email, password);
        await _saveProfile(firestore, user);
        await router.navigate(['/dashboard']);
      } catch (err) {
        store._patchState({ error: mapFirebaseError(err) });
      } finally {
        store._patchState({ loading: false });
      }
    },

    async loginWithGoogle(): Promise<void> {
      store._patchState({ loading: true, error: null });
      try {
        const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
        await _saveProfile(firestore, user);
        await router.navigate(['/dashboard']);
      } catch (err) {
        store._patchState({ error: mapFirebaseError(err) });
      } finally {
        store._patchState({ loading: false });
      }
    },

    async logout(): Promise<void> {
      await signOut(auth);
      store._patchState({ user: null });
      await router.navigate(['/login']);
    },

    clearError(): void {
      store._patchState({ error: null });
    },
  })),

  withHooks({
    onInit(store) {
      store.initAuthListener();
    },
  })
);

// ─── Helpers privati ─────────────────────────────────────────────────────────

async function _saveProfile(firestore: Firestore, user: User): Promise<void> {
  await setDoc(
    doc(firestore, `users/${user.uid}`),
    {
      email: user.email,
      displayName: user.displayName ?? user.email?.split('@')[0] ?? 'User',
      lastLogin: serverTimestamp(),
    },
    { merge: true }
  );
}

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
```

---

## `auth.guard.ts`

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../../store/auth.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  if (store.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};
```

---

## `login.component.ts`

```typescript
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">

        <h1 class="text-2xl font-bold text-gray-900 mb-1">API Watcher</h1>
        <p class="text-gray-500 text-sm mb-8">Accedi per continuare</p>

        @if (store.error()) {
          <div class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
            {{ store.error() }}
          </div>
        }

        <div class="space-y-4 mb-6">
          <input
            type="email"
            [(ngModel)]="email"
            placeholder="Email"
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            [(ngModel)]="password"
            placeholder="Password"
            class="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            (keyup.enter)="loginEmail()"
          />
          <button
            (click)="loginEmail()"
            [disabled]="store.loading()"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            {{ store.loading() ? 'Accesso...' : 'Accedi' }}
          </button>
        </div>

        <div class="relative mb-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-200"></div>
          </div>
          <div class="relative flex justify-center text-xs text-gray-400 bg-white">
            <span class="px-3">oppure</span>
          </div>
        </div>

        <button
          (click)="store.loginWithGoogle()"
          [disabled]="store.loading()"
          class="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Accedi con Google
        </button>

      </div>
    </div>
  `,
})
export class LoginComponent {
  store = inject(AuthStore);
  email = '';
  password = '';

  loginEmail(): void {
    if (this.email && this.password) {
      this.store.loginWithEmail(this.email, this.password);
    }
  }
}
```
