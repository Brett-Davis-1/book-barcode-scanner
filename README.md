# Bookscan

Scan an ISBN-13 barcode using a phone camera or a photo, or enter an ISBN-10 or ISBN-13 by hand. Bookscan validates the check digit and lets you copy the ISBN or look up the edition on Open Library.

## Run locally

Serve this folder over HTTP on localhost, for example with `python -m http.server 8000`, then open <http://localhost:8000>. Camera access requires localhost or HTTPS and browser permission. Use a clear photo of the main barcode if camera access is unavailable.

## Publish on GitHub Pages

Push this folder's contents to the root of a GitHub repository on the `main` branch. Under **Settings → Pages**, select **Deploy from a branch**, then **main** and **/(root)**. Save and open the HTTPS address that GitHub displays.

The app is static and has no build step. It loads the pinned ZXing browser decoder from jsDelivr when needed. Camera frames and uploaded photos are decoded locally. The Open Library link opens separately and includes the ISBN.
