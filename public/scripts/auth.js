import { api } from "./api.js";

const form = document.getElementById("auth-form");
const usernameInput = document.getElementById("auth-username");
const passwordInput = document.getElementById("auth-password");
const errorEl = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
        errorEl.textContent = "Please fill in both fields";
        return;
    }

    submitBtn.disabled = true;
    try {
        const res = await api.login(username, password);
        if (res && res.token) {
            localStorage.setItem("kivo_token", res.token);
            window.location.href = "dashboard.html";
        } else {
            errorEl.textContent = "Unexpected response from server";
        }
    } catch (err) {
        errorEl.textContent = (err && err.error) ? err.error : "Something went wrong";
    } finally {
        submitBtn.disabled = false;
    }
});

// Already signed in? Straight to the dashboard.
async function checkExistingSession() {
    const token = localStorage.getItem("kivo_token");
    if (!token) return;
    try {
        const me = await api.me();
        if (me && me.id) {
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        localStorage.removeItem("kivo_token");
    }
}

checkExistingSession();
