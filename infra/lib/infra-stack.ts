import * as amp from "@aws-cdk/aws-amplify";
import { BuildSpec } from "@aws-cdk/aws-codebuild";
import { ManagedPolicy, Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { Construct, Stack, StackProps, SecretValue } from "@aws-cdk/core";

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
      role,
      buildSpec: BuildSpec.fromObjectToYaml({
        version: "1.0",
        frontend: {
          phases: {
            preBuild: {
              commands: ["yarn install"],
            },
            build: {
              commands: ["yarn run build"],
            },
          },
          artifacts: {
            baseDirectory: ".next",
            files: "**/*",
          },
          cache: {
            paths: "node_modules/**/*",
          },
        },
      }),
    });

    const main = amplifyApp.addBranch("main");
    const domain = amplifyApp.addDomain("sketchy.blakegreen.dev", {
      enableAutoSubdomain: true, // in case subdomains should be auto registered for branches
      autoSubdomainCreationPatterns: ["*", "pr*"], // regex for branches that should auto register subdomains
    });
    domain.mapRoot(main); // map master branch to domain root
  }
}
