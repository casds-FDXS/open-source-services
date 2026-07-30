# Delivery Process / 交付流程

本流程适用于范围明确的小型软件技术协作。每一步的深度将根据代码库状态、任务风险、访问权限和双方约定调整。

This process is for clearly scoped small software collaborations. The depth of each step is adjusted for repository state, task risk, access level, and mutual agreement.

## 1. Confirm scope and acceptance criteria / 确认任务范围和验收标准

确认目标、已有信息、交付物、不可触碰的范围、目标时间和验收方式。未确认的假设会明确记录，而不是当作事实处理。

Confirm the goal, available information, deliverables, out-of-scope areas, target timing, and acceptance method. Unconfirmed assumptions are recorded rather than treated as facts.

## 2. Review repository, issue, and current implementation / 检查仓库、 issue 和现有实现

阅读相关 issue、文档、代码路径、测试和现有自动化，先建立问题的可验证上下文。

Read the relevant issue, documentation, code paths, tests, and existing automation to establish verifiable context.

## 3. Reproduce and analyze / 复现并分析问题

尽可能使用最小步骤复现现象，区分可确认事实、待验证假设和环境限制。

Use minimal steps to reproduce the behavior where possible, distinguishing confirmed facts, hypotheses to test, and environmental limits.

## 4. Propose approach and work estimate / 提出解决方案和工作量判断

说明可选方案、风险、影响范围和建议的交付切分。若问题无法稳定复现，会先交付调查结论而非承诺特定修复结果。

Describe options, risks, affected scope, and a recommended delivery split. If an issue cannot be reproduced reliably, an investigation result is delivered before any promise of a particular fix.

## 5. Implement code, tests, or documentation / 实现代码、测试或文档修改

在已确认范围内进行最小且可审阅的修改，并尽可能同步更新测试、示例或说明。

Make minimal, reviewable changes within the confirmed scope and update tests, examples, or documentation where appropriate.

## 6. Deliver through PR or repository / 通过 Pull Request 或独立仓库交付

交付包括变更内容、验证方式、已知限制和必要的运行说明。默认优先使用 GitHub Pull Request；无仓库权限时可使用独立仓库或补丁。

Delivery includes the changes, verification method, known limitations, and necessary run instructions. GitHub Pull Requests are preferred by default; a separate repository or patch can be used when repository access is unavailable.

## 7. Complete agreed revisions / 根据约定完成合理范围内的修改

验收反馈会对照先前确认的范围处理。新增需求、扩大范围或新的环境问题会重新评估。

Acceptance feedback is handled against the previously confirmed scope. New requirements, expanded scope, or new environmental issues are reassessed.

## 8. Settle after acceptance / 在验收后完成结算

在约定的验收条件满足后完成结算。付款方式和必要的账务信息在正式开发前单独确认，不在公开仓库展示。

Settlement is completed after the agreed acceptance conditions are met. Payment method and any necessary billing information are confirmed separately before formal development and are not displayed in this public repository.
