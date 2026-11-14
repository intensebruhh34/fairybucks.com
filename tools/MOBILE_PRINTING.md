# Mobile PDF printing

The original link had `download`, which requests saving rather than normal PDF navigation. This update provides a primary Open PDF to print link without that attribute and a separate Download PDF fallback. Both point at the exact same unchanged sheet; browser/PDF-viewer support and printer compatibility still determine whether phone printing is available. No forced iframe print calls or unreliable automatic print popups are used.

Phone help is based on Apple and Google documentation:
- https://support.apple.com/en-us/109349
- https://support.google.com/chrome/answer/1069693?co=GENIE.Platform%3DAndroid

Validation: regression suite and link-path checks pass. Local browser QA with the real parent module and mocked authentication displayed five paired actions and phone help. Clicking the open link launched a new tab, but the cloud browser disconnected before the PDF viewer could be inspected; PDF-viewer behavior, iOS/Android hardware and a physical print job are not confirmed. The unchanged PDFs were validated in the prior print release and already printed successfully on the owner's laptop.

No database migration. After merge, refresh, open Print Fairy Bucks and try Open PDF to print in Safari or Chrome. Check Share/Print or the PDF viewer menu, with the saved-file/printer-app fallback if needed.
