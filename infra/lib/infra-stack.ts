import * as amp from "@aws-cdk/aws-amplify";
import { BuildSpec } from "@aws-cdk/aws-codebuild";
import { UserPool, CfnUserPoolClient, CfnIdentityPool } from "@aws-cdk/aws-cognito";
import { ManagedPolicy, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { Construct, Stack, StackProps, SecretValue, Duration, CfnOutput } from "@aws-cdk/core";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new UserPool(this, "UserPool", {
      passwordPolicy: {
        requireDigits: false,
        requireLowercase: false,
        requireSymbols: false,
        requireUppercase: false, 
        minLength: 6,
        tempPasswordValidity: Duration.days(7)
      }
    })
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

    new CfnOutput(this, "IdentityPoolOut", {value: identityPool.ref})
    new CfnOutput(this, "UserPoolIdOut", {value: userPool.userPoolId})
    new CfnOutput(this, "UserPoolClientIdOut", {value: userPoolClient.ref})
    new CfnOutput(this, "RegionOut", {value: this.region})
  }
}
