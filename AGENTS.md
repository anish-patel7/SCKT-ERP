<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

---

## SCKT Backend Development — AI Agent Guidelines

**Valid for:** claude/trusting-ritchie-zg25ff branch  
**Last Updated:** September 20, 2026

### Mandatory Constraints

1. **Never force-push or rebase this branch**
   - Lovable syncs from this branch; rewriting history breaks the sync
   - Always create new commits for changes
   - If you need to amend an unpushed commit, do so before first push only

2. **Keep branch in working state at all times**
   - Before pushing: `npm run typecheck`, `npm run lint`, `npm run build` must pass
   - Never push broken TypeScript or failing linter checks
   - Commits that pass CI locally may still fail in Lovable's build; test first

3. **Don't redesign UI unless explicitly requested**
   - This is a backend migration task
   - Preserve component layout, styling, and user interaction patterns
   - UI changes: only when necessary to wire up new database features

4. **Don't delete unrelated features or modules**
   - Focus on one STEP at a time
   - Leave existing screens/functionality untouched unless part of current STEP
   - Example: When migrating Inventory (STEP 11), don't refactor Production code

5. **Don't change git history on already-pushed commits**
   - Create new commits to fix issues
   - Exception: Unpushed commits (before first push) can be amended

### Lovable-Specific Practices

- **After each STEP:** Push to this branch so Lovable syncs
- **Build status:** Check `npm run build` before pushing (Lovable will also build)
- **Component regeneration:** Don't manually edit Lovable-generated UI components; they're auto-synced
- **Configuration:** Any changes to `.lovable/` folder should sync automatically

### How to Handle Lovable Conflicts

If a Lovable change conflicts with your backend work:

1. **Fetch latest:** `git fetch origin claude/trusting-ritchie-zg25ff`
2. **Merge:** `git merge origin/claude/trusting-ritchie-zg25ff` (not rebase)
3. **Resolve:** Edit conflicts, keeping both your changes and Lovable's UI updates
4. **Test:** `npm run typecheck && npm run build`
5. **Push:** `git push -u origin claude/trusting-ritchie-zg25ff`

Never use `git rebase` or `git reset --hard` on this branch.

### Branch Sync Checklist

After every significant change:

- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] All files are staged/committed
- [ ] Commit message is clear and describes the change
- [ ] Push to branch (no force-push)
- [ ] Verify push succeeded (`git log --oneline -5`)

### When in Doubt

1. **Read CLAUDE.md** — Contains all rules and patterns
2. **Check existing code** — Follow established patterns
3. **Run validation** — If it compiles and builds, it's safe to push
4. **Commit early, push often** — Smaller commits are easier to manage

### Emergency Rollback (If Needed)

If you need to revert a pushed commit:

```bash
# DON'T rebase or force-push; create a revert commit instead
git revert <commit-hash>
git push -u origin claude/trusting-ritchie-zg25ff
```

This preserves history for Lovable.

---

## Backend Migration STEPS

This file documents the structured approach to migrating SCKT from localStorage to PostgreSQL/Supabase.

**STEP 0:** ✅ Baseline analysis (completed September 20, 2026)  
**STEP 1:** Create CLAUDE.md & AGENTS.md (IN PROGRESS)  
**STEP 2:** Secure Supabase configuration  
**STEP 3:** Replace mock authentication with Supabase Auth  
**STEP 4:** Create profiles/roles/permissions schema  
**STEP 5:** Implement Row-Level Security  
**STEP 6:** Create service/repository layer  
**STEP 7:** Create master data schema  
**STEP 8:** Migrate first master screen  
**STEP 9:** Migrate remaining masters  
**STEP 10:** Migrate costing module  
**STEP 11:** Design inventory transaction ledger  
**STEP 12:** Connect inventory UI  
**STEP 13:** Migrate production module  
**STEP 14:** Migrate quality module  
**STEP 15:** Migrate sales module  
**STEP 16:** Implement audit logging  
**STEP 17:** Performance optimization  
**STEP 18:** Remove remaining business localStorage  
**STEP 19:** Final backend audit

---

**AGENTS.md** — Valid for SCKT development on this branch
