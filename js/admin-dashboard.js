import { monitorAuthState, logoutUser, createUserAsAdmin, sendResetEmail } from './auth-service.js';
import { ensureUserProfile, getAllUserProfiles, setUserStatus, deleteUserProfile, getUserProfileByEmail, getAllSurveys, deactivateSurvey, deleteSurveyAndResponses, updateRecoveryEmail } from './db-service.js';

let currentAdmin = null;
const sections = {};
let currentProfile = null;

// Profile panel elements
const profileCard = document.getElementById('profile-card');
const profileAccountEmail = document.getElementById('profile-account-email');
const profileRecoveryEmail = document.getElementById('profile-recovery-email');
const profileMessage = document.getElementById('profile-message');

monitorAuthState(async (user) => {
    if (user) {
        // Block access if admin account is disabled/deleted
        const profile = await getUserProfileByEmail(user.email);
        if (profile && (profile.deleted || profile.active === false)) {
            alert('Your admin account is disabled.');
            await logoutUser();
            return;
        }
        await ensureUserProfile(user.email, 'admin');
        currentAdmin = user;
        currentProfile = profile || await ensureUserProfile(user.email, 'admin');
        document.getElementById('admin-email').textContent = user.email;
        hydrateProfileCard();
        loadUsers();
        loadSurveyStats();
        showSection('users');
    } else {
        window.location.href = 'index.html';
    }
});

document.getElementById('logout-btn').addEventListener('click', logoutUser);
document.getElementById('nav-user-mgmt-btn').addEventListener('click', () => showSection('users'));
document.getElementById('nav-survey-mgmt-btn').addEventListener('click', () => showSection('surveys'));
document.getElementById('nav-profile-btn').addEventListener('click', toggleProfileCard);

document.getElementById('save-recovery-btn').addEventListener('click', async () => {
    if (!currentAdmin) return;
    const recoveryEmail = profileRecoveryEmail.value.trim();
    profileMessage.style.color = '#e74c3c';
    profileMessage.textContent = '';

    if (!recoveryEmail) {
        profileMessage.textContent = 'Please enter a recovery email.';
        return;
    }

    try {
        currentProfile = await updateRecoveryEmail(currentAdmin.email, recoveryEmail);
        profileMessage.style.color = 'green';
        profileMessage.textContent = 'Recovery email saved.';
    } catch (err) {
        console.error(err);
        profileMessage.textContent = err.message || 'Failed to save recovery email.';
    }
});

document.getElementById('send-reset-btn').addEventListener('click', async () => {
    if (!currentAdmin) return;
    profileMessage.style.color = '#e74c3c';
    profileMessage.textContent = '';
    try {
        await sendResetEmail(currentAdmin.email);
        profileMessage.style.color = 'green';
        profileMessage.textContent = 'Reset link sent to the admin account email. Make sure that inbox exists.';
    } catch (err) {
        console.error(err);
        profileMessage.textContent = err.message || 'Failed to send reset link.';
    }
});

function showSection(key) {
    if (!sections.users) {
        sections.users = document.getElementById('user-management-card');
        sections.surveys = document.getElementById('survey-management-card');
    }
    Object.entries(sections).forEach(([name, el]) => {
        el.style.display = name === key ? 'block' : 'none';
    });
    if (sections[key]) {
        sections[key].scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleProfileCard() {
    if (!profileCard) return;
    const isHidden = profileCard.style.display === 'none' || profileCard.style.display === '';
    profileCard.style.display = isHidden ? 'block' : 'none';
    if (!isHidden) return;
    profileCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hydrateProfileCard() {
    if (!currentAdmin || !profileAccountEmail) return;
    profileAccountEmail.value = currentAdmin.email;
    if (currentProfile && currentProfile.recoveryEmail) {
        profileRecoveryEmail.value = currentProfile.recoveryEmail;
    }
}

document.getElementById('create-user-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-user-email').value.trim();
    const password = document.getElementById('new-user-password').value;
    const role = document.getElementById('new-user-role').value || 'user';
    const messageEl = document.getElementById('create-user-message');
    messageEl.style.color = '#e74c3c';
    messageEl.textContent = '';

    if (!email || !password) {
        messageEl.textContent = 'Email and password are required.';
        return;
    }
    if (password.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters.';
        return;
    }

    try {
        await createUserAsAdmin(email, password);
        await ensureUserProfile(email, role);
        messageEl.style.color = 'green';
        messageEl.textContent = 'User created and enabled.';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        loadUsers();
    } catch (e) {
        console.error(e);
        messageEl.textContent = e.message || 'Failed to create user.';
    }
});

function preventSelfChange(email) {
    return currentAdmin && currentAdmin.email === email;
}

async function loadUsers() {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
    try {
        const users = await getAllUserProfiles();
        if (!users || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No users found.</td></tr>';
            return;
        }

        let rows = '';
        users.forEach(u => {
            const active = u.active !== false && !u.deleted;
            const pending = u.active === false && !u.deleted;
            const statusLabel = u.deleted ? 'Deleted' : pending ? 'Pending approval' : active ? 'Active' : 'Disabled';
            rows += `
                <tr>
                    <td>${u.email}</td>
                    <td>${u.role || 'user'}</td>
                    <td>${statusLabel}</td>
                    <td>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            ${pending ? `<button class="secondary btn-sm" data-approve="${u.email}">Approve</button>` : `<button class="secondary btn-sm" data-toggle="${u.email}" data-active="${active}">${active ? 'Disable' : 'Enable'}</button>`}
                            <button class="danger btn-sm" data-delete="${u.email}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = rows;

        tbody.querySelectorAll('button[data-approve]').forEach(btn => {
            btn.onclick = async () => {
                const email = btn.getAttribute('data-approve');
                await ensureUserProfile(email);
                await setUserStatus(email, true);
                loadUsers();
            };
        });

        tbody.querySelectorAll('button[data-toggle]').forEach(btn => {
            btn.onclick = async () => {
                const email = btn.getAttribute('data-toggle');
                if (preventSelfChange(email)) {
                    alert('You cannot disable your own admin account.');
                    return;
                }
                const currentlyActive = btn.getAttribute('data-active') === 'true';
                await ensureUserProfile(email);
                await setUserStatus(email, !currentlyActive);
                loadUsers();
            };
        });

        tbody.querySelectorAll('button[data-delete]').forEach(btn => {
            btn.onclick = async () => {
                const email = btn.getAttribute('data-delete');
                if (preventSelfChange(email)) {
                    alert('You cannot delete your own admin account.');
                    return;
                }
                if (!confirm(`Delete user ${email}? This will disable their access.`)) return;
                await ensureUserProfile(email);
                await deleteUserProfile(email);
                loadUsers();
            };
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Failed to load users.</td></tr>';
    }
}

// -----------------------------------------------------------------------------
// Survey Management (per-user stats and actions)
// -----------------------------------------------------------------------------

async function loadSurveyStats() {
    const statsBody = document.querySelector('#user-survey-stats-table tbody');
    const listBody = document.querySelector('#survey-list-table tbody');
    statsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';
    listBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        const surveys = await getAllSurveys();
        if (!surveys || surveys.length === 0) {
            statsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No surveys found.</td></tr>';
            listBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No surveys found.</td></tr>';
            return;
        }

        // Aggregate counts per user
        const byUser = {};
        surveys.forEach(s => {
            const owner = s.createdBy || 'unknown';
            if (!byUser[owner]) {
                byUser[owner] = { active: 0, finished: 0 };
            }
            const isActive = s.active !== false;
            if (isActive) byUser[owner].active += 1; else byUser[owner].finished += 1;
        });

        let statsRows = '';
        Object.keys(byUser).sort().forEach(email => {
            const entry = byUser[email];
            statsRows += `<tr><td>${email}</td><td>${entry.active}</td><td>${entry.finished}</td></tr>`;
        });
        statsBody.innerHTML = statsRows;

        // Render survey list
        let listRows = '';
        surveys.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        surveys.forEach(s => {
            const isActive = s.active !== false;
            const created = s.createdAt ? s.createdAt.toDate().toLocaleDateString() : 'N/A';
            const status = isActive ? 'Active' : 'Finished';
            const title = s.title || 'Untitled';
            listRows += `
                <tr>
                    <td>${title}</td>
                    <td>${s.createdBy || 'unknown'}</td>
                    <td>${status}</td>
                    <td>${created}</td>
                    <td>
                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            ${isActive ? `<button class="secondary btn-sm" data-deactivate-survey="${s.id}">Deactivate</button>` : ''}
                            <button class="danger btn-sm" data-delete-survey="${s.id}">Delete</button>
                        </div>
                    </td>
                </tr>
            `;
        });
        listBody.innerHTML = listRows;

        // Wire actions
        listBody.querySelectorAll('button[data-deactivate-survey]').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-deactivate-survey');
                if (!id) return;
                if (!confirm('Deactivate this survey? Users will no longer be able to submit responses.')) return;
                await deactivateSurvey(id);
                loadSurveyStats();
            };
        });

        listBody.querySelectorAll('button[data-delete-survey]').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-delete-survey');
                if (!id) return;
                if (!confirm('Delete this survey and all its responses? This cannot be undone.')) return;
                await deleteSurveyAndResponses(id);
                loadSurveyStats();
            };
        });

    } catch (e) {
        console.error(e);
        statsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Failed to load stats.</td></tr>';
        listBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Failed to load surveys.</td></tr>';
    }
}
