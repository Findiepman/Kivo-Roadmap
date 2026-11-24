// Avatar colours.
//
// Every avatar shows the first letter of a username, on a colour:
//   1. The colour the user picked in Settings (or an admin set for them),
//      stored as users.color ("#rrggbb").
//   2. Otherwise an automatic colour from AVATAR_PALETTE, fixed per account
//      (based on the account id) so the same person always looks the same.
//   3. On a roadmap, members without a picked colour are spread over the
//      palette so two members never share a colour while a free one is left.

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

function paletteIndex(id) {
    const n = Math.abs(Number(id));
    return Number.isFinite(n) ? Math.floor(n) % AVATAR_PALETTE.length : 0;
}

// The automatic colour of an account, or null when there is no account id
// (a deleted account keeps the neutral default gradient).
export function autoColor(id) {
    if (id === null || id === undefined || id === "") return null;
    return AVATAR_PALETTE[paletteIndex(id)];
}

// The colour to draw for a user outside a roadmap (top bar, settings, admin list).
export function colorFor(user) {
    if (!user) return null;
    return user.color || autoColor(user.id);
}

// For each roadmap member the colour to draw.
// members: [{ id, username, color }]  ->  Map(id -> "#rrggbb")
export function resolveAvatarColors(members) {
    const colors = new Map();
    const unique = [];
    members.forEach(m => {
        if (colors.has(m.id)) return;
        colors.set(m.id, m.color || null);
        unique.push(m);
    });

    // picked colours are fixed and taken first
    const used = new Set(unique.filter(m => m.color).map(m => m.color.toLowerCase()));

    // sorted by id so the result is the same on every page load
    [...unique].sort((a, b) => a.id - b.id).forEach(m => {
        if (m.color) return;
        const start = paletteIndex(m.id);
        let pick = null;
        for (let i = 0; i < AVATAR_PALETTE.length; i++) {
            const c = AVATAR_PALETTE[(start + i) % AVATAR_PALETTE.length];
            if (!used.has(c)) { pick = c; break; }
        }
        // more members than palette colours: fall back to their own colour
        if (!pick) pick = AVATAR_PALETTE[start];
        used.add(pick);
        colors.set(m.id, pick);
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

// Fill an avatar element: the initial, plus the colour (null = default gradient).
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

// A row of swatches (little avatars with the user's own initial): Auto, the
// palette, then a custom colour. Used in Settings and in the admin panel.
//   container: element to fill
//   opts.name():   the username to show on the swatches
//   opts.userId:   for the Auto swatch preview
//   opts.value:    current choice ("#rrggbb" or null = auto)
//   opts.onChange(color): called when the choice changes (null = auto)
export function renderColorPicker(container, opts) {
    const value = opts.value || null;
    const name = opts.name();
    const isCustom = !!value && !AVATAR_PALETTE.includes(value);
    container.innerHTML = "";

    function choose(color) {
        opts.value = color;
        renderColorPicker(container, opts);
        opts.onChange(color);
    }

    function swatch(color, label) {
        const btn = document.createElement("button");
        btn.className = "color-swatch" + (value === color ? " selected" : "");
        btn.type = "button";
        btn.title = label;
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", String(value === color));
        btn.setAttribute("aria-label", label);
        const av = document.createElement("span");
        av.className = "avatar";
        paintAvatar(av, name, color === null ? autoColor(opts.userId) : color);
        btn.appendChild(av);
        btn.addEventListener("click", () => choose(color));
        return btn;
    }

    container.appendChild(swatch(null, "Auto"));
    AVATAR_PALETTE.forEach(c => container.appendChild(swatch(c, c)));

    // custom: a native colour input laid over a swatch
    const custom = document.createElement("label");
    custom.className = "color-swatch" + (isCustom ? " selected" : "");
    custom.title = "Custom color";
    const av = document.createElement("span");
    av.className = "avatar";
    if (isCustom) {
        paintAvatar(av, name, value);
    } else {
        av.textContent = "+";
        av.classList.add("swatch-plus");
        av.style.background = "var(--baby-soft)";
        av.style.color = "var(--deep)";
    }
    custom.appendChild(av);
    const input = document.createElement("input");
    input.type = "color";
    input.value = value || autoColor(opts.userId) || "#1b6fb8";
    input.setAttribute("aria-label", "Custom color");
    // live preview while dragging, commit once the picker closes
    input.addEventListener("input", () => {
        av.classList.remove("swatch-plus");
        paintAvatar(av, name, input.value.toLowerCase());
        container.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
        custom.classList.add("selected");
    });
    input.addEventListener("change", () => choose(input.value.toLowerCase()));
    custom.appendChild(input);
    container.appendChild(custom);
}
