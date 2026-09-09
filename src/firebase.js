/* global __SEDUC_CLIENTE__ */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// A configuração pública é selecionada no build; credenciais Admin nunca entram aqui.
const cliente = __SEDUC_CLIENTE__;
const emulador =
  import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === "true";
const firebaseConfig = emulador
  ? {
      projectId: "demo-seduc",
      apiKey: "demo-seduc",
      authDomain: "demo-seduc.firebaseapp.com",
      appId: "demo-seduc",
    }
  : cliente.firebase;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
export { app, auth, db, storage, cliente };
