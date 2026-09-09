import { app, auth, db } from "../firebase";
export async function inicializarProtecoes() {
  if (
    import.meta.env.DEV &&
    import.meta.env.VITE_FIREBASE_EMULATORS === "true"
  ) {
    const [{ connectAuthEmulator }, { connectFirestoreEmulator }] =
      await Promise.all([
        import("firebase/auth"),
        import("firebase/firestore"),
      ]);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    return;
  }
  if (import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY) {
    const { initializeAppCheck, ReCaptchaEnterpriseProvider } =
      await import("firebase/app-check");
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
      ),
      isTokenAutoRefreshEnabled: true,
    });
  }
}
