import * as amp from "@aws-cdk/aws-amplify";
import { UserPool, CfnUserPoolClient, CfnIdentityPool, AccountRecovery } from "@aws-cdk/aws-cognito";
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { NodejsFunction } from "@aws-cdk/aws-lambda-nodejs";
import { Construct, Stack, StackProps, SecretValue, Duration, CfnOutput } from "@aws-cdk/core";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    ///////////// Auth Lambda
    // Create role
    const authRole = new Role(this, "AuthRole", {
      assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
    });
    authRole.addToPolicy(new PolicyStatement({
      resources: ['*'],
      actions: [
        'ses:SendEmail', 
        'cognito-idp:AdminUpdateUserAttributes',
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents'
      ]
    }))
    // Create lambda functions
    const emailAddress = "blakegreen@msn.com"
    const createAuthFunction = new NodejsFunction(this, 'CreateAuthFunction', {
      entry: 'functions/passwordless/create-auth-challenge.ts', 
      handler: 'handler', 
      role: authRole,
      environment: {
        'SES_FROM_ADDRESS':emailAddress
      }
    });
    const preSignUpFunction = new NodejsFunction(this, 'PreSignUpFunction', {
      entry: 'functions/passwordless/pre-signup.ts', 
      handler: 'handler', 
      role: authRole,
      environment: {
        'SES_FROM_ADDRESS':emailAddress
      }
    });
    const defineAuthFunction = new NodejsFunction(this, 'DefineAuthFunction', {
      entry: 'functions/passwordless/define-auth-challenge.ts', 
      handler: 'handler', 
      role: authRole,
      environment: {
        'SES_FROM_ADDRESS':emailAddress
      }
    });
    const postAuthFunction = new NodejsFunction(this, 'PostAuthFunction', {
      entry: 'functions/passwordless/post-authentication.ts', 
      handler: 'handler', 
      role: authRole,
      environment: {
        'SES_FROM_ADDRESS':emailAddress
      }
    });
    const verifyAuthFunction = new NodejsFunction(this, 'VerifyAuthFunction', {
      entry: 'functions/passwordless/verify-auth-challenge-response.ts', 
      handler: 'handler', 
      role: authRole,
      environment: {
        'SES_FROM_ADDRESS':emailAddress
      }
    });
    ///////////// Cognito
    // Create user pool
    const userPool = new UserPool(this, "UserPool2", {
      selfSignUpEnabled: true,
      signInAliases: {email: true},
      accountRecovery: AccountRecovery.NONE,
      passwordPolicy: {
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false, 
        minLength: 6,
        tempPasswordValidity: Duration.days(7)
      },
      lambdaTriggers: {
        createAuthChallenge: createAuthFunction,
        preSignUp: preSignUpFunction,
        defineAuthChallenge: defineAuthFunction,
        postAuthentication: postAuthFunction,
        verifyAuthChallengeResponse: verifyAuthFunction
      }
    })
    // Create user pool client
    const userPoolClient = new CfnUserPoolClient(this, "UserPoolClient", {
      userPoolId: userPool.userPoolId,
      generateSecret: false,
      explicitAuthFlows: [
        "ALLOW_CUSTOM_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH"
      ]
    })
    const identityPool = new CfnIdentityPool(this, "IdentityPool", {
      allowUnauthenticatedIdentities: true,
      cognitoIdentityProviders: [{
        clientId: userPoolClient.ref,
        providerName: userPool.userPoolProviderName
      }]
    })

    ///////////// Amplify
    const role = new Role(this, "MyRole", {
      assumedBy: new ServicePrincipal("amplify.amazonaws.com"),
    });
    role.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    );

    const amplifyApp = new amp.App(this, "amplify", {
      appName: "sketchynote",
      sourceCodeProvider: new amp.GitHubSourceCodeProvider({
        owner: "blakegreendev",
        repository: "next-cdk-amplify",
        oauthToken: SecretValue.secretsManager("github-repo"),
      }),
      environmentVariables: {
        'IDENTITY_POOL_ID': identityPool.ref,
        'USER_POOL_ID': userPool.userPoolId,
        'USER_POOL_CLIENT_ID': userPoolClient.ref,
        'REGION': this.region
      },
      role,
      autoBranchCreation: {
        patterns: ["*"]
      },
      autoBranchDeletion: true
    });

    const main = amplifyApp.addBranch("main");
    const domain = amplifyApp.addDomain("sketchy.blakegreen.dev", {
      enableAutoSubdomain: true, // in case subdomains should be auto registered for branches
      autoSubdomainCreationPatterns: ["*", "pr*"], // regex for branches that should auto register subdomains
    });
    domain.mapRoot(main); // map master branch to domain root

    ////////////////// Outputs
    new CfnOutput(this, "IdentityPoolOut", {value: identityPool.ref})
    new CfnOutput(this, "UserPoolIdOut", {value: userPool.userPoolId})
    new CfnOutput(this, "UserPoolClientIdOut", {value: userPoolClient.ref})
    new CfnOutput(this, "RegionOut", {value: this.region})
  }
}
