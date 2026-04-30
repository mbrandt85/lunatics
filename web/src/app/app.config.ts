import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';

import { routes } from './app.routes';

const firebaseConfig = {
  apiKey: "AIzaSyChTOlqRkkG556VSV_lC6ez34LiDGaTYLU",
  authDomain: "lunatics-d8b5a.firebaseapp.com",
  projectId: "lunatics-d8b5a",
  storageBucket: "lunatics-d8b5a.firebasestorage.app",
  messagingSenderId: "830172908677",
  appId: "1:830172908677:web:bc12d57413a77c90b52dec",
  measurementId: "G-MHZVRLL36R"
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideFirebaseApp(() => initializeApp(firebaseConfig)),
    provideFirestore(() => {
      const db = getFirestore();
      if (location.hostname === 'localhost') {
        connectFirestoreEmulator(db, 'localhost', 8080);
      }
      return db;
    })
  ]
};
