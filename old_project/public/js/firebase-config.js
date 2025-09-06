// Firebase Configuration
// Note: These credentials are safe for client-side use and meant to be public
const firebaseConfig = {
  apiKey: "AIzaSyCQR37uq-MVrMhzhA5RN3GlZQ5boc3oAsU",
  authDomain: "daily-ai-3b51f.firebaseapp.com",
  projectId: "daily-ai-3b51f",
  storageBucket: "daily-ai-3b51f.firebasestorage.app",
  messagingSenderId: "913184794448",
  appId: "1:913184794448:web:12df81811e74731886ae55"
};

// Simple environment detection
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

// Export configuration
export { firebaseConfig, isDevelopment };