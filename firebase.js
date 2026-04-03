import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    collection,
    deleteDoc,
    doc,
    documentId,
    endAt,
    getDoc,
    getDocs,
    getFirestore,
    limit,
    orderBy,
    query,
    setDoc,
    startAt
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
const itemsCollection = collection(db, "items");

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const adminBox = document.getElementById("adminBox");
const authStatus = document.getElementById("authStatus");
const loginBtn = document.getElementById("loginBtn");

const newJsonFile = document.getElementById("newJsonFile");
const newJsonId = document.getElementById("newJsonId");
const newJsonType = document.getElementById("newJsonType");
const createBtn = document.getElementById("createBtn");
const newJsonInfo = document.getElementById("newJsonInfo");

const searchIdInput = document.getElementById("searchIdInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");
const selectedIdInput = document.getElementById("selectedIdInput");
const loadSelectedBtn = document.getElementById("loadSelectedBtn");
const editJsonFile = document.getElementById("editJsonFile");
const editJsonType = document.getElementById("editJsonType");
const mergeBtn = document.getElementById("mergeBtn");
const overwriteBtn = document.getElementById("overwriteBtn");
const deleteBtn = document.getElementById("deleteBtn");
const editJsonInfo = document.getElementById("editJsonInfo");

let isAuthorized = false;
let newJsonData = null;
let editJsonData = null;
let selectedEditId = "";

function setStatus(message, isError = false) {
    authStatus.textContent = message;
    authStatus.style.color = isError ? "#ff8b8b" : "";
}

function setAuthButtonMode(mode) {
    loginBtn.dataset.mode = mode;
    loginBtn.textContent = mode === "logout" ? "CERRAR SESION" : "INICIAR SESION CON GOOGLE";
    loginBtn.disabled = false;
}

function setAdminEnabled(enabled) {
    adminBox.classList.toggle("is-disabled", !enabled);
    adminBox.setAttribute("aria-disabled", String(!enabled));

    const controls = adminBox.querySelectorAll("input, button");
    controls.forEach((control) => {
        if (control.id === "selectedIdInput") return;
        control.disabled = !enabled;
    });

    selectedIdInput.disabled = true;
}

function createInfoLine(label, value) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(value || "-"));
    return line;
}

function renderInfo(target, data, fallbackId = "") {
    target.textContent = "";
    target.appendChild(createInfoLine("Nombre", data.name));
    target.appendChild(createInfoLine("ID", data.id || fallbackId));
    target.appendChild(createInfoLine("Tipo", data.type));
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

function validateId(id) {
    const trimmed = (id || "").trim();
    if (!trimmed) {
        alert("Debes indicar un ID.");
        return null;
    }
    if (trimmed.includes("/")) {
        alert("El ID no puede contener '/'.");
        return null;
    }
    return trimmed;
}

function readJsonFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                resolve(JSON.parse(event.target.result));
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

function selectEditId(id) {
    selectedEditId = id;
    selectedIdInput.value = id;

    const chips = searchResults.querySelectorAll(".result-chip");
    chips.forEach((chip) => {
        chip.classList.toggle("is-selected", chip.dataset.id === id);
    });
}

function renderSearchResults(ids) {
    searchResults.textContent = "";

    if (ids.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "No se encontraron IDs.";
        searchResults.appendChild(empty);
        return;
    }

    ids.forEach((id) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "result-chip";
        chip.dataset.id = id;
        chip.textContent = id;
        chip.addEventListener("click", () => selectEditId(id));
        searchResults.appendChild(chip);
    });
}

async function fetchIdsByPrefix(prefix) {
    const term = (prefix || "").trim();
    let q;

    if (!term) {
        q = query(itemsCollection, orderBy(documentId()), limit(25));
    } else {
        q = query(
            itemsCollection,
            orderBy(documentId()),
            startAt(term),
            endAt(`${term}\uf8ff`),
            limit(25)
        );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => item.id);
}

function buildNewPayload() {
    if (!newJsonData) {
        alert("Carga primero un JSON local en la seccion de nuevo.");
        return null;
    }

    const id = validateId(newJsonId.value);
    if (!id) return null;

    const type = newJsonType.value.trim();
    if (!type) {
        alert("Debes indicar el tipo.");
        return null;
    }

    return { ...newJsonData, id, type };
}

function buildEditPayload() {
    if (!selectedEditId) {
        alert("Selecciona antes un ID de Firebase.");
        return null;
    }

    if (!editJsonData) {
        alert("Carga un JSON local para editar el documento existente.");
        return null;
    }

    const type = editJsonType.value.trim();
    if (!type) {
        alert("Debes indicar el tipo para la actualizacion.");
        return null;
    }

    return { ...editJsonData, id: selectedEditId, type };
}

async function startGoogleLogin() {
    setStatus("Abriendo login de Google...");
    loginBtn.disabled = true;

    try {
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

    try {
        const initialIds = await fetchIdsByPrefix("");
        renderSearchResults(initialIds);
    } catch (error) {
        console.error("Initial list error:", error);
        renderSearchResults([]);
    }
});

newJsonFile.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        newJsonData = await readJsonFile(file);
        newJsonId.value = (newJsonData.id || "").toString();
        newJsonType.value = (newJsonData.type || "").toString();
        renderInfo(newJsonInfo, newJsonData, newJsonId.value);
    } catch (error) {
        console.error("Invalid new JSON:", error);
        newJsonData = null;
        newJsonInfo.textContent = "";
        alert("JSON invalido en la seccion de nuevo.");
    }
});

createBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const payload = buildNewPayload();
    if (!payload) return;

    try {
        const itemRef = doc(db, "items", payload.id);
        const existing = await getDoc(itemRef);
        if (existing.exists()) {
            alert("Ese ID ya existe en Firebase. Usa la seccion de edicion.");
            return;
        }

        await setDoc(itemRef, payload);
        alert("JSON nuevo subido correctamente.");
        const updatedIds = await fetchIdsByPrefix(searchIdInput.value);
        renderSearchResults(updatedIds);
    } catch (error) {
        console.error("Create error:", error);
        alert("Error al subir JSON nuevo.");
    }
});

searchBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    try {
        const ids = await fetchIdsByPrefix(searchIdInput.value);
        renderSearchResults(ids);
    } catch (error) {
        console.error("Search error:", error);
        alert("Error al buscar IDs.");
    }
});

loadSelectedBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const id = validateId(selectedIdInput.value);
    if (!id) return;
    selectEditId(id);

    try {
        const snapshot = await getDoc(doc(db, "items", id));
        if (!snapshot.exists()) {
            alert("No existe un documento con ese ID.");
            return;
        }

        const existingData = snapshot.data();
        editJsonType.value = (existingData.type || "").toString();
        editJsonInfo.textContent = "";
        editJsonInfo.appendChild(createInfoLine("ID seleccionado", id));
        editJsonInfo.appendChild(createInfoLine("Nombre actual", existingData.name));
        editJsonInfo.appendChild(createInfoLine("Tipo actual", existingData.type));
        editJsonInfo.appendChild(createInfoLine("Estado", "Listo para anadir, sobrescribir o eliminar"));
    } catch (error) {
        console.error("Load selected error:", error);
        alert("Error al cargar el JSON seleccionado.");
    }
});

editJsonFile.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        editJsonData = await readJsonFile(file);
        editJsonType.value = (editJsonData.type || editJsonType.value || "").toString();
        renderInfo(editJsonInfo, editJsonData, selectedEditId);
    } catch (error) {
        console.error("Invalid edit JSON:", error);
        editJsonData = null;
        alert("JSON invalido en la seccion de edicion.");
    }
});

mergeBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const payload = buildEditPayload();
    if (!payload) return;

    try {
        await setDoc(doc(db, "items", payload.id), payload, { merge: true });
        alert("JSON actualizado con anadir (merge).");
    } catch (error) {
        console.error("Merge error:", error);
        alert("Error al anadir informacion.");
    }
});

overwriteBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const payload = buildEditPayload();
    if (!payload) return;

    try {
        await setDoc(doc(db, "items", payload.id), payload);
        alert("JSON sobrescrito completamente.");
    } catch (error) {
        console.error("Overwrite error:", error);
        alert("Error al sobrescribir JSON.");
    }
});

deleteBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;
    const id = validateId(selectedIdInput.value);
    if (!id) return;
    selectEditId(id);

    const confirmed = confirm(`Vas a eliminar items/${id} de forma permanente. Continuar?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "items", id));
        editJsonData = null;
        editJsonInfo.textContent = "";
        selectedEditId = "";
        selectedIdInput.value = "";
        alert("Documento eliminado.");
        const updatedIds = await fetchIdsByPrefix(searchIdInput.value);
        renderSearchResults(updatedIds);
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error al eliminar documento.");
    }
});

setAdminEnabled(false);
setStatus("Verificando sesion...");
setAuthButtonMode("login");

// Force fresh login every page load.
signOut(auth).catch(() => {
    setStatus("Debes iniciar sesion para continuar.");
});
