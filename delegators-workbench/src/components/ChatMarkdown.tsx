import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitAssistantParagraphs } from '../lib/artifactContinuation';
import { renderAssistantLineParts, type AssistantInlineSegment } from '../lib/assistantProseRender';

type ChatMarkdownProps = {
  text: string;
  className?: string;
  variant?: 'user' | 'assistant';
};

function AssistantInline({ segments }: { segments: AssistantInlineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === 'link') {
          return (
            <a
              key={`link-${index}`}
              className="chat-assistant-link"
              href={segment.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              {segment.value}
            </a>
          );
        }

        if (segment.kind === 'emphasis') {
          return (
            <span key={`emphasis-${index}`} className="chat-assistant-emphasis">
              {segment.value}
            </span>
          );
        }

        return <span key={`text-${index}`}>{segment.value}</span>;
      })}
    </>
  );
}

function AssistantLine({ line, className }: { line: string; className: string }) {
  const { labeled, segments } = renderAssistantLineParts(line);

  if (labeled) {
    return (
      <p className={`${className} chat-line-labeled`}>
        <span className="chat-assistant-label">{labeled.label}:</span>{' '}
        <span className="chat-assistant-detail">
          <AssistantInline segments={segments} />
        </span>
      </p>
    );
  }

  return (
    <p className={className}>
      <AssistantInline segments={segments} />
    </p>
  );
}

function AssistantProse({ text, className }: { text: string; className: string }) {
  const paragraphs = splitAssistantParagraphs(text);

  return (
    <div className={className}>
      {paragraphs.map((block, blockIndex) => {
        const lines = block.split('\n').filter(Boolean);
        if (lines.length === 1) {
          return (
            <AssistantLine
              key={blockIndex}
              line={lines[0]}
              className="chat-paragraph"
            />
          );
        }

        return (
          <div key={blockIndex} className="chat-prose-block">
            {lines.map((line, lineIndex) => (
              <AssistantLine
                key={lineIndex}
                line={line}
                className="chat-paragraph chat-line"
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ChatMarkdown({ text, className = 'chat-markdown', variant = 'user' }: ChatMarkdownProps) {
  if (variant === 'assistant') {
    return (
      <AssistantProse
        text={text}
        className={`${className} chat-markdown-assistant`}
      />
    );
  }

  const userComponents: Record<string, (props: { children?: ReactNode; href?: string }) => ReactNode> = {
    p: ({ children }) => <p className="chat-paragraph">{children}</p>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="chat-markdown-table-wrap">
        <table>{children}</table>
      </div>
    )
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={userComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}