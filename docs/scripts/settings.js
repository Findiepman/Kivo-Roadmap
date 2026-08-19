import { api } from "./api.js";

// ===== DOM =====
const meAvatar = document.getElementById("me-avatar");
const meUsername = document.getElementById("me-username");
const meRole = document.getElementById("me-role");
const accountNote = document.getElementById("account-note");
const adminPanel = document.getElementById("admin-panel");
const adminError = document.getElementById("admin-error");
const userList = document.getElementById("user-list");
const newUsername = document.getElementById("new-username");
const newPassword = document.getElementById("new-password");
const createUserBtn = document.getElementById("create-user-btn");

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

let me = null;
let userToEdit = null;
let userToDelete = null;

function openModal(m) { m.classList.add("open"); }
function closeModal(m) { m.classList.remove("open"); }

// ===== ACCOUNT CARD =====
async function init() {
    try {
        me = await api.me();
    } catch (err) {
        window.location.href = "index.html";
        return;
    }
    if (!me) return;

    meAvatar.textContent = (me.username || "?").charAt(0);
    meUsername.textContent = me.username;
    meRole.textContent = me.isAdmin ? "Admin" : "Member";

    if (me.isAdmin) {
        adminPanel.style.display = "block";
        await renderUsers();
    } else {
        accountNote.style.display = "block";
    }
}

// ===== ADMIN PANEL =====
async function renderUsers() {
    adminError.textContent = "";
    let users = [];
    try {
        users = await api.adminListUsers();
    } catch (err) {
        adminError.textContent = err.error || "Could not load accounts";
        return;
    }

    userList.innerHTML = "";
    users.forEach(u => {
        const row = document.createElement("div");
        row.className = "user-row";

        const avatar = document.createElement("span");
        avatar.className = "avatar";
        avatar.textContent = (u.username || "?").charAt(0);

        const name = document.createElement("span");
        name.className = "user-name";
        name.textContent = u.username;
        if (u.isAdmin) {
            const badge = document.createElement("span");
            badge.className = "role-badge";
            badge.textContent = "Admin";
            name.appendChild(badge);
        }
        if (me && u.id === me.id) {
            const you = document.createElement("span");
            you.className = "user-since";
            you.textContent = "(you)";
            name.appendChild(you);
        }

        const actions = document.createElement("span");
        actions.className = "user-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "btn-ghost btn-small";
        editBtn.textContent = "Edit";
        editBtn.addEventListener("click", () => openEditModal(u));

        actions.appendChild(editBtn);

        // the server also refuses to delete the only admin; hiding the button
        // for your own account avoids the most confusing case
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn-danger-ghost btn-small";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => openDeleteModal(u));
        actions.appendChild(deleteBtn);

        row.appendChild(avatar);
        row.appendChild(name);
        row.appendChild(actions);
        userList.appendChild(row);
    });
}

createUserBtn.addEventListener("click", async () => {
    adminError.textContent = "";
    const username = newUsername.value.trim();
    const password = newPassword.value;
    if (!username || !password) {
        adminError.textContent = "Enter a username and a password";
        return;
    }
    try {
        await api.adminCreateUser(username, password);
        newUsername.value = "";
        newPassword.value = "";
        await renderUsers();
    } catch (err) {
        adminError.textContent = err.error || "Could not create the account";
    }
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
        await api.adminUpdateUser(userToEdit.id, data);
        closeModal(editModal);
        userToEdit = null;
        await renderUsers();
        await init(); // refresh the account card in case you renamed yourself
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
    deleteWarning.textContent =
        `This deletes ${user.username} and every roadmap they own. There is no undo.`;
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
        if (me && target.id === me.id) {
            // deleted your own account: session is gone
            localStorage.removeItem("kivo_token");
            window.location.href = "index.html";
            return;
        }
        await renderUsers();
    } catch (err) {
        adminError.textContent = err.error || "Could not delete the account";
    }
});

cancelDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
closeDeleteBtn.addEventListener("click", () => closeModal(deleteModal));
deleteModal.addEventListener("click", (e) => {
    if (e.target === deleteModal) closeModal(deleteModal);
});

// ===== LOGOUT =====
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("kivo_token");
    window.location.href = "index.html";
});

init();
