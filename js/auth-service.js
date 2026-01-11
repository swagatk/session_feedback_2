import { auth, secondaryAuth } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updatePassword,
    EmailAuthProvider,
    reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Register a new user
export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        throw error;
    }
}

// Login existing user
export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        throw error;
    }
}

// Logout user
export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Error signing out: ", error);
        throw error;
    }
}

// Monitor auth state
export function monitorAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        callback(user);
    });
}

// Change current user's password (requires re-auth for security)
export async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user || !user.email) {
        throw new Error('No authenticated user.');
    }

    // Re-authenticate with current password, then update
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
}

// Create a user without switching the current session (uses secondary auth instance)
export async function createUserAsAdmin(email, password) {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    // Clean up secondary session
    await signOut(secondaryAuth);
    return cred.user;
}

// Sign out without redirecting (for access checks)
export async function signOutSilent() {
    await signOut(auth);
}
