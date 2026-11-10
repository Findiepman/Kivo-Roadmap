import { api } from "./api.js";
import { svgIcon, ICON } from "./icons.js";

// Accounts column of the admin dashboard: every account on the install, with
// create / edit / delete, and per account the roadmaps it is on.
// onChange() reloads the whole dashboard (roadmap owners and member counts
// change when accounts are renamed, deleted or removed from a roadmap).
export function initAdminPanel(me, onChange) {

    // ===== DOM =====
    const accountsCol = document.getElementById("accounts-col");
    const accountList = document.getElementById("account-list");
    const accountCount = document.getElementById("account-count");
    const adminError = document.getElementById("admin-error");

    // new account modal
    const newModal = document.getElementById("new-account-modal");
    const newAccountBtn = document.getElementById("new-account-btn");
    const newUsername = document.getElementById("new-username");
    const newPassword = document.getElementById("new-password");
    const newError = document.getElementById("new-account-error");
    const createAccountBtn = document.getElementById("create-account-btn");
    const cancelNewBtn = document.getElementById("cancel-new-account");
    const closeNewBtn = document.getElementById("close-new-account");

    // edit modal
    const editModal = document.getElementById("edit-user-modal");
    const editTitle = document.getElementById("edit-user-title");
    const editUsername = document.getElementById("edit-username");
    const editPassword = document.getElementById("edit-password");
    const editError = document.getElementById("edit-user-error");
    const saveEditBtn = document.getElementById("save-edit-user");
    const cancelEditBtn = document.getElementById("cancel-edit-user");
    const closeEditBtn = document.getElementById("close-edit-user");

    // delete modal
    const deleteModal = document.getElementById("delete-user-modal");
    const deleteWarning = document.getElementById("delete-user-warning");
    const confirmDeleteBtn = document.getElementById("confirm-delete-user");
    const cancelDeleteBtn = document.getElementById("cancel-delete-user");
    const closeDeleteBtn = document.getElementById("close-delete-user");

    let userToEdit = null;
    let userToDelete = null;
    const expanded = new Set(); // account ids whose roadmap list is open

    accountsCol.style.display = "block";

    function openModal(m) { m.classList.add("open"); }
    function closeModal(m) { m.classList.remove("open"); }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    const ROLE_LABELS = { owner: "Owner", editor: "Editor", viewer: "Viewer" };

    // ===== RENDER =====
    async function renderAccounts() {
        let users;
        try {
            users = await api.adminListUsers();
        } catch (err) {
            adminError.textContent = err.error || "Could not load accounts";
            return;
        }
        if (!users) return;
        adminError.textContent = "";

        accountCount.textContent = users.length;
        accountList.innerHTML = "";
        users.forEach(u => accountList.appendChild(buildAccountCard(u)));
    }

    function buildAccountCard(u) {
        const card = el("div", "account-card");
        const open = expanded.has(u.id);

        const owned = u.roadmaps.filter(r => r.role === "owner").length;

        // head: toggles the roadmap list
        const head = el("button", "account-head" + (open ? " open" : ""));
        head.type = "button";
        head.setAttribute("aria-expanded", String(open));

        const chev = el("span", "chev");
        chev.appendChild(svgIcon(ICON.chevron, 16));
        head.appendChild(chev);

        head.appendChild(el("span", "avatar", (u.username || "?").charAt(0)));

        const main = el("span", "person-main");
        const name = el("span", "person-name", u.username);
        if (u.isAdmin) name.appendChild(el("span", "role-badge", "Admin"));
        if (u.id === me.id) name.appendChild(el("span", "user-since", "(you)"));
        main.appendChild(name);
        const total = u.roadmaps.length;
        main.appendChild(el("span", "person-sub",
            total === 0
                ? "Not on any roadmap"
                : `On ${total} ${total === 1 ? "roadmap" : "roadmaps"}` + (owned ? ` · owns ${owned}` : "")));
        head.appendChild(main);

        // actions
        const actions = el("div", "account-actions");
        const editBtn = el("button", "btn-ghost btn-small", "Edit");
        editBtn.addEventListener("click", () => openEditModal(u));
        const deleteBtn = el("button", "btn-danger-ghost btn-small", "Delete");
        deleteBtn.addEventListener("click", () => openDeleteModal(u));
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        const top = el("div", "account-top");
        top.appendChild(head);
        top.appendChild(actions);
        card.appendChild(top);

        // panel: the roadmaps this account is on
        const panel = el("div", "account-panel");
        panel.style.display = open ? "block" : "none";
        if (u.roadmaps.length === 0) {
            panel.appendChild(el("p", "access-empty", "Not on any roadmap yet. Add them from a roadmap's Share menu."));
        }
        u.roadmaps.forEach(r => {
            const row = el("div", "account-roadmap");
            const link = el("a", "account-roadmap-name", r.title);
            link.href = `roadmap.html?id=${r.id}`;
            row.appendChild(link);
            row.appendChild(el("span", "role-badge", ROLE_LABELS[r.role] || r.role));
            if (r.role !== "owner") {
                const removeBtn = el("button", "btn-danger-ghost btn-small", "Remove");
                removeBtn.title = `Remove ${u.username} from ${r.title}`;
                removeBtn.addEventListener("click", async () => {
                    adminError.textContent = "";
                    try {
                        await api.removeAccess(r.id, u.id);
                        await onChange();
                    } catch (err) {
                        adminError.textContent = err.error || "Could not remove them from the roadmap";
                    }
                });
                row.appendChild(removeBtn);
            }
            panel.appendChild(row);
        });
        card.appendChild(panel);

        head.addEventListener("click", () => {
            const nowOpen = panel.style.display === "none";
            panel.style.display = nowOpen ? "block" : "none";
            head.classList.toggle("open", nowOpen);
            head.setAttribute("aria-expanded", String(nowOpen));
            if (nowOpen) expanded.add(u.id); else expanded.delete(u.id);
        });

        return card;
    }

    // ===== NEW ACCOUNT =====
    newAccountBtn.addEventListener("click", () => {
        newUsername.value = "";
        newPassword.value = "";
        newError.textContent = "";
        openModal(newModal);
        newUsername.focus();
    });

    createAccountBtn.addEventListener("click", async () => {
        newError.textContent = "";
        const username = newUsername.value.trim();
        const password = newPassword.value;
        if (!username || !password) {
            newError.textContent = "Enter a username and a password";
            return;
        }
        try {
            await api.adminCreateUser(username, password);
            closeModal(newModal);
            await onChange();
        } catch (err) {
            newError.textContent = err.error || "Could not create the account";
        }
    });

    newPassword.addEventListener("keydown", (e) => {
        if (e.key === "Enter") createAccountBtn.click();
    });

    cancelNewBtn.addEventListener("click", () => closeModal(newModal));
    closeNewBtn.addEventListener("click", () => closeModal(newModal));
    newModal.addEventListener("click", (e) => {
        if (e.target === newModal) closeModal(newModal);
    });

    // ===== EDIT ACCOUNT =====
    function openEditModal(user) {
        userToEdit = user;
        editTitle.textContent = `Edit ${user.username}`;
        editUsername.value = user.username;
        editPassword.value = "";
        editError.textContent = "";
        openModal(editModal);
    }

    saveEditBtn.addEventListener("click", async () => {
        if (!userToEdit) return;
        editError.textContent = "";

        const data = {};
        const username = editUsername.value.trim();
        if (username && username !== userToEdit.username) data.username = username;
        if (editPassword.value) data.password = editPassword.value;

        if (Object.keys(data).length === 0) {
            closeModal(editModal);
            return;
        }

        try {
            const updated = await api.adminUpdateUser(userToEdit.id, data);
            closeModal(editModal);
            if (userToEdit.id === me.id && updated) {
                // renamed yourself: keep the top bar in step
                me.username = updated.username;
                document.getElementById("topbar-username").textContent = updated.username;
                document.getElementById("user-avatar").textContent = updated.username.charAt(0);
            }
            userToEdit = null;
            await onChange();
        } catch (err) {
            editError.textContent = err.error || "Could not save the changes";
        }
    });

    cancelEditBtn.addEventListener("click", () => closeModal(editModal));
    closeEditBtn.addEventListener("click", () => closeModal(editModal));
    editModal.addEventListener("click", (e) => {
        if (e.target === editModal) closeModal(editModal);
    });

    // ===== DELETE ACCOUNT =====
    function openDeleteModal(user) {
        userToDelete = user;
        const owned = user.roadmaps.filter(r => r.role === "owner").length;
        deleteWarning.textContent = owned
            ? `This deletes ${user.username} and the ${owned === 1 ? "roadmap" : `${owned} roadmaps`} they own. There is no undo.`
            : `This deletes ${user.username}. There is no undo.`;
        openModal(deleteModal);
    }

    confirmDeleteBtn.addEventListener("click", async () => {
        if (!userToDelete) return;
        adminError.textContent = "";
        const target = userToDelete;
        userToDelete = null;
        closeModal(deleteModal);
        try {
            await api.adminDeleteUser(target.id);
            if (target.id === me.id) {
                // deleted your own account: session is gone
                localStorage.removeItem("kivo_token");
                window.location.href = "index.html";
                return;
            }
            expanded.delete(target.id);
            await onChange();
        } catch (err) {
            adminError.textContent = err.error || "Could not delete the account";
        }
    });

    cancelDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
    closeDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) closeModal(deleteModal);
    });

    return { renderAccounts };
}
