const state = {
  people: [blankPerson()],
  stamp: 0,
  rendered: -1,
  projectId: sessionStorage.getItem("spirit-project"),
  project: null,
  page: 0,
  status: null,
};

const $ = (id) => document.getElementById(id);
const notice = () => $("notice");

function blankPerson() {
  return { id: crypto.randomUUID(), name: "", place: "", remember: "", birthDate: "", birthTime: "", birthPlace: "" };
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false && value != null) node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The app could not do that.");
  return data;
}

function field(person, key, label, tag, attrs = {}) {
  const id = `${key}-${person.id}`;
  const control = el(tag, {
    id,
    ...attrs,
    oninput: (event) => { person[key] = event.target.value; },
  });
  if (tag === "textarea") control.value = person[key];
  else control.value = person[key];
  return el("div", {}, [el("label", { for: id }, label), control]);
}

function personCard(person, index) {
  return el("fieldset", { class: "person" }, [
    el("legend", {}, index === 0 ? "Adult creating this book" : `Person ${index + 1}`),
    index > 0 ? el("button", { class: "button ghost", type: "button", onclick: () => removePerson(index) }, "Remove") : null,
    field(person, "name", "Name", "input", { maxlength: "80", autocomplete: "off", required: true }),
    field(person, "place", "Place in the family, in your words", "input", { maxlength: "80", autocomplete: "off" }),
    field(person, "remember", "What should this page hold?", "textarea", { maxlength: "600" }),
    field(person, "birthDate", "Birth date", "input", { type: "date", required: true, autocomplete: "off" }),
    field(person, "birthTime", "Birth time", "input", { type: "time", required: true, autocomplete: "off" }),
    field(person, "birthPlace", "Birth place", "input", { maxlength: "80", required: true, autocomplete: "off" }),
  ]);
}

function renderPeople() {
  if (state.rendered === state.stamp) return;
  state.rendered = state.stamp;
  $("people").replaceChildren(...state.people.map(personCard));
}

function removePerson(index) {
  state.people.splice(index, 1);
  state.stamp += 1;
  renderPeople();
}

function collect() {
  return {
    title: $("title").value,
    edition: $("edition").value,
    authority: $("authority").checked,
    people: state.people.map((person) => ({ ...person })),
  };
}

function fillForm(project) {
  $("title").value = project?.title || "";
  $("edition").value = project?.edition || "universal";
  $("authority").checked = Boolean(project?.authority);
  state.people = project?.people?.length ? project.people.map((person) => ({ ...person })) : [blankPerson()];
  state.projectId = project?.id || null;
  state.project = project || null;
  state.stamp += 1;
  renderPeople();
}

function useExample() {
  fillForm({
    title: "The Example Family",
    edition: "universal",
    authority: false,
    people: [
      { ...blankPerson(), name: "Ada Example", place: "the one telling the story", remember: "She wants the book to sound like the kitchen after dinner: unhurried and specific. Fictional sample.", birthDate: "1979-06-14", birthTime: "06:30", birthPlace: "Example Harbor" },
      { ...blankPerson(), name: "Julian Example", place: "her brother", remember: "He keeps the old photographs in a shoebox. Fictional sample. Not a real person.", birthDate: "1982-11-03", birthTime: "14:05", birthPlace: "Example Harbor" },
    ],
  });
  say("Example loaded. Tick the adult box, then generate once.");
}

function say(message, isError = false) {
  notice().textContent = message;
  notice().className = isError ? "notice error" : "notice";
}

async function writeSample(event) {
  event.preventDefault();
  const button = $("write-sample");
  button.disabled = true;
  say("Writing the sample. One pass, then we read it.");
  try {
    const payload = collect();
    const saved = state.projectId
      ? await api("PUT", `/api/projects/${state.projectId}`, payload)
      : await api("POST", "/api/projects", payload);
    state.projectId = saved.id;
    sessionStorage.setItem("spirit-project", saved.id);
    const project = await api("POST", `/api/projects/${saved.id}/generate`);
    state.project = project;
    state.page = 0;
    if (location.hash === "#/book") showBook();
    else location.hash = "#/book";
    say("");
  } catch (error) {
    say(error.message, true);
  } finally {
    button.disabled = false;
  }
}

function pagesOf(project) {
  const book = project.manuscript;
  const pages = [
    { label: "Cover", node: coverNode(project, book) },
    { label: "Opening", node: proseNode("Opening", book?.introduction || "Generate a sample to open the book.") },
  ];
  const portraits = book?.portraits || [];
  for (const person of project.people) {
    const portrait = portraits.find((item) => item.personId === person.id);
    pages.push({ label: person.name || "Page", node: portraitNode(person, portrait) });
  }
  pages.push({ label: "Family", node: proseNode(book?.familyHeading || "The family page", book?.familyBody || "") });
  pages.push({ label: "Close", node: proseNode("Before print", book?.closing || "This is a sample, not a proof and not an order.") });
  return pages;
}

function coverNode(project, book) {
  return el("article", { class: "sheet" }, [
    el("figure", { class: "cover print-cover" }, [
      el("span", { class: "kicker light" }, book?.coverKicker || "A portrait of possibility"),
      el("span", { class: "cover-title" }, project.title),
      el("span", { class: "cover-line" }, book?.coverLine || "See · Honor · Become"),
    ]),
  ]);
}

function proseNode(heading, body) {
  return el("article", { class: "sheet" }, [el("h2", {}, heading), el("p", {}, body)]);
}

function birthSentence(person) {
  if (!person.birthDate || !person.birthTime || !person.birthPlace) return "";
  return `Born ${person.birthDate} at ${person.birthTime} in ${person.birthPlace}.`;
}

function portraitNode(person, portrait) {
  const children = [
    el("p", { class: "kicker" }, person.place || "Family"),
    el("h2", {}, portrait?.heading || person.name),
    birthSentence(person) ? el("p", { class: "birth" }, birthSentence(person)) : null,
    el("p", {}, portrait?.body || "This page has no written sample yet."),
  ];
  if (portrait?.prompt) children.push(el("p", { class: "prompt" }, portrait.prompt));
  return el("article", { class: "sheet" }, children);
}

function showBook() {
  const root = $("book-root");
  if (!state.project) {
    root.replaceChildren(
      el("p", { class: "kicker" }, "Your preview"),
      el("h1", {}, "A family story begins with a name."),
      el("p", {}, "Complete the form to see a sample cover and pages here."),
      el("a", { class: "button", href: "#/studio" }, "Create a sample"),
    );
    return;
  }
  const pages = pagesOf(state.project);
  state.page = Math.min(state.page, pages.length - 1);
  pages.forEach((page, index) => { if (index === state.page) page.node.classList.add("on"); });
  const source = state.project.manuscript?.source;
  const banner = source === "unconnected"
    ? "Claude is not connected. These pages are blank on purpose. Nothing here is a reading."
    : source === "claude" && state.project.manuscript.complete === false
      ? "Claude left a page empty. Read it before you ask for another."
      : "Sample only. Not a prediction, a chart, a payment, or a print approval.";
  root.replaceChildren(
    el("p", { class: "banner no-print" }, banner),
    el("div", { class: "book-tools no-print" }, [
      el("button", { class: "button", type: "button", onclick: () => window.print() }, "Print / save sample"),
      el("button", { class: "button ghost", type: "button", onclick: () => editProject() }, "Edit names"),
      el("button", { class: "button ghost", type: "button", onclick: () => clearOne() }, "Clear personal information"),
    ]),
    el("div", { class: "pager no-print" }, pages.map((page, index) => {
      const attrs = { class: "button ghost", type: "button", onclick: () => { state.page = index; showBook(); } };
      if (index === state.page) attrs["aria-current"] = "page";
      return el("button", attrs, page.label);
    })),
    el("div", { class: "book-layout" }, pages.map((page) => page.node)),
  );
}

async function editProject() {
  if (!state.project) return;
  fillForm(state.project);
  location.hash = "#/studio";
}

async function clearOne() {
  if (!confirm("Remove this sample from this computer?")) return;
  if (!state.projectId) return fillForm(null);
  await api("DELETE", `/api/projects/${state.projectId}`);
  sessionStorage.removeItem("spirit-project");
  fillForm(null);
  say("That sample was removed from this computer.");
  location.hash = "#/studio";
}

async function showPath() {
  const status = state.status || await api("GET", "/api/status");
  state.status = status;
  const projects = await api("GET", "/api/projects");
  const root = $("path-root");
  root.replaceChildren(
    el("p", { class: "kicker" }, "What is connected"),
    el("h1", {}, "The path from sample to book"),
    card("Claude", status.claude ? `Connected. Model ${status.model}. One press writes one sample and spends from your key. There is no automatic retry.` : "Not connected. This app reads the Anthropic key already in the vault env. Until it is found, samples stay blank on purpose."),
    card("Charts", "Off. Numerology, Cards of Destiny, and Human Design are not calculated."),
    card("Checkout", "Off. Nothing on this screen is a price or an order."),
    card("Printing", "Off. Bookvault, Blurb, Lulu, and Prodigi are named and not connected. Browser print is for reading a sample."),
    card("Phone", "In Safari or Chrome, use Share or the browser menu and choose Add to Home Screen. That installs this app on the phone that can reach it. It is not an App Store download."),
    card("Call Now", "Waiting on a verified phone number for this product. None is on file, so there is no call button."),
    el("button", { class: "button ghost", type: "button", onclick: clearAll }, "Clear personal information"),
    projects.length ? el("div", {}, projects.map((project) => el("p", {}, [
      el("a", { href: "#/book", onclick: () => openProject(project.id) }, project.title),
      ` · ${project.people} people`,
    ]))) : el("p", { class: "fine" }, "No samples are saved on this computer."),
  );
}

function card(title, body) {
  return el("article", {}, [el("h2", {}, title), el("p", {}, body)]);
}

async function openProject(id) {
  state.project = await api("GET", `/api/projects/${id}`);
  state.projectId = id;
  sessionStorage.setItem("spirit-project", id);
  state.page = 0;
  if (location.hash === "#/book") showBook();
}

async function clearAll() {
  if (!confirm("Remove every sample saved on this computer?")) return;
  await api("DELETE", "/api/projects");
  sessionStorage.removeItem("spirit-project");
  fillForm(null);
  showPath();
}

function route() {
  const name = (location.hash.replace("#/", "") || "home").split("?")[0];
  const view = ["home", "studio", "book", "path"].includes(name) ? name : "home";
  document.querySelectorAll("[data-view]").forEach((section) => { section.hidden = section.dataset.view !== view; });
  document.querySelectorAll("[data-go]").forEach((link) => {
    if (link.dataset.go === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (view === "studio") renderPeople();
  if (view === "book") showBook();
  if (view === "path") showPath();
}

async function boot() {
  $("studio-form").addEventListener("submit", writeSample);
  $("add-person").addEventListener("click", () => {
    if (state.people.length >= 5) return say("Five people is the maximum for this sample.", true);
    state.people.push(blankPerson());
    state.stamp += 1;
    renderPeople();
  });
  $("use-example").addEventListener("click", useExample);
  state.status = await api("GET", "/api/status").catch(() => null);
  $("claude-line").textContent = state.status?.claude
    ? "Claude is connected. Generating a sample sends the family name, the edition, the notes, and each birth date, time, and place to Anthropic."
    : "Claude is not connected. A sample still needs every birth date, time, and place. The Anthropic key in the vault env was not found.";
  if (state.projectId) {
    state.project = await api("GET", `/api/projects/${state.projectId}`).catch(() => null);
    if (!state.project) sessionStorage.removeItem("spirit-project");
  }
  renderPeople();
  addEventListener("hashchange", route);
  if ("serviceWorker" in navigator && (location.pathname === "/" || location.pathname === "/index.html")) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  route();
}

boot();
