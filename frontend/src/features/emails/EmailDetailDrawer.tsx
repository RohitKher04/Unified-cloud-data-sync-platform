import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  X,
  Star,
  Mail,
  MailOpen,
  Calendar,
  Paperclip,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from 'lucide-react';

import { emailApi } from '@/lib/api';
import { formatFullDateTime, formatBytes } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmailBodyIframe } from '@/features/emails/EmailBodyIframe';
import { cn } from '@/lib/utils';

interface EmailDetailDrawerProps {
  emailId: number | null;
  onClose: () => void;
}

export const EmailDetailDrawer: React.FC<EmailDetailDrawerProps> = ({
  emailId,
  onClose,
}) => {
  const qc = useQueryClient();
  const [showRecipientDetails, setShowRecipientDetails] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const { data: email, isLoading } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => emailApi.getDetail(emailId!),
    enabled: emailId !== null,
  });

  const toggleStarMutation = useMutation({
    mutationFn: (newVal: boolean) =>
      emailApi.update(emailId!, { is_starred: newVal }),
    onSuccess: (updated) => {
      qc.setQueryData(['email', emailId], updated);
      void qc.invalidateQueries({ queryKey: ['emails'] });
      toast.success(updated.is_starred ? 'Email starred' : 'Email unstarred');
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: (newVal: boolean) =>
      emailApi.update(emailId!, { is_read: newVal }),
    onSuccess: (updated) => {
      qc.setQueryData(['email', emailId], updated);
      void qc.invalidateQueries({ queryKey: ['emails'] });
      void qc.invalidateQueries({ queryKey: ['emails-unread-count'] });
      toast.success(updated.is_read ? 'Marked as read' : 'Marked as unread');
    },
  });

  if (emailId === null) return null;

  const senderName = email?.sender?.split('<')[0]?.trim() || email?.sender || 'Unknown Sender';
  const senderEmail = email?.sender?.match(/<([^>]+)>/)?.[1] || (email?.sender?.includes('@') ? email?.sender : '');
  const initials = (senderName || 'U').slice(0, 2).toUpperCase();
  const hasAttachments = Boolean(email?.attachments && email.attachments.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <aside className="relative z-50 flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl transition-all duration-300 ease-in-out">
        {/* Top Header / Actions Bar */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-1.5">
            {email && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 transition-colors',
                    email.is_starred
                      ? 'text-amber-400 hover:text-amber-500 hover:bg-amber-400/10'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => toggleStarMutation.mutate(!email.is_starred)}
                  title={email.is_starred ? 'Unstar' : 'Star'}
                >
                  <Star className={cn('h-4 w-4', email.is_starred && 'fill-current')} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleReadMutation.mutate(!email.is_read)}
                  title={email.is_read ? 'Mark as unread' : 'Mark as read'}
                >
                  {email.is_read ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <MailOpen className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </>
            )}
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !email ? (
          <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground text-sm">
            Email details could not be loaded.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Subject */}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground leading-snug">
                {email.subject || '(No Subject)'}
              </h2>

              {email.labels && email.labels.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {email.labels.map((lbl) => (
                    <Badge
                      key={lbl}
                      variant="muted"
                      className="text-[11px] font-mono px-2 py-0.5"
                    >
                      {lbl}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Sender / Metadata Card */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-xs">
                  {initials}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {senderName}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatFullDateTime(email.received_at)}</span>
                    </div>
                  </div>

                  {senderEmail && (
                    <p className="text-xs text-muted-foreground truncate">
                      &lt;{senderEmail}&gt;
                    </p>
                  )}
                </div>
              </div>

              {/* Collapsible Recipient Details */}
              <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-medium text-foreground">To:</span>
                    <span className="truncate">
                      {email.recipients?.length ? email.recipients.join(', ') : 'Me'}
                    </span>
                  </div>

                  {Boolean((email.cc && email.cc.length > 0) || (email.bcc && email.bcc.length > 0)) && (
                    <button
                      onClick={() => setShowRecipientDetails((prev) => !prev)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0 ml-2 font-medium"
                    >
                      {showRecipientDetails ? 'Hide details' : 'Show details'}
                      {showRecipientDetails ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </div>

                {showRecipientDetails && (
                  <div className="space-y-1 pt-1.5 pl-5 border-l-2 border-border mt-1.5 animate-in fade-in-50 duration-150">
                    {email.cc && email.cc.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Cc:</span>
                        <span className="truncate">{email.cc.join(', ')}</span>
                      </div>
                    )}
                    {email.bcc && email.bcc.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-foreground">Bcc:</span>
                        <span className="truncate">{email.bcc.join(', ')}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Email Message Content inside sandboxed iframe with image security banner */}
            <div className="pt-1">
              <EmailBodyIframe
                bodyHtml={email.body_html}
                bodyText={email.body_text}
              />
            </div>

            {/* Attachments Section */}
            {hasAttachments && email.attachments && (
              <div className="pt-4 border-t border-border/60 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Paperclip className="h-4 w-4 text-primary" />
                  <span>Attachments ({email.attachments.length})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {email.attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {att.filename}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>{formatBytes(att.size)}</span>
                            {att.mime_type && (
                              <>
                                <span>·</span>
                                <span className="font-mono truncate max-w-[100px]">
                                  {att.mime_type}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-7 px-2 text-[11px] text-muted-foreground shrink-0 cursor-not-allowed"
                        title="Download (coming soon)"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
