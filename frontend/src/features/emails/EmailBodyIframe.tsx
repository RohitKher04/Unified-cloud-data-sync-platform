import React, { useRef, useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { useTheme } from '@/lib/theme';

interface EmailBodyIframeProps {
  bodyHtml?: string | null;
  bodyText?: string | null;
}

export const EmailBodyIframe: React.FC<EmailBodyIframeProps> = ({
  bodyHtml,
  bodyText,
}) => {
  const [iframeHeight, setIframeHeight] = useState<number>(300);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();

  // Sanitize and prepare document content with images enabled automatically
  const sanitizedDoc = useMemo(() => {
    if (!bodyHtml) return '';

    // Force all links/buttons in the email to open safely in a new tab
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });

    const cleanHtml = DOMPurify.sanitize(bodyHtml, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['target', 'src', 'rel'],
    });

    DOMPurify.removeHook('afterSanitizeAttributes');

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    const bg = isDark ? '#18181b' : '#ffffff';
    const text = isDark ? '#f4f4f5' : '#18181b';
    const link = isDark ? '#818cf8' : '#4f46e5';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank">
  <style>
    body {
      margin: 0;
      padding: 16px 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: ${text};
      background-color: ${bg};
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
    }
    a {
      color: ${link};
      text-decoration: underline;
    }
    table {
      max-width: 100% !important;
    }
    pre, code {
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  ${cleanHtml}
</body>
</html>`;
  }, [bodyHtml, theme]);

  // Adjust iframe height automatically based on scrollHeight
  const handleIframeLoad = () => {
    if (iframeRef.current && iframeRef.current.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      const height = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 150);
      setIframeHeight(height + 24);
    }
  };

  useEffect(() => {
    handleIframeLoad();
  }, [sanitizedDoc]);

  // Fallback if no HTML is present
  if (!bodyHtml && bodyText) {
    return (
      <div className="pt-2">
        <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed wrap-break-word">
          {bodyText}
        </pre>
      </div>
    );
  }

  if (!bodyHtml && !bodyText) {
    return (
      <p className="text-sm italic text-muted-foreground pt-4">
        (No message content)
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card pt-1">
      <iframe
        ref={iframeRef}
        srcDoc={sanitizedDoc}
        title="Email Message Body"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        className="w-full border-0 transition-all duration-200"
        style={{ height: `${iframeHeight}px`, minHeight: '180px' }}
        onLoad={handleIframeLoad}
      />
    </div>
  );
};
