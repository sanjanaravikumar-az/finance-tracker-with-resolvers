import { defineAuth } from '@aws-amplify/backend';
import { financetrackerc3d67c94 } from '../function/financetrackerc3d67c94/resource';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: 'Your verification code',
      verificationEmailBody: () => 'Your verification code is {####}',
    },
  },
  userAttributes: {
    email: {
      required: true,
      mutable: true,
    },
  },
  multifactor: {
    mode: 'OFF',
  },
  access: (allow: any) => [
    allow.resource(financetrackerc3d67c94).to(['manageUsers']),
    allow.resource(financetrackerc3d67c94).to(['manageGroupMembership']),
    allow.resource(financetrackerc3d67c94).to(['manageUserDevices']),
    allow.resource(financetrackerc3d67c94).to(['managePasswordRecovery']),
    allow.resource(financetrackerc3d67c94).to(['setUserMfaPreference']),
    allow.resource(financetrackerc3d67c94).to(['updateUserAttributes']),
    allow.resource(financetrackerc3d67c94).to(['forgetDevice']),
    allow.resource(financetrackerc3d67c94).to(['setUserSettings']),
    allow.resource(financetrackerc3d67c94).to(['listUsers']),
    allow.resource(financetrackerc3d67c94).to(['listUsersInGroup']),
    allow.resource(financetrackerc3d67c94).to(['listGroups']),
  ],
});
