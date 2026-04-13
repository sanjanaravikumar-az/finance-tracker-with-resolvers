import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const dynamoClient = new DynamoDBClient({});
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const sns = new SNSClient({});

export const handler = async (event) => {
  console.log(`EVENT: ${JSON.stringify(event, null, 2)}`);

  const fieldName = event.info?.fieldName || event.fieldName;
  const args = event.arguments || event.args || {};

  console.log('Field Name:', fieldName);
  console.log('Arguments:', JSON.stringify(args, null, 2));

  try {
    switch (fieldName) {
      case 'calculateFinancialSummary':
        const summary = await calculateSummaryFromDB();
        console.log('Handler returning summary:', summary);
        return summary;

      case 'sendMonthlyReport':
        return await sendMonthlyReport(args);

      case 'sendBudgetAlert':
        return await sendBudgetAlert(args);

      default:
        console.error('Unknown operation. Event structure:', JSON.stringify(event, null, 2));
        throw new Error(`Unknown field: ${fieldName}. Full event logged to CloudWatch.`);
    }
  } catch (error) {
    console.error('Handler Error:', error);

    if (fieldName === 'calculateFinancialSummary') {
      return { totalIncome: 0, totalExpenses: 0, balance: 0, savingsRate: 0 };
    }

    return { success: false, message: `Error: ${error.message}` };
  }
};

async function calculateSummaryFromDB() {
  let tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
  console.log('Table name from env:', tableName);

  if (!tableName || tableName.includes('NONE')) {
    try {
      const listResult = await dynamoClient.send(new ListTablesCommand({}));
      const transactionTable = listResult.TableNames.find((name) => name.startsWith('Transaction-'));
      if (transactionTable) {
        tableName = transactionTable;
      } else {
        throw new Error('Could not find Transaction table in DynamoDB');
      }
    } catch (listError) {
      throw new Error(`Could not list DynamoDB tables: ${listError.message}`);
    }
  }

  const result = await dynamodb.send(new ScanCommand({ TableName: tableName }));
  const transactions = result.Items || [];

  const summary = transactions.reduce(
    (acc, transaction) => {
      if (transaction.type === 'INCOME') acc.totalIncome += transaction.amount;
      else if (transaction.type === 'EXPENSE') acc.totalExpenses += transaction.amount;
      return acc;
    },
    { totalIncome: 0, totalExpenses: 0 },
  );

  summary.balance = summary.totalIncome - summary.totalExpenses;
  summary.savingsRate = summary.totalIncome > 0 ? parseFloat(((summary.balance / summary.totalIncome) * 100).toFixed(2)) : 0;
  return summary;
}

async function sendMonthlyReport(args) {
  const email = args.email;
  if (!email) return { success: false, message: 'Email is required' };

  try {
    const topicArn = process.env.MONTHLY_REPORT_TOPIC_ARN;
    if (!topicArn || topicArn === 'NONE') throw new Error('Monthly report topic ARN not configured');

    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    const result = await dynamodb.send(new ScanCommand({ TableName: tableName }));
    const transactions = result.Items || [];

    const summary = transactions.reduce(
      (acc, t) => {
        if (t.type === 'INCOME') acc.totalIncome += t.amount;
        else if (t.type === 'EXPENSE') acc.totalExpenses += t.amount;
        return acc;
      },
      { totalIncome: 0, totalExpenses: 0 },
    );
    summary.balance = summary.totalIncome - summary.totalExpenses;
    summary.savingsRate = summary.totalIncome > 0 ? ((summary.balance / summary.totalIncome) * 100).toFixed(2) : 0;

    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: 'Your Monthly Financial Report',
      Message: `Monthly Report:\nTotal Income: ${summary.totalIncome.toFixed(2)}\nTotal Expenses: ${summary.totalExpenses.toFixed(2)}\nBalance: ${summary.balance.toFixed(2)}\nSavings Rate: ${summary.savingsRate}%\nTotal Transactions: ${transactions.length}\nGenerated: ${new Date().toLocaleDateString()}`,
    }));

    return { success: true, message: `Monthly report sent to subscribed emails.` };
  } catch (error) {
    return { success: false, message: `Failed to send report: ${error.message}` };
  }
}

async function sendBudgetAlert(args) {
  const { email, category, exceeded } = args;

  try {
    const topicArn = process.env.BUDGET_ALERT_TOPIC_ARN;
    if (!topicArn || topicArn === 'NONE') throw new Error('Budget alert topic ARN not configured');

    const tableName = process.env.API_FINANCETRACKER_TRANSACTIONTABLE_NAME;
    const result = await dynamodb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'category = :category AND #type = :type',
      ExpressionAttributeNames: { '#type': 'type' },
      ExpressionAttributeValues: { ':category': category, ':type': 'EXPENSE' },
    }));

    const categoryTransactions = result.Items || [];
    const totalSpent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

    await sns.send(new PublishCommand({
      TopicArn: topicArn,
      Subject: `Budget Alert: ${category}`,
      Message: `Budget exceeded for ${category} by ${exceeded.toFixed(2)}.\nTotal Spent: ${totalSpent.toFixed(2)}\nTransactions: ${categoryTransactions.length}`,
    }));

    return { success: true, message: 'Budget alert sent successfully!' };
  } catch (error) {
    return { success: false, message: `Failed to send alert: ${error.message}` };
  }
}
