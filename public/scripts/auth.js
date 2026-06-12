import { api } from "./api.js";

const form = document.getElementById("auth-form");
const titleEl = document.getElementById("auth-title");
const subtitleEl = document.getElementById("auth-subtitle");
const usernameInput = document.getElementById("auth-username");
const passwordInput = document.getElementById("auth-password");
const errorEl = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");
const toggleText = document.getElementById("auth-toggle-text");
const toggleBtn = document.getElementById("auth-toggle-btn");

let mode = "login"; // of "register"

function applyMode() {
    if (mode === "login") {
        titleEl.textContent = "Welcome back";
        subtitleEl.textContent = "Sign in to your roadmaps";
        submitBtn.textContent = "Sign in";
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = "Create one";
        passwordInput.setAttribute("autocomplete", "current-password");
    } else {
        titleEl.textContent = "Create your account";
        subtitleEl.textContent = "Start building roadmaps";
        submitBtn.textContent = "Create account";
        toggleText.textContent = "Already have an account?";
        toggleBtn.textContent = "Sign in";
        passwordInput.setAttribute("autocomplete", "new-password");
    }
    errorEl.textContent = "";
}

toggleBtn.addEventListener("click", () => {
    mode = mode === "login" ? "register" : "login";
    applyMode();
});

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
        const res = mode === "login"
            ? await api.login(username, password)
            : await api.register(username, password);

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

// Als er al een geldige sessie is, meteen door naar het dashboard.
async function checkExistingSession() {
    const token = localStorage.getItem("kivo_token");
    if (!token) return;
    try {
        const me = await api.me();
        if (me && me.id) {
            window.location.href = "dashboard.html";
        }
    } catch (err) {
        // ongeldige token -> blijf op de loginpagina
        localStorage.removeItem("kivo_token");
    }
}

applyMode();
checkExistingSession();
