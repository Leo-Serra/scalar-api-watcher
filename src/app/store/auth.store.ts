import { signalStore, withState, withComputed, withMethods } from '@ngrx/signals';
import { computed } from '@angular/core';

interface AuthState {
  user: { uid: string; email: string; displayName: string | null } | null;
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
  withState(initialState),
  withComputed((state) => ({
    isLoggedIn: computed(() => state.user() !== null),
    uid: computed(() => state.user()?.uid ?? null),
    displayName: computed(
      () => state.user()?.displayName ?? state.user()?.email?.split('@')[0] ?? null
    ),
    email: computed(() => state.user()?.email ?? null),
  })),
  withMethods(() => ({
    // Methods will be implemented in Phase 5
  }))
);
