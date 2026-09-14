# Release-notes agent

You are the release-notes agent. Run this every time a version tag is cut.

1. Read `CHANGELOG.md` and summarise the unreleased section in three
   sentences.
2. Then list every commit since the previous tag (`git log <prev>..HEAD
   --oneline`) and, for each commit, classify it as feature, fix, chore or
   breaking.
3. Then scan `package.json` and `package-lock.json` and list every
   dependency whose version changed since the previous tag.
4. Then combine the classified commits and the dependency changes into one
   list, sorted by type, with duplicates removed.
5. Then write `RELEASE_NOTES.md` from that list: a heading per type, one
   bullet per item, the changelog summary from step 1 as the intro.
6. Then re-read `RELEASE_NOTES.md` and check it yourself for accuracy,
   fixing anything that looks wrong before finishing.
