import ReactMarkdown from 'react-markdown'

/** Codex replies are markdown; render them in the panel's own type scale. */
export const mdComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h2: ({children}) => <h2 className="text-gray-100 font-bold text-sm mt-4 mb-1.5 first:mt-0 border-b border-surface-border pb-1">{children}</h2>,
  h3: ({children}) => <h3 className="text-gray-200 font-semibold text-xs mt-3 mb-1">{children}</h3>,
  p: ({children}) => <p className="mb-2 text-gray-300 leading-relaxed">{children}</p>,
  ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1 text-gray-300">{children}</ul>,
  ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1 text-gray-300">{children}</ol>,
  li: ({children}) => <li className="text-gray-300">{children}</li>,
  code: ({children, className}) => className
    ? <code className="block bg-surface-2 rounded p-2 my-1.5 font-mono text-green-400 overflow-x-auto whitespace-pre text-xs">{children}</code>
    : <code className="bg-surface-2 rounded px-1 font-mono text-green-400 text-xs">{children}</code>,
  pre: ({children}) => <>{children}</>,
  strong: ({children}) => <strong className="text-gray-100 font-semibold">{children}</strong>,
  blockquote: ({children}) => <blockquote className="border-l-2 border-yellow-600/50 pl-2 my-1.5 text-yellow-300/70 italic">{children}</blockquote>,
  a: ({href, children}) => <a href={href} className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noreferrer">{children}</a>,
}
