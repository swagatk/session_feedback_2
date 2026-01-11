import { logoutUser, monitorAuthState, changePassword } from './auth-service.js';
import { createSurvey, getUserSurveys, getSurveyResponses, deleteSurvey, deactivateSurvey as deactivateSurveyApi, deleteSurveyResponse, getUserProfileByEmail, ensureUserProfile } from './db-service.js';
import { exportToExcel } from './utils.js';

let currentUser = null;
let currentFields = [];
let cachedSurveys = [];
let currentSurveyDetails = null;
let currentReportRows = [];

// Default Template Fields
const DEFAULT_FIELDS = [
    { type: 'rating', label: 'Clarity of Content' },
    { type: 'rating', label: 'Engagement' },
    { type: 'rating', label: 'Pace of the Lecture' },
    { type: 'textarea', label: 'What went well? (Positive Feedback)' },
    { type: 'textarea', label: 'What could be improved? (Constructive Feedback)' }
];

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

monitorAuthState(async (user) => {
    if (user) {
        const profile = await getUserProfileByEmail(user.email);
        if (profile && (profile.deleted || profile.active === false)) {
            alert('Your account is disabled.');
            await logoutUser();
            return;
        }
        await ensureUserProfile(user.email, 'user');
        currentUser = user;
        document.getElementById('user-email').textContent = user.email;
        loadSurveyHistory();
        
        // Initialize default fields for creation
        resetCreateForm();
    } else {
        window.location.href = 'index.html';
    }
});

document.getElementById('logout-btn').addEventListener('click', logoutUser);
document.getElementById('change-password-btn').addEventListener('click', async () => {
    const current = prompt('Enter your current password:');
    if (!current) return;
    const next = prompt('Enter new password (min 6 characters):');
    if (!next || next.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }
    const confirmNext = prompt('Confirm new password:');
    if (confirmNext !== next) {
        alert('New passwords do not match.');
        return;
    }
    try {
        await changePassword(current, next);
        alert('Password updated successfully.');
    } catch (e) {
        console.error(e);
        alert('Failed to update password: ' + (e.message || 'Unknown error'));
    }
});

// -----------------------------------------------------------------------------
// Create Survey Logic
// -----------------------------------------------------------------------------

function resetCreateForm() {
    currentFields = JSON.parse(JSON.stringify(DEFAULT_FIELDS)); // Deep copy
    document.getElementById('session-name').value = '';
    
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('session-date').value = today;
    
    renderCreateFields();
}

function renderCreateFields() {
    const container = document.getElementById('active-fields-list');
    container.innerHTML = '';
    
    currentFields.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = `field-item ${field.type === 'rating' ? 'rating-field' : 'text-field'}`;
        
        const icon = field.type === 'rating' ? '<i class="fas fa-star" style="color:#f1c40f; margin-right:5px;"></i>' : '<i class="fas fa-comment-alt" style="color:#3498db; margin-right:5px;"></i>';
        
        div.innerHTML = `
            <span>${icon} ${field.label}</span>
            <span class="remove-field" onclick="window.removeField(${index})">&times;</span>
        `;
        container.appendChild(div);
    });
}

window.removeField = (index) => {
    currentFields.splice(index, 1);
    renderCreateFields();
};

window.addRatingField = () => {
    const label = prompt("Enter label for new Rating field:");
    if (label) {
        currentFields.push({ type: 'rating', label: label });
        renderCreateFields();
    }
};

window.addCommentField = () => {
    const label = prompt("Enter label for new Comment field:");
    if (label) {
        currentFields.push({ type: 'textarea', label: label });
        renderCreateFields();
    }
};

document.getElementById('create-survey-link-btn').addEventListener('click', async () => {
    const sessionName = document.getElementById('session-name').value;
    const sessionDate = document.getElementById('session-date').value;
    
    if (!sessionName || !sessionDate) {
        alert("Please provide a Session Name and Date.");
        return;
    }
    
    if (currentFields.length === 0) {
        alert("Please add at least one field.");
        return;
    }

    try {
        // Construct title from Session Name + Date for internal use
        const title = `${sessionName} | ${sessionDate}`;
        const newSurveyId = await createSurvey(currentUser.email, title, currentFields);
        
        // Copy to clipboard
        const link = `${window.location.origin}/survey.html?id=${newSurveyId}`;
        try {
            await navigator.clipboard.writeText(link);
            alert("Survey Created! Link copied to clipboard:\n" + link);
        } catch (err) {
            alert("Survey Created! Link:\n" + link);
        }
        
        resetCreateForm();
        loadSurveyHistory();
    } catch (e) {
        console.error(e);
        alert("Failed to create survey: " + e.message);
    }
});


// -----------------------------------------------------------------------------
// History & Retrieval Logic
// -----------------------------------------------------------------------------

async function loadSurveyHistory() {
    const container = document.getElementById('survey-history-list');
    container.innerHTML = '<div style="text-align:center; padding:10px; color:#888;">Refreshing...</div>';
    
    try {
        const surveys = await getUserSurveys(currentUser.email);
        cachedSurveys = surveys;
        container.innerHTML = '';
        
        if (surveys.length === 0) {
            container.innerHTML = '<div style="padding:10px; text-align:center; color:#888;">No active surveys. Create one to get started!</div>';
            return;
        }

        // Sort by date created desc
        surveys.sort((a, b) => b.createdAt - a.createdAt);

        renderActiveSurveys(surveys.filter(s => s.active !== false));

        surveys.forEach(survey => {
            const item = document.createElement('div');
            item.className = 'history-item';
            // Parse title which we saved as "Name | Date"
            // Handle legacy titles gracefully
            let name = survey.title;
            let date = '';
            
            if (survey.title.includes('|')) {
                const parts = survey.title.split('|');
                name = parts[0].trim();
                date = parts[1].trim();
            }
            
            item.innerHTML = `
                <h4>${name}</h4>
                <div class="history-meta">
                    <span>${date}</span>
                    <span style="color:#27ae60">View &raquo;</span>
                </div>
            `;
            item.onclick = () => loadSurveyDetails(survey);
            container.appendChild(item);
        });
    } catch (e) {
        container.innerHTML = "Error loading history.";
        console.error(e);
    }
}

// -----------------------------------------------------------------------------
// Active Surveys Render & Actions
// -----------------------------------------------------------------------------

function renderActiveSurveys(surveys) {
    const card = document.getElementById('active-surveys-card');
    const list = document.getElementById('active-surveys-list');

    if (!surveys || surveys.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    list.innerHTML = '';

    surveys.forEach(survey => {
        const wrapper = document.createElement('div');
        wrapper.className = 'survey-item';

        let name = survey.title;
        let date = '';
        if (survey.title.includes('|')) {
            const parts = survey.title.split('|');
            name = parts[0].trim();
            date = parts[1].trim();
        }

        const link = `${window.location.origin}/survey.html?id=${survey.id}`;

        wrapper.innerHTML = `
            <div style="flex:1; min-width: 220px;">
                <h4 style="margin:0 0 6px 0;">${name}</h4>
                <div style="font-size:12px; color:#666;">Module: ${name}</div>
                <div style="font-size:12px; color:#666;">Date: ${date}</div>
                <div style="font-size:11px; color:#888;">Created: ${survey.createdAt ? survey.createdAt.toDate().toLocaleDateString() : ''}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px; min-width: 260px;">
                <div style="display:flex; gap:6px; align-items:center;">
                    <input value="${link}" readonly style="flex:1; padding:6px; font-size:12px;" />
                    <button class="secondary btn-sm" data-copy="${link}">Copy Link</button>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="danger btn-sm" data-deactivate="${survey.id}">Deactivate</button>
                </div>
            </div>
        `;

        list.appendChild(wrapper);
    });

    // Wire copy buttons
    list.querySelectorAll('button[data-copy]').forEach(btn => {
        btn.onclick = async () => {
            const link = btn.getAttribute('data-copy');
            try {
                await navigator.clipboard.writeText(link);
                btn.textContent = 'Copied!';
                setTimeout(() => (btn.textContent = 'Copy Link'), 1200);
            } catch (err) {
                alert('Link: ' + link);
            }
        };
    });

    // Wire deactivate buttons
    list.querySelectorAll('button[data-deactivate]').forEach(btn => {
        btn.onclick = () => deactivateSurvey(btn.getAttribute('data-deactivate'));
    });
}

// -----------------------------------------------------------------------------
// Details & Results Logic
// -----------------------------------------------------------------------------

async function loadSurveyDetails(survey) {
    // 1. UI Updates
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    // (Highlighting specific item would require ID matching, skipped for brevity, generally easy)
    
    document.getElementById('submissions-card').style.display = 'block';
    document.getElementById('overall-rating-card').style.display = 'block';

    // store for downloads
    currentSurveyDetails = survey;
    
    // Parse title
    let name = survey.title;
    let date = survey.createdAt ? survey.createdAt.toDate().toLocaleDateString() : '';
    if (survey.title.includes('|')) {
        name = survey.title.split('|')[0].trim();
    }

    document.getElementById('viewing-survey-title').textContent = name;
    document.getElementById('viewing-survey-date').textContent = date;

    // Setup Delete Button
    const deleteBtn = document.getElementById('reset-feedback-btn');
    deleteBtn.onclick = () => deleteSurveyHandler(survey.id);

    // 2. Fetch Responses
    const tableBody = document.querySelector('#submissions-table tbody');
    const tableHead = document.querySelector('#submissions-table thead');
    tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Loading data...</td></tr>';
    
    try {
        const responses = await getSurveyResponses(survey.id);
        
        document.getElementById('submission-count').textContent = responses.length;

        if (responses.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:20px;">No feedback submitted yet.</td></tr>';
            document.getElementById('avg-rating-display').textContent = "0.0 / 5.0";
            return;
        }

        // 3. Process Data for Table
        // Identify all keys from the survey fields config (stored in survey object)
        // If not available in survey object (legacy), infer from first response
        let columns = [];
        let ratingColumns = [];
        
        if (survey.fields) {
            survey.fields.forEach(f => {
                columns.push(f.label);
                if (f.type === 'rating') ratingColumns.push(f.label);
            });
        } else if (responses.length > 0) {
            // Fallback
            columns = Object.keys(responses[0].responseData);
        }

        // Render Headers
        let headHtml = '<tr>';
        columns.forEach(col => {
            // Shorten long headers for display
            const displayCol = col.length > 20 ? col.substring(0, 20) + '...' : col;
            headHtml += `<th>${displayCol}</th>`;
        });
        headHtml += '<th>Submitted</th><th>Actions</th></tr>';
        tableHead.innerHTML = headHtml;

        // Render Rows & Calculate Stats
        let totalRatingSum = 0;
        let totalRatingCount = 0;

        currentReportRows = [];

        let rowsHtml = '';
        responses.forEach(res => {
            rowsHtml += '<tr>';
            const exportRow = {};
            columns.forEach(col => {
                const val = res.responseData[col] || '-';
                // Check if this column is a rating col to aggregate stats
                if (ratingColumns.includes(col)) {
                    const numVal = parseFloat(val);
                    if (!isNaN(numVal)) {
                        totalRatingSum += numVal;
                        totalRatingCount++;
                    }
                }
                rowsHtml += `<td>${val}</td>`;
                exportRow[col] = val;
            });
            const submittedAt = res.submittedAt ? res.submittedAt.toDate().toLocaleDateString() : '';
            rowsHtml += `<td>${submittedAt}</td>`;
            rowsHtml += `<td><button class="danger btn-sm" data-delete-response="${res.id}">Delete</button></td>`;
            rowsHtml += '</tr>';

            exportRow['Submitted'] = submittedAt;
            currentReportRows.push(exportRow);
        });
        tableBody.innerHTML = rowsHtml;

        // Wire row-level delete buttons
        tableBody.querySelectorAll('button[data-delete-response]').forEach(btn => {
            btn.onclick = () => handleDeleteResponse(btn.getAttribute('data-delete-response'));
        });

        // Update Overall Rating
        if (totalRatingCount > 0) {
            // Average = Sum of all individual ratings / count of individual ratings
            const avg = (totalRatingSum / totalRatingCount).toFixed(1);
            document.getElementById('avg-rating-display').textContent = `${avg} / 5.0`;
        } else {
             document.getElementById('avg-rating-display').textContent = "N/A";
        }

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="10">Error loading data.</td></tr>';
    }
}

async function deleteSurveyHandler(id) {
    if (confirm("Are you sure you want to delete this survey and all metrics? This cannot be undone.")) {
        await deleteSurvey(id);
        document.getElementById('submissions-card').style.display = 'none';
        document.getElementById('overall-rating-card').style.display = 'none';
        loadSurveyHistory();
        // Also refresh active list
        cachedSurveys = cachedSurveys.filter(s => s.id !== id);
        renderActiveSurveys(cachedSurveys.filter(s => s.active !== false));
    }
}

// Deactivate from Active list
async function deactivateSurvey(id) {
    if (!id) return;
    if (!confirm('Deactivate this survey link?')) return;
    await deactivateSurveyApi(id);
    cachedSurveys = cachedSurveys.map(s => s.id === id ? { ...s, active: false } : s);
    renderActiveSurveys(cachedSurveys.filter(s => s.active !== false));
    // Keep history intact
    // Reload to pull fresh server state (timestamps etc.)
    loadSurveyHistory();
}

// PDF Export
document.getElementById('download-pdf-btn').onclick = () => {
    const table = document.getElementById('submissions-table');
    const title = document.getElementById('viewing-survey-title').textContent;
    
    if (typeof html2pdf === 'undefined') {
        alert("PDF Library not loaded. Please refresh.");
        return;
    }

    // Temporarily hide actions column on the real table for capture
    const hidden = [];
    const actionCells = table.querySelectorAll('th:last-child, td:last-child');
    actionCells.forEach(cell => {
        hidden.push({ cell, display: cell.style.display });
        cell.style.display = 'none';
    });

    const opt = {
        margin:       0.5,
        filename:     `Feedback_${title.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(table).save().finally(() => {
        // Restore actions column
        hidden.forEach(({ cell, display }) => {
            cell.style.display = display;
        });
    });
};

// Report Excel download
document.getElementById('download-excel-btn').onclick = () => {
    if (!currentSurveyDetails) {
        alert('Select a survey to download its report.');
        return;
    }
    if (!currentReportRows || currentReportRows.length === 0) {
        alert('No responses to export.');
        return;
    }
    const name = currentSurveyDetails.title?.split('|')[0]?.trim() || currentSurveyDetails.title;
    exportToExcel(currentReportRows, `${name}_Report`);
};

// Delete a single response and refresh table
async function handleDeleteResponse(responseId) {
    if (!responseId) return;
    const confirmed = confirm('Delete this feedback entry? This cannot be undone.');
    if (!confirmed) return;
    try {
        await deleteSurveyResponse(responseId);
        if (currentSurveyDetails) {
            await loadSurveyDetails(currentSurveyDetails);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to delete response.');
    }
}
