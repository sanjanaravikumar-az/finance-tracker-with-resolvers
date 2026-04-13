import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
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
        budgetAlertTopic.addSubscription(new subscriptions.EmailSubscription('sanjana.ravikumar.az@gmail.com'));
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
        monthlyReportTopic.addSubscription(new subscriptions.EmailSubscription('sanjana.ravikumar.az@gmail.com'));
        new cdk.CfnOutput(this, 'MonthlyReportTopicArn', {
            value: monthlyReportTopic.topicArn,
            description: 'SNS Topic ARN for monthly reports',
            exportName: `${projectName}-MonthlyReportTopicArn-${branchName}`,
        });
        cdk.Tags.of(this).add('Project', 'FinanceTracker');
        cdk.Tags.of(this).add('Environment', branchName);
        cdk.Tags.of(this).add('ManagedBy', 'Amplify');
    }
}
