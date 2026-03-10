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
