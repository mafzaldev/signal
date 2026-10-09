export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/**
 * The shared look of Signal's emails: the Lamp logo, a heading, a short message, one
 * button, and a quiet footer under the card. Inline styles and tables, because email
 * clients ignore stylesheets. `body` is HTML; callers escape anything user-provided in it.
 * The plain-text part of each email carries the raw link for clients that can't show the
 * button, so the HTML doesn't need to print it. The logo is the Lamp mark drawn with two
 * nested circles; padding centres the dot (2 + 4 + 10 + 4 + 2 = 22px), which mail clients
 * render more reliably than vertical alignment.
 */
export function layout({
  heading,
  body,
  button,
  footer,
}: {
  heading: string;
  body: string;
  button: { label: string; href: string };
  footer: string;
}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f0f0e;color-scheme:dark">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0e;font-family:${FONT}">
      <tr><td align="center" style="padding:48px 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
          <tr><td style="padding:0 8px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle">
                <div style="width:10px;height:10px;padding:4px;border:2px solid #ededea;border-radius:50%">
                  <div style="width:10px;height:10px;border-radius:50%;background:#ff5a14;font-size:0;line-height:0">&nbsp;</div>
                </div>
              </td>
              <td style="padding-left:10px;font-size:16px;font-weight:700;color:#ededea;letter-spacing:-0.2px">Signal</td>
            </tr></table>
          </td></tr>
          <tr><td style="background:#181817;border:1px solid #2a2a28;border-radius:16px;padding:40px 36px">
            <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;font-weight:700;color:#ededea;letter-spacing:-0.3px">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#c2c2bc">${body}</p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="border-radius:10px;background:#ff5a14">
                <a href="${escapeHtml(button.href)}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(button.label)}</a>
              </td>
            </tr></table>
          </td></tr>
          <tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#8d8d86">
            ${escapeHtml(footer)}<br>
            Signal · Release control for your team
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
