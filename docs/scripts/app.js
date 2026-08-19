import { state } from "./state.js";
import { roadmapFromApi } from "./storage.js";
import { api } from "./api.js";

// Dashboard page logic. Bail out if this script is loaded anywhere else.
const listEl = document.getElementById("roadmap-list");
if (listEl) {
    initDashboard();
}

function initDashboard() {

    // ===== DOM =====
    const newRoadmapBtn = document.getElementById("new-roadmap-btn");
    const emptyState = document.getElementById("empty-state");
    const emptyText = document.getElementById("empty-text");
    const pageSubtitle = document.getElementById("page-subtitle");

    // create modal
    const createModal = document.getElementById("create-modal");
    const btnClose = document.getElementById("close-modal");
    const btnCancel = document.getElementById("cancel-btn");
    const btnCreate = document.getElementById("create-btn");
    const roadmapName = document.getElementById("roadmap-name");
    const roadmapDesc = document.getElementById("roadmap-description");
    const createError = document.getElementById("create-error");

    // delete modal
    const deleteModal = document.getElementById("delete-modal");
    const btnCloseDelete = document.getElementById("close-delete-modal");
    const btnCancelDelete = document.getElementById("cancel-delete-btn");
    const btnConfirmDelete = document.getElementById("confirm-delete-btn");

    // edit modal
    const renameModal = document.getElementById("rename-modal");
    const renameName = document.getElementById("rename-roadmap-name");
    const renameDesc = document.getElementById("rename-roadmap-description");
    const renameBtn = document.getElementById("rename-btn");
    const cancelRenameBtn = document.getElementById("cancel-rename-btn");
    const closeRenameBtn = document.getElementById("close-rename-modal");

    // sharing modal
    const accessModal = document.getElementById("access-modal");
    const closeAccessBtn = document.getElementById("close-access-modal");
    const accessList = document.getElementById("access-list");
    const accessUsername = document.getElementById("access-username");
    const accessAddBtn = document.getElementById("access-add-btn");
    const accessError = document.getElementById("access-error");

    // public share link
    const shareCreateBtn = document.getElementById("share-create-btn");
    const shareLinkBox = document.getElementById("share-link-box");
    const shareLinkInput = document.getElementById("share-link-input");
    const shareCopyBtn = document.getElementById("share-copy-btn");
    const shareDisableBtn = document.getElementById("share-disable-btn");

    let roadmapToRename = null;
    let accessRoadmapId = null;

    function openModal(m) { m.classList.add("open"); }
    function closeModalEl(m) { m.classList.remove("open"); }

    // ===== RENDER =====
    function renderDashboard() {
        const n = state.roadmaps.length;
        pageSubtitle.textContent =
            n === 0 ? "No active roadmaps" :
            n === 1 ? "1 active roadmap" :
            `${n} active roadmaps`;

        listEl.innerHTML = "";
        emptyState.style.display = n === 0 ? "block" : "none";
        if (n === 0 && state.user && state.user.isAdmin) {
            emptyText.textContent = "Create your first roadmap with the button above.";
        }

        state.roadmaps.forEach(roadmap => {
            listEl.appendChild(buildStrip(roadmap));
        });
    }

    function buildStrip(roadmap) {
        const isOwner = roadmap.role === "owner";
        const counts = roadmap.counts || {};
        const total = counts.total || 0;
        const finished = counts.finished || 0;
        const inProgress = counts.in_progress || 0;
        const planned = counts.planned || 0;

        const strip = document.createElement("article");
        strip.className = "roadmap-strip";
        strip.tabIndex = 0;
        strip.setAttribute("role", "link");
        strip.setAttribute("aria-label", `Open roadmap ${roadmap.name}`);

        // top row: title (+ role badge)
        const top = document.createElement("div");
        top.className = "strip-top";

        const title = document.createElement("h3");
        title.className = "strip-title";
        title.textContent = roadmap.name;
        if (!isOwner) {
            const badge = document.createElement("span");
            badge.className = "role-badge";
            badge.textContent = "Shared with you";
            title.appendChild(badge);
        }
        top.appendChild(title);
        strip.appendChild(top);

        if (roadmap.desc) {
            const desc = document.createElement("p");
            desc.className = "strip-desc";
            desc.textContent = roadmap.desc;
            strip.appendChild(desc);
        }

        // runway progress bar
        const runwayWrap = document.createElement("div");
        runwayWrap.className = "strip-runway";

        const runway = document.createElement("div");
        runway.className = "runway";
        if (total > 0) {
            const segFinished = document.createElement("span");
            segFinished.className = "seg seg-finished";
            segFinished.style.width = `${(finished / total) * 100}%`;
            const segProgress = document.createElement("span");
            segProgress.className = "seg seg-progress";
            segProgress.style.width = `${(inProgress / total) * 100}%`;
            runway.appendChild(segFinished);
            runway.appendChild(segProgress);
        }

        const runwayLabel = document.createElement("span");
        runwayLabel.className = "runway-label";
        runwayLabel.textContent = total > 0
            ? `${finished} of ${total} finished`
            : "No tasks yet";

        runwayWrap.appendChild(runway);
        runwayWrap.appendChild(runwayLabel);
        strip.appendChild(runwayWrap);

        // meta row: per-status counts + member count
        const meta = document.createElement("div");
        meta.className = "strip-meta";
        [
            ["planned", planned, "planned"],
            ["in_progress", inProgress, "in progress"],
            ["finished", finished, "finished"]
        ].forEach(([key, value, label]) => {
            const item = document.createElement("span");
            const dot = document.createElement("span");
            dot.className = `count-dot ${key}`;
            item.appendChild(dot);
            item.appendChild(document.createTextNode(`${value} ${label}`));
            meta.appendChild(item);
        });

        const members = document.createElement("span");
        members.className = "strip-members";
        members.textContent = roadmap.memberCount === 1
            ? "1 member"
            : `${roadmap.memberCount} members`;
        meta.appendChild(members);
        strip.appendChild(meta);

        // owner menu
        if (isOwner) {
            const wrap = document.createElement("div");
            wrap.className = "menu-wrap strip-menu-wrap";

            const menuBtn = document.createElement("button");
            menuBtn.className = "menu-btn";
            menuBtn.textContent = "⋯";
            menuBtn.setAttribute("aria-label", "Roadmap options");

            const menu = document.createElement("div");
            menu.className = "menu";

            const renameItem = document.createElement("button");
            renameItem.className = "menu-item";
            renameItem.textContent = "Edit details";
            renameItem.addEventListener("click", (e) => {
                e.stopPropagation();
                openRenameModal(roadmap);
                menu.classList.remove("open");
            });

            const accessItem = document.createElement("button");
            accessItem.className = "menu-item";
            accessItem.textContent = "Share";
            accessItem.addEventListener("click", (e) => {
                e.stopPropagation();
                openAccessModal(roadmap);
                menu.classList.remove("open");
            });

            const deleteItem = document.createElement("button");
            deleteItem.className = "menu-item danger";
            deleteItem.textContent = "Delete";
            deleteItem.addEventListener("click", (e) => {
                e.stopPropagation();
                openRoadmapDelete(roadmap);
                menu.classList.remove("open");
            });

            menuBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                document.querySelectorAll(".menu").forEach(m => {
                    if (m !== menu) m.classList.remove("open");
                });
                menu.classList.toggle("open");
            });

            menu.appendChild(renameItem);
            menu.appendChild(accessItem);
            menu.appendChild(deleteItem);
            wrap.appendChild(menuBtn);
            wrap.appendChild(menu);
            strip.appendChild(wrap);
        }

        strip.addEventListener("click", () => {
            window.location.href = `roadmap.html?id=${roadmap.id}`;
        });
        strip.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                window.location.href = `roadmap.html?id=${roadmap.id}`;
            }
        });

        return strip;
    }

    // close menus on outside click
    document.addEventListener("click", () => {
        document.querySelectorAll(".menu").forEach(m => m.classList.remove("open"));
    });

    // ===== CREATE =====
    newRoadmapBtn.addEventListener("click", () => {
        createError.textContent = "";
        openModal(createModal);
        roadmapName.focus();
    });

    function closeCreateModal() {
        closeModalEl(createModal);
        roadmapName.value = "";
        roadmapDesc.value = "";
    }

    btnCreate.addEventListener("click", async () => {
        const name = roadmapName.value.trim();
        if (!name) {
            createError.textContent = "Give the roadmap a name";
            return;
        }
        try {
            await api.createRoadmap({ title: name, description: roadmapDesc.value.trim() });
            closeCreateModal();
            await loadAndRender();
        } catch (err) {
            createError.textContent = err.error || "Could not create the roadmap";
        }
    });

    btnClose.addEventListener("click", closeCreateModal);
    btnCancel.addEventListener("click", closeCreateModal);
    createModal.addEventListener("click", (e) => {
        if (e.target === createModal) closeCreateModal();
    });

    // ===== EDIT =====
    function openRenameModal(roadmap) {
        roadmapToRename = roadmap;
        renameName.value = roadmap.name;
        renameDesc.value = roadmap.desc;
        openModal(renameModal);
    }

    renameBtn.addEventListener("click", async () => {
        if (!roadmapToRename) return;
        const newName = renameName.value.trim();
        if (!newName) return;

        await api.updateRoadmap(roadmapToRename.id, {
            title: newName,
            description: renameDesc.value
        });

        closeModalEl(renameModal);
        roadmapToRename = null;
        await loadAndRender();
    });

    cancelRenameBtn.addEventListener("click", () => closeModalEl(renameModal));
    closeRenameBtn.addEventListener("click", () => closeModalEl(renameModal));
    renameModal.addEventListener("click", (e) => {
        if (e.target === renameModal) closeModalEl(renameModal);
    });

    // ===== DELETE =====
    function openRoadmapDelete(roadmap) {
        openModal(deleteModal);
        btnConfirmDelete.onclick = async () => {
            closeModalEl(deleteModal);
            await api.deleteRoadmap(roadmap.id);
            await loadAndRender();
        };
    }

    btnCloseDelete.addEventListener("click", () => closeModalEl(deleteModal));
    btnCancelDelete.addEventListener("click", () => closeModalEl(deleteModal));
    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) closeModalEl(deleteModal);
    });

    // ===== SHARING =====
    async function openAccessModal(roadmap) {
        accessRoadmapId = roadmap.id;
        accessError.textContent = "";
        accessUsername.value = "";
        openModal(accessModal);
        await renderAccessList();
        await loadShareLink();
    }

    async function renderAccessList() {
        accessList.innerHTML = "";
        let users = [];
        try {
            users = await api.getAccess(accessRoadmapId);
        } catch (err) {
            accessError.textContent = err.error || "Could not load the member list";
            return;
        }

        if (!users || users.length === 0) {
            const empty = document.createElement("p");
            empty.className = "access-empty";
            empty.textContent = "No members yet. Add someone by username.";
            accessList.appendChild(empty);
            return;
        }

        users.forEach(u => {
            const row = document.createElement("div");
            row.className = "access-row";

            const left = document.createElement("div");
            left.className = "access-row-left";

            const avatar = document.createElement("span");
            avatar.className = "avatar";
            avatar.textContent = (u.username || "?").charAt(0);

            const name = document.createElement("span");
            name.textContent = u.username;

            left.appendChild(avatar);
            left.appendChild(name);

            const removeBtn = document.createElement("button");
            removeBtn.className = "btn-danger-ghost btn-small";
            removeBtn.textContent = "Remove";
            removeBtn.addEventListener("click", async () => {
                await api.removeAccess(accessRoadmapId, u.userId);
                await renderAccessList();
            });

            row.appendChild(left);
            row.appendChild(removeBtn);
            accessList.appendChild(row);
        });
    }

    accessAddBtn.addEventListener("click", async () => {
        accessError.textContent = "";
        const username = accessUsername.value.trim();
        if (!username) {
            accessError.textContent = "Enter a username";
            return;
        }
        try {
            await api.addAccess(accessRoadmapId, username);
            accessUsername.value = "";
            await renderAccessList();
        } catch (err) {
            accessError.textContent = err.error || "Could not add that user";
        }
    });

    accessUsername.addEventListener("keydown", (e) => {
        if (e.key === "Enter") accessAddBtn.click();
    });

    closeAccessBtn.addEventListener("click", () => closeModalEl(accessModal));
    accessModal.addEventListener("click", (e) => {
        if (e.target === accessModal) closeModalEl(accessModal);
    });

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
            shareCreateBtn.style.display = "inline-flex";
            shareLinkBox.style.display = "none";
            shareLinkInput.value = "";
        }
    }

    // "2026-06-12 12:33:10" (UTC) -> "3 minutes ago" / local date
    function formatWhen(ts) {
        if (!ts) return "";
        const when = new Date(ts.replace(" ", "T") + "Z");
        const diff = Date.now() - when.getTime();
        const min = Math.floor(diff / 60000);
        if (min < 1) return "just now";
        if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
        const days = Math.floor(hr / 24);
        if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
        return when.toLocaleDateString();
    }

    function renderShareStats(res) {
        const el = document.getElementById("share-stats");
        if (!el) return;
        if (res && res.publicToken) {
            const n = res.viewCount || 0;
            let txt = `${n} view${n === 1 ? "" : "s"}`;
            if (n > 0 && res.lastViewedAt) txt += ` · last viewed ${formatWhen(res.lastViewedAt)}`;
            el.textContent = txt;
            el.style.display = "block";
        } else {
            el.style.display = "none";
        }
    }

    async function loadShareLink() {
        try {
            const res = await api.getShare(accessRoadmapId);
            renderShareLink(res && res.publicToken);
            renderShareStats(res);
        } catch (err) {
            renderShareLink(null);
            renderShareStats(null);
        }
    }

    shareCreateBtn.addEventListener("click", async () => {
        try {
            await api.createShare(accessRoadmapId);
            await loadShareLink();
        } catch (err) {
            accessError.textContent = err.error || "Could not create the link";
        }
    });

    shareDisableBtn.addEventListener("click", async () => {
        try {
            await api.revokeShare(accessRoadmapId);
            renderShareLink(null);
            renderShareStats(null);
        } catch (err) {
            accessError.textContent = err.error || "Could not disable the link";
        }
    });

    shareCopyBtn.addEventListener("click", async () => {
        shareLinkInput.select();
        try {
            await navigator.clipboard.writeText(shareLinkInput.value);
        } catch (err) {
            document.execCommand("copy");
        }
        const original = shareCopyBtn.textContent;
        shareCopyBtn.textContent = "Copied!";
        setTimeout(() => { shareCopyBtn.textContent = original; }, 1500);
    });

    // ===== LOGOUT =====
    const logoutBtn = document.getElementById("logout-btn");
    logoutBtn.addEventListener("click", () => {
        localStorage.removeItem("kivo_token");
        window.location.href = "index.html";
    });

    // ===== DATA =====
    async function loadAndRender() {
        const roadmaps = await api.getRoadmaps();
        state.roadmaps = roadmaps.map(roadmapFromApi);
        renderDashboard();
    }

    async function initApp() {
        let me;
        try {
            me = await api.me();
        } catch (err) {
            window.location.href = "index.html";
            return;
        }
        if (!me) return; // redirect already underway

        state.user = me;
        const userLabel = document.getElementById("topbar-username");
        if (userLabel) userLabel.textContent = me.username;
        const avatar = document.getElementById("user-avatar");
        if (avatar) avatar.textContent = (me.username || "?").charAt(0);

        // only admins may create roadmaps
        if (!me.isAdmin) {
            newRoadmapBtn.style.display = "none";
        }

        await loadAndRender();
    }

    initApp();
}
