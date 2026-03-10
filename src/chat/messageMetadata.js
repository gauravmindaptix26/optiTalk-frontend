export const ATTACHMENT_PLACEHOLDER = "__chat_attachment__";

export function parseMessageMetadata(extendedData) {
  if (!extendedData) return {};

  try {
    const parsed = JSON.parse(extendedData);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function stringifyMessageMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") return "";

  const entries = Object.entries(metadata).filter(([, value]) => value != null);
  if (!entries.length) return "";

  return JSON.stringify(Object.fromEntries(entries));
}

export function mergeMessageMetadata(extendedData, nextMetadata) {
  return stringifyMessageMetadata({
    ...parseMessageMetadata(extendedData),
    ...(nextMetadata || {}),
  });
}

export function getMessagePreview(message) {
  if (!message) return "";

  const metadata = parseMessageMetadata(message.extendedData);
  const attachment = metadata.attachment;
  const text = String(message.message || "").trim();

  if (attachment?.type?.startsWith("image/")) {
    return text && text !== ATTACHMENT_PLACEHOLDER ? `Photo | ${text}` : "Photo";
  }

  if (attachment?.name) {
    return text && text !== ATTACHMENT_PLACEHOLDER
      ? `Attachment | ${text}`
      : `Attachment | ${attachment.name}`;
  }

  if (text === ATTACHMENT_PLACEHOLDER) return "Attachment";
  return text;
}
