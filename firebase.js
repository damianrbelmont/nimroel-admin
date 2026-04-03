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
    deleteDoc,
    doc,
    getDoc,
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
const mergeBtn = document.getElementById("mergeBtn");
const loadBtn = document.getElementById("loadBtn");
const deleteBtn = document.getElementById("deleteBtn");
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
    loadBtn.disabled = !enabled;
    mergeBtn.disabled = !enabled;
    uploadBtn.disabled = !enabled;
    deleteBtn.disabled = !enabled;
}

function setAuthButtonMode(mode) {
    loginBtn.dataset.mode = mode;
    loginBtn.textContent = mode === "logout" ? "CERRAR SESION" : "INICIAR SESION CON GOOGLE";
    loginBtn.disabled = false;
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
    jsonInfo.appendChild(createInfoLine("ID", data.id || jsonIdInput.value));
    jsonInfo.appendChild(createInfoLine("Tipo", data.type));
}

function isCurrentUserAuthorized(user) {
    if (!user) return false;
    const normalizedEmail = (user.email || "").toLowerCase();
    return user.uid === ADMIN_UID && normalizedEmail === ADMIN_EMAIL;
}

function ensureAuthorized() {
    const ok = isAuthorized && isCurrentUserAuthorized(auth.currentUser);
    if (ok) return true;
    alert("Debes iniciar sesion con la cuenta autorizada.");
    setAdminEnabled(false);
    return false;
}

function getValidatedId() {
    const id = jsonIdInput.value.trim();
    if (!id) {
        alert("Debes indicar un ID.");
        return null;
    }
    if (id.includes("/")) {
        alert("El ID no puede contener '/'.");
        return null;
    }
    return id;
}

function buildPayload() {
    if (!jsonData) {
        alert("Carga primero un JSON local o desde Firebase.");
        return null;
    }

    const id = getValidatedId();
    if (!id) return null;

    const type = jsonTypeInput.value.trim();
    if (!type) {
        alert("Debes indicar el tipo.");
        return null;
    }

    return { ...jsonData, id, type };
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

async function closeSession() {
    setStatus("Cerrando sesion...");
    loginBtn.disabled = true;
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        setStatus("No se pudo cerrar sesion.", true);
    } finally {
        loginBtn.disabled = false;
    }
}

loginBtn.addEventListener("click", async () => {
    if (loginBtn.dataset.mode === "logout") {
        await closeSession();
        return;
    }
    await startGoogleLogin();
});

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        isAuthorized = false;
        setAdminEnabled(false);
        setStatus("Debes iniciar sesion para continuar.");
        setAuthButtonMode("login");
        return;
    }

    if (!isCurrentUserAuthorized(user)) {
        isAuthorized = false;
        setAdminEnabled(false);
        setStatus("Cuenta no autorizada. Solo la cuenta admin puede entrar.", true);
        setAuthButtonMode("login");
        await signOut(auth).catch(() => {});
        return;
    }

    isAuthorized = true;
    setAdminEnabled(true);
    setStatus(`Autenticado como ${user.email}`);
    setAuthButtonMode("logout");
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

loadBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const id = getValidatedId();
    if (!id) return;

    try {
        const itemRef = doc(db, "items", id);
        const snapshot = await getDoc(itemRef);

        if (!snapshot.exists()) {
            alert("No existe un documento con ese ID.");
            return;
        }

        jsonData = snapshot.data();
        jsonIdInput.value = id;
        jsonTypeInput.value = (jsonData.type || "").toString();
        renderJsonInfo(jsonData);
        alert("Documento cargado desde Firebase.");
    } catch (error) {
        console.error("Load error:", error);
        alert("Error al cargar el documento.");
    }
});

mergeBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const payload = buildPayload();
    if (!payload) return;

    try {
        await setDoc(doc(db, "items", payload.id), payload, { merge: true });
        alert("Actualizado con merge (sin borrar campos no enviados).");
    } catch (error) {
        console.error("Merge error:", error);
        alert("Error al actualizar.");
    }
});

uploadBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const payload = buildPayload();
    if (!payload) return;

    try {
        await setDoc(doc(db, "items", payload.id), payload);
        alert("Documento sobrescrito completamente.");
    } catch (error) {
        console.error("Replace error:", error);
        alert("Error al sobrescribir.");
    }
});

deleteBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const id = getValidatedId();
    if (!id) return;

    const confirmed = confirm(`Vas a eliminar items/${id} de forma permanente. Continuar?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "items", id));
        jsonData = null;
        jsonInfo.textContent = "";
        alert("Documento eliminado.");
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error al eliminar.");
        return;
    }
});

setAdminEnabled(false);
setStatus("Verificando sesion...");
setAuthButtonMode("login");

// Force fresh login every page load.
signOut(auth).catch(() => {
    setStatus("Debes iniciar sesion para continuar.");
});
