import { getSurveyById, saveSurveyResponse, checkEmailSubmission } from './db-service.js';

const urlParams = new URLSearchParams(window.location.search);
const surveyId = urlParams.get('id');

const titleEl = document.getElementById('survey-title');
const formEl = document.getElementById('survey-form');
const fieldsContainer = document.getElementById('survey-fields');
const messageEl = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

// State for Auth
let isAuthRequired = false;
let userEmail = '';
let verificationCode = '';
let isVerified = false;

async function init() {
    if (!surveyId) {
        titleEl.textContent = "Survey Not Found";
        messageEl.textContent = "No survey ID provided in URL.";
        return;
    }

    try {
        const survey = await getSurveyById(surveyId);
        if (!survey) {
            titleEl.textContent = "Survey Not Found";
            messageEl.textContent = "The survey you are looking for does not exist.";
            return;
        }

        // New Duplicate Check: Use LocalStorage for Anonymous, skip if Auth required (handled by email check)
        if (!survey.isAuthenticated) {
            const storageKey = `survey_submitted_${surveyId}`;
            if (localStorage.getItem(storageKey)) {
                titleEl.textContent = "Submission Already Received";
                messageEl.textContent = "You have already submitted feedback for this session.";
                formEl.style.display = 'none';
                return;
            }
        }

        renderForm(survey);
    } catch (error) {
        console.error(error);
        titleEl.textContent = "Error";
        messageEl.textContent = "Failed to load survey.";
    }
}
// IP Check removed

function renderForm(survey) {
    // Block deactivated surveys
    if (survey.active === false) {
        titleEl.textContent = "Survey Closed";
        messageEl.textContent = "This survey link has been deactivated by the owner.";
        formEl.style.display = 'none';
        return;
    }

    titleEl.textContent = survey.title.split('|')[0] || survey.title;
    
    // Check if subtitle (date) exists
    if (survey.title.includes('|')) {
        const dateSpan = document.createElement('p');
        dateSpan.style.textAlign = 'center';
        dateSpan.style.color = '#777';
        dateSpan.textContent = survey.title.split('|')[1];
        titleEl.after(dateSpan);
    }

    if (survey.isAuthenticated) {
        isAuthRequired = true;
        renderAuthUI(survey);
    } else {
        renderSurveyFields(survey);
    }
}

function renderAuthUI(survey) {
    // Clear fields just in case
    fieldsContainer.innerHTML = '';
    submitBtn.style.display = 'none';

    const authContainer = document.createElement('div');
    authContainer.className = 'auth-container';
    authContainer.style.background = '#f9f9f9';
    authContainer.style.padding = '20px';
    authContainer.style.borderRadius = '8px';
    authContainer.style.marginBottom = '20px';
    authContainer.innerHTML = `
        <div id="email-step">
            <h3>Email Verification Required</h3>
            <p style="font-size:0.9em; color:#666;">Enter your email to receive a verification code.</p>
            <div class="form-field">
                <label>Email Address</label>
                <input type="email" id="auth-email" placeholder="student@university.ac.uk">
            </div>
            <button type="button" id="send-code-btn" class="secondary">Send Verification Code</button>
        </div>

        <div id="code-step" style="display:none;">
            <h3>Enter Verification Code</h3>
            <p style="font-size:0.9em; color:#666;" id="code-msg">Code sent to your email.</p>
            <div class="form-field">
                <label>Verification Code</label>
                <input type="text" id="auth-code" placeholder="e.g. A1B2C3">
            </div>
            <button type="button" id="verify-code-btn" class="secondary">Verify & Start Survey</button>
            <div style="margin-top:10px;">
                <small><a href="#" id="resend-link">Resend Code</a></small>
            </div>
        </div>
    `;
    
    fieldsContainer.appendChild(authContainer);

    // Event Listeners for Auth
    document.getElementById('send-code-btn').onclick = async () => {
        const emailInput = document.getElementById('auth-email');
        const email = emailInput.value.trim();
        
        if (!email || !email.includes('@')) {
            alert("Please enter a valid email address.");
            return;
        }

        const btn = document.getElementById('send-code-btn');
        btn.disabled = true;
        btn.textContent = "Checking...";

        try {
            // Check for duplicate submission
            const exists = await checkEmailSubmission(survey.id, email);
            if (exists) {
                alert("This email has already submitted feedback for this survey.");
                btn.disabled = false;
                btn.textContent = "Send Verification Code";
                return;
            }

            // Generate & Send Code
            userEmail = email;
            verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            
            // EmailJS Configuration - REPLACE THESE
            const SERVICE_ID = 'service_ivl2px2';
            const TEMPLATE_ID = 'template_as2qt1e'; 

            try {
                btn.textContent = "Sending Email...";
                // Using global emailjs object loaded in HTML
                await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                    to_email: userEmail,
                    code: verificationCode,
                    survey_title: survey.title.split('|')[0].trim() || 'Session Feedback'
                });
                
                alert(`Verification code sent to ${email}`);
                
                // Move to next step
                document.getElementById('email-step').style.display = 'none';
                document.getElementById('code-step').style.display = 'block';
                document.getElementById('code-msg').textContent = `Code sent to ${email}`;

            } catch (err) {
                console.error('EmailJS Error:', err);
                alert("Failed to send email. Please check console or try again.");
                btn.disabled = false;
                btn.textContent = "Send Verification Code";
            }

        } catch (error) {
            console.error(error);
            alert("Error checking email status. Please try again.");
            btn.disabled = false;
            btn.textContent = "Send Verification Code";
        }
    };

    document.getElementById('verify-code-btn').onclick = () => {
        const input = document.getElementById('auth-code').value.trim().toUpperCase();
        if (input === verificationCode) {
            isVerified = true;
            // success
            authContainer.innerHTML = `
                <div style="color:green; text-align:center; padding:10px;">
                    <strong><i class="fas fa-check-circle"></i> Verified!</strong><br>
                    ${userEmail}
                </div>
            `;
            renderSurveyFields(survey);
        } else {
            alert("Invalid Code. Please try again.");
        }
    };

    document.getElementById('resend-link').onclick = async (e) => {
        e.preventDefault();
        
        // Resend logic
        if (!verificationCode || !userEmail) return;
        
        const link = document.getElementById('resend-link');
        const originalText = link.textContent;
        link.textContent = 'Sending...';
        link.style.pointerEvents = 'none';

        try {
            const SERVICE_ID = 'YOUR_SERVICE_ID';
            const TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; 
            
            await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                to_email: userEmail,
                code: verificationCode,
                survey_title: survey.title.split('|')[0].trim() || 'Session Feedback'
            });
            alert(`Code re-sent to ${userEmail}`);
        } catch(err) {
            console.error(err);
            alert("Failed to resend email.");
        } finally {
            link.textContent = originalText;
            link.style.pointerEvents = 'auto';
        }
    };
}

function renderSurveyFields(survey) {
    survey.fields.forEach((field, index) => {
        const div = document.createElement('div');
        div.className = 'form-field';
        
        const label = document.createElement('label');
        label.textContent = field.label;
        div.appendChild(label);

        if (field.type === 'textarea') {
            const input = document.createElement('textarea');
            input.rows = 4;
            input.name = field.label; // Use label as key
            div.appendChild(input);
        } else if (field.type === 'rating') {
            const ratingContainer = document.createElement('div');
            ratingContainer.className = 'star-rating-input';
            
            // Create 5 stars (5 to 1 because of flex-direction: row-reverse)
            for (let i = 5; i >= 1; i--) {
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.id = `star-${index}-${i}`;
                radio.name = field.label;
                radio.value = i;
                
                const starLabel = document.createElement('label');
                starLabel.htmlFor = `star-${index}-${i}`;
                starLabel.innerHTML = '&#9733;'; // HTML Star Entity
                
                ratingContainer.appendChild(radio);
                ratingContainer.appendChild(starLabel);
            }
            div.appendChild(ratingContainer);
        } else {
            // Default text
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.name = field.label;
            div.appendChild(input);
        }
        
        fieldsContainer.appendChild(div);
    });

    submitBtn.style.display = 'block';
}

formEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Safety check for auth
    if (isAuthRequired && !isVerified) {
        alert("Please complete the email verification first.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData(formEl);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }

    try {
        if (!isAuthRequired) {
            const storageKey = `survey_submitted_${surveyId}`;
            if (localStorage.getItem(storageKey)) {
                 messageEl.textContent = "You have already submitted feedback.";
                 formEl.style.display = 'none';
                 return;
            }
        }

        // Save Response with Auth Data if applicable
        await saveSurveyResponse(
            surveyId, 
            data, 
            null, // IP
            isAuthRequired ? userEmail : null,       // Email
            isAuthRequired ? verificationCode : null // Code
        );
        
        if (!isAuthRequired) {
            const storageKey = `survey_submitted_${surveyId}`;
            localStorage.setItem(storageKey, 'true');
        }
        
        formEl.style.display = 'none';
        
        // Remove subtitle if exists
        const p = document.querySelector('p');
        if(p) p.style.display = 'none';
        
        // Success Message
        titleEl.textContent = "Thank You!";
        messageEl.style.color = "green";
        
        if (isAuthRequired) {
            messageEl.innerHTML = `
                Your feedback has been submitted successfully.<br><br>
                <strong>Verification Record:</strong><br>
                Email: ${userEmail}<br>
                Code: ${verificationCode}
            `;
        } else {
            messageEl.textContent = "Your feedback has been submitted successfully.";
        }


    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
        messageEl.textContent = "Error submitting feedback. Please try again.";
        console.error(error);
    }
});

init();
