for ($i=1; $i -le $Max; $i++) {
  claude -p "/loop" --permission-mode acceptEdits | Tee-Object logs/loop-$i.json
  $tail = Get-Content docs/LOOP-STATUS.md -Tail 5
  if ($tail -match "MVP-COMPLETE" -or $tail -match "NEEDS-HUMAN") { break }
  Start-Sleep -Seconds 5
}
pnpm install 2>/dev/null || true
