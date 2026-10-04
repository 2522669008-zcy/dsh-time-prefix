/**
 * Send-time prefix, desktop variant.
 *
 * This build carries **no Config schema and no client half**. Its on/off switch
 * is the desktop plugin manager's own per-plugin toggle, which acts on the
 * loader row rather than on plugin configuration — so there is nothing to
 * declare here and nothing to render in Settings.
 */

/** Cordis plugin name. Must match the `name` in cordis.patch.yml. */
export const name = 'dsh-time-prefix-desktop';

/**
 * The plugin contributes an `agent/pre-step` listener and consumes no service,
 * so it declares no dependency; the listener is disposed with the plugin.
 */
export const inject = [];

/**
 * Text that opened a prefixed block in an earlier release of the sibling
 * plugin. That release tagged its block with an invisible `U+2063` followed by
 * this literal, which leaked into the visible message and the request; only the
 * text after it was ever meant to be read.
 */
const LEGACY_SENTINEL = '\u2063dsh-time-prefix';

/**
 * Shape of the prefix this plugin writes, including the line break that keeps
 * the reading on its own line — for example `【2026/10/04，23:27】\n`.
 *
 * Recognition uses the rendered text itself, never a hidden sentinel: anything
 * smuggled into `text` is shown to the user and sent to the model, so the
 * message must contain nothing but the reading. The break is matched with the
 * reading so stripping removes both; otherwise every refresh would leave the
 * previous reading's blank line behind. It is optional so that a message written
 * before the break existed is still recognized rather than accumulating.
 */
const PREFIX_PATTERN = /^【\d{4}\/\d{2}\/\d{2}，\d{2}:\d{2}】\n?/;

/**
 * Render the send-time prefix, local to the host process, at minute precision.
 * @param lineBreak - Append the line break that puts the user's own text on its
 *   own line. Omitted for a message with no text, where a trailing break would
 *   only leave a blank line before the image.
 * @returns The prefix text, for example `【2026/10/04，23:27】` or
 *   `【2026/10/04，23:27】\n`.
 */
function formatTimePrefix(lineBreak = false) {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const reading = `【${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}，${pad(now.getHours())}:${pad(now.getMinutes())}】`;
  return lineBreak ? `${reading}\n` : reading;
}

/**
 * Strip every prefix this plugin (or the sibling plugin's earlier release)
 * already wrote, leaving only what the user actually typed.
 *
 * The loop removes every stacked layer rather than just the first, because each
 * turn that skipped normalization added one more; a persisted draft can carry
 * several. It converges unconditionally, so stripping its own output is a no-op.
 *
 * @param text - First text block of the message.
 * @returns The message body with no prefix left on it.
 */
function stripPrefix(text) {
  let body = text;
  for (;;) {
    const withoutSentinel = body.startsWith(LEGACY_SENTINEL) ? body.slice(LEGACY_SENTINEL.length) : body;
    if (!PREFIX_PATTERN.test(withoutSentinel)) return body;
    body = withoutSentinel.replace(PREFIX_PATTERN, '');
  }
}

/**
 * Attach the reading for this step to one message.
 *
 * The reading is **prepended to the user's own message text**, so the message
 * reads as one piece (`【2026/10/05，01:32】你的话`). The target is the first text
 * block, not the first block: a message carrying an image before its text must
 * still get the reading on the text, or the reading would sit detached from what
 * the user wrote.
 *
 * A message with no text at all (an image-only message) gets the reading as its
 * own leading block instead — the only case where there is nothing to attach it
 * to.
 *
 * Attaching rather than splitting matters because the desktop composer persists a
 * draft: a message re-proposed with a stale reading (or with the invisible
 * sentinel an earlier release wrote) must have that stale text removed, or it
 * would freeze into every later message — which is exactly how that bug outlived
 * its fix.
 *
 * @param message - A user message proposed for this step.
 * @returns A new message carrying exactly one reading, or `message` when it must
 *   pass through untouched.
 */
function withTimePrefix(message) {
  if (message?.role !== 'user') return message;
  const content = message.content;
  if (!Array.isArray(content) || content.length === 0) return message;

  const target = content.findIndex((block) => block.type === 'text');
  if (target === -1) {
    // Nothing to attach to: the reading stands alone, with no trailing break to
    // push the image away from it.
    return {
      ...message,
      content: [{ type: 'text', text: formatTimePrefix() }, ...content]
    };
  }

  const block = content[target];
  const body = stripPrefix(block.text);
  const text = `${formatTimePrefix(true)}${body}`;
  if (text === block.text) return message;
  const next = [...content];
  next[target] = { ...block, text };
  return { ...message, content: next };
}

/**
 * Register the prefix listener, unconditionally.
 *
 * `agent/pre-step` is the documented waterfall on which a plugin may rework the
 * user messages proposed for a step: the messages returned there are exactly
 * what the loop appends to the session as `user/message`, so the transcript, the
 * durable log, and the request the model sees all agree. The listener delegates
 * with `next()` first, so every other preparation-time contribution — including
 * context messages appended by other plugins — survives, and only the messages
 * this plugin actually rewrote are replaced.
 *
 * @param ctx - Plugin context; the listener is disposed with it.
 */
export function apply(ctx) {
  ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
    const decision = await next();
    if (decision.kind === 'reject' || signal.aborted) return decision;
    if (!Array.isArray(messages) || messages.length === 0) return decision;

    const replaced = new Map();
    for (const message of messages) {
      const prefixed = withTimePrefix(message);
      if (prefixed !== message) replaced.set(message, prefixed);
    }
    if (replaced.size === 0) return decision;
    return {
      ...decision,
      messages: decision.messages.map((message) => replaced.get(message) ?? message)
    };
  });
}
