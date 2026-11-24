/**
 * Safe copy to clipboard that works in both Secure Contexts (HTTPS, localhost)
 * and Non-Secure Contexts (HTTP over LAN IP, e.g. 172.16.10.52:8080).
 */
export const safeCopyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  // 1. Try modern navigator.clipboard if available
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // Fall through to legacy execCommand fallback
  }

  // 2. Fallback for HTTP / non-secure contexts
  try {
    if (typeof document !== 'undefined') {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (err) {
    console.error('safeCopyToClipboard failed:', err);
  }

  return false;
};
