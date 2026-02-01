import { state } from "./state.js";
import { loadRoadmaps, saveRoadmaps } from "./storage.js";

// ===== DOM ELEMENTEN =====

// create roadmap modal
const modal = document.getElementById('create-modal');
const createRoadmapBtn = document.querySelector('.btn-new-roadmap');
const btnClose = document.getElementById('close-modal');
const btnCancel = document.getElementById('cancel-btn');
const btnCreate = document.getElementById('create-btn');

// inputs voor nieuwe roadmap
const roadmapName = document.getElementById("roadmap-name");
const roadmapDesc = document.getElementById("roadmap-description");

// delete modal
const btnCloseDelete = document.getElementById('close-delete-modal');
const btnCancelDelete = document.getElementById('cancel-delete-btn');
const btnConfirmDelete = document.getElementById('confirm-delete-btn');
const deleteModal = document.getElementById('delete-modal');

// rename modal
const renameModal = document.getElementById("rename-modal");
const renameName = document.getElementById("rename-roadmap-name");
const renameDesc = document.getElementById("rename-roadmap-description");
const renameBtn = document.getElementById("rename-btn");
const cancelRenameBtn = document.getElementById("cancel-rename-btn");
const closeRenameBtn = document.getElementById("close-rename-modal");

// dashboard info
const activeRoadmaps = document.getElementById("page-subtitle");

// ===== STATE VARIABELEN =====

// roadmap die wordt hernoemd
let roadmapToRename = null;

// roadmap waarvan description wordt aangepast
let roadmapDescToRedesc = null;


// ===== ROADMAP AANMAKEN =====
function createRoadmap(name, desc) {
    // check of naam al bestaat
    const existingRoadmap = state.roadmaps.find(
        roadmaps => roadmaps.name === name.toLowerCase()
    );

    // alleen aanmaken als alles geldig is
    if (!existingRoadmap && name && desc) {
        const newRoadmap = {
            name: name,
            id: Date.now(),
            desc: desc,
            columns: {
                todo: [],
                doing: [],
                done: []
            }
        };

        // toevoegen aan state
        state.roadmaps.push(newRoadmap);

        // inputs resetten
        roadmapDesc.value = "";
        roadmapName.value = "";

        // opslaan en opnieuw renderen
        saveRoadmaps();
        renderDashboard();
    }
}


// ===== DASHBOARD RENDEREN =====
function renderDashboard() {

    // tekst boven dashboard
    if (state.roadmaps.length == "0") {
        activeRoadmaps.textContent = "0 Active Roadmaps";
    } else if (state.roadmaps.length == "1") {
        activeRoadmaps.textContent = "1 Active Roadmap";
    } else {
        activeRoadmaps.textContent = state.roadmaps.length + " Active Roadmaps";
    }

    const grid = document.querySelector(".roadmaps-grid");
    grid.innerHTML = "";

    // elke roadmap renderen
    state.roadmaps.forEach(roadmap => {

        const card = document.createElement("div");
        card.className = "roadmap-card";

        const header = document.createElement("div");
        header.className = "roadmap-header";

        const title = document.createElement("h3");
        title.textContent = roadmap.name;

        const desc = document.createElement("p");
        desc.className = "roadmap-description";
        desc.textContent = roadmap.desc || "";

        // 3-puntjes menu knop
        const menuBtn = document.createElement("button");
        menuBtn.className = "roadmap-menu-btn";
        menuBtn.textContent = "⋯";

        // dropdown menu
        const menu = document.createElement("div");
        menu.className = "roadmap-menu";

        const renameBtn = document.createElement("button");
        const deleteBtn = document.createElement("button");

        renameBtn.className = "menu-item";
        deleteBtn.className = "menu-item";

        renameBtn.textContent = "Rename";
        deleteBtn.textContent = "Delete";
        deleteBtn.style.color = "red";

        menu.appendChild(renameBtn);
        menu.appendChild(deleteBtn);

        // delete via menu
        deleteBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openhabitDelete(roadmap);
            menu.classList.remove("open");
        });

        // rename via menu
        renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openRenameModal(roadmap);
            menu.classList.remove("open");
        });

        // menu openen/sluiten
        menuBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.querySelectorAll(".roadmap-menu").forEach(m => {
                if (m !== menu) m.classList.remove("open");
            });
            menu.classList.toggle("open");
        });

        header.appendChild(title);

        // kaart click gedrag
        card.addEventListener("click", (e) => {
            if (e.ctrlKey) {
                openhabitDelete(roadmap);
                return;
            }
            if (e.shiftKey) {
                openRenameModal(roadmap);
                return;
            }
            onRoadmapClick(roadmap.id);
        });

        // kaart opbouwen
        card.appendChild(header);
        card.appendChild(desc);
        card.appendChild(menuBtn);
        card.appendChild(menu);
        grid.appendChild(card);
    });

    // menu sluiten bij klik buiten
    document.addEventListener("click", () => {
        document.querySelectorAll(".roadmap-menu")
            .forEach(m => m.classList.remove("open"));
    });
}


// ===== RENAME MODAL =====
function openRenameModal(roadmap) {
    renameModal.style.display = "flex";
    roadmapToRename = roadmap;
    roadmapDescToRedesc = roadmap;
    renameName.value = roadmap.name;
    renameDesc.value = roadmap.desc;
}

// naam aanpassen
function renameRoadmap(roadmap) {
    const newName = renameName.value;
    if (!newName) return;

    roadmap.name = newName;
    saveRoadmaps();
    renderDashboard();
}

// description aanpassen
function redescRoadmap(roadmap) {
    const newDesc = renameDesc.value;
    if (!newDesc) return;

    roadmap.desc = newDesc;
    saveRoadmaps();
    renderDashboard();
}

// bevestigen rename
renameBtn.addEventListener("click", () => {
    renameRoadmap(roadmapToRename);
    redescRoadmap(roadmapDescToRedesc);
    renameModal.style.display = "none";
    roadmapToRename = null;
});


// ===== ROADMAP DELETE =====
function deleteRoadmap(id) {
    state.roadmaps = state.roadmaps.filter(h => h.id !== id);
    saveRoadmaps();
    renderDashboard();
}

function openhabitDelete(roadmap) {
    deleteModal.style.display = "flex";

    btnConfirmDelete.onclick = () => {
        deleteModal.style.display = "none";
        deleteRoadmap(roadmap.id);
    };

    btnCloseDelete.onclick = () => deleteModal.style.display = "none";
    btnCancelDelete.onclick = () => deleteModal.style.display = "none";
}


// ===== NAVIGATIE =====
function onRoadmapClick(id) {
    window.location.href = `roadmap.html?id=${id}`;
}


// ===== CREATE MODAL =====
function closeModal() {
    modal.style.display = "none";
    roadmapName.value = "";
    roadmapDesc.value = "";
}

createRoadmapBtn.addEventListener("click", () => {
    modal.style.display = "flex";
});

btnClose.addEventListener("click", closeModal);
btnCancel.addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});
// ===== DELETE MODAL SLUITEN =====
deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) deleteModal.style.display = "none";
});


// ===== RENAME MODAL SLUITEN =====
renameModal.addEventListener("click", (e) => {
    if (e.target === renameModal) renameModal.style.display = "none";
});

cancelRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});

closeRenameBtn.addEventListener("click", () => {
    renameModal.style.display = "none";
});


// ===== ROADMAP AANMAKEN BUTTON =====
btnCreate.addEventListener("click", () => {
    if (roadmapName.value && roadmapDesc.value !== "") {
        createRoadmap(roadmapName.value, roadmapDesc.value);
        closeModal();
    } else {
        if (roadmapName.value === "") {
            roadmapName.placeholder = "You have to input a name!";
        }
        if (roadmapDesc.value === "") {
            roadmapDesc.placeholder = "You have to input a description.";
        }
    }
});


// ===== APP START =====
function initApp() {
    loadRoadmaps();
    renderDashboard();
}

initApp();
