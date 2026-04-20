export function stripHtmlTags(input: string | undefined | null): string {
  if (!input) return "";
  const noTags = input.replace(/<[^>]*>/g, "");
  return noTags
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
