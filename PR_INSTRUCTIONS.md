# PR Creation Instructions

## Step 1: Create PR from cursor/workflow-dashboard-feature-flag-error-0f5f → feature-workflow-engine

### Option A: Via GitHub Web Interface (Recommended)

1. **Open this URL in your browser:**
   ```
   https://github.com/danrwr-web/signposting/compare/feature-workflow-engine...cursor/workflow-dashboard-feature-flag-error-0f5f
   ```

2. **Click "Create pull request"**

3. **PR Details:**
   - **Title**: `feat: Merge workflow guidance and global default inheritance into feature-workflow-engine`
   - **Base branch**: `feature-workflow-engine` (should be pre-selected)
   - **Compare branch**: `cursor/workflow-dashboard-feature-flag-error-0f5f` (should be pre-selected)
   - **Description**: Copy from MERGE_SUMMARY.md or use:
     ```markdown
     ## Overview
     Merges workflow guidance features, global default workflow inheritance, feature flag improvements, and diagram rendering fixes from cursor branch.
     
     ## Key Changes
     - Add `isFeatureEnabledForSurgery()` function for surgery-level feature checks
     - Implement Global Default workflow inheritance with override support
     - Add workflow guidance module and documentation
     - Fix workflow diagram arrow rendering
     - Add migration script and GitHub Action
     
     ## Files Changed
     - 30 files changed, 1020 insertions(+), 118 deletions(-)
     - See MERGE_SUMMARY.md for detailed breakdown
     
     ## Merge Strategy
     **Recommendation: Squash Merge** to combine 7 commits into one cohesive commit.
     
     ## Verification Required
     After merge, verify build/tests pass and check preview deploy for:
     - Global Default arrows rendering
     - Ide Lane arrows rendering  
     - New override arrows rendering
     ```

4. **Create the PR** (do not merge yet)

5. **After PR is created**, review the changes, then merge using **Squash Merge**

### Option B: Via Command Line (if you prefer)

```powershell
# Create PR using GitHub API (requires GitHub token)
# You'll need to set $env:GITHUB_TOKEN first
```

## Step 2: After Merge - Verify Build & Tests

Once the PR is merged into `feature-workflow-engine`:

```powershell
# Pull latest changes
git checkout feature-workflow-engine
git pull origin feature-workflow-engine

# Run build
npm run build

# Run tests (if available)
npm test

# Check for TypeScript errors
npx tsc --noEmit

# Check linting
npm run lint
```

## Step 3: Create Second PR from feature-workflow-engine → main

**⚠️ DO NOT MERGE THIS PR AUTOMATICALLY**

1. **Open this URL in your browser:**
   ```
   https://github.com/danrwr-web/signposting/compare/main...feature-workflow-engine
   ```

2. **Click "Create pull request"**

3. **PR Details:**
   - **Title**: `feat: Workflow engine with guidance, global defaults, and diagram improvements`
   - **Base branch**: `main` (should be pre-selected)
   - **Compare branch**: `feature-workflow-engine` (should be pre-selected)
   - **Description**: 
     ```markdown
     ## Overview
     This PR brings the workflow engine feature branch to main, including:
     - Workflow guidance module and documentation
     - Global Default workflow inheritance system
     - Enhanced feature flag support
     - Improved workflow diagram rendering
     
     ## Previous PRs
     - Merged: cursor/workflow-dashboard-feature-flag-error-0f5f → feature-workflow-engine
     
     ## Testing
     - [ ] Build passes
     - [ ] Tests pass
     - [ ] Preview deploy verified (see MERGE_SUMMARY.md checklist)
     
     ## Merge Strategy
     **Recommendation: Squash Merge** or **Merge Commit** (maintain history)
     
     ⚠️ **DO NOT MERGE** until preview deploy verification is complete.
     ```

4. **Create the PR** - Leave it open for review and verification

## Verification Checklist (from MERGE_SUMMARY.md)

After the first PR is merged and deployed to preview:

### ✅ Global Default Arrows
- [ ] Navigate to a workflow template that inherits from Global Default
- [ ] Verify arrows/edges render correctly in the diagram
- [ ] Check that Global Default workflows show appropriate visual indicators
- [ ] Confirm arrows point correctly between nodes

### ✅ Ide Lane Arrows  
- [ ] Check workflow diagrams in "Ide Lane" workflows (if applicable)
- [ ] Verify arrow routing and rendering
- [ ] Confirm no broken or misaligned arrows

### ✅ New Override Arrows
- [ ] Create or view a workflow that overrides a Global Default
- [ ] Verify override workflows display distinct arrow styling
- [ ] Check that arrows correctly show the override relationship
- [ ] Confirm custom workflows (non-override) render differently from overrides

### General Workflow Verification
- [ ] Workflow creation flow works correctly
- [ ] Workflow editing preserves node positions
- [ ] Linked workflows display correctly
- [ ] Workflow deletion works as expected
- [ ] Feature flag gating works for workflow guidance

