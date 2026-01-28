import { getSurveyById, saveSurveyResponse } from './db-service.js';

const urlParams = new URLSearchParams(window.location.search);
const surveyId = urlParams.get('id');

const titleEl = document.getElementById('survey-title');
const formEl = document.getElementById('survey-form');
const fieldsContainer = document.getElementById('survey-fields');
const messageEl = document.getElementById('message');
const submitBtn = document.getElementById('submit-btn');

async function init() {
    if (!surveyId) {
        titleEl.textContent = "Survey Not Found";
        messageEl.textContent = "No survey ID provided in URL.";
        return;
    }

    // New Duplicate Check: Use LocalStorage instead of IP
    // IP check blocks everyone on the same University/Office network (same public IP).
    const storageKey = `survey_submitted_${surveyId}`;
    if (localStorage.getItem(storageKey)) {
        titleEl.textContent = "Submission Already Received";
        messageEl.textContent = "You have already submitted feedback for this session.";
        formEl.style.display = 'none';
        return;
    }

    try {
        const survey = await getSurveyById(surveyId);
        if (!survey) {
            titleEl.textContent = "Survey Not Found";
            messageEl.textContent = "The survey you are looking for does not exist.";
            return;
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
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData(formEl);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }

    try {
        const storageKey = `survey_submitted_${surveyId}`;
        /* Double-check before submitting */
        if (localStorage.getItem(storageKey)) {
             messageEl.textContent = "You have already submitted feedback.";
             formEl.style.display = 'none';
             return;
        }

        await saveSurveyResponse(surveyId, data); // No IP passed
        
        // Mark as submitted locally
        localStorage.setItem(storageKey, 'true');
        
        formEl.style.display = 'none';
        titleEl.textContent = "Thank You!";
        messageEl.style.color = "green";
        messageEl.textContent = "Your feedback has been submitted successfully.";
        
        // Remove subtitle if exists
        const p = document.querySelector('p');
        if(p) p.style.display = 'none';

    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
        messageEl.textContent = "Error submitting feedback. Please try again.";
        console.error(error);
    }
});

init();
