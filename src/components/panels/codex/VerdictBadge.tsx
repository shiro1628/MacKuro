/** Review replies open with a verdict line; surface it on the card header. */
export default function VerdictBadge({ output }: { output: string }) {
  if (/SHIP/i.test(output)) return <span className="verdict-ship text-xs">● SHIP</span>
  if (/NEEDS-FIX/i.test(output)) return <span className="verdict-fix text-xs">● NEEDS-FIX</span>
  if (/DISCUSS/i.test(output)) return <span className="verdict-discuss text-xs">● DISCUSS</span>
  return null
}
