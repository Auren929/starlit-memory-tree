export function memoryId(record) {
    return String(record?.id || "");
}

export function readMemoryQuery(search = location.search) {
    const params = new URLSearchParams(search);
    return {
        q: (params.get("q") || "").trim(),
        domain: (params.get("domain") || "").trim(),
        minImportance: Math.max(0, Math.min(10, Number(params.get("min") || 0) || 0)),
        from: (params.get("from") || "").trim(),
        to: (params.get("to") || "").trim(),
        star: (params.get("star") || "").trim()
    };
}

export function memoryMatches(record, state) {
    if (!record) return false;
    if (state.domain && String(record.domain || record.galaxy || "") !== state.domain) return false;
    if ((Number(record.importance) || 0) < state.minImportance) return false;
    const day = String(record.created || "").slice(0, 10);
    if (state.from && (!day || day < state.from)) return false;
    if (state.to && (!day || day > state.to)) return false;
    if (!state.q) return true;
    const haystack = [ record.name, record.preview, record.content, record.contentFull, record.domain, record.galaxy, record.created ].filter(Boolean).join("\n").toLocaleLowerCase("zh-CN");
    return state.q.toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean).every(word => haystack.includes(word));
}

export function filterMemories(records, state) {
    return records.filter(record => memoryMatches(record, state));
}

export function memoryDomains(records) {
    return [ ...new Set(records.map(record => String(record.domain || record.galaxy || "")).filter(Boolean)) ].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function updateMemoryUrl(patch, {replace: replace = true} = {}) {
    const url = new URL(location.href);
    const values = {
        ...readMemoryQuery(url.search),
        ...patch
    };
    const mapping = {
        q: "q",
        domain: "domain",
        minImportance: "min",
        from: "from",
        to: "to",
        star: "star"
    };
    for (const [key, param] of Object.entries(mapping)) {
        const value = values[key];
        if (value === "" || value === 0 || value == null) url.searchParams.delete(param); else url.searchParams.set(param, String(value));
    }
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    return values;
}

export async function copyMemoryUrl() {
    const value = location.href;
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return value;
        } catch {}
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    return value;
}

export function memoryMonths(records) {
    return [ ...new Set(records.map(record => String(record.created || "").slice(0, 7)).filter(value => /^\d{4}-\d{2}$/.test(value))) ].sort().reverse();
}

export function monthRange(month) {
    if (!/^\d{4}-\d{2}$/.test(month || "")) return {
        from: "",
        to: ""
    };
    const [year, number] = month.split("-").map(Number);
    const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
    return {
        from: `${month}-01`,
        to: `${month}-${String(last).padStart(2, "0")}`
    };
}