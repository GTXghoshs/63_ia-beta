const state = {
  messages: [],
  models: { disk: [], server: [] },
  config: null,
  sending: false,
  selectedNotePath: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function showToast(message, type = "") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.className = "toast"; }, 3600);
}

async function getJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `Falha HTTP ${response.status}`);
  }
  return payload;
}

function statusClass(stateName) {
  return ["online", "loading", "offline", "error"].includes(stateName) ? stateName : "";
}

function setStatusDot(element, serviceState) {
  if (!element) return;
  element.className = `status-dot ${statusClass(serviceState)}`;
}

function showSection(name) {
  const target = name || "overview";
  $$(".page-section").forEach((section) => section.classList.toggle("active", section.id === `section-${target}`));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.section === target));
  const current = $(`.nav-item[data-section="${target}"]`);
  $("#page-breadcrumb").textContent = current ? current.textContent.replace(/\s+/g, " ").trim() : "Visão geral";
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (target === "models") loadModels();
  if (target === "metrics") loadMetrics();
  if (target === "settings") loadConfig();
  if (target === "knowledge") { loadFiles(); loadObsidian(); }
  if (target === "web") loadTavilyStatus();
}

function bindNavigation() {
  $$("[data-section]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.section)));
  $$("[data-section-link]").forEach((button) => button.addEventListener("click", () => showSection(button.dataset.sectionLink)));
}

function updateStatus(payload) {
  const llama = payload.llama || {};
  $("#llama-status").textContent = llama.label || "Indisponível";
  $("#llama-latency").textContent = llama.latency_ms == null ? "Não foi possível conectar" : `${llama.latency_ms} ms de latência`;
  $("#model-count").textContent = payload.models_on_disk ?? 0;
  $("#terminal-status").textContent = payload.terminal?.enabled ? "Habilitado" : "Desabilitado";
  setStatusDot($("#llama-dot"), llama.state);
  setStatusDot($("#chat-status-dot"), llama.state);
  setStatusDot($("#terminal-dot"), payload.terminal?.enabled ? "online" : "offline");
  $("#chat-status-text").textContent = llama.label ? `llama.cpp: ${llama.label}` : "Servidor não verificado";
  $("#last-updated").textContent = `Última leitura às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  $("#metric-state").textContent = llama.label || "—";
  $("#metric-state-detail").textContent = llama.details?.status ? `status: ${llama.details.status}` : "endpoint /health";
  $("#metric-latency").textContent = llama.latency_ms == null ? "—" : `${llama.latency_ms} ms`;
  $("#metric-models").textContent = payload.models_on_disk ?? 0;
  $("#metric-terminal").textContent = payload.terminal?.enabled ? "Ativo" : "Off";
}

async function loadStatus(silent = false) {
  try {
    const payload = await getJson("/api/status");
    updateStatus(payload);
  } catch (error) {
    updateStatus({ llama: { label: "Offline", state: "offline" }, models_on_disk: 0, terminal: { enabled: false } });
    if (!silent) showToast(error.message, "error");
  }
}

function modelOptions() {
  const select = $("#chat-model");
  const current = select.value;
  const models = [...state.models.server];
  select.innerHTML = `<option value="">Padrão do servidor</option>`;
  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.id || "";
    option.textContent = model.id || "modelo local";
    select.appendChild(option);
  });
  if (current && [...select.options].some((option) => option.value === current)) select.value = current;
}

function renderModelsTable() {
  const tbody = $("#models-table");
  const disk = state.models.disk || [];
  const serverIds = new Set((state.models.server || []).map((item) => item.id));
  $("#disk-model-count").textContent = disk.length;
  $("#server-model-count").textContent = state.models.server?.length || 0;
  $("#model-table-status").textContent = disk.length ? "ATUALIZADO" : "VAZIO";
  if (!disk.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">Nenhum arquivo .gguf foi encontrado no diretório configurado.</div></td></tr>`;
    return;
  }
  tbody.innerHTML = disk.map((model) => {
    const published = [...serverIds].some((id) => id === model.name || String(id).endsWith(model.name));
    return `<tr><td>${escapeHtml(model.name)}</td><td>${escapeHtml(model.size)}</td><td>Disco local</td><td><span class="table-status ${published ? "" : "dim"}">${published ? "Servindo" : "Disponível"}</span></td><td><button class="tiny-button use-model" data-model="${escapeHtml(model.name)}">Usar</button></td></tr>`;
  }).join("");
  $$(".use-model").forEach((button) => button.addEventListener("click", () => {
    showSection("chat");
    const select = $("#chat-model");
    if ([...select.options].some((option) => option.value === button.dataset.model)) select.value = button.dataset.model;
    else showToast("O arquivo está no disco, mas ainda não foi publicado pelo llama-server.");
  }));
}

async function loadModels() {
  try {
    const payload = await getJson("/api/models");
    state.models = { disk: payload.disk || [], server: payload.server || [] };
    $("#model-dir").textContent = payload.model_dir || "—";
    modelOptions();
    renderModelsTable();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderFiles(files) {
  const target = $("#file-list");
  $("#files-count-label").textContent = `${files.length} ARQUIVO${files.length === 1 ? "" : "S"}`;
  if (!files.length) {
    target.innerHTML = `<div class="empty-state compact">Nenhum arquivo carregado. Os originais permanecem na área local de ingestão.</div>`;
    return;
  }
  target.innerHTML = files.map((file) => `<div class="file-item"><input class="file-check" type="checkbox" data-file-id="${escapeHtml(file.id)}" title="Incluir no contexto do chat" /><div class="file-meta"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><span>${escapeHtml(file.size)} · ${escapeHtml(file.extension)}${file.extractable ? " · texto extraível" : " · anexo"}</span></div><div class="file-actions"><span class="file-kind">${file.extractable ? "Ler" : "Bruto"}</span><button class="tiny-button delete-file" data-file-id="${escapeHtml(file.id)}">Excluir</button></div></div>`).join("");
  $$(".delete-file").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm("Excluir este arquivo da área de ingestão local?")) return;
    try { await getJson(`/api/files/${button.dataset.fileId}`, { method: "DELETE" }); await loadFiles(); showToast("Arquivo removido."); } catch (error) { showToast(error.message, "error"); }
  }));
}

async function loadFiles() {
  try {
    const payload = await getJson("/api/files");
    renderFiles(payload.files || []);
    $("#upload-limit").textContent = `${Math.round((payload.max_upload_bytes || 0) / 1024 / 1024)} MB`;
  } catch (error) { showToast(error.message, "error"); }
}

async function uploadSelectedFiles(fileList) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  try {
    const response = await fetch("/api/files", { method: "POST", body: form });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || `Falha HTTP ${response.status}`);
    await loadFiles();
    showToast(`${payload.files?.length || files.length} arquivo(s) carregado(s) localmente.`);
  } catch (error) { showToast(error.message, "error"); }
}

function noteUrl(path) { return `/api/obsidian/notes/${path.split("/").map(encodeURIComponent).join("/")}`; }

function renderObsidianNotes(notes) {
  const target = $("#obsidian-notes");
  if (!notes.length) { target.innerHTML = `<div class="empty-state compact">Nenhuma nota Markdown encontrada.</div>`; return; }
  target.innerHTML = notes.map((note) => `<div class="note-row ${state.selectedNotePath === note.path ? "selected" : ""}" data-note-path="${escapeHtml(note.path)}"><input class="note-check" type="checkbox" data-note-path="${escapeHtml(note.path)}" title="Incluir no contexto do chat" /><div><strong>${escapeHtml(note.name)}</strong><span>${escapeHtml(note.path)} · ${escapeHtml(note.size)}</span></div><span>→</span></div>`).join("");
  $$(".note-row").forEach((row) => row.addEventListener("click", (event) => { if (!event.target.closest(".note-check")) selectObsidianNote(row.dataset.notePath); }));
}

async function loadObsidian() {
  try {
    const status = await getJson("/api/obsidian/status");
    const label = $("#obsidian-status-label");
    label.textContent = status.exists ? "CONECTADO" : (status.configured ? "NÃO ENCONTRADO" : "NÃO CONFIGURADO");
    $("#obsidian-path").textContent = status.vault_dir || "Defina OBSIDIAN_VAULT_DIR no arquivo .env para conectar seu vault.";
    if (!status.configured || !status.exists) { renderObsidianNotes([]); return; }
    const payload = await getJson(`/api/obsidian/notes?query=${encodeURIComponent($("#obsidian-search").value || "")}`);
    renderObsidianNotes(payload.notes || []);
  } catch (error) { showToast(error.message, "error"); }
}

async function selectObsidianNote(path) {
  try {
    const note = await getJson(noteUrl(path));
    state.selectedNotePath = path;
    $("#selected-note-label").textContent = path;
    $("#note-content").disabled = false;
    $("#note-content").value = note.content || "";
    $("#save-note").disabled = false;
    renderObsidianNotes((await getJson(`/api/obsidian/notes?query=${encodeURIComponent($("#obsidian-search").value || "")}`)).notes || []);
  } catch (error) { showToast(error.message, "error"); }
}

async function saveObsidianNote() {
  if (!state.selectedNotePath) return;
  try {
    await getJson(noteUrl(state.selectedNotePath), { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: $("#note-content").value }) });
    showToast("Nota salva no vault do Obsidian.");
    await loadObsidian();
  } catch (error) { showToast(error.message, "error"); }
}

function bindKnowledge() {
  const input = $("#file-input");
  const zone = $(".upload-zone");
  $("#upload-files").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { uploadSelectedFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.add("dragging"); }));
  ["dragleave", "drop"].forEach((eventName) => zone.addEventListener(eventName, (event) => { event.preventDefault(); zone.classList.remove("dragging"); }));
  zone.addEventListener("drop", (event) => uploadSelectedFiles(event.dataTransfer.files));
  $("#refresh-obsidian").addEventListener("click", loadObsidian);
  $("#obsidian-search").addEventListener("input", () => loadObsidian());
  $("#save-note").addEventListener("click", saveObsidianNote);
  $("#open-knowledge").addEventListener("click", () => showSection("knowledge"));
}

async function loadTavilyStatus() {
  try {
    const status = await getJson("/api/tavily/status");
    const label = $("#tavily-status-label");
    const ready = status.enabled && status.configured;
    label.textContent = ready ? "ATIVA" : (status.configured ? "DESABILITADA" : "SEM CHAVE");
    label.className = `mini-label ${ready ? "label-online" : ""}`;
    $("#tavily-usage-note").textContent = ready ? `${status.search_depth} · até ${status.max_results} fontes · cache ${status.cache_ttl}s` : (status.configured ? "Ative TAVILY_ENABLED no .env" : "Configure TAVILY_API_KEY no .env");
    $("#run-tavily-search").disabled = !ready;
    if (status.search_depth && [...$("#tavily-depth").options].some((option) => option.value === status.search_depth)) $("#tavily-depth").value = status.search_depth;
  } catch (error) {
    $("#tavily-status-label").textContent = "INDISPONÍVEL";
    $("#run-tavily-search").disabled = true;
    $("#tavily-usage-note").textContent = error.message;
  }
}

function safeExternalUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; } catch (_) { return "#"; }
}

function renderTavilyResults(payload) {
  const results = payload.results || [];
  $("#tavily-result-meta").textContent = results.length ? `${results.length} FONTES${payload.cached ? " · CACHE" : ""}` : "SEM RESULTADOS";
  const answer = payload.answer ? `<div class="tavily-answer"><span>✦</span><p>${escapeHtml(payload.answer)}</p></div>` : "";
  if (!results.length) { $("#tavily-results").innerHTML = answer || `<div class="empty-state">Nenhuma fonte retornada para esta consulta.</div>`; return; }
  $("#tavily-results").innerHTML = answer + results.map((result) => `<article class="tavily-result"><div class="tavily-result-top"><span class="result-score">${Number(result.score || 0).toFixed(2)}</span><a href="${escapeHtml(safeExternalUrl(result.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.title || result.url || "Fonte sem título")} ↗</a></div><p>${escapeHtml(result.content || "Sem trecho disponível.")}</p><small>${escapeHtml(result.url || "")}</small></article>`).join("");
}

async function runTavilySearch() {
  const query = $("#tavily-query").value.trim();
  if (!query) { showToast("Escreva uma consulta para pesquisar.", "error"); return; }
  const button = $("#run-tavily-search");
  button.disabled = true;
  button.innerHTML = "Pesquisando…";
  $("#tavily-result-meta").textContent = "CONSULTANDO";
  try {
    const payload = await getJson("/api/tavily/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, search_depth: $("#tavily-depth").value, topic: $("#tavily-topic").value, max_results: 5, include_answer: $("#tavily-answer").checked }) });
    renderTavilyResults(payload);
    showToast(payload.cached ? "Resultados carregados do cache local." : "Pesquisa concluída.");
  } catch (error) {
    $("#tavily-result-meta").textContent = "ERRO";
    $("#tavily-results").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    showToast(error.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = "Pesquisar <span>↗</span>";
    loadTavilyStatus();
  }
}

function bindTavily() {
  $("#run-tavily-search").addEventListener("click", runTavilySearch);
  $("#tavily-query").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); runTavilySearch(); } });
}

function renderActivity(events) {
  const target = $("#activity-list");
  if (!events?.length) {
    target.innerHTML = `<div class="empty-state compact">Nenhum evento de terminal registrado ainda.</div>`;
    return;
  }
  target.innerHTML = events.slice().reverse().map((event) => {
    const status = event.status || "evento";
    const when = event.started_at ? new Date(event.started_at * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
    return `<div class="activity-item"><div class="activity-icon">›_</div><div><strong>${escapeHtml(event.command || "comando local")}</strong><span>${escapeHtml(status)}${event.duration_ms ? ` · ${event.duration_ms} ms` : ""}</span></div><time>${when}</time></div>`;
  }).join("");
}

async function loadActivity() {
  try {
    const payload = await getJson("/api/audit?limit=5");
    renderActivity(payload.events || []);
  } catch (_) {
    renderActivity([]);
  }
}

async function loadConfig() {
  try {
    const config = await getJson("/api/config");
    state.config = config;
    const labels = { llama_base_url: "Endpoint llama.cpp", dashboard_host: "Host do dashboard", dashboard_port: "Porta do dashboard", model_dir: "Diretório de modelos", work_dir: "Diretório de trabalho", terminal_enabled: "Terminal habilitado", terminal_timeout: "Timeout do terminal", max_output_bytes: "Limite de saída", default_model: "Modelo padrão", remote_access_enabled: "Acesso remoto", remote_access_configured: "Token remoto configurado", tavily_enabled: "Tavily habilitada", obsidian_configured: "Obsidian configurado" };
    $("#config-grid").innerHTML = Object.entries(labels).map(([key, label]) => `<div class="config-item"><span>${label}</span><strong title="${escapeHtml(String(config[key] ?? ""))}">${escapeHtml(String(config[key] ?? "—"))}</strong></div>`).join("");
    $("#terminal-mode-label").textContent = config.terminal_enabled ? "ATIVO · ALLOWLIST" : "DESABILITADO";
    $("#logout-button").hidden = !config.remote_access_enabled;
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadMetrics() {
  try {
    const payload = await getJson("/api/metrics");
    $("#metrics-availability").textContent = payload.available ? "DISPONÍVEL" : "NÃO DISPONÍVEL";
    $("#metrics-output").textContent = payload.available ? payload.text : (payload.error || "O llama-server não expôs /metrics. Inicie-o com a opção de métricas para habilitar este painel.");
  } catch (error) {
    $("#metrics-output").textContent = error.message;
    showToast(error.message, "error");
  }
}

function appendMessage(role, content = "") {
  const messages = $("#chat-messages");
  const welcome = messages.querySelector(".welcome-message");
  if (welcome) welcome.remove();
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;
  wrapper.innerHTML = `<div class="message-role">${role === "user" ? "Você" : "Llama local"}</div><div class="message-body"></div>`;
  wrapper.querySelector(".message-body").textContent = content;
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper.querySelector(".message-body");
}

function setChatBusy(busy) {
  state.sending = busy;
  $("#send-button").disabled = busy;
  $("#chat-input").disabled = busy;
  $("#chat-status-text").textContent = busy ? "Gerando resposta…" : "Pronto para receber mensagens";
}

async function sendChat() {
  if (state.sending) return;
  const input = $("#chat-input");
  const content = input.value.trim();
  if (!content) return;
  const userMessage = { role: "user", content };
  state.messages.push(userMessage);
  appendMessage("user", content);
  input.value = "";
  $("#char-count").textContent = "0 / 250.000";
  const assistantBody = appendMessage("assistant", "");
  setChatBusy(true);
  try {
    const fileIds = $$(".file-check:checked").map((checkbox) => checkbox.dataset.fileId);
    const obsidianPaths = $$(".note-check:checked").map((checkbox) => checkbox.dataset.notePath);
    const response = await fetch("/api/chat/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: state.messages, file_ids: fileIds, obsidian_paths: obsidianPaths, model: $("#chat-model").value || null, temperature: Number($("#temperature").value), top_p: Number($("#top-p").value), max_tokens: Number($("#max-tokens").value) }) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).detail || `Falha HTTP ${response.status}`);
    if (!response.body) throw new Error("O navegador não recebeu um stream de resposta.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const eventBlock of events) {
        const dataLine = eventBlock.split("\n").find((line) => line.startsWith("data:"));
        const eventLine = eventBlock.split("\n").find((line) => line.startsWith("event:"));
        if (!dataLine) continue;
        const data = JSON.parse(dataLine.slice(5).trim());
        const eventName = eventLine ? eventLine.slice(6).trim() : "message";
        if (eventName === "delta") { answer += data.text || ""; assistantBody.textContent = answer; $("#chat-messages").scrollTop = $("#chat-messages").scrollHeight; }
        if (eventName === "reasoning" && !answer) assistantBody.textContent = `[raciocínio] ${data.text || ""}`;
        if (eventName === "error") throw new Error(data.message || data.detail || "Falha na inferência local");
      }
    }
    state.messages.push({ role: "assistant", content: answer || assistantBody.textContent || "(resposta vazia)" });
  } catch (error) {
    assistantBody.textContent = `Erro: ${error.message}`;
    showToast(error.message, "error");
  } finally {
    setChatBusy(false);
    loadStatus(true);
    loadActivity();
  }
}

function bindChat() {
  $("#send-button").addEventListener("click", sendChat);
  $("#chat-input").addEventListener("input", (event) => { $("#char-count").textContent = `${event.target.value.length.toLocaleString("pt-BR")} / 250.000`; });
  $("#chat-input").addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } });
  $$("[data-prompt]").forEach((button) => button.addEventListener("click", () => { $("#chat-input").value = button.dataset.prompt; $("#chat-input").dispatchEvent(new Event("input")); $("#chat-input").focus(); }));
  $("#clear-chat").addEventListener("click", () => { state.messages = []; $("#chat-messages").innerHTML = `<div class="welcome-message"><div class="welcome-mark">✦</div><h2>Pronto para pensar localmente.</h2><p>Escolha um modelo e envie uma mensagem para iniciar. A resposta será transmitida em tempo real.</p></div>`; showToast("Conversa limpa."); });
}

function bindParameters() {
  const pairs = [["temperature", "temperature-value"], ["top-p", "top-p-value"], ["max-tokens", "max-tokens-value"]];
  pairs.forEach(([inputId, outputId]) => $("#" + inputId).addEventListener("input", (event) => { $("#" + outputId).textContent = inputId === "max-tokens" ? event.target.value : Number(event.target.value).toFixed(2); }));
}

function appendTerminalLine(text, className = "") {
  const output = $("#terminal-output");
  const line = document.createElement("div");
  line.className = `terminal-line ${className}`;
  line.textContent = text;
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
}

async function runTerminal() {
  const input = $("#terminal-input");
  const command = input.value.trim();
  if (!command) return;
  appendTerminalLine(`$ ${command}`, "command");
  input.value = "";
  try {
    const result = await getJson("/api/terminal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
    if (result.output) result.output.split("\n").forEach((line) => appendTerminalLine(line, result.status === "ok" ? "success" : "error"));
    appendTerminalLine(`[${result.status}]`, result.status === "ok" ? "success" : "error");
  } catch (error) {
    appendTerminalLine(error.message, "error");
    showToast(error.message, "error");
  }
  loadActivity();
}

function bindTerminal() {
  $("#run-terminal").addEventListener("click", runTerminal);
  $("#terminal-input").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); runTerminal(); } });
}

async function bootstrap() {
  bindNavigation();
  bindChat();
  bindParameters();
  bindTerminal();
  bindKnowledge();
  bindTavily();
  $("#refresh-button").addEventListener("click", () => { loadStatus(); loadModels(); loadActivity(); showToast("Status atualizado."); });
  $("#refresh-models").addEventListener("click", () => { loadModels(); showToast("Catálogo atualizado."); });
  $("#refresh-metrics").addEventListener("click", loadMetrics);
  $("#logout-button").addEventListener("click", async () => { await getJson("/api/auth/logout", { method: "POST" }); window.location.replace("/login"); });
  $("#theme-button").addEventListener("click", () => { document.body.classList.toggle("high-contrast"); showToast("Contraste alternado."); });
  await Promise.all([loadStatus(true), loadModels(), loadConfig(), loadActivity(), loadFiles(), loadObsidian(), loadTavilyStatus()]);
}

document.addEventListener("DOMContentLoaded", bootstrap);
