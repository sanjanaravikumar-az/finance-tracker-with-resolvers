import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { cdkStack } from './custom/customfinance/resource';
import { cdkStack as customresolver_cdkStack } from './custom/customresolver/resource';
import { financetrackerc3d67c94 } from './function/financetrackerc3d67c94/resource';
import { defineBackend } from '@aws-amplify/backend';
import { Duration } from 'aws-cdk-lib';

const backend = defineBackend({
  auth,
  data,
  storage,
  financetrackerc3d67c94,
});
const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.usernameAttributes = ['email'];
cfnUserPool.policies = {
  passwordPolicy: {
    minimumLength: 8,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSymbols: false,
    temporaryPasswordValidityDays: 7,
  },
};
const userPool = backend.auth.resources.userPool;
userPool.addClient('NativeAppClient', {
  refreshTokenValidity: Duration.days(30),
  enableTokenRevocation: true,
  enablePropagateAdditionalUserContextData: false,
  authSessionValidity: Duration.minutes(3),
  disableOAuth: true,
  generateSecret: false,
});
new cdkStack(backend.createStack('customfinance'), 'customfinance');
new customresolver_cdkStack(
  backend.createStack('customresolver'),
  'customresolver',
  backend
);
const branchName = process.env.AWS_BRANCH ?? 'sandbox';
backend.financetrackerc3d67c94.resources.cfnResources.cfnFunction.functionName = `financetrackerc3d67c94-${branchName}`;
backend.financetrackerc3d67c94.addEnvironment(
  'API_FINANCETRACKER_GRAPHQLAPIKEYOUTPUT',
  backend.data.apiKey!
);
backend.financetrackerc3d67c94.addEnvironment(
  'API_FINANCETRACKER_GRAPHQLAPIENDPOINTOUTPUT',
  backend.data.graphqlUrl
);
backend.financetrackerc3d67c94.addEnvironment(
  'API_FINANCETRACKER_GRAPHQLAPIIDOUTPUT',
  backend.data.apiId
);
backend.financetrackerc3d67c94.addEnvironment(
  'API_FINANCETRACKER_TRANSACTIONTABLE_NAME',
  backend.data.resources.tables['Transaction'].tableName
);
backend.financetrackerc3d67c94.addEnvironment(
  'AUTH_FINANCETRACKERB192A2D4_USERPOOLID',
  backend.auth.resources.userPool.userPoolId
);
backend.data.resources.graphqlApi.grantMutation(
  backend.financetrackerc3d67c94.resources.lambda
);
backend.data.resources.graphqlApi.grantQuery(
  backend.financetrackerc3d67c94.resources.lambda
);
const s3Bucket = backend.storage.resources.cfnResources.cfnBucket;
// Use this bucket name post refactor
// s3Bucket.bucketName = 'financetracker349e4525efd5465ab4e130b672f512e467fcf-dev';
s3Bucket.bucketEncryption = {
  serverSideEncryptionConfiguration: [
    {
      serverSideEncryptionByDefault: {
        sseAlgorithm: 'AES256',
      },
      bucketKeyEnabled: false,
    },
  ],
};
