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

### Feature: Custom VTL Resolver for Category Filter (Gen1 style - for migration testing)

Added a custom AppSync resolver using Gen1 patterns to test Gen1-to-Gen2 migration.

**Backend files added:**
- `amplify/backend/custom/customresolver/cdk-stack.ts` - CDK stack with Gen1 patterns: `@aws-cdk/aws-appsync` (v1), `cdk.Fn.ref(retVal.api.financetracker.GraphQLAPIIdOutput)`, `AmplifyHelpers.addResourceDependency()`
- `amplify/backend/custom/customresolver/package.json` - Gen1 deps: `@aws-cdk/aws-appsync`, `@aws-sdk/client-ssm`, `aws-cdk-lib`, `constructs`
- `amplify/backend/custom/customresolver/tsconfig.json`
- `amplify/backend/custom/customresolver/.npmrc`

**Backend files modified:**
- `amplify/backend/api/financetracker/schema.graphql` - Added `getTransactionsByCategory(category: String!, limit: Int): TransactionConnection` query and `TransactionConnection` type
- `amplify/backend/backend-config.json` - Registered `customresolver` with `dependsOn` API
- `amplify/backend/types/amplify-dependent-resources-ref.d.ts` - Added `customresolver` outputs
- `package.json` - Added Gen1-style CDK deps to root (`@aws-cdk/aws-appsync`, `@aws-sdk/client-ssm`, `aws-cdk-lib`, `constructs`, `@aws-amplify/cli-extensibility-helper`)

**Frontend files modified:**
- `src/App.tsx` - Added `getTransactionsByCategoryQuery`, category filter state, `handleFilterByCategory`/`handleClearFilter` handlers, and filter UI above transactions list
- `src/App.css` - Added `.category-filter` and `.filter-info` styles

**Migration issues this tests:**
1. `apiId: cdk.Fn.ref(retVal.api...)` → should become `data.resources.graphqlApi.apiId`
2. `@aws-cdk/aws-appsync` (v1) → should be removed (bundled in `aws-cdk-lib`)
3. Root `package.json` dependency conflicts (aws-cdk-lib/constructs in both deps and devDeps)
4. Custom resource `package.json` not being copied correctly (only package-lock.json)
5. Entire custom resource being silently dropped during migration when it has API dependencies
