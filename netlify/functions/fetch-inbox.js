// Lit les emails de la boîte de réception Gandi via IMAP, avec les mêmes
// identifiants que l'envoi SMTP déjà configuré (SMTP_USER/SMTP_PASS) --
// pas de nouvelle variable d'environnement à ajouter. Gandi expose IMAP et
// SMTP sur le MÊME hôte (mail.gandi.net), seul le port change (993 pour
// IMAP SSL) -- confirmé via la documentation officielle Gandi après un
// premier essai raté sur "imap.gandi.net" (hôte inexistant, DNS ENOTFOUND
// en conditions réelles).
//
// Deux modes, selon la query string :
// - sans "uid" : liste des 30 derniers emails (aperçu léger, comme avant).
// - avec "?uid=X" : contenu complet d'UN message précis (le clic sur une
//   ligne de la boîte de réception doit vraiment l'ouvrir, pas juste
//   renvoyer une liste).
//
// Honnêteté/résilience : si les identifiants ne sont pas configurés, ou si
// la connexion IMAP échoue, renvoie une erreur claire plutôt qu'une liste
// vide silencieuse -- la boîte de réception doit dire explicitement
// "indisponible", jamais laisser croire qu'elle est simplement vide.
const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

async function connectClient() {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "mail.gandi.net",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    logger: false
  });
  await client.connect();
  return client;
}

async function listMessages(client) {
  const lock = await client.getMailboxLock("INBOX");
  const messages = [];
  try {
    // Les 30 emails les plus récents seulement -- une boîte de réception
    // complète n'est pas l'objet ici, juste un aperçu rapide dans le CRM.
    const status = await client.status("INBOX", { messages: true });
    const total = status.messages || 0;
    const from = Math.max(1, total - 29);
    for await (const msg of client.fetch(`${from}:${total}`, { envelope: true, flags: true, uid: true })) {
      messages.push({
        uid: msg.uid,
        date: msg.envelope?.date || null,
        from: msg.envelope?.from?.[0]?.address || "",
        fromName: msg.envelope?.from?.[0]?.name || "",
        subject: msg.envelope?.subject || "(sans objet)",
        unread: !msg.flags?.has("\\Seen")
      });
    }
  } finally {
    lock.release();
  }
  messages.sort((a, b) => new Date(b.date) - new Date(a.date));
  return messages;
}

async function readMessage(client, uid) {
  const lock = await client.getMailboxLock("INBOX");
  try {
    const { content } = await client.download(uid, undefined, { uid: true });
    const parsed = await simpleParser(content);
    return {
      from: parsed.from?.text || "",
      to: parsed.to?.text || "",
      subject: parsed.subject || "(sans objet)",
      date: parsed.date || null,
      text: parsed.text || "",
      html: parsed.html || ""
    };
  } finally {
    lock.release();
  }
}

exports.handler = async (event) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { statusCode: 501, body: JSON.stringify({ error: "SMTP_USER/SMTP_PASS non configurées sur Netlify" }) };
  }
  const uid = event.queryStringParameters?.uid;
  let client;
  try {
    client = await connectClient();
    const result = uid
      ? { message: await readMessage(client, Number(uid)) }
      : { messages: await listMessages(client) };
    await client.logout();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    if (client) { try { await client.logout(); } catch { /* déjà fermée ou jamais ouverte */ } }
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Connexion IMAP indisponible" }) };
  }
};
