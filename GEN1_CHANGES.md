# Gen1 Code Changes (Beyond README)

Changes made to the Gen1 Finance Tracker app that differ from the original README setup.

## 1. Custom VTL Resolver (`customresolver`)

Added a second custom CDK resource that creates an AppSync VTL resolver for querying
transactions by category. This tests the migration of custom resolvers that depend on
the GraphQL API.

### Files Added

- `amplify/backend/custom/customresolver/cdk-stack.ts` - CDK stack that creates:
  - IAM role for DynamoDB access
  - AppSync DynamoDB data source (`TransactionsByCategoryDataSource`)
  - VTL resolver for `Query.getTransactionsByCategory`
  - Uses Gen1 patterns: `@aws-cdk/aws-appsync` (v1), `cdk.Fn.ref(retVal.api...)`,
    `AmplifyHelpers.addResourceDependency()`
- `amplify/backend/custom/customresolver/package.json` - Dependencies including
  `@aws-cdk/aws-appsync` (CDK v1), `@aws-sdk/client-ssm`, `@aws-amplify/cli-extensibility-helper`
- `amplify/backend/custom/customresolver/tsconfig.json` - Matching `customfinance` config
  with `esModuleInterop` and `skipLibCheck`
- `amplify/backend/custom/customresolver/.npmrc`

### Files Modified

- `amplify/backend/api/financetracker/schema.graphql`:
  - Added `TransactionConnection` type
  - Added `getTransactionsByCategory(category: String!, limit: Int): TransactionConnection` query
- `amplify/backend/backend-config.json`:
  - Registered `customresolver` with `dependsOn` on `api/financetracker`
  - Added function `dependsOn` for `api/financetracker` (GraphQLAPIIdOutput, etc.)
- `amplify/backend/types/amplify-dependent-resources-ref.d.ts`:
  - Added `customresolver` outputs (ResolverArn, DataSourceName)
- `package.json`:
  - Added Gen1-style CDK deps to root: `@aws-cdk/aws-appsync`, `@aws-sdk/client-ssm`,
    `@aws-amplify/cli-extensibility-helper`, `aws-cdk-lib`, `constructs`

## 2. SNS Email Subscriptions in CDK

Moved email subscriptions from Lambda runtime to the CDK custom resource.

### Files Modified

- `amplify/backend/custom/customfinance/cdk-stack.ts`:
  - Added `import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions'`
  - Added `budgetAlertTopic.addSubscription(new subscriptions.EmailSubscription(...))`
  - Added `monthlyReportTopic.addSubscription(new subscriptions.EmailSubscription(...))`
  - Removed comment about dynamic Lambda subscriptions

## 3. Lambda Function Simplification

Simplified the Lambda to only publish to SNS topics (no longer manages subscriptions).

### Files Modified

- `amplify/backend/function/financetrackerc3d67c94/src/index.js`:
  - Removed `SubscribeCommand` import
  - Removed `subscribeEmailToTopic()` helper function
  - Removed `await subscribeEmailToTopic()` calls from `sendMonthlyReport` and `sendBudgetAlert`
  - Lambda now only uses `PublishCommand` to send messages
- `amplify/backend/function/financetrackerc3d67c94/custom-policies.json`:
  - Reduced SNS permissions from `["sns:Publish", "sns:ListTopics", "sns:CreateTopic", "sns:Subscribe"]`
    to just `["sns:Publish"]`

## 4. Frontend Category Filter

Added UI for filtering transactions by category using the custom VTL resolver.

### Files Modified

- `src/App.tsx`:
  - Added `getTransactionsByCategoryQuery` GraphQL query
  - Added `filterCategory`, `filteredTransactions`, `showFiltered` state
  - Added `handleFilterByCategory()` and `handleClearFilter()` handlers
  - Added category filter UI (input + filter/clear buttons) above transactions list
  - Transaction list renders `filteredTransactions` when filter is active
- `src/App.css`:
  - Added `.category-filter` and `.filter-info` styles

## 5. CloudFormation Template Fixes

Fixed deployment issues in the Lambda function's CloudFormation template.

### Files Modified

- `amplify/backend/function/financetrackerc3d67c94/financetrackerc3d67c94-cloudformation-template.json`:
  - Added missing `dependsOn` and `lambdaLayers` parameters (required by Amplify CLI
    but not present in template)
  - Changed `Fn::ImportValue` for SNS topic ARNs to `Ref` parameters to avoid
    cross-stack circular dependencies

## Migration Issues This App Tests

1. Custom resolver with API dependency gets dropped or incorrectly ported
2. Custom resource `package.json` not copied during migration
3. CDK v1 dependencies (`@aws-cdk/aws-appsync`) not cleaned up
4. Duplicate import names when multiple custom resources export `cdkStack`
5. `@function` directive auto-injects unnecessary API/Auth dependencies that cause
   circular dependencies in Gen2's nested stack architecture
6. Lambda handler not converted from CommonJS to ESM
7. AWS SDK packages need special handling for esbuild bundling
