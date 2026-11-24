import { api } from "./api.js";
import { paintAvatar } from "./avatars.js";
import { logout } from "./logout.js";

// ===== DOM =====
const meAvatar = document.getElementById("me-avatar");
const meUsername = document.getElementById("me-username");
const meRole = document.getElementById("me-role");
const accountNote = document.getElementById("account-note");
const adminPanel = document.getElementById("admin-panel");

// ===== ACCOUNT CARD =====
async function init() {
    let me;
    try {
        me = await api.me();
    } catch (err) {
        window.location.href = "index.html";
        return;
    }
    if (!me) return;

    paintAvatar(meAvatar, me.username, me.color);
    meUsername.textContent = me.username;
    meRole.textContent = me.isAdmin ? "Admin" : "Member";

    // admins manage every account (their own included) from the dashboard
    if (me.isAdmin) {
        adminPanel.style.display = "block";
    } else {
        accountNote.style.display = "block";
    }
}

// ===== LOGOUT =====
document.getElementById("logout-btn").addEventListener("click", logout);

init();
