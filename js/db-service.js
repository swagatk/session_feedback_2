import { db } from './firebase-config.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    setDoc,
    query, 
    where, 
    deleteDoc,
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Create a new survey
export async function createSurvey(userEmail, title, fields) {
    try {
        const docRef = await addDoc(collection(db, "surveys"), {
            createdBy: userEmail,
            title: title,
            fields: fields, // Array of field objects { label, type, options }
            createdAt: serverTimestamp(),
            active: true
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding document: ", error);
        throw error;
    }
}

// Get surveys created by specific user
export async function getUserSurveys(userEmail) {
    const surveys = [];
    const q = query(collection(db, "surveys"), where("createdBy", "==", userEmail));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        surveys.push({ id: doc.id, ...doc.data() });
    });
    return surveys;
}

// Get a single survey by ID
export async function getSurveyById(surveyId) {
    const docRef = doc(db, "surveys", surveyId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
    } else {
        return null;
    }
}

// Save a response to a survey
export async function saveSurveyResponse(surveyId, responseData, ipAddress = null) {
    try {
        await addDoc(collection(db, "responses"), {
            surveyId: surveyId,
            responseData: responseData,
            ip: ipAddress || null,
            submittedAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error saving response: ", error);
        throw error;
    }
}

// Get responses for a specific survey
export async function getSurveyResponses(surveyId) {
    const responses = [];
    const q = query(collection(db, "responses"), where("surveyId", "==", surveyId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
        responses.push({ id: doc.id, ...doc.data() });
    });
    return responses;
}

// Check if a response exists from a given IP for a survey
export async function hasResponseFromIp(surveyId, ipAddress) {
    if (!ipAddress) return false;
    const q = query(collection(db, 'responses'), where('surveyId', '==', surveyId), where('ip', '==', ipAddress));
    const snap = await getDocs(q);
    return !snap.empty;
}

// Delete a survey
export async function deleteSurvey(surveyId) {
    await deleteDoc(doc(db, "surveys", surveyId));
}

// Delete a survey and all its responses
export async function deleteSurveyAndResponses(surveyId) {
    // Remove responses
    const responsesSnap = await getDocs(query(collection(db, 'responses'), where('surveyId', '==', surveyId)));
    const deletes = [];
    responsesSnap.forEach((resDoc) => {
        deletes.push(deleteDoc(doc(db, 'responses', resDoc.id)));
    });
    await Promise.all(deletes);
    // Remove survey
    await deleteDoc(doc(db, 'surveys', surveyId));
}

// Delete a single survey response
export async function deleteSurveyResponse(responseId) {
    await deleteDoc(doc(db, "responses", responseId));
}

// Deactivate (archive) a survey without deleting it
export async function deactivateSurvey(surveyId) {
    const ref = doc(db, "surveys", surveyId);
    await updateDoc(ref, { active: false });
}

// Admin: Get all users (This requires a specific implementation or simply listing emails from surveys if Auth listing is restricted client-side)
// Note: Client-side listing of all Auth users is not directly supported by Firebase Client SDK for security. 
// We will simulate "Admin" features by querying unique creators in the "surveys" collection or using a separate "users" collection if we were registering them there.
// For this demo, we'll assume the admin just wants to see all surveys.
export async function getAllSurveys() {
    const surveys = [];
    const querySnapshot = await getDocs(collection(db, "surveys"));
    querySnapshot.forEach((doc) => {
        surveys.push({ id: doc.id, ...doc.data() });
    });
    return surveys;
}

// -----------------------------------------------------------------------------
// User Profiles (app-level enable/disable metadata)
// -----------------------------------------------------------------------------

// Ensure a user profile document exists (email used as document id)
export async function ensureUserProfile(email, role = 'user', activeDefault = true) {
    const ref = doc(db, 'userProfiles', email);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { email, role, active: activeDefault, deleted: false, createdAt: serverTimestamp() });
        return { email, role, active: activeDefault, deleted: false };
    }
    const data = snap.data();
    const updates = {};
    let changed = false;
    if (role && data.role !== role) {
        updates.role = role;
        changed = true;
    }
    if (typeof data.active === 'undefined') {
        updates.active = activeDefault;
        changed = true;
    }
    if (typeof data.deleted === 'undefined') {
        updates.deleted = false;
        changed = true;
    }
    if (changed) {
        await updateDoc(ref, updates);
        return { ...data, ...updates };
    }
    return data;
}

export async function getUserProfileByEmail(email) {
    const ref = doc(db, 'userProfiles', email);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
}

export async function getAllUserProfiles() {
    const profiles = [];
    const querySnapshot = await getDocs(collection(db, 'userProfiles'));
    querySnapshot.forEach((doc) => {
        profiles.push({ id: doc.id, ...doc.data() });
    });
    return profiles;
}

export async function setUserStatus(email, active) {
    const ref = doc(db, 'userProfiles', email);
    await updateDoc(ref, { active, deleted: false });
}

export async function deleteUserProfile(email) {
    const ref = doc(db, 'userProfiles', email);
    // Mark as deleted/disabled instead of removing to preserve audit trail
    await updateDoc(ref, { active: false, deleted: true });
}
