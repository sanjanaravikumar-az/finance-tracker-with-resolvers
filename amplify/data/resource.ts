import { defineData } from '@aws-amplify/backend';

const schema = `# This "input" configures a global authorization rule to enable public access to
# all models in this schema. Learn more about authorization rules here: https://docs.amplify.aws/cli/graphql/authorization-rules
input AMPLIFY { globalAuthRule: AuthRule = { allow: public } } # FOR TESTING ONLY!

type Transaction @model {
  id: ID!
  description: String!
  amount: Float!
  type: TransactionType!
  category: String!
  date: AWSDateTime!
  receiptUrl: String
  owner: String
}

enum TransactionType {
  INCOME
  EXPENSE
}

type Budget @model {
  id: ID!
  category: String!
  limit: Float!
  month: String!
  owner: String
}

type FinancialSummary @model {
  id: ID!
  totalIncome: Float!
  totalExpenses: Float!
  balance: Float!
  month: String!
  owner: String
}

# Custom query to calculate financial summary using Lambda
type CalculatedSummary @aws_api_key @aws_cognito_user_pools {
  totalIncome: Float!
  totalExpenses: Float!
  balance: Float!
  savingsRate: Float!
}

type NotificationResult @aws_api_key @aws_cognito_user_pools {
  success: Boolean!
  message: String!
}

type TransactionConnection @aws_api_key @aws_cognito_user_pools {
  items: [Transaction]
  nextToken: String
}

type Query {
  calculateFinancialSummary: CalculatedSummary @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
  getTransactionsByCategory(category: String!, limit: Int): TransactionConnection @aws_api_key @aws_cognito_user_pools
}

type Mutation {
  sendMonthlyReport(email: String!): NotificationResult @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
  sendBudgetAlert(email: String!, category: String!, exceeded: Float!): NotificationResult @function(name: "financetrackere30b1453-dev") @aws_api_key @aws_cognito_user_pools
}`;

export const data = defineData({
  migratedAmplifyGen1DynamoDbTableMappings: [
    {
      //The "branchname" variable needs to be the same as your deployment branch if you want to reuse your Gen1 app tables
      branchName: 'dev',
      modelNameToTableNameMapping: {
        Transaction: 'Transaction-2wfenq2x7zcnlibkicixwspyry-dev',
        Budget: 'Budget-2wfenq2x7zcnlibkicixwspyry-dev',
        FinancialSummary: 'FinancialSummary-2wfenq2x7zcnlibkicixwspyry-dev',
      },
    },
  ],
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: { expiresInDays: 365, description: 'graphql' },
  },
  schema,
});
