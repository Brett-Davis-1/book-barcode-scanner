import { normalizeIsbn } from "./isbn.mjs";

const get = (id) => document.getElementById(id);
const preview = get("preview");
const camera = get("camera");
const photo = get("photo");
const file = get("file");
const isbn = get("isbn");
const status = get("status");
let activeScan;
let readerPromise;
let operation = 0;
let successTimer;

function getReader() {
  readerPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js";
    script.onload = () => {
      if (window.ZXingBrowser) {
        // DecodeHintType values in the pinned ZXing release.
        const POSSIBLE_FORMATS = 2;
        const TRY_HARDER = 3;
        const hints = new Map([
          [POSSIBLE_FORMATS, [window.ZXingBrowser.BarcodeFormat.EAN_13]],
          [TRY_HARDER, true]
        ]);
        resolve(new window.ZXingBrowser.BrowserMultiFormatOneDReader(hints));
      }
      else reject(new Error("Barcode decoder unavailable"));
    };
    script.onerror = () => reject(new Error("Barcode decoder unavailable"));
    document.head.append(script);
  }).catch((error) => {
    readerPromise = undefined;
    throw error;
  });
  return readerPromise;
}

function resetCamera() {
  operation += 1;
  clearTimeout(successTimer);
  get("scan-success").hidden = true;
  activeScan?.stop();
  activeScan = undefined;
  preview.hidden = true;
  camera.textContent = "Start camera";
}

function showIsbn(value) {
  resetCamera();
  const attempt = operation;
  get("result").hidden = true;
  get("format").textContent = value.length === 13 ? "ISBN-13" : "ISBN-10";
  get("value").textContent = value;
  get("lookup").href = "https://openlibrary.org/isbn/" + value;
  get("scan-success").hidden = false;
  status.textContent = "Barcode scanned successfully.";
  successTimer = setTimeout(() => {
    if (attempt !== operation) return;
    get("scan-success").hidden = true;
    get("result").hidden = false;
    status.textContent = "Your book link is ready.";
    get("result").scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "nearest"
    });
  }, 900);
}

function bookBarcode(value) {
  const isbn13 = normalizeIsbn(value);
  return isbn13?.length === 13 ? isbn13 : null;
}

camera.addEventListener("click", async () => {
  if (camera.textContent === "Stop camera") {
    resetCamera();
    status.textContent = "Camera stopped.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Camera access needs HTTPS or localhost. Try a photo or enter the ISBN.";
    return;
  }
  resetCamera();
  get("result").hidden = true;
  const attempt = operation;
  camera.textContent = "Stop camera";
  status.textContent = "Starting camera…";
  try {
    const reader = await getReader();
    if (attempt !== operation) return;
    // Use a separate video per attempt so a late permission response cannot replace a newer stream.
    const video = preview.cloneNode();
    video.removeAttribute("id");
    video.hidden = false;
    video.muted = true;
    video.playsInline = true;
    preview.before(video);
    const controls = await reader.decodeFromConstraints({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    }, video, (result, error, scanner) => {
      if (attempt !== operation) {
        scanner.stop();
        video.remove();
        return;
      }
      if (!result) return;
      const value = bookBarcode(result.getText());
      if (value) {
        scanner.stop();
        video.remove();
        showIsbn(value);
      } else {
        status.textContent = "Aim at the main 13-digit ISBN barcode, usually starting with 978 or 979.";
      }
    }).catch((error) => {
      video.remove();
      throw error;
    });
    if (attempt !== operation) {
      controls.stop();
      video.remove();
      return;
    }
    activeScan = { stop() { controls.stop(); video.remove(); } };
    video.hidden = false;
    status.textContent = "Hold the barcode horizontally, fill most of the camera view, and move back until the lines look sharp.";
    const track = video.srcObject?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.();
    if (capabilities?.focusMode?.includes("continuous")) {
      track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
    }
  } catch (error) {
    if (attempt !== operation) return;
    resetCamera();
    if (error.name === "NotAllowedError") {
      status.textContent = "Allow camera access in your browser, or try a photo.";
    } else if (error.name === "NotFoundError" || error.name === "NotReadableError") {
      status.textContent = "No camera is available. Try a photo or enter the ISBN.";
    } else {
      status.textContent = "The scanner could not start. Try again or enter the ISBN.";
    }
  }
});

photo.addEventListener("click", () => file.click());
file.addEventListener("change", async () => {
  const image = file.files[0];
  file.value = "";
  if (!image) return;
  resetCamera();
  get("result").hidden = true;
  const attempt = operation;
  const url = URL.createObjectURL(image);
  status.textContent = "Reading photo…";
  try {
    const reader = await getReader();
    if (attempt !== operation) return;
    const result = await reader.decodeFromImageUrl(url);
    if (attempt !== operation) return;
    const value = bookBarcode(result.getText());
    if (value) showIsbn(value);
    else status.textContent = "This barcode does not contain an ISBN. Try a photo of the main book barcode.";
  } catch {
    if (attempt === operation) {
      status.textContent = "Could not read an ISBN. Try a sharp, well-lit photo with the entire barcode visible.";
    }
  } finally {
    URL.revokeObjectURL(url);
  }
});

get("manual").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = normalizeIsbn(isbn.value);
  if (value) showIsbn(value);
  else status.textContent = "Enter a valid ISBN-10 or ISBN-13, including the final check digit.";
});

get("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(get("value").textContent);
    status.textContent = "ISBN copied.";
  } catch {
    status.textContent = "Clipboard unavailable. Select the ISBN to copy it.";
  }
});
window.addEventListener("pagehide", resetCamera);