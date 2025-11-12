/**
 * panel.js
 * ----------------------------------------
 * Injects MailSense panel and filters Gmail inbox
 * based on labels stored in chrome.storage.local.
 */

const injectMailSensePanel = async () => {
  if (document.getElementById("mailsense-panel")) return;

  const container = document.querySelector("div.aeH");
  if (!container) return;

  // --- Panel setup
  const panel = document.createElement("div");
  panel.id = "mailsense-panel";
  panel.style.border = "1px solid #ccc";
  panel.style.padding = "10px";
  panel.style.margin = "10px 0";
  panel.style.borderRadius = "8px";
  panel.style.background = "#f5f5f5";
  panel.style.fontFamily = "Arial, sans-serif";

  const title = document.createElement("h3");
  title.textContent = "MailSense Filter";
  title.style.margin = "0 0 8px 0";
  panel.appendChild(title);

  const categories = [
    "All",
    "Work",
    "Personal",
    "Spam / Advertisement"
  ];

  const btnContainer = document.createElement("div");
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat;
    btn.style.margin = "3px";
    btn.style.padding = "5px 10px";
    btn.style.border = "1px solid #888";
    btn.style.borderRadius = "5px";
    btn.style.backgroundColor = "#fff";
    btn.style.cursor = "pointer";
    btn.onclick = () => {
  console.log("Button clicked:", cat);
  filterGmailByCategory(cat);
};

    btnContainer.appendChild(btn);
  });

  panel.appendChild(btnContainer);
  container.prepend(panel);
};

/*Filter Gmail threads by category*/
async function filterGmailByCategory(category) {
  const rows = document.querySelectorAll("tr.zA");
  if (!rows.length) {
    console.warn("No Gmail rows found — inbox may not be fully loaded yet.");
    return;
  }

  const stored = await chrome.storage.local.get("labeledEmails");
  const labeledEmails = stored.labeledEmails || [];

  console.log("Loaded labeled emails:", labeledEmails.slice(0, 5));
  console.log("Filtering category:", category);

  if (category === "All") {
    rows.forEach(row => (row.style.display = ""));
    return;
  }

  const labelKey =
    category === "Spam / Advertisement" ? "spam" : category.toLowerCase();

  let matchedCount = 0;

  rows.forEach(row => {
  const span = row.querySelector("span[data-legacy-thread-id]");
  const threadId = span?.getAttribute("data-legacy-thread-id"); // ← this is the ID used in storage

  if (!threadId) {
    // fallback if something goes wrong
    row.style.display = "";
    return;
  }

  const match = labeledEmails.find(e => e.id === threadId);

  if (match?.label === labelKey) {
    row.style.display = ""; // show
  } else {
    row.style.display = "none"; // hide
  }
});


  console.log(`Filtered ${matchedCount} emails for category: ${category}`);
}


/*Initialize the panel when Gmail loads*/
const observer = new MutationObserver(() => {
  const inboxLoaded = document.querySelector("div.aeH tr.zA");
  if (inboxLoaded) {
    injectMailSensePanel();
    observer.disconnect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
