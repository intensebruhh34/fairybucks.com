import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL(file,root),'utf8')).toString('base64'));
const {parentNotice}=await load('parent-notice.js');const {siteContact}=await load('site-contact.js');
const contact={operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,phone:siteContact.phone,supportEmail:siteContact.supportEmail};
const hash=createHash('sha256').update(JSON.stringify({notice:parentNotice,contact})).digest('hex');
console.log(JSON.stringify({version:parentNotice.version,notice_hash:hash,contacts_complete:Object.values(contact).every(Boolean),privacy_reviewed:siteContact.privacyNoticeReviewed,parent_permission_enabled:siteContact.parentPermissionEnabled}));
