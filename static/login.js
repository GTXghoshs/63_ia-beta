const form = document.querySelector("#login-form");
const input = document.querySelector("#access-token");
const button = document.querySelector("#login-button");
const error = document.querySelector("#login-error");

async function checkSession() {
  const response = await fetch("/api/auth/status", { credentials: "same-origin" });
  const payload = await response.json().catch(() => ({}));
  if (payload.authenticated) window.location.replace("/");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Verificando…";
  try {
    const response = await fetch("/api/auth/login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: input.value }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || "Não foi possível autenticar.");
    window.location.replace("/");
  } catch (loginError) {
    error.textContent = loginError.message;
    button.disabled = false;
    button.innerHTML = "Entrar <span>↗</span>";
    input.select();
  }
});

checkSession();
