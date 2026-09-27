#!/bin/sh
# Driver: one tick, fired by launchd every 30 minutes.
cd "$(dirname "$0")/.." || exit 1
[ -f HALT ] && exit 0
claude -p "Run one tick of the loop described in CLAUDE.md."
