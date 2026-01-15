import { loginUser, registerUser, logoutUser, signOutSilent, sendResetEmail } from './auth-service.js';
import { ensureUserProfile, getUserProfileByEmail } from './db-service.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const adminLoginForm = document.getElementById('admin-login-form');

const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const adminLoginBtn = document.getElementById('admin-login-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');

const showRegisterLink = document.getElementById('show-register');
const showLoginLink = document.getElementById('show-login');
const showAdminLoginLink = document.getElementById('show-admin-login');
const backToLoginLink = document.getElementById('back-to-login');

// Toggle Forms
showRegisterLink.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
});

showLoginLink.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
});

showAdminLoginLink.addEventListener('click', () => {
    loginForm.style.display = 'none';
    adminLoginForm.style.display = 'block';
});

backToLoginLink.addEventListener('click', () => {
    adminLoginForm.style.display = 'none';
    loginForm.style.display = 'block';
});

async function ensureActiveAndProfile(email, role = null) {
    let profile = await getUserProfileByEmail(email);
    if (!profile) {
        profile = await ensureUserProfile(email, role || 'user');
    }
    if (profile.deleted) {
        await signOutSilent();
        throw new Error('Account has been removed. Contact the administrator.');
    }
    if (profile.active === false) {
        await signOutSilent();
        throw new Error('Account is pending admin approval.');
    }
    if (role && profile.role !== role) {
        profile = await ensureUserProfile(email, role);
    }
    return profile;
}

// Login Handler
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const messageEl = document.getElementById('login-message');
    messageEl.style.color = '#e74c3c';

    if (!email || !password) {
        messageEl.textContent = 'Please fill in all fields.';
        return;
    }

    try {
        await loginUser(email, password);
        const profile = await ensureActiveAndProfile(email, null);
        if (profile.role === 'admin') {
            window.location.href = 'admin_dashboard.html';
        } else {
            window.location.href = 'user_dashboard.html';
        }
    } catch (error) {
        messageEl.textContent = error.message;
    }
});

// Forgot Password Handler
forgotPasswordBtn.addEventListener('click', async () => {
    const email = document.getElementById('login-email').value;
    const messageEl = document.getElementById('login-message');

    if (!email) {
        messageEl.style.color = '#e74c3c';
        messageEl.textContent = 'Enter your registered email to reset your password.';
        return;
    }

    try {
        await sendResetEmail(email);
        messageEl.style.color = 'green';
        messageEl.textContent = 'Reset link sent. Check your email.';
    } catch (error) {
        messageEl.style.color = '#e74c3c';
        messageEl.textContent = error.message;
    }
});

// Register Handler
registerBtn.addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const messageEl = document.getElementById('reg-message');

    if (!email || !password) {
        messageEl.textContent = 'Please fill in all fields.';
        return;
    }

    try {
        await registerUser(email, password);
        await ensureUserProfile(email, 'user', false); // pending approval
        messageEl.style.color = 'green';
        messageEl.textContent = 'Registration received. Await admin approval before you can sign in.';
    } catch (error) {
        messageEl.style.color = '#e74c3c';
        messageEl.textContent = error.message;
    }
});

adminLoginBtn.addEventListener('click', async () => {
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const messageEl = document.getElementById('admin-message');

    if (!email || !password) {
        messageEl.textContent = 'Please fill in all fields.';
        return;
    }

    try {
        await loginUser(email, password);
        const profile = await ensureActiveAndProfile(email, null);
        if (!profile || profile.role !== 'admin') {
            await signOutSilent();
            throw new Error('You do not have admin access. Ask an admin to grant the admin role.');
        }
        window.location.href = 'admin_dashboard.html';
    } catch (error) {
        messageEl.textContent = error.message;
    }
});
