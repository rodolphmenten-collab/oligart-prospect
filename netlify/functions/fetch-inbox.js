// Lit les emails récents de la boîte de réception Gandi via IMAP, avec les
// mêmes identifiants que l'envoi SMTP déjà configuré (SMTP_USER/SMTP_PASS) --
// pas de nouvelle variable d'environnement à ajouter. Gandi expose IMAP sur
// imap.gandi.net:993 (SSL), même compte que mail.gandi.net pour le SMTP.
//
// Honnêteté/résilience : si les identifiants ne sont pas configurés, ou si
// la connexion IMAP échoue, renvoie une erreur claire plutôt qu'une liste
// vide silencieuse -- la boîte de réception doit dire explicitement
// "indisponible", jamais laisser croire qu'elle est simplement vide.
const { ImapFlow } = require("imapflow");

exports.handler = async () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { statusCode: 501, body: JSON.stringify({ error: "SMTP_USER/SMTP_PASS non configurées sur Netlify" }) };
  }
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gandi.net",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];
    try {
      // Les 30 emails les plus récents seulement -- une boîte de réception
      // complète n'est pas l'objet ici, juste un aperçu rapide dans le CRM.
      const status = await client.status("INBOX", { messages: true });
      const total = status.messages || 0;
      const from = Math.max(1, total - 29);
      for await (const msg of client.fetch(`${from}:${total}`, { envelope: true, flags: true })) {
        messages.push({
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
    await client.logout();
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { statusCode: 200, body: JSON.stringify({ messages }) };
  } catch (e) {
    try { await client.logout(); } catch { /* déjà fermée ou jamais ouverte */ }
    return { statusCode: 500, body: JSON.stringify({ error: e.message || "Connexion IMAP indisponible" }) };
  }
};
