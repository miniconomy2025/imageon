import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyBoiSyJdsWHqm_Zb3mZ8VXbW0t6LQ5vFHw',
    authDomain: 'imageon-cc2e2.firebaseapp.com',
    projectId: 'imageon-cc2e2',
    storageBucket: 'imageon-cc2e2.firebasestorage.app',
    messagingSenderId: '480920431317',
    appId: '1:480920431317:web:29debb14e94ceb6758905c',
    measurementId: 'G-HM07DQR22Z'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Auth Provider
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// Add redirect URI for local development
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Set custom parameters for local development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    googleProvider.setCustomParameters({
        prompt: 'select_account',
        // This helps with local development
        redirect_uri: window.location.origin
    });
}

export default app;
