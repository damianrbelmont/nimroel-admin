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
    getDoc,
    getDocs,
    getFirestore,
    limit,
    orderBy,
    query,
    runTransaction,
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
const DEFAULT_TYPE = "character";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const itemsCollection = collection(db, "items");
const indexDocRef = doc(db, "meta", "index");

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

const adminBox = document.getElementById("adminBox");
const authStatus = document.getElementById("authStatus");
const loginBtn = document.getElementById("loginBtn");

const searchIdInput = document.getElementById("searchIdInput");
const searchBtn = document.getElementById("searchBtn");
const searchResults = document.getElementById("searchResults");
const selectedIdInput = document.getElementById("selectedIdInput");
const loadSelectedBtn = document.getElementById("loadSelectedBtn");
const newDocBtn = document.getElementById("newDocBtn");

const fieldId = document.getElementById("fieldId");
const fieldType = document.getElementById("fieldType");
const fieldName = document.getElementById("fieldName");
const fieldSlug = document.getElementById("fieldSlug");

const metaTitle = document.getElementById("metaTitle");
const metaImage = document.getElementById("metaImage");
const metaDescription = document.getElementById("metaDescription");

const aliasInput = document.getElementById("aliasInput");
const tagsInput = document.getElementById("tagsInput");
const relCharacters = document.getElementById("relCharacters");
const relLocations = document.getElementById("relLocations");
const relEvents = document.getElementById("relEvents");
const summaryInput = document.getElementById("summaryInput");

const sectionsContainer = document.getElementById("sectionsContainer");
const addSectionBtn = document.getElementById("addSectionBtn");

const extraRace = document.getElementById("extraRace");
const extraBirth = document.getElementById("extraBirth");
const extraDeath = document.getElementById("extraDeath");
const extraAffiliation = document.getElementById("extraAffiliation");

const createBtn = document.getElementById("createBtn");
const overwriteBtn = document.getElementById("overwriteBtn");
const deleteBtn = document.getElementById("deleteBtn");
const downloadPdfBtn = document.getElementById("downloadPdfBtn");

const editorInfo = document.getElementById("editorInfo");
const jsonPreview = document.getElementById("jsonPreview");

let isAuthorized = false;
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

    const controls = adminBox.querySelectorAll("input, textarea, button");
    controls.forEach((control) => {
        control.disabled = !enabled;
    });
}

function createInfoLine(label, value) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    line.appendChild(document.createTextNode(value || "-"));
    return line;
}

function setEditorMessage(lines) {
    editorInfo.textContent = "";
    lines.forEach(([label, value]) => {
        editorInfo.appendChild(createInfoLine(label, value));
    });
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

function normalizeLineBreaks(value) {
    return (value || "").toString().replace(/\r\n?/g, "\n");
}

function decodeEscapedLineBreaks(value) {
    return (value || "").toString().replace(/\\n/g, "\n");
}

function cleanText(value) {
    return normalizeLineBreaks(value).trim();
}

function cleanMultilineText(value) {
    return decodeEscapedLineBreaks(normalizeLineBreaks(value)).trim();
}

function parseList(value) {
    const source = decodeEscapedLineBreaks(normalizeLineBreaks(value));
    const entries = source
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    return [...new Set(entries)];
}

function formatList(values) {
    if (!Array.isArray(values)) return "";
    return values.join("\n");
}

function validateId(id, silent = false) {
    const trimmed = cleanText(id);
    if (!trimmed) {
        if (!silent) alert("Debes indicar un ID.");
        return null;
    }
    if (trimmed.includes("/")) {
        if (!silent) alert("El ID no puede contener '/'.");
        return null;
    }
    return trimmed;
}

function normalizeTypeToIndexKey(type) {
    const raw = (type || "").toString().trim().toLowerCase();
    if (!raw) return null;

    const aliases = {
        character: "characters",
        characters: "characters",
        location: "locations",
        locations: "locations",
        organization: "organizations",
        organizations: "organizations"
    };

    if (aliases[raw]) return aliases[raw];
    if (raw.endsWith("y")) return `${raw.slice(0, -1)}ies`;
    return raw.endsWith("s") ? raw : `${raw}s`;
}

function normalizeIndexData(data) {
    const normalized = {};

    if (data && typeof data === "object") {
        Object.entries(data).forEach(([key, value]) => {
            if (!Array.isArray(value)) return;
            const clean = value
                .map((entry) => (entry || "").toString().trim())
                .filter(Boolean);
            normalized[key] = [...new Set(clean)];
        });
    }

    if (!normalized.characters) normalized.characters = [];
    if (!normalized.locations) normalized.locations = [];
    if (!normalized.organizations) normalized.organizations = [];
    return normalized;
}

function removeIdFromAllIndexArrays(indexData, id) {
    Object.keys(indexData).forEach((key) => {
        if (!Array.isArray(indexData[key])) return;
        indexData[key] = indexData[key].filter((entry) => entry !== id);
    });
}

function sortIndexArrays(indexData) {
    Object.keys(indexData).forEach((key) => {
        if (!Array.isArray(indexData[key])) return;
        indexData[key] = [...new Set(indexData[key])].sort((a, b) => a.localeCompare(b));
    });
}

async function updateIndexForUpsert(id, type) {
    const indexKey = normalizeTypeToIndexKey(type);
    if (!indexKey) throw new Error("No se pudo normalizar el type para el indice.");

    await runTransaction(db, async (transaction) => {
        const indexSnap = await transaction.get(indexDocRef);
        const indexData = normalizeIndexData(indexSnap.exists() ? indexSnap.data() : {});

        removeIdFromAllIndexArrays(indexData, id);

        if (!Array.isArray(indexData[indexKey])) {
            indexData[indexKey] = [];
        }
        indexData[indexKey].push(id);
        sortIndexArrays(indexData);

        transaction.set(indexDocRef, indexData);
    });
}

async function updateIndexForDelete(id) {
    await runTransaction(db, async (transaction) => {
        const indexSnap = await transaction.get(indexDocRef);
        if (!indexSnap.exists()) return;

        const indexData = normalizeIndexData(indexSnap.data());
        removeIdFromAllIndexArrays(indexData, id);
        sortIndexArrays(indexData);
        transaction.set(indexDocRef, indexData);
    });
}

function sanitizePdfText(value) {
    return normalizeLineBreaks(value)
        .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, "")
        .trim();
}

function createSectionCard(section = {}) {
    const card = document.createElement("div");
    card.className = "section-card";

    const cardTitle = document.createElement("p");
    cardTitle.className = "section-card-title";
    card.appendChild(cardTitle);

    const idLabel = document.createElement("label");
    idLabel.className = "field-label";
    idLabel.textContent = "Section ID";
    card.appendChild(idLabel);

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.className = "section-id";
    idInput.placeholder = "early_life";
    idInput.value = (section.id || "").toString();
    card.appendChild(idInput);

    const titleLabel = document.createElement("label");
    titleLabel.className = "field-label";
    titleLabel.textContent = "Section Title";
    card.appendChild(titleLabel);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "section-title-input";
    titleInput.placeholder = "Vida temprana";
    titleInput.value = (section.title || "").toString();
    card.appendChild(titleInput);

    const textLabel = document.createElement("label");
    textLabel.className = "field-label";
    textLabel.textContent = "Section Text";
    card.appendChild(textLabel);

    const textArea = document.createElement("textarea");
    textArea.className = "section-text";
    textArea.rows = 8;
    textArea.placeholder = "Texto de la seccion...";
    textArea.value = (section.text || "").toString();
    card.appendChild(textArea);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "section-remove";
    removeButton.textContent = "ELIMINAR SECCION";
    removeButton.addEventListener("click", () => {
        card.remove();
        refreshSectionTitles();
        updateJsonPreview();
    });
    card.appendChild(removeButton);

    [idInput, titleInput, textArea].forEach((control) => {
        control.addEventListener("input", updateJsonPreview);
    });

    sectionsContainer.appendChild(card);
    refreshSectionTitles();
}

function refreshSectionTitles() {
    const cards = sectionsContainer.querySelectorAll(".section-card");
    cards.forEach((card, index) => {
        const title = card.querySelector(".section-card-title");
        if (title) {
            title.textContent = `Seccion ${index + 1}`;
        }
    });
}

function renderSections(sections) {
    sectionsContainer.textContent = "";
    if (Array.isArray(sections) && sections.length > 0) {
        sections.forEach((section) => createSectionCard(section));
        return;
    }
    createSectionCard();
}

function collectSections(strict = false) {
    const cards = sectionsContainer.querySelectorAll(".section-card");
    const sections = [];
    const ids = new Set();

    for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const id = cleanText(card.querySelector(".section-id")?.value);
        const title = cleanText(card.querySelector(".section-title-input")?.value);
        const text = cleanMultilineText(card.querySelector(".section-text")?.value);

        if (!id && !title && !text) {
            continue;
        }

        if (strict && (!id || !title || !text)) {
            alert(`La seccion ${i + 1} debe tener id, title y text.`);
            return null;
        }

        if (id && ids.has(id)) {
            if (strict) {
                alert(`Hay IDs de seccion repetidos: ${id}`);
                return null;
            }
            continue;
        }

        if (id) ids.add(id);

        sections.push({ id, title, text });
    }

    return sections;
}

function buildPayload(strict = false) {
    const id = validateId(fieldId.value, !strict);
    const type = cleanText(fieldType.value);
    const name = cleanText(fieldName.value);
    const slug = cleanText(fieldSlug.value);

    const sections = collectSections(strict);
    if (!sections) return null;

    const missing = [];
    if (strict && !id) missing.push("id");
    if (strict && !type) missing.push("type");
    if (strict && !name) missing.push("name");
    if (strict && !slug) missing.push("slug");

    if (strict && missing.length > 0) {
        alert(`Faltan campos obligatorios: ${missing.join(", ")}`);
        return null;
    }

    return {
        id: id || "",
        type: type || "",
        name: name || "",
        slug: slug || "",
        meta: {
            title: cleanText(metaTitle.value),
            description: cleanMultilineText(metaDescription.value),
            image: cleanText(metaImage.value)
        },
        alias: parseList(aliasInput.value),
        tags: parseList(tagsInput.value),
        relations: {
            characters: parseList(relCharacters.value),
            locations: parseList(relLocations.value),
            events: parseList(relEvents.value)
        },
        content: {
            summary: cleanMultilineText(summaryInput.value),
            sections
        },
        extra: {
            race: cleanText(extraRace.value),
            birth: cleanText(extraBirth.value),
            death: cleanText(extraDeath.value),
            affiliation: parseList(extraAffiliation.value)
        }
    };
}

function fillFormFromPayload(payload) {
    fieldId.value = (payload.id || "").toString();
    fieldType.value = (payload.type || DEFAULT_TYPE).toString();
    fieldName.value = (payload.name || "").toString();
    fieldSlug.value = (payload.slug || "").toString();

    metaTitle.value = (payload.meta?.title || "").toString();
    metaDescription.value = (payload.meta?.description || "").toString();
    metaImage.value = (payload.meta?.image || "").toString();

    aliasInput.value = formatList(payload.alias);
    tagsInput.value = formatList(payload.tags);

    relCharacters.value = formatList(payload.relations?.characters);
    relLocations.value = formatList(payload.relations?.locations);
    relEvents.value = formatList(payload.relations?.events);

    summaryInput.value = (payload.content?.summary || "").toString();
    renderSections(payload.content?.sections);

    extraRace.value = (payload.extra?.race || "").toString();
    extraBirth.value = (payload.extra?.birth || "").toString();
    extraDeath.value = (payload.extra?.death || "").toString();
    extraAffiliation.value = formatList(payload.extra?.affiliation);

    updateJsonPreview();
}

function clearForm() {
    fieldId.value = "";
    fieldType.value = DEFAULT_TYPE;
    fieldName.value = "";
    fieldSlug.value = "";

    metaTitle.value = "";
    metaDescription.value = "";
    metaImage.value = "";

    aliasInput.value = "";
    tagsInput.value = "";

    relCharacters.value = "";
    relLocations.value = "";
    relEvents.value = "";

    summaryInput.value = "";
    renderSections([]);

    extraRace.value = "";
    extraBirth.value = "";
    extraDeath.value = "";
    extraAffiliation.value = "";

    selectedEditId = "";
    selectedIdInput.value = "";
    setEditorMessage([["Estado", "Documento nuevo en blanco"]]);
    updateJsonPreview();
}

function updateJsonPreview() {
    const payload = buildPayload(false);
    if (!payload) {
        jsonPreview.textContent = "{}";
        return;
    }
    jsonPreview.textContent = JSON.stringify(payload, null, 2);
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

async function fetchIdsBySearch(searchValue) {
    const term = (searchValue || "").toString().trim().toLowerCase();
    const baseQuery = query(itemsCollection, orderBy(documentId()), limit(300));
    const snapshot = await getDocs(baseQuery);
    const allIds = snapshot.docs.map((item) => item.id);

    if (!term) return allIds.slice(0, 25);
    return allIds
        .filter((id) => id.toLowerCase().includes(term))
        .slice(0, 60);
}

function exportPayloadToPdf(payload) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("No se pudo cargar la libreria PDF.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });

    const margin = 48;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;
    const lineHeight = 14;
    let y = margin;

    const ensureSpace = (height = lineHeight) => {
        if (y + height <= pageHeight - margin) return;
        pdf.addPage();
        y = margin;
    };

    const writeWrapped = (text, indent = 0) => {
        const safe = sanitizePdfText(text) || "-";
        const lines = pdf.splitTextToSize(safe, maxWidth - indent);
        lines.forEach((line) => {
            ensureSpace(lineHeight);
            pdf.text(line, margin + indent, y);
            y += lineHeight;
        });
    };

    const writeTitle = (text) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        const lines = pdf.splitTextToSize(sanitizePdfText(text) || "Documento Nimroel", maxWidth);
        lines.forEach((line) => {
            ensureSpace(24);
            pdf.text(line, margin, y);
            y += 24;
        });
        y += 8;
    };

    const writeLabel = (label) => {
        ensureSpace(16);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text((label || "").toUpperCase(), margin, y);
        y += 14;
    };

    const writeField = (label, value) => {
        if (value == null) return;
        if (Array.isArray(value) && value.length === 0) return;
        if (!Array.isArray(value) && sanitizePdfText(value) === "") return;

        writeLabel(label);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        const body = Array.isArray(value) ? value.join(", ") : value;
        writeWrapped(body, 10);
        y += 6;
    };

    const drawDivider = () => {
        ensureSpace(12);
        pdf.setDrawColor(184, 155, 94);
        pdf.setLineWidth(0.7);
        pdf.line(margin, y, pageWidth - margin, y);
        y += 12;
    };

    const title = payload.meta?.title || payload.name || payload.id || "Documento Nimroel";
    writeTitle(title);

    writeField("ID", payload.id);
    writeField("Type", payload.type);
    writeField("Name", payload.name);
    writeField("Slug", payload.slug);
    writeField("Meta Description", payload.meta?.description);
    writeField("Meta Image", payload.meta?.image);
    writeField("Alias", payload.alias);
    writeField("Tags", payload.tags);

    writeField("Relations Characters", payload.relations?.characters);
    writeField("Relations Locations", payload.relations?.locations);
    writeField("Relations Events", payload.relations?.events);

    writeField("Race", payload.extra?.race);
    writeField("Birth", payload.extra?.birth);
    writeField("Death", payload.extra?.death);
    writeField("Affiliation", payload.extra?.affiliation);

    drawDivider();
    writeLabel("Summary");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    writeWrapped(payload.content?.summary || "-", 10);

    y += 8;
    drawDivider();
    writeLabel("Sections");

    const sections = Array.isArray(payload.content?.sections) ? payload.content.sections : [];
    if (sections.length === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        writeWrapped("Sin secciones.", 10);
    } else {
        sections.forEach((section, index) => {
            ensureSpace(18);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(13);
            pdf.text(`${index + 1}. ${sanitizePdfText(section.title) || "Sin titulo"}`, margin + 10, y);
            y += 16;

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            ensureSpace(13);
            pdf.text("ID:", margin + 10, y);
            pdf.setFont("helvetica", "normal");
            pdf.text(sanitizePdfText(section.id) || "-", margin + 28, y);
            y += 13;

            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11);
            writeWrapped(section.text || "-", 10);
            y += 7;

            drawDivider();
        });
    }

    const safeName = (payload.id || payload.slug || "nimroel_document")
        .toString()
        .replace(/[^a-zA-Z0-9_-]/g, "_");
    pdf.save(`${safeName}.pdf`);
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

searchBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    try {
        const ids = await fetchIdsBySearch(searchIdInput.value);
        renderSearchResults(ids);
    } catch (error) {
        console.error("Search error:", error);
        alert("Error al buscar IDs.");
    }
});

loadSelectedBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    const chosen = validateId(selectedIdInput.value || selectedEditId);
    if (!chosen) return;

    try {
        const snapshot = await getDoc(doc(db, "items", chosen));
        if (!snapshot.exists()) {
            alert("No existe un documento con ese ID.");
            return;
        }

        const data = snapshot.data() || {};
        data.id = chosen;
        fillFormFromPayload(data);
        selectEditId(chosen);

        setEditorMessage([
            ["Estado", "Documento cargado desde Firebase"],
            ["ID cargado", chosen],
            ["Nombre", data.name || "-"]
        ]);
    } catch (error) {
        console.error("Load error:", error);
        alert("Error al cargar el documento.");
    }
});

newDocBtn.addEventListener("click", () => {
    if (!ensureAuthorized()) return;
    clearForm();
});

addSectionBtn.addEventListener("click", () => {
    createSectionCard();
    updateJsonPreview();
});

createBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    const payload = buildPayload(true);
    if (!payload) return;

    try {
        const itemRef = doc(db, "items", payload.id);
        const existing = await getDoc(itemRef);

        if (existing.exists()) {
            alert("Ese ID ya existe. Carga el documento y usa guardar cambios.");
            return;
        }

        await setDoc(itemRef, payload);
        await updateIndexForUpsert(payload.id, payload.type);

        selectEditId(payload.id);
        setEditorMessage([
            ["Estado", "Documento nuevo creado"],
            ["ID", payload.id],
            ["Type", payload.type]
        ]);

        const ids = await fetchIdsBySearch(searchIdInput.value);
        renderSearchResults(ids);
        alert("Documento creado en Firebase e indice actualizado.");
    } catch (error) {
        console.error("Create error:", error);
        alert("Error al crear el documento.");
    }
});

overwriteBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    if (!selectedEditId) {
        alert("Primero carga un documento desde Firebase para editarlo.");
        return;
    }

    const payload = buildPayload(true);
    if (!payload) return;

    if (payload.id !== selectedEditId) {
        alert("Para sobrescribir, el campo ID debe coincidir con el documento cargado.");
        return;
    }

    try {
        const itemRef = doc(db, "items", selectedEditId);
        const existing = await getDoc(itemRef);
        if (!existing.exists()) {
            alert("El documento cargado ya no existe. Cargalo de nuevo.");
            return;
        }

        await setDoc(itemRef, payload);
        await updateIndexForUpsert(payload.id, payload.type);

        setEditorMessage([
            ["Estado", "Documento sobrescrito"],
            ["ID", payload.id],
            ["Type", payload.type]
        ]);

        alert("Cambios guardados. El JSON anterior fue sustituido.");
    } catch (error) {
        console.error("Overwrite error:", error);
        alert("Error al guardar cambios.");
    }
});

deleteBtn.addEventListener("click", async () => {
    if (!ensureAuthorized()) return;

    if (!selectedEditId) {
        alert("No hay documento cargado para eliminar.");
        return;
    }

    const confirmed = confirm(`Vas a eliminar items/${selectedEditId}. Continuar?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "items", selectedEditId));
        await updateIndexForDelete(selectedEditId);

        clearForm();
        const ids = await fetchIdsBySearch(searchIdInput.value);
        renderSearchResults(ids);

        alert("Documento eliminado e indice actualizado.");
    } catch (error) {
        console.error("Delete error:", error);
        alert("Error al eliminar el documento.");
    }
});

downloadPdfBtn.addEventListener("click", () => {
    if (!ensureAuthorized()) return;
    const payload = buildPayload(false);
    if (!payload) return;
    exportPayloadToPdf(payload);
});

adminBox.addEventListener("input", () => {
    updateJsonPreview();
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
        const initialIds = await fetchIdsBySearch("");
        renderSearchResults(initialIds);
    } catch (error) {
        console.error("Initial list error:", error);
        renderSearchResults([]);
    }

    clearForm();
});

setAdminEnabled(false);
setStatus("Verificando sesion...");
setAuthButtonMode("login");

signOut(auth).catch(() => {
    setStatus("Debes iniciar sesion para continuar.");
});
