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

## 4. Root `package.json`: Clean Up Dependencies

Move AWS SDK packages from `dependencies` to `devDependencies` and remove Gen1-only packages:

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
   ...
 }
```

**Why:**
- AWS SDK packages in `dependencies` conflict with `@aws-amplify/backend`'s peer dep on
  `aws-cdk-lib` (different versions pulled transitively).
- `@aws-sdk/client-ssm` was only needed by the Gen1 custom resource's own `package.json`.
- SDK packages in `devDependencies` are available for esbuild bundling without causing
  peer dep conflicts.

## 5. Data Resource: Switch Default Auth to `userPool`

In `amplify/data/resource.ts`:

```diff
 authorizationModes: {
-  defaultAuthorizationMode: 'apiKey',
-  apiKeyAuthorizationMode: { expiresInDays: 365, description: 'graphql' },
+  defaultAuthorizationMode: 'userPool',
+  apiKeyAuthorizationMode: { expiresInDays: 365, description: 'graphql' },
 },
```

**Why:** The API needs Cognito User Pool auth for authenticated users. Without this,
signed-in users get "Unauthorized" errors because the API defaults to API key auth.

## 6. Frontend `App.tsx`: Add `authMode: 'userPool'` to GraphQL Calls

Add `authMode: 'userPool'` to all `client.graphql()` calls:

```diff
-const result = await client.graphql({ query: listTransactions });
+const result = await client.graphql({ query: listTransactions, authMode: 'userPool' });
```

Apply to: `listTransactions`, `createTransaction`, `calculateFinancialSummary`,
`sendMonthlyReport`, `sendBudgetAlert`, `getTransactionsByCategory`.

**Why:** With `defaultAuthorizationMode: 'userPool'`, the client must explicitly use
`userPool` auth mode to send the Cognito token instead of the API key.

## 7. Remove Unnecessary Cross-Resource References

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
-const s3Bucket = backend.storage.resources.cfnResources.cfnBucket;
-s3Bucket.bucketEncryption = { ... };
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
- These references were auto-injected by Gen1's `@function` directive and create
  cross-stack circular dependencies in Gen2's nested stack architecture.

### `amplify/auth/resource.ts`

Remove all `access` rules granting the Lambda Cognito permissions:

```diff
 export const auth = defineAuth({
   loginWith: { ... },
   userAttributes: { ... },
   multifactor: { mode: 'OFF' },
-  access: (allow) => [
-    allow.resource(financetrackerc3d67c94).to(['manageUsers']),
-    allow.resource(financetrackerc3d67c94).to(['manageGroupMembership']),
-    ... (11 rules total)
-  ],
 });
```

Also remove the unused import:
```diff
-import { financetrackerc3d67c94 } from '../function/financetrackerc3d67c94/resource';
```

**Why:** The Lambda never manages Cognito users. These rules were auto-generated from
Gen1's `@function` directive IAM policies and create an auth→function dependency that
contributes to circular dependencies.

## 8. Fix Custom Resolver Circular Dependency

In `amplify/backend.ts`, place the custom resolver in the data stack instead of its own stack:

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
a separate stack causes a circular dependency: customresolver→data→auth→storage→auth.
Placing it in the data stack eliminates the cross-stack reference.

## 9. Build Configuration: `amplify.yml`

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

**Why:** The build server's npm version differs from local, causing `npm ci` to fail with
lockfile mismatch errors. `npm install` is more flexible with version resolution.
