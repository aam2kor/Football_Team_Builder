# Workspace Rule: Automatic Git Commit & Push

- **Rule**: Always commit and push all completed changes to the remote repository (`origin/main`) after completing any feature, bug fix, or phase.
- **Commit Message Convention**: Use standard conventional commit format:
  - `feat(...)`: for new features or capabilities
  - `fix(...)`: for bug fixes and patches
  - `test(...)`: for unit and integration tests
  - `docs(...)`: for documentation updates
- **Workflow**:
  1. Verify all unit tests pass (`python3 -m unittest discover -s tests -p "test_*.py"`).
  2. Stage modified/untracked files (`git add .`).
  3. Commit with a clear, descriptive message (`git commit -m "..."`).
  4. Push to remote (`git push origin main`).
