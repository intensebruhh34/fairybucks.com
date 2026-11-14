// Public contact settings. Never put credentials, private addresses or secret keys here.
// Email-only public contact is intentional for the draft. Do not invent or publish personal details.
export const siteContact = Object.freeze({
 supportEmail: 'support@fairybucks.com',
 privacyNoticeReviewed: false,
 operatorName: '',
 mailingAddress: '',
 phone: ''
});
export const supportEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteContact.supportEmail) ? siteContact.supportEmail : '';
export function renderContact(root = document) {
 for (const el of root.querySelectorAll('[data-support-email]')) {
  el.replaceChildren();
  if (supportEmail) {
   const link = document.createElement('a');
   link.href = 'mailto:' + supportEmail;
   link.textContent = supportEmail;
   el.append(link);
  } else el.textContent = 'During the invite-only pilot, contact the person who invited you. A dedicated support inbox has not been configured yet.';
 }
 for (const [key,value] of Object.entries(siteContact)) {
  for (const el of root.querySelectorAll('[data-contact="'+key+'"]')) el.textContent = value || '';
 }
 for (const el of root.querySelectorAll('[data-support-incomplete]')) el.hidden = Boolean(supportEmail);
 for (const el of root.querySelectorAll('[data-contact-field]')) el.hidden = !siteContact[el.getAttribute('data-contact-field')];
 for (const el of root.querySelectorAll('[data-privacy-draft]')) el.hidden = siteContact.privacyNoticeReviewed;
}
