// Mapping helpers that bridge the server's data shape (title/description/column/
// position) and the frontend's existing shape (name/desc/text + a columns object).
// Keeping the frontend shape intact means the rendering/drag-drop logic is unchanged.

// API roadmap -> dashboard list item.
export function roadmapFromApi(r) {
    return {
        id: r.id,
        name: r.title,
        desc: r.description || "",
        role: r.role
    };
}

// API task -> frontend task card object.
export function taskFromApi(t) {
    return {
        id: t.id,
        title: t.title,
        text: t.description || "",
        tags: Array.isArray(t.tags) ? t.tags : [],
        position: t.position
    };
}

// Flat list of API tasks -> { todo: [], doing: [], done: [] }, ordered by position.
export function tasksToColumns(tasks) {
    const columns = { todo: [], doing: [], done: [] };
    [...tasks]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .forEach(t => {
            const col = columns[t.column] ? t.column : "todo";
            columns[col].push(taskFromApi(t));
        });
    return columns;
}
