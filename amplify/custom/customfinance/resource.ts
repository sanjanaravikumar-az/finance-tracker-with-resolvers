import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
const branchName = process.env.AWS_BRANCH ?? "sandbox";
const projectName = "financetracker";
export class cdkStack extends Construct {
    constructor(scope: Construct, id: string) {
        super(scope, id);
        // 1. SNS Topic for Budget Alerts
        const budgetAlertTopic = new sns.Topic(this, 'BudgetAlertTopic', {
            topicName: `finance-budget-alerts-${branchName}`,
            displayName: 'Fin Tracker Budget Alerts',
        });
        new cdk.CfnOutput(this, 'BudgetAlertTopicArn', {
            value: budgetAlertTopic.topicArn,
            description: 'SNS Topic ARN for budget alerts',
            exportName: `${projectName}-BudgetAlertTopicArn-${branchName}`,
        });
        // 2. SNS Topic for Monthly Reports
        const monthlyReportTopic = new sns.Topic(this, 'MonthlyReportTopic', {
            topicName: `finance-monthly-reports-${branchName}`,
            displayName: 'Finance Tracker Monthly Reports',
        });
        // Note: Email subscriptions will be managed dynamically by Lambda
        // when users click the email button (allows any user to subscribe)
        new cdk.CfnOutput(this, 'MonthlyReportTopicArn', {
            value: monthlyReportTopic.topicArn,
            description: 'SNS Topic ARN for monthly reports',
            exportName: `${projectName}-MonthlyReportTopicArn-${branchName}`,
        });
        // 3. Add tags for resource organization
        cdk.Tags.of(this).add('Project', 'FinanceTracker');
        cdk.Tags.of(this).add('Environment', branchName);
        cdk.Tags.of(this).add('ManagedBy', 'Amplify');
    }
}
