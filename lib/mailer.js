/**
 * Envoi d'e-mails transactionnels, indépendant du service d'e-mails intégré de
 * Supabase (limité à quelques envois par heure, souvent classé en indésirables).
 *
 * Fournisseurs gratuits pris en charge, sans dépendance npm (API HTTP) :
 *   - Brevo  : BREVO_API_KEY  — 300 e-mails/jour gratuits, expéditeur = une
 *              adresse vérifiée dans Brevo (une adresse Gmail convient).
 *   - Resend : RESEND_API_KEY — 3 000 e-mails/mois gratuits, domaine vérifié requis.
 * Expéditeur : MAIL_FROM (adresse) et MAIL_FROM_NAME (nom, « The Capital » par défaut).
 *
 * Sans clé, mailerReady() renvoie false : les parcours d'inscription retombent
 * sur les e-mails Supabase, rien ne casse.
 */
const BREVO = process.env.BREVO_API_KEY || '';
const RESEND = process.env.RESEND_API_KEY || '';
const FROM = (process.env.MAIL_FROM || '').trim();
const FROM_NAME = (process.env.MAIL_FROM_NAME || 'The Capital').trim();
export const SITE_URL = (process.env.SITE_URL || 'https://thecapitalinvest.vercel.app').replace(/\/+$/, '');

export function mailerReady() {
  return !!((BREVO || RESEND) && FROM);
}

export function mailerInfo() {
  return { ready: mailerReady(), provider: BREVO ? 'brevo' : RESEND ? 'resend' : null, from: FROM || null };
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Gabarit HTML sobre, lisible sur mobile et dans les clients e-mail courants. */
export function layout({ title, intro, blocks = [], cta, foot }) {
  const body = blocks.map(b => b.code
    ? `<div style="margin:22px 0;text-align:center"><div style="display:inline-block;font:700 32px/1 'Courier New',monospace;letter-spacing:10px;color:#0A0804;background:#F0CD85;border-radius:8px;padding:16px 22px">${esc(b.code)}</div></div>`
    : `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a332a">${b.html || esc(b.text)}</p>`).join('');
  const button = cta ? `<div style="margin:26px 0 8px;text-align:center"><a href="${esc(cta.url)}" style="display:inline-block;background:#B8964E;color:#0A0804;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:6px">${esc(cta.label)}</a></div>` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e7dfcf">
<tr><td style="background:#0A0804;padding:22px 28px;text-align:center"><img src="${SITE_URL}/assets/the-capital-logo.png" alt="The Capital" width="170" style="display:inline-block;max-width:170px;height:auto;border:0"></td></tr>
<tr><td style="padding:30px 28px 10px"><h1 style="margin:0 0 14px;font:700 22px/1.3 Georgia,serif;color:#0A0804">${esc(title)}</h1>
${intro ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a332a">${esc(intro)}</p>` : ''}${body}${button}</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #efe8da;font-size:12px;line-height:1.6;color:#8a8171">${foot ? esc(foot) + '<br>' : ''}The Capital — l’intelligence financière de la BRVM.<br><a href="${SITE_URL}" style="color:#B8964E">${SITE_URL.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

function textVersion({ title, intro, blocks = [], cta }) {
  return [title, '', intro, ...blocks.map(b => b.code ? 'Code : ' + b.code : (b.text || String(b.html || '').replace(/<[^>]+>/g, ''))), cta ? cta.label + ' : ' + cta.url : '', '', 'The Capital — ' + SITE_URL].filter(x => x !== undefined).join('\n');
}

/**
 * Envoie un e-mail. Ne lève jamais : renvoie { sent, provider, error }.
 * @param {{to:string,name?:string,subject:string,content:object,replyTo?:string}} m
 */
export async function sendMail({ to, name, subject, content, replyTo }) {
  if (!mailerReady()) return { sent: false, error: 'NO_PROVIDER' };
  const html = layout(content), text = textVersion(content);
  try {
    let r;
    if (BREVO) {
      r = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: FROM_NAME, email: FROM }, to: [{ email: to, name: name || undefined }], subject, htmlContent: html, textContent: text, replyTo: replyTo ? { email: replyTo } : undefined }),
        signal: AbortSignal.timeout(12000)
      });
    } else {
      r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: `${FROM_NAME} <${FROM}>`, to: [to], subject, html, text, reply_to: replyTo || undefined }),
        signal: AbortSignal.timeout(12000)
      });
    }
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[MAILER]', r.status, detail.slice(0, 300));
      return { sent: false, provider: BREVO ? 'brevo' : 'resend', error: 'HTTP_' + r.status };
    }
    return { sent: true, provider: BREVO ? 'brevo' : 'resend' };
  } catch (e) {
    console.error('[MAILER]', e?.message || e);
    return { sent: false, error: 'NETWORK' };
  }
}

/* ── Messages types ─────────────────────────────────────────── */
export const MAILS = {
  signupCode: (code, nom) => ({
    subject: code + ' — votre code de confirmation The Capital',
    content: { title: 'Confirmez votre adresse e-mail', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'voici votre code pour activer votre compte The Capital :', blocks: [{ code }, { text: 'Ce code est valable 15 minutes. Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement cet e-mail.' }] }
  }),
  welcome: (nom, trialDays) => ({
    subject: 'Bienvenue sur The Capital',
    content: { title: 'Bienvenue' + (nom ? ', ' + nom : '') + ' !', intro: 'Votre compte est activé.', blocks: [
      { text: trialDays > 0 ? 'Vous profitez de ' + trialDays + ' jours d’accès complet gratuit : cours BRVM en temps réel, états financiers, analyses, screener, portefeuille et alertes.' : 'Vous avez accès au marché BRVM, aux cours et aux fiches sociétés.' },
      { text: 'Astuce : ajoutez vos valeurs favorites à votre liste de suivi et créez une alerte de cours pour être prévenu au bon moment.' }],
      cta: { label: 'Ouvrir mon espace', url: SITE_URL + '/app/app.html' } }
  }),
  recovery: link => ({
    subject: 'Réinitialisation de votre mot de passe The Capital',
    content: { title: 'Nouveau mot de passe', intro: 'Vous avez demandé à réinitialiser votre mot de passe.', blocks: [{ text: 'Cliquez sur le bouton ci-dessous pour en choisir un nouveau. Ce lien est valable une heure et ne fonctionne qu’une fois.' }, { text: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.' }], cta: { label: 'Choisir un nouveau mot de passe', url: link } }
  }),
  subscriptionActive: (nom, planName, end) => ({
    subject: 'Votre abonnement ' + planName + ' est actif',
    content: { title: 'Abonnement activé', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'merci pour votre confiance !', blocks: [{ text: 'Votre formule ' + planName + ' est active' + (end ? ' jusqu’au ' + new Date(end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '.' }], cta: { label: 'Accéder à The Capital', url: SITE_URL + '/app/app.html' } }
  }),
  paymentRejected: (nom, note) => ({
    subject: 'Votre paiement n’a pas pu être validé',
    content: { title: 'Paiement non validé', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'nous n’avons pas pu valider votre reçu de paiement.', blocks: [note ? { text: 'Motif : ' + note } : { text: 'Le montant ou la référence ne correspondent pas à la commande.' }, { text: 'Vous pouvez envoyer un nouveau reçu depuis la page de paiement ou répondre à cet e-mail.' }], cta: { label: 'Page de paiement', url: SITE_URL + '/payment.html' } }
  }),
  paymentSubmittedToAdmin: (nom, email, planName, period, orderAmount, claimedAmount, reference, orderId, proofId, mismatch) => ({
    subject: '💳 Nouveau paiement à vérifier — ' + planName,
    content: {
      title: 'Nouveau paiement à vérifier',
      intro: 'Un client vient de transmettre un reçu. Vérifiez le reçu, la référence et le montant avant validation.',
      blocks: [
        { text: 'Client : ' + (nom || '—') + ' — ' + email },
        { text: 'Formule : ' + planName + ' · Période : ' + period },
        { text: 'Montant commande : ' + new Intl.NumberFormat('fr-FR').format(Number(orderAmount) || 0) + ' FCFA · Montant déclaré : ' + new Intl.NumberFormat('fr-FR').format(Number(claimedAmount) || 0) + ' FCFA' + (mismatch ? ' — ⚠️ ÉCART À VÉRIFIER' : '') },
        { text: 'Référence Wave : ' + (reference || 'non fournie') },
        { text: 'Commande : ' + orderId + ' · Reçu : ' + proofId }
      ],
      cta: { label: 'Examiner et valider le paiement', url: SITE_URL + '/admin-payments.html' },
      foot: 'Ne validez que si le paiement est effectivement reçu et que le montant correspond à la commande.'
    }
  }),
  paymentInfo: (nom, note) => ({
    subject: 'Précisions demandées sur votre paiement',
    content: { title: 'Encore une petite étape', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'nous avons besoin d’une précision pour valider votre paiement.', blocks: [{ text: note || 'Merci de nous transmettre la référence de la transaction Wave.' }], cta: { label: 'Compléter mon paiement', url: SITE_URL + '/payment.html' } }
  }),
  trialEnding: (nom, days) => ({
    subject: 'Votre essai The Capital se termine dans ' + days + ' jour' + (days > 1 ? 's' : ''),
    content: { title: 'Votre essai touche à sa fin', intro: (nom ? 'Bonjour ' + nom + ', ' : 'Bonjour, ') + 'votre accès complet gratuit se termine dans ' + days + ' jour' + (days > 1 ? 's' : '') + '.', blocks: [{ text: 'Pour garder les analyses, le screener, les états financiers complets et vos alertes, choisissez la formule qui vous convient.' }], cta: { label: 'Voir les formules', url: SITE_URL + '/pricing.html' } }
  }),
  adminMessage: (nom, subject, message) => ({
    subject,
    content: { title: subject, intro: nom ? 'Bonjour ' + nom + ',' : 'Bonjour,', blocks: String(message || '').split(/\n{2,}/).map(t => ({ text: t.trim() })).filter(b => b.text) }
  })
};
