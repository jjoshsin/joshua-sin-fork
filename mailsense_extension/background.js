const STORAGE_KEY = "lastProcessedEmailId";
const LABELED_KEY = "labeledEmails";

/*Authentication*/
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) reject("No token found");
      else resolve(token);
    });
  });
}

/*Fetch Gmail message IDs*/
async function fetchMessageList(token) {
  const resp = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return data.messages || [];
}

/*Fetch full email content by ID*/
async function fetchFullMessage(token, id) {
  try {
    const resp = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const msgData = await resp.json();
    const headers = msgData.payload?.headers || [];
    const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)";
    const body = msgData.snippet || "";
    return { id, subject, body };
  } catch (err) {
    console.warn(`Failed to fetch message ${id}:`, err);
    return { id, subject: "(error)", body: "" };
  }
}

/*Fetch concurrently (batched)*/
async function fetchWithConcurrency(list, fn, limit = 10) {
  const results = [];
  for (let i = 0; i < list.length; i += limit) {
    const chunk = list.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

/**Send emails to backend for prediction*/
async function sendToBackend(emails) {
  if (!emails.length) return [];
  const response = await fetch("http://127.0.0.1:8000/api/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(emails),
  });
  
  const data = await response.json();
  console.log(`Sent ${emails.length} emails to backend.`);
  return data.results || [];
}

/*Get only new messages since last processed ID*/
function getNewMessages(messages, lastId, initial) {
  if (initial || !lastId) return messages;
  const lastIndex = messages.findIndex(m => m.id === lastId);
  return lastIndex >= 0 ? messages.slice(0, lastIndex) : messages;
}

/*Main function — fetch, label, store*/
async function fetchAndProcessEmails(initial = false) {
  try {
    const token = await getAuthToken();
    const messages = await fetchMessageList(token);

    const stored = await chrome.storage.local.get([STORAGE_KEY, LABELED_KEY]);
    const lastId = stored[STORAGE_KEY] || null;
    const existingLabeled = stored[LABELED_KEY] || [];

    const newMessages = getNewMessages(messages, lastId, initial);
    if (!newMessages.length) {
      console.log("No new emails found.");
      return;
    }

    // Fetch full content
    const emails = await fetchWithConcurrency(newMessages, m => fetchFullMessage(token, m.id));

    // Send to backend for labeling
    const newLabeledEmails = await sendToBackend(emails);

    if (newLabeledEmails.length) {
      // Append all new labeled emails — no trimming
      const combined = [...newLabeledEmails, ...existingLabeled];
      await chrome.storage.local.set({ [LABELED_KEY]: combined });
      console.log(`📦 Stored total of ${combined.length} labeled emails.`);
    }

    // Update last processed message ID
    if (messages.length) {
      await chrome.storage.local.set({ [STORAGE_KEY]: messages[0].id });
    }

  } catch (err) {
    console.error("❌ Error fetching/sending emails:", err);
  }
}

/*Event listeners*/
chrome.runtime.onInstalled.addListener(() => fetchAndProcessEmails(true));

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "fetchEmails") fetchAndProcessEmails(false);
});
