import { loadData, saveShortcuts, saveSettings, DEFAULT_SHORTCUTS } from "./storage.js";

// Tab switching
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetTab = tab.dataset.tab;
    
    // Update active tab
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    
    // Update active content
    tabContents.forEach((content) => {
      if (content.id === `${targetTab}-tab`) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });
  });
});

// Settings elements
const autoExpand = document.getElementById("auto-expand");
const autoFocus = document.getElementById("auto-focus");
const autoSend = document.getElementById("auto-send");
const storageArea = document.getElementById("storage-area");
const saveSettingsButton = document.getElementById("save-settings-button");
const status = document.getElementById("status");

// Shortcuts elements
const listEl = document.getElementById("shortcut-list");
const searchInput = document.getElementById("search-input");
const nameInput = document.getElementById("name-input");
const templateInput = document.getElementById("template-input");
const tagsInput = document.getElementById("tags-input");
const saveShortcutButton = document.getElementById("save-shortcut-button");
const resetShortcutButton = document.getElementById("reset-shortcut-button");
const toastEl = document.getElementById("toast");
const formTitle = document.getElementById("form-title");
const exportButton = document.getElementById("export-button");
const importButton = document.getElementById("import-button");
const importFile = document.getElementById("import-file");

let shortcuts = [];
let settings = {};
let editingName = null;

function showToast(message, timeout = 2000) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  setTimeout(() => {
    toastEl.hidden = true;
  }, timeout);
}

function normalizeName(name) {
  const trimmed = name.trim().toLowerCase();
  if (!trimmed.startsWith("#")) {
    return `#${trimmed.replace(/^#+/, "")}`;
  }
  return trimmed;
}

function toPreviewText(template) {
  return template.split("\n")[0].slice(0, 80);
}

function renderList(filter = "") {
  listEl.innerHTML = "";
  const query = filter.trim().toLowerCase();
  const filtered = shortcuts.filter((shortcut) => {
    if (!query) {
      return true;
    }
    return (
      shortcut.name.toLowerCase().includes(query) ||
      shortcut.template.toLowerCase().includes(query) ||
      shortcut.tags?.join(" ").toLowerCase().includes(query)
    );
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.textContent = "No shortcuts found.";
    empty.className = "preview";
    listEl.appendChild(empty);
    return;
  }

  filtered.forEach((shortcut) => {
    const card = document.createElement("div");
    card.className = "shortcut-card";

    const header = document.createElement("div");
    header.className = "shortcut-card-header";

    const title = document.createElement("h3");
    title.textContent = shortcut.name;

    const favorite = document.createElement("button");
    favorite.className = "icon";
    favorite.textContent = shortcut.favorite ? "★" : "☆";
    favorite.title = shortcut.favorite ? "Unfavorite" : "Favorite";
    favorite.addEventListener("click", () => {
      shortcut.favorite = !shortcut.favorite;
      saveShortcuts(shortcuts).then(() => renderList(searchInput.value));
    });

    header.appendChild(title);
    header.appendChild(favorite);

    const preview = document.createElement("p");
    preview.className = "preview";
    preview.textContent = toPreviewText(shortcut.template);

    const actions = document.createElement("div");
    actions.className = "shortcut-card-actions";

    const insert = document.createElement("button");
    insert.className = "primary";
    insert.textContent = "Insert";
    insert.addEventListener("click", () => insertShortcut(shortcut.name));

    const edit = document.createElement("button");
    edit.className = "ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(shortcut));

    const remove = document.createElement("button");
    remove.className = "ghost";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteShortcut(shortcut.name));

    actions.append(insert, edit, remove);
    card.append(header, preview, actions);
    listEl.appendChild(card);
  });
}

async function insertShortcut(name) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showToast("No active tab found.");
    return;
  }
  const sendMessage = () =>
    new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { type: "insert-shortcut", name }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "No response from page." });
      });
    });

  let response = await sendMessage();
  if (!response || !response.ok && (chrome.runtime.lastError || response.error?.includes("Receiving end does not exist"))) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content_script.js"]
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      response = await sendMessage();
    } catch (error) {
      showToast("Cannot access this page. Try a standard web page.");
      return;
    }
  }

  if (!response?.ok) {
    showToast(response?.error || "Unable to insert shortcut.");
    return;
  }
  showToast("Inserted into page.");
}

function startEdit(shortcut) {
  editingName = shortcut.name;
  formTitle.textContent = `Edit ${shortcut.name}`;
  nameInput.value = shortcut.name;
  templateInput.value = shortcut.template;
  tagsInput.value = shortcut.tags?.join(", ") || "";
  // Scroll to form
  document.querySelector(".form-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function resetForm() {
  editingName = null;
  formTitle.textContent = "New Shortcut";
  nameInput.value = "";
  templateInput.value = "";
  tagsInput.value = "";
}

function deleteShortcut(name) {
  if (!confirm(`Delete ${name}?`)) {
    return;
  }
  shortcuts = shortcuts.filter((shortcut) => shortcut.name !== name);
  saveShortcuts(shortcuts).then(() => {
    renderList(searchInput.value);
    showToast("Shortcut deleted.");
  });
}

async function handleSaveShortcut() {
  const nameValue = normalizeName(nameInput.value);
  if (!nameValue || nameValue === "#") {
    showToast("Enter a valid #name.");
    return;
  }
  if (!templateInput.value.trim()) {
    showToast("Template cannot be empty.");
    return;
  }
  const tags = tagsInput.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const existingIndex = shortcuts.findIndex((shortcut) => shortcut.name === nameValue);
  const favorite =
    existingIndex >= 0
      ? shortcuts[existingIndex].favorite
      : false;

  const payload = {
    name: nameValue,
    template: templateInput.value.trim(),
    tags,
    favorite
  };

  if (editingName && editingName !== nameValue) {
    shortcuts = shortcuts.filter((shortcut) => shortcut.name !== editingName);
  }

  if (existingIndex >= 0) {
    shortcuts.splice(existingIndex, 1, payload);
  } else {
    shortcuts.push(payload);
  }

  await saveShortcuts(shortcuts);
  resetForm();
  renderList(searchInput.value);
  showToast("Shortcut saved.");
}

async function exportShortcuts() {
  const payload = {
    version: 1,
    shortcuts,
    settings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "prompt-hash-shortcuts.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function handleImportFile(file) {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      const incoming = Array.isArray(data.shortcuts) ? data.shortcuts : [];
      const incomingSettings = data.settings || {};
      const existingNames = new Set(shortcuts.map((shortcut) => shortcut.name));
      const conflicts = incoming.filter((shortcut) => existingNames.has(shortcut.name));
      if (conflicts.length) {
        const ok = confirm(
          `Overwrite ${conflicts.length} existing shortcut(s)? This cannot be undone.`
        );
        if (!ok) {
          return;
        }
      }
      const merged = new Map(shortcuts.map((shortcut) => [shortcut.name, shortcut]));
      incoming.forEach((shortcut) => {
        merged.set(shortcut.name, {
          ...shortcut,
          tags: shortcut.tags || [],
          favorite: Boolean(shortcut.favorite)
        });
      });
      shortcuts = Array.from(merged.values());
      settings = { ...settings, ...incomingSettings };
      await Promise.all([saveShortcuts(shortcuts), saveSettings(settings)]);
      renderList(searchInput.value);
      showToast("Import complete.");
    } catch (error) {
      showToast("Import failed. Check the JSON file.");
    }
  };
  reader.readAsText(file);
}

async function initSettings() {
  const data = await loadData();
  autoExpand.checked = Boolean(data.settings.autoExpandOnSpace);
  autoFocus.checked = Boolean(data.settings.autoFocusAiInput);
  autoSend.checked = Boolean(data.settings.autoSend);
  storageArea.value = data.settings.storageArea || "sync";
}

async function saveSettingsHandler() {
  status.textContent = "";
  const current = await loadData();
  const newSettings = {
    autoExpandOnSpace: autoExpand.checked,
    autoFocusAiInput: autoFocus.checked,
    autoSend: autoSend.checked,
    storageArea: storageArea.value
  };
  await saveSettings(newSettings);
  if ((current.settings.storageArea || "sync") !== newSettings.storageArea) {
    await saveShortcuts(current.shortcuts);
  }
  status.textContent = "Settings saved.";
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

function bindShortcutEvents() {
  searchInput.addEventListener("input", (event) => renderList(event.target.value));
  saveShortcutButton.addEventListener("click", handleSaveShortcut);
  resetShortcutButton.addEventListener("click", resetForm);
  exportButton.addEventListener("click", exportShortcuts);
  importButton.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      handleImportFile(file);
    }
    importFile.value = "";
  });
}

async function initShortcuts() {
  const data = await loadData();
  shortcuts = data.shortcuts && data.shortcuts.length ? data.shortcuts : DEFAULT_SHORTCUTS;
  settings = data.settings;
  
  if (!data.shortcuts || !data.shortcuts.length) {
    await saveShortcuts(DEFAULT_SHORTCUTS);
  }
  
  renderList();
  bindShortcutEvents();
}

// Initialize everything
saveSettingsButton.addEventListener("click", saveSettingsHandler);
initSettings();
initShortcuts();
