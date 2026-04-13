# Post-Generate Changes (Gen2 Migration)

After running `npx amplify gen2-migration generate`, the following manual changes are needed
to get the Gen2 branch to deploy successfully.

## 1. Lambda Function: Add `package.json`

Create `amplify/function/financetrackerc3d67c94/package.json` with AWS SDK v3 dependencies:

```json
{
  "name": "financetrackerc3d67c94",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.821.0",
    "@aws-sdk/lib-dynamodb": "^3.821.0",
    "@aws-sdk/client-sns": "^3.821.0",
    "@aws-sdk/client-sts": "^3.821.0"
  }
}
```

**Why:** The migration tool doesn't create a `package.json` for the Lambda function.
esbuild needs these dependencies available to bundle the function.

## 2. Lambda Handler: Convert to ESM

In `amplify/function/financetrackerc3d67c94/index.js`:

- Change `require()` calls to `import` statements
- Change `exports.handler` to `export const handler`

```diff
-const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
-const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
-const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
+import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
+import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
+import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

-exports.handler = async (event) => {
+export const handler = async (event) => {
```

**Why:** Gen2 uses ESM bundling by default. CommonJS `require()` syntax fails during esbuild.

## 3. Lambda `resource.ts`: Add Bundling Config and `resourceGroupName`

In `amplify/function/financetrackerc3d67c94/resource.ts`:

```diff
 export const financetrackerc3d67c94 = defineFunction({
   ...
+  bundling: {
+    minify: false,
+  },
   environment: { ... },
   runtime: 22,
+  resourceGroupName: 'data',
 });
```

**Why:**
- `bundling.minify: false` keeps the code readable for debugging.
- `resourceGroupName: 'data'` places the function in the data stack, avoiding circular
  dependencies between the function, data, and auth stacks.

## 4. Root `package.json`: Clean Up Dependencies and Upgrade TypeScript

Move AWS SDK packages from `dependencies` to `devDependencies`, remove Gen1-only packages,
and upgrade TypeScript to v5:

```diff
 "dependencies": {
-  "@aws-sdk/client-dynamodb": "^3.0.0",
-  "@aws-sdk/client-sns": "^3.0.0",
-  "@aws-sdk/client-ssm": "^3.962.0",
-  "@aws-sdk/client-sts": "^3.0.0",
-  "@aws-sdk/lib-dynamodb": "^3.0.0",
   "aws-amplify": "^6.16.3",
   "react": "^19.2.4",
   "react-dom": "^19.2.4"
 },
 "devDependencies": {
+  "@aws-sdk/client-dynamodb": "^3.821.0",
+  "@aws-sdk/client-sns": "^3.821.0",
+  "@aws-sdk/client-sts": "^3.821.0",
+  "@aws-sdk/lib-dynamodb": "^3.821.0",
-  "typescript": "^4.9.5",
+  "typescript": "^5.0.0",
   ...
 }
```

**Why:**
- AWS SDK packages in `dependencies` cause peer dep conflicts with `@aws-amplify/backend`'s
  `aws-cdk-lib` requirement (different versions pulled transitively via
  `@aws-amplify/cli-extensibility-helper`).
- `@aws-sdk/client-ssm` was only needed by the Gen1 custom resource's own `package.json`.
- SDK packages in `devDependencies` are available for esbuild bundling without conflicts.
- TypeScript 5.0+ is required because `@aws-amplify/data-schema` uses `const` type
  parameters (`const values extends readonly string[]`) which are a TS 5.0 feature.
  The migration tool sets TypeScript to `^4.9.5` which can't parse these declarations.

## 5. Schema: Add Auth Directives to Custom Operations

In the schema within `amplify/data/resource.ts`, add `@aws_api_key` and
`@aws_cognito_user_pools` directives to all custom queries and mutations:

```diff
 type Query {
-  calculateFinancialSummary: CalculatedSummary @function(name: "financetrackere30b1453-dev")
-  getTransactionsByCategory(category: String!, limit: Int): TransactionConnection
+  calculateFinancialSummary: CalculatedSummary @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
+  getTransactionsByCategory(category: String!, limit: Int): TransactionConnection @aws_api_key @aws_cognito_user_pools
 }

 type Mutation {
-  sendMonthlyReport(email: String!): NotificationResult @function(name: "financetrackere30b1453-dev")
-  sendBudgetAlert(...): NotificationResult @function(name: "financetrackere30b1453-dev")
+  sendMonthlyReport(email: String!): NotificationResult @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
+  sendBudgetAlert(...): NotificationResult @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
 }
```

**Why:** In Gen2, the `@function` directive generates `@aws_iam` auth on the resolver by
default. This means only IAM-signed requests can access these operations. In Gen1, the
`@function` directive respected the global `allow: public` auth rule (API key).

Without adding `@aws_cognito_user_pools`, signed-in users sending Cognito tokens get
"Not Authorized to access sendMonthlyReport on type Mutation" errors, because the resolver
only accepts IAM auth.

Adding both `@aws_api_key` and `@aws_cognito_user_pools` allows these operations to be
called with either auth method, matching the Gen1 behavior where any authenticated or
public request could invoke them.

## 6. Data Resource: Switch Default Auth to `userPool`

In `amplify/data/resource.ts`:

```diff
 authorizationModes: {
-  defaultAuthorizationMode: 'apiKey',
+  defaultAuthorizationMode: 'userPool',
   apiKeyAuthorizationMode: { expiresInDays: 365, description: 'graphql' },
 },
```

**Why:** The API needs Cognito User Pool auth for authenticated users to access their own
data. Without this, the `owner` field on models doesn't enforce per-user access control.

## 7. Frontend `App.tsx`: Add `authMode: 'userPool'` to All GraphQL Calls

Add `authMode: 'userPool'` to all `client.graphql()` calls:

```diff
-const result = await client.graphql({ query: listTransactions });
+const result = await client.graphql({ query: listTransactions, authMode: 'userPool' });
```

Apply to all operations: `listTransactions`, `createTransaction`,
`calculateFinancialSummary`, `sendMonthlyReport`, `sendBudgetAlert`,
`getTransactionsByCategory`.

**Why:** With `defaultAuthorizationMode: 'userPool'`, the client must explicitly specify
`authMode: 'userPool'` to send the Cognito token. This works for both model operations
(per-user data) and custom operations (now that we added `@aws_cognito_user_pools` to
the schema in step 5).

## 8. Remove Unnecessary Cross-Resource References

### `amplify/backend.ts`

Remove these lines that create unnecessary cross-stack dependencies:

```diff
-backend.financetrackerc3d67c94.addEnvironment(
-  'API_FINANCETRACKER_GRAPHQLAPIKEYOUTPUT',
-  backend.data.apiKey!
-);
-backend.financetrackerc3d67c94.addEnvironment(
-  'API_FINANCETRACKER_GRAPHQLAPIENDPOINTOUTPUT',
-  backend.data.graphqlUrl
-);
-backend.financetrackerc3d67c94.addEnvironment(
-  'API_FINANCETRACKER_GRAPHQLAPIIDOUTPUT',
-  backend.data.apiId
-);
-backend.financetrackerc3d67c94.addEnvironment(
-  'AUTH_FINANCETRACKERB192A2D4_USERPOOLID',
-  backend.auth.resources.userPool.userPoolId
-);
-backend.data.resources.graphqlApi.grantMutation(
-  backend.financetrackerc3d67c94.resources.lambda
-);
-backend.data.resources.graphqlApi.grantQuery(
-  backend.financetrackerc3d67c94.resources.lambda
-);
```

Keep only:
```typescript
backend.financetrackerc3d67c94.addEnvironment(
  'API_FINANCETRACKER_TRANSACTIONTABLE_NAME',
  backend.data.resources.tables['Transaction'].tableName
);
```

**Why:**
- The Lambda is an AppSync resolver (called BY AppSync), not an API client. It doesn't
  need `grantMutation`/`grantQuery` or the API key/endpoint/ID.
- The Lambda never calls Cognito, so it doesn't need the UserPoolId.
- These references were auto-injected by Gen1's `@function` directive into the Lambda's
  CloudFormation template. The migration tool faithfully ported them, but in Gen2's nested
  stack architecture they create cross-stack circular dependencies that didn't exist in
  Gen1's flat stack structure.

### `amplify/auth/resource.ts`

Remove all `access` rules granting the Lambda Cognito permissions:

```diff
-import { financetrackerc3d67c94 } from '../function/financetrackerc3d67c94/resource';
-
 export const auth = defineAuth({
   loginWith: { ... },
   userAttributes: { ... },
   multifactor: { mode: 'OFF' },
-  access: (allow) => [
-    allow.resource(financetrackerc3d67c94).to(['manageUsers']),
-    allow.resource(financetrackerc3d67c94).to(['manageGroupMembership']),
-    allow.resource(financetrackerc3d67c94).to(['manageUserDevices']),
-    allow.resource(financetrackerc3d67c94).to(['managePasswordRecovery']),
-    allow.resource(financetrackerc3d67c94).to(['setUserMfaPreference']),
-    allow.resource(financetrackerc3d67c94).to(['updateUserAttributes']),
-    allow.resource(financetrackerc3d67c94).to(['forgetDevice']),
-    allow.resource(financetrackerc3d67c94).to(['setUserSettings']),
-    allow.resource(financetrackerc3d67c94).to(['listUsers']),
-    allow.resource(financetrackerc3d67c94).to(['listUsersInGroup']),
-    allow.resource(financetrackerc3d67c94).to(['listGroups']),
-  ],
 });
```

**Why:** The Lambda never manages Cognito users. These rules were auto-generated from
Gen1's `@function` directive IAM policies (which gave the Lambda full Cognito access by
default). In Gen2, these create an explicit auth→function dependency that contributes to
circular dependencies. The Lambda only needs to scan DynamoDB and publish to SNS.

## 9. Fix Custom Resolver Circular Dependency

In `amplify/backend.ts`, place the custom resolver in the data stack instead of its own:

```diff
-new customresolver_cdkStack(
-  backend.createStack('customresolver'),
-  'customresolver',
-  backend
-);
+const dataStack = backend.data.resources.cfnResources.cfnGraphqlApi.stack;
+new customresolver_cdkStack(dataStack, 'customresolver', backend);
```

**Why:** The custom resolver depends on the GraphQL API ID from the data stack. Creating
a separate stack causes a circular dependency between nested stacks. Placing it in the
data stack eliminates the cross-stack reference since they share the same stack.

## 10. Build Configuration: `amplify.yml`

Change `npm ci` to `npm install` in both backend and frontend build phases:

```diff
 backend:
   phases:
     build:
       commands:
-        - npm ci --cache .npm --prefer-offline
+        - npm install --cache .npm --prefer-offline
 frontend:
   phases:
     preBuild:
       commands:
-        - npm ci --cache .npm --prefer-offline
+        - npm install --cache .npm --prefer-offline
```

**Why:** The Amplify build server uses a different npm version than local development.
`npm ci` requires an exact lockfile match and fails when the npm versions generate
slightly different dependency trees. `npm install` is more flexible with resolution.

## 11. Clean Up Unused Imports in Custom Resources

In `amplify/custom/customresolver/resource.ts`, remove unused imports:

```diff
 import * as cdk from 'aws-cdk-lib';
 import { Construct } from 'constructs';
-import * as appsync from "aws-cdk-lib/aws-appsync";
 import * as iam from 'aws-cdk-lib/aws-iam';
-const projectName = "financetracker";
```

**Why:** The `appsync` import is unused (code uses `cdk.aws_appsync.CfnDataSource` instead)
and `projectName` is declared but never read.
