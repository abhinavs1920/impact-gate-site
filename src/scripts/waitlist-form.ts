const forms = document.querySelectorAll<HTMLFormElement>("[data-waitlist-form]");

for (const form of forms) {
  const status = form.querySelector<HTMLElement>("[data-form-status]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!status) return;
    status.textContent = "Sending…";
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      status.textContent = response.ok ? "Thanks. Your waitlist request was received." : "We could not submit that request. Please try again.";
      if (response.ok) form.reset();
    } catch {
      status.textContent = "We could not submit that request. Please try again.";
    }
  });
}
