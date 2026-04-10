import { defineFunction } from '@aws-amplify/backend';

const branchName = process.env.AWS_BRANCH ?? 'sandbox';

export const financetrackerc3d67c94 = defineFunction({
  entry: './index.js',
  name: `financetrackerc3d67c94-${branchName}`,
  timeoutSeconds: 25,
  memoryMB: 128,
  bundling: {
    minify: false,
  },
  environment: {
    BUDGET_ALERT_TOPIC_ARN: 'NONE',
    MONTHLY_REPORT_TOPIC_ARN: 'NONE',
    ENV: `${branchName}`,
    REGION: 'us-east-1',
  },
  runtime: 22,
  resourceGroupName: "data",
});
