import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAALd99tyT-ILov22m1G58iforA3f-E628",
    authDomain: "nimroel-wiki.firebaseapp.com",
    projectId: "nimroel-wiki",
    storageBucket: "nimroel-wiki.firebasestorage.app",
    messagingSenderId: "499128220480",
    appId: "1:499128220480:web:e1da6cf1a6f306cd0458a5"
};

const ADMIN_UID = "ofe3AaZtvwd7KxY8MqG4182BZpo2";
const ADMIN_EMAIL = "damianr.belmont@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const fileInput = document.getElementById("jsonFile");
const jsonIdInput = document.getElementById("jsonId");
const jsonTypeInput = document.getElementById("jsonType");
const uploadBtn = document.getElementById("uploadBtn");
const jsonInfo = document.getElementById("jsonInfo");
const loginBtn = document.getElementById("loginBtn");
const authStatus = document.getElementById("authStatus");
const adminBox = document.getElementById("adminBox");

let jsonData = null;
let isAuthorized = false;

function setStatus(message, isError = false) {
    authStatus.textContent = message;
    authStatus.style.color = isError ? "#ff8b8b" : "";
}

function setAdminEnabled(enabled) {
    adminBox.classList.toggle("is-disabled", !enabled);
    adminBox.setAttribute("aria-disabled", String(!enabled));
    fileInput.disabled = !enabled;
    jsonIdInput.disabled = !enabled;
    jsonTypeInput.disabled = !enabled;
    uploadBtn.disabled = !enabled;
}

function createInfoLine(label, value) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(value || "-"));
    return line;
}

function renderJsonInfo(data) {
    jsonInfo.textContent = "";
    jsonInfo.appendChild(createInfoLine("Nombre", data.name));
    jsonInfo.appendChild(createInfoLine("ID", data.id));
    jsonInfo.appendChild(createInfoLine("Tipo", data.type));
}

function isCurrentUserAuthorized(user) {
    if (!user) return false;
    const normalizedEmail = (user.email || "").toLowerCase();
    return user.uid === ADMIN_UID && normalizedEmail === ADMIN_EMAIL;
}

async function startGoogleLogin() {
    setStatus("Abriendo login de Google...");
    loginBtn.disabled = true;

    try {
        // Always clear any existing session so each page load asks for login.
        await signOut(auth).catch(() => {});
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login error:", error);
        setStatus("No se pudo iniciar sesion. Intenta de nuevo.", true);
    } finally {
        loginBtn.disabled = false;
    }
}

loginBtn.addEventListener("click", startGoogleLogin);

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        isAuthorized = false;
        setAdminEnabled(false);
        setStatus("Debes iniciar sesion para continuar.");
        return;
    }

    if (!isCurrentUserAuthorized(user)) {
        isAuthorized = false;
        setAdminEnabled(false);
        setStatus("Cuenta no autorizada. Solo la cuenta admin puede entrar.", true);
        await signOut(auth).catch(() => {});
        return;
    }

    isAuthorized = true;
    setAdminEnabled(true);
    setStatus(`Autenticado como ${user.email}`);
});

fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
        try {
            jsonData = JSON.parse(readerEvent.target.result);
            jsonIdInput.value = (jsonData.id || "").toString();
            jsonTypeInput.value = (jsonData.type || "").toString();
            renderJsonInfo(jsonData);
        } catch (error) {
            console.error("Invalid JSON:", error);
            jsonData = null;
            jsonInfo.textContent = "";
            alert("JSON invalido");
        }
    };

    reader.readAsText(file);
});

uploadBtn.addEventListener("click", async () => {
    if (!isAuthorized || !isCurrentUserAuthorized(auth.currentUser)) {
        alert("Debes iniciar sesion con la cuenta autorizada.");
        setAdminEnabled(false);
        return;
    }

    if (!jsonData) {
        alert("Carga un JSON primero");
        return;
    }

    const id = jsonIdInput.value.trim();
    const type = jsonTypeInput.value.trim();

    if (!id || !type) {
        alert("ID y tipo son obligatorios");
        return;
    }

    if (id.includes("/")) {
        alert("El ID no puede contener '/'");
        return;
    }

    try {
        await setDoc(doc(db, "items", id), {
            ...jsonData,
            id,
            type
        });

        alert("Subido correctamente");
    } catch (error) {
        console.error("Upload error:", error);
        alert("Error al subir");
    }
});

setAdminEnabled(false);
setStatus("Verificando sesion...");

// Force fresh login every page load.
signOut(auth).catch(() => {
    setStatus("Debes iniciar sesion para continuar.");
});
