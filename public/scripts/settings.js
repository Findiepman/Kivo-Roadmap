import { api } from "./api.js";
import { paintAvatar, colorFor, renderColorPicker } from "./avatars.js";
import { logout } from "./logout.js";

// ===== DOM =====
const meAvatar = document.getElementById("me-avatar");
const meUsername = document.getElementById("me-username");
const meRole = document.getElementById("me-role");
const accountNote = document.getElementById("account-note");
const adminPanel = document.getElementById("admin-panel");
const colorPicker = document.getElementById("my-color-picker");
const colorStatus = document.getElementById("my-color-status");

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

    paintAvatar(meAvatar, me.username, colorFor(me));
    initColorPicker(me);
    meUsername.textContent = me.username;
    meRole.textContent = me.isAdmin ? "Admin" : "Member";

    // admins manage every account (their own included) from the dashboard
    if (me.isAdmin) {
        adminPanel.style.display = "block";
    } else {
        accountNote.style.display = "block";
    }
}

// ===== AVATAR COLOUR =====
// Saved the moment you pick one; the big avatar above shows it straight away.
// Only the newest pick counts: an older request finishing late is ignored, and
// a failed save falls back to the last colour the server confirmed.
let saveSeq = 0;
let confirmedColor = null;

function initColorPicker(me) {
    confirmedColor = me.color || null;
    drawColorPicker(me, confirmedColor);
}

function drawColorPicker(me, value) {
    renderColorPicker(colorPicker, {
        name: () => me.username,
        userId: me.id,
        value,
        onChange: (color) => saveColor(me, color)
    });
}

async function saveColor(me, color) {
    const mine = ++saveSeq;
    paintAvatar(meAvatar, me.username, colorFor({ id: me.id, color }));
    colorStatus.classList.remove("error");
    colorStatus.textContent = "Saving...";
    try {
        const res = await api.setMyColor(color);
        if (!res) return; // session ended, redirect under way
        if (mine !== saveSeq) return; // a newer pick is on its way
        confirmedColor = res.color;
        me.color = res.color;
        colorStatus.textContent = "Saved.";
    } catch (err) {
        if (mine !== saveSeq) return;
        // show what is really stored again
        me.color = confirmedColor;
        paintAvatar(meAvatar, me.username, colorFor(me));
        drawColorPicker(me, confirmedColor);
        colorStatus.classList.add("error");
        colorStatus.textContent = (err && err.error) || "Could not save the color";
    }
}

// ===== LOGOUT =====
document.getElementById("logout-btn").addEventListener("click", logout);

init();
