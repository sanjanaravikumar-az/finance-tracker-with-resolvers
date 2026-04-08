# Finance Tracker - Changes Log

## 2026-04-08

### Fix: GraphQL Authorization (src/App.tsx)
- Added `authMode: 'userPool'` to all GraphQL requests (`fetchTransactions`, `handleAddTransaction`, `calculateSummary`, `handleSendMonthlyReport`)
- This ensures the Cognito User Pool token is sent instead of the API key when making authenticated requests

### Fix: Gen 2 Authorization Mode (amplify/data/resource.ts)
- Changed `defaultAuthorizationMode` from `"apiKey"` to `"userPool"` in the `defineData` configuration
- This enables Cognito User Pool authentication as the default mode for the Gen 2 AppSync API

### Fix: Missing CloudFormation Parameters (amplify/backend/function/financetrackerc3d67c94/financetrackerc3d67c94-cloudformation-template.json)
- Added missing `dependsOn` and `lambdaLayers` parameters to the Lambda function CloudFormation template
- These parameters are defined in `parameters.json` but were not declared in the template, causing deployment failure with error: "Parameters: [dependsOn, lambdaLayers] do not exist in the template"
- Replaced `Fn::ImportValue` references for `BUDGET_ALERT_TOPIC_ARN` and `MONTHLY_REPORT_TOPIC_ARN` with `Ref` to the corresponding parameters (`customcustomfinanceBudgetAlertTopicArn`, `customcustomfinanceMonthlyReportTopicArn`)
- The `Fn::ImportValue` approach caused a circular dependency: the custom stack's exports weren't available during function stack creation, causing error: "No export named financetracker-MonthlyReportTopicArn-dev found"
