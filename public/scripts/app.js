import { state } from "./state.js";
import { roadmapFromApi } from "./storage.js";
import { api } from "./api.js";

// app.js is loaded by both dashboard.html and roadmap.html. Only the dashboard
// has the "+ New Roadmap" button — bail early everywhere else so we don't touch
// elements that don't exist on the roadmap editor page.
const createRoadmapBtn = document.querySelector('.btn-new-roadmap');
if (createRoadmapBtn) {
    initDashboard();
}

function initDashboard() {

    // ===== DOM ELEMENTEN =====

    // create roadmap modal
    const modal = document.getElementById('create-modal');
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

    // access modal
    const accessModal = document.getElementById("access-modal");
    const closeAccessBtn = document.getElementById("close-access-modal");
    const accessList = document.getElementById("access-list");
    const accessUsername = document.getElementById("access-username");
    const accessRole = document.getElementById("access-role");
    const accessAddBtn = document.getElementById("access-add-btn");
    const accessError = document.getElementById("access-error");

    // public share link
    const shareCreateBtn = document.getElementById("share-create-btn");
    const shareLinkBox = document.getElementById("share-link-box");
    const shareLinkInput = document.getElementById("share-link-input");
    const shareCopyBtn = document.getElementById("share-copy-btn");
    const shareDisableBtn = document.getElementById("share-disable-btn");

    // dashboard info
    const activeRoadmaps = document.getElementById("page-subtitle");

    // ===== STATE VARIABELEN =====
    let roadmapToRename = null;
    let accessRoadmapId = null;

    // ===== ROADMAP AANMAKEN =====
    async function createRoadmap(name, desc) {
        // check of naam al bestaat (client-side, vriendelijke check)
        const existingRoadmap = state.roadmaps.find(
            r => r.name.toLowerCase() === name.toLowerCase()
        );

        if (!existingRoadmap && name && desc) {
            await api.createRoadmap({ title: name, description: desc });

            roadmapDesc.value = "";
            roadmapName.value = "";

            await loadAndRender();
        }
    }

    // ===== DASHBOARD RENDEREN =====
    function renderDashboard() {

        if (state.roadmaps.length === 0) {
            activeRoadmaps.textContent = "0 Active Roadmaps";
        } else if (state.roadmaps.length === 1) {
            activeRoadmaps.textContent = "1 Active Roadmap";
        } else {
            activeRoadmaps.textContent = state.roadmaps.length + " Active Roadmaps";
        }

        const grid = document.querySelector(".roadmaps-grid");
        grid.innerHTML = "";

        state.roadmaps.forEach(roadmap => {

            const isOwner = roadmap.role === "owner";

            const card = document.createElement("div");
            card.className = "roadmap-card";

            const header = document.createElement("div");
            header.className = "roadmap-header";

            const title = document.createElement("h3");
            title.textContent = roadmap.name;

            // kleine rol-badge voor gedeelde roadmaps
            if (!isOwner) {
                const badge = document.createElement("span");
                badge.className = "role-badge";
                badge.textContent = roadmap.role === "editor" ? "Editor" : "Viewer";
                title.appendChild(document.createTextNode(" "));
                title.appendChild(badge);
            }

            const desc = document.createElement("p");
            desc.className = "roadmap-description";
            desc.textContent = roadmap.desc || "";

            header.appendChild(title);
            card.appendChild(header);
            card.appendChild(desc);

            // 3-puntjes menu enkel voor de owner
            if (isOwner) {
                const menuBtn = document.createElement("button");
                menuBtn.className = "roadmap-menu-btn";
                menuBtn.textContent = "⋯";

                const menu = document.createElement("div");
                menu.className = "roadmap-menu";

                const renameItem = document.createElement("button");
                const accessItem = document.createElement("button");
                const deleteItem = document.createElement("button");

                renameItem.className = "menu-item";
                accessItem.className = "menu-item";
                deleteItem.className = "menu-item";

                renameItem.textContent = "Rename";
                accessItem.textContent = "Manage Access";
                deleteItem.textContent = "Delete";
                deleteItem.style.color = "red";

                menu.appendChild(renameItem);
                menu.appendChild(accessItem);
                menu.appendChild(deleteItem);

                deleteItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openRoadmapDelete(roadmap);
                    menu.classList.remove("open");
                });

                renameItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openRenameModal(roadmap);
                    menu.classList.remove("open");
                });

                accessItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openAccessModal(roadmap);
                    menu.classList.remove("open");
                });

                menuBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    document.querySelectorAll(".roadmap-menu").forEach(m => {
                        if (m !== menu) m.classList.remove("open");
                    });
                    menu.classList.toggle("open");
                });

                card.appendChild(menuBtn);
                card.appendChild(menu);
            }

            // kaart click gedrag
            card.addEventListener("click", (e) => {
                if (isOwner && e.ctrlKey) {
                    openRoadmapDelete(roadmap);
                    return;
                }
                if (isOwner && e.shiftKey) {
                    openRenameModal(roadmap);
                    return;
                }
                onRoadmapClick(roadmap.id);
            });

            grid.appendChild(card);
        });
    }

    // menu sluiten bij klik buiten (één keer registreren)
    document.addEventListener("click", () => {
        document.querySelectorAll(".roadmap-menu")
            .forEach(m => m.classList.remove("open"));
    });

    // ===== RENAME MODAL =====
    function openRenameModal(roadmap) {
        renameModal.style.display = "flex";
        roadmapToRename = roadmap;
        renameName.value = roadmap.name;
        renameDesc.value = roadmap.desc;
    }

    renameBtn.addEventListener("click", async () => {
        if (!roadmapToRename) return;
        const newName = renameName.value.trim();
        if (!newName) return;

        await api.updateRoadmap(roadmapToRename.id, {
            title: newName,
            description: renameDesc.value
        });

        renameModal.style.display = "none";
        roadmapToRename = null;
        await loadAndRender();
    });

    // ===== ROADMAP DELETE =====
    function openRoadmapDelete(roadmap) {
        deleteModal.style.display = "flex";

        btnConfirmDelete.onclick = async () => {
            deleteModal.style.display = "none";
            await api.deleteRoadmap(roadmap.id);
            await loadAndRender();
        };

        btnCloseDelete.onclick = () => deleteModal.style.display = "none";
        btnCancelDelete.onclick = () => deleteModal.style.display = "none";
    }

    // ===== ACCESS / SHARING =====
    async function openAccessModal(roadmap) {
        accessRoadmapId = roadmap.id;
        accessError.textContent = "";
        accessUsername.value = "";
        accessRole.value = "editor";
        accessModal.style.display = "flex";
        await renderAccessList();
        await loadShareLink();
    }

    // ===== PUBLIC SHARE LINK =====
    function publicUrl(token) {
        return `${window.location.origin}/view.html?token=${token}`;
    }

    function renderShareLink(token) {
        if (token) {
            shareCreateBtn.style.display = "none";
            shareLinkBox.style.display = "flex";
            shareLinkInput.value = publicUrl(token);
        } else {
            shareCreateBtn.style.display = "block";
            shareLinkBox.style.display = "none";
            shareLinkInput.value = "";
        }
    }

    async function loadShareLink() {
        try {
            const res = await api.getShare(accessRoadmapId);
            renderShareLink(res && res.publicToken);
        } catch (err) {
            renderShareLink(null);
        }
    }

    shareCreateBtn.addEventListener("click", async () => {
        try {
            const res = await api.createShare(accessRoadmapId);
            renderShareLink(res.publicToken);
        } catch (err) {
            accessError.textContent = err.error || "Could not create link";
        }
    });

    shareDisableBtn.addEventListener("click", async () => {
        try {
            await api.revokeShare(accessRoadmapId);
            renderShareLink(null);
        } catch (err) {
            accessError.textContent = err.error || "Could not disable link";
        }
    });

    shareCopyBtn.addEventListener("click", async () => {
        shareLinkInput.select();
        try {
            await navigator.clipboard.writeText(shareLinkInput.value);
        } catch (err) {
            document.execCommand("copy"); // fallback for older browsers
        }
        const original = shareCopyBtn.textContent;
        shareCopyBtn.textContent = "Copied!";
        setTimeout(() => { shareCopyBtn.textContent = original; }, 1500);
    });

    async function renderAccessList() {
        accessList.innerHTML = "";
        let users = [];
        try {
            users = await api.getAccess(accessRoadmapId);
        } catch (err) {
            accessError.textContent = err.error || "Could not load access list";
            return;
        }

        if (!users || users.length === 0) {
            const empty = document.createElement("p");
            empty.className = "access-empty";
            empty.textContent = "No one else has access yet.";
            accessList.appendChild(empty);
            return;
        }

        users.forEach(u => {
            const row = document.createElement("div");
            row.className = "access-row";

            const name = document.createElement("span");
            name.className = "access-name";
            name.textContent = u.username;

            const badge = document.createElement("span");
            badge.className = "role-badge";
            badge.textContent = u.role === "editor" ? "Editor" : "Viewer";

            const removeBtn = document.createElement("button");
            removeBtn.className = "access-remove";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", async () => {
                await api.removeAccess(accessRoadmapId, u.userId);
                await renderAccessList();
            });

            const left = document.createElement("div");
            left.className = "access-row-left";
            left.appendChild(name);
            left.appendChild(badge);

            row.appendChild(left);
            row.appendChild(removeBtn);
            accessList.appendChild(row);
        });
    }

    accessAddBtn.addEventListener("click", async () => {
        accessError.textContent = "";
        const username = accessUsername.value.trim();
        const role = accessRole.value;
        if (!username) {
            accessError.textContent = "Enter a username";
            return;
        }
        try {
            await api.addAccess(accessRoadmapId, username, role);
            accessUsername.value = "";
            await renderAccessList();
        } catch (err) {
            accessError.textContent = err.error || "Could not add user";
        }
    });

    closeAccessBtn.addEventListener("click", () => accessModal.style.display = "none");
    accessModal.addEventListener("click", (e) => {
        if (e.target === accessModal) accessModal.style.display = "none";
    });

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

    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) deleteModal.style.display = "none";
    });

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

    // ===== LOGOUT =====
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.removeItem("kivo_token");
            window.location.href = "index.html";
        });
    }

    // ===== DATA LADEN =====
    async function loadAndRender() {
        const roadmaps = await api.getRoadmaps();
        state.roadmaps = roadmaps.map(roadmapFromApi);
        renderDashboard();
    }

    // ===== APP START =====
    async function initApp() {
        // verify de sessie; bij 401 stuurt api.me() ons al naar de login
        let me;
        try {
            me = await api.me();
        } catch (err) {
            window.location.href = "index.html";
            return;
        }
        if (!me) return; // redirect was al ingezet

        state.user = me;
        const userLabel = document.getElementById("sidebar-username");
        if (userLabel) userLabel.textContent = me.username;

        // alleen toegestane accounts mogen roadmaps aanmaken
        if (me.canCreateRoadmaps === false) {
            createRoadmapBtn.style.display = "none";
        }

        await loadAndRender();
    }

    initApp();
}
