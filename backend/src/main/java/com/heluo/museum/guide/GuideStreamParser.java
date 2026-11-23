package com.heluo.museum.guide;

import java.util.function.Consumer;

/**
 * Streaming parser with a 24-character sliding lookahead buffer that cleanly splits
 * natural-language body text from the trailing `<<<LUOSHENG_META>>>` JSON block
 * without ever leaking partial delimiter characters to the SSE client.
 */
final class GuideStreamParser {
    static final String DELIMITER = "<<<LUOSHENG_META>>>";
    static final int HOLDBACK_CHARS = 24;

    private final StringBuilder pending = new StringBuilder();
    private final StringBuilder body = new StringBuilder();
    private final StringBuilder meta = new StringBuilder();
    private boolean inMeta = false;

    void feed(String chunk, Consumer<String> onBodyDelta) {
        if (chunk == null || chunk.isEmpty()) {
            return;
        }
        if (inMeta) {
            meta.append(chunk);
            return;
        }
        pending.append(chunk);
        int delimIdx = pending.indexOf(DELIMITER);
        if (delimIdx >= 0) {
            String before = pending.substring(0, delimIdx);
            if (!before.isEmpty()) {
                emitBody(before, onBodyDelta);
            }
            meta.append(pending.substring(delimIdx + DELIMITER.length()));
            pending.setLength(0);
            inMeta = true;
            return;
        }
        if (pending.length() > HOLDBACK_CHARS) {
            int flushLen = pending.length() - HOLDBACK_CHARS;
            String safe = pending.substring(0, flushLen);
            pending.delete(0, flushLen);
            emitBody(safe, onBodyDelta);
        }
    }

    ParseResult finish(Consumer<String> onBodyDelta) {
        if (!inMeta && !pending.isEmpty()) {
            int delimIdx = pending.indexOf(DELIMITER);
            if (delimIdx >= 0) {
                String before = pending.substring(0, delimIdx);
                if (!before.isEmpty()) {
                    emitBody(before, onBodyDelta);
                }
                meta.append(pending.substring(delimIdx + DELIMITER.length()));
                inMeta = true;
            } else {
                emitBody(pending.toString(), onBodyDelta);
            }
            pending.setLength(0);
        }
        return new ParseResult(body.toString().strip(), meta.toString().strip(), inMeta);
    }

    private void emitBody(String text, Consumer<String> onBodyDelta) {
        body.append(text);
        if (onBodyDelta != null && !text.isEmpty()) {
            onBodyDelta.accept(text);
        }
    }

    record ParseResult(String body, String rawMeta, boolean delimiterFound) {}
}
