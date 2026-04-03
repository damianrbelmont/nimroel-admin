import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
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
    projectId: "nimroel-wiki"
};

const ADMIN_UID = "ofe3AaZtvwd7KxY8MqG4182BZpo2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new GoogleAuthProvider();


// 🔥 FORZAR LOGIN (BORRA SESIÓN SI EXISTE)
async function forceLogin() {
    if (auth.currentUser) {
        await signOut(auth);
    }

    signInWithPopup(auth, provider)
        .then(res => console.log("🟢 Logeado:", res.user.uid))
        .catch(err => console.error(err));
}


// 🔍 CONTROL SESIÓN
onAuthStateChanged(auth, (user) => {

    if (!user) {
        console.log("🔐 Lanzando login");
        forceLogin();
        return;
    }

    if (user.uid !== ADMIN_UID) {
        document.body.innerHTML = "<h1>Acceso denegado</h1>";
        return;
    }

    console.log("👑 ADMIN OK");
});


// 📂 RESTO IGUAL (NO TOCAR)
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