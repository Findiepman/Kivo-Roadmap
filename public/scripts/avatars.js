// Avatar colours.
//
// Every avatar shows the first letter of a username. By default it uses the
// standard baby-blue gradient from theme.css. Two things change that:
//   1. An admin can give an account its own colour (users.color, "#rrggbb").
//   2. On a roadmap, members whose names start with the same letter are told
//      apart automatically: the first keeps the default, the others get a
//      colour from AVATAR_PALETTE that nobody else with that letter is using.

// Dark enough for the white initial to stay readable.
export const AVATAR_PALETTE = [
    "#1b6fb8", // blue
    "#237a55", // green
    "#a06a15", // amber
    "#7b3fa4", // purple
    "#b04a44", // red
    "#22788b", // teal
    "#4b53b8", // indigo
    "#ab4478", // pink
    "#5d6b7a", // slate
    "#3f7d20"  // olive
];

export function initialOf(username) {
    return (username || "?").charAt(0);
}

// For each member the colour to draw, or null for the default gradient.
// members: [{ id, username, color }]  ->  Map(id -> "#rrggbb" | null)
export function resolveAvatarColors(members) {
    const colors = new Map();
    const byInitial = new Map();

    members.forEach(m => {
        if (colors.has(m.id)) return;
        colors.set(m.id, m.color || null);
        const key = initialOf(m.username).toLowerCase();
        if (!byInitial.has(key)) byInitial.set(key, []);
        byInitial.get(key).push(m);
    });

    byInitial.forEach(group => {
        if (group.length < 2) return;

        // colours already taken by someone with this letter
        const used = new Set(group.filter(m => m.color).map(m => m.color.toLowerCase()));
        let defaultTaken = false;

        // sorted by id so the result is the same on every page load
        [...group].sort((a, b) => a.id - b.id).forEach(m => {
            if (m.color) return; // an admin's choice always wins
            if (!defaultTaken) {
                defaultTaken = true;
                return; // keeps the default gradient
            }
            const start = Math.abs(Number(m.id) || 0) % AVATAR_PALETTE.length;
            let pick = null;
            for (let i = 0; i < AVATAR_PALETTE.length; i++) {
                const c = AVATAR_PALETTE[(start + i) % AVATAR_PALETTE.length];
                if (!used.has(c)) { pick = c; break; }
            }
            // more same-letter members than palette colours: reuse one
            if (!pick) pick = AVATAR_PALETTE[start];
            used.add(pick);
            colors.set(m.id, pick);
        });
    });

    return colors;
}

// Light custom colours get dark text instead of white.
function textColorFor(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.68 ? "#12324e" : "#ffffff";
}

// Fill an avatar element: the initial, plus the colour (null = default).
export function paintAvatar(el, username, color) {
    el.textContent = initialOf(username);
    if (color && /^#[0-9a-f]{6}$/i.test(color)) {
        el.style.background = color;
        el.style.color = textColorFor(color);
    } else {
        el.style.background = "";
        el.style.color = "";
    }
}
