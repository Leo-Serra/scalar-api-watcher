import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../store/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
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
