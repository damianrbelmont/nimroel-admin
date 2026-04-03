import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// 🔥 CONFIG (AQUÍ VAS A PONER LA TUYA REAL)
const firebaseConfig = {
    apiKey: "AIzaSyAALd99tyT-ILov22m1G58iforA3f-E628",
    authDomain: "nimroel-wiki.firebaseapp.com",
    projectId: "nimroel-wiki"
};


// 🔥 INIT
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();


// 🔐 UID ADMIN (TU CUENTA)
const ADMIN_UID = "TU_UID_AQUI";


// 🔐 LOGIN AUTOMÁTICO
function login() {
    signInWithPopup(auth, provider)
        .then(result => {
            console.log("🟢 Logeado:", result.user.uid);
        })
        .catch(err => {
            console.error("❌ Error login:", err);
        });
}


// 🔍 CONTROL SESIÓN
onAuthStateChanged(auth, (user) => {

    if (!user) {
        console.log("🔐 No logeado → lanzando login");
        login();
        return;
    }

    if (user.uid !== ADMIN_UID) {
        alert("No autorizado");
        document.body.innerHTML = "<h1>Acceso denegado</h1>";
        return;
    }

    console.log("👑 ADMIN OK");
});


// 📂 CARGA JSON
const fileInput = document.getElementById("jsonFile");
const jsonIdInput = document.getElementById("jsonId");
const jsonTypeInput = document.getElementById("jsonType");
const uploadBtn = document.getElementById("uploadBtn");
const jsonInfo = document.getElementById("jsonInfo");

let jsonData = null;

fileInput.addEventListener("change", (e) => {

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            jsonData = JSON.parse(event.target.result);

            // 🔥 AUTO DETECTAR ID Y TYPE
            jsonIdInput.value = jsonData.id || "";
            jsonTypeInput.value = jsonData.type || "";

            jsonInfo.innerHTML = `
                <p><strong>Nombre:</strong> ${jsonData.name || "-"}</p>
                <p><strong>ID:</strong> ${jsonData.id || "-"}</p>
                <p><strong>Tipo:</strong> ${jsonData.type || "-"}</p>
            `;

        } catch (err) {
            alert("JSON inválido");
        }
    };

    reader.readAsText(file);
});


// 🚀 SUBIR A FIREBASE
uploadBtn.addEventListener("click", async () => {

    if (!jsonData) {
        alert("Carga un JSON primero");
        return;
    }

    const id = jsonIdInput.value;
    const type = jsonTypeInput.value;

    if (!id || !type) {
        alert("ID y tipo requeridos");
        return;
    }

    try {
        await setDoc(doc(db, "items", id), {
            ...jsonData,
            type
        });

        alert("✅ Subido correctamente");

    } catch (error) {
        console.error(error);
        alert("Error al subir");
    }
});