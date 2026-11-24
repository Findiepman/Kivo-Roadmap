import { api } from "./api.js";

// Ends the session on the server too (so a copied token stops working), then
// clears it here. The local logout happens even when the server is unreachable.
export async function logout() {
    try {
        await api.logout();
    } catch (_) {
        // ignore: still log out locally
    }
    localStorage.removeItem("kivo_token");
    window.location.href = "index.html";
}
