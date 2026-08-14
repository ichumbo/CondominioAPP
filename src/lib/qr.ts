import QRCode from "qrcode";

export async function qrDataUrl(text: string, size = 160) {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#1C2118", light: "#ffffff" },
  });
}
