### Pause safely

**Leave a state a cold start can resume from.** Pausing is explicit: "keep going" is not a pause.

1. Stop at a safe boundary: finish the current atomic step or back out of it. Start nothing new;
   stop the agents you spawned.
2. Take no irreversible action to pause: no push, no landing.
3. Make the work durable: commit uncommitted edits as one `wip:` commit on the work branch. A
   broken tree says so in the commit body.
4. Write the resume note to a file: the goal, what is done with its evidence, what is in flight, the
   next step, key files, gotchas, open questions for the owner. Point at the goal file or decision
   log rather than copying them.

**Reply:** where you stopped, the commits and whether the tree is clean, where the note is, and the
first action on resume.
