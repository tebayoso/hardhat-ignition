import { IgnitionError } from "../../../errors";
import { ERRORS } from "../../../errors-list";
import {
  isAccountRuntimeValue,
  isArtifactType,
  isModuleParameterRuntimeValue,
} from "../../../type-guards";
import { ArtifactResolver } from "../../../types/artifact";
import { DeploymentParameters } from "../../../types/deploy";
import { StaticCallFuture } from "../../../types/module";
import {
  validateArtifactFunction,
  validateFunctionArgumentParamType,
} from "../../execution/abi";
import {
  retrieveNestedRuntimeValues,
  validateAccountRuntimeValue,
} from "../utils";

export async function validateNamedStaticCall(
  future: StaticCallFuture<string, string>,
  artifactLoader: ArtifactResolver,
  deploymentParameters: DeploymentParameters,
  accounts: string[]
): Promise<string[]> {
  const errors: IgnitionError[] = [];

  /* stage one */

  const artifact =
    "artifact" in future.contract
      ? future.contract.artifact
      : await artifactLoader.loadArtifact(future.contract.contractName);

  if (!isArtifactType(artifact)) {
    errors.push(
      new IgnitionError(ERRORS.VALIDATION.INVALID_ARTIFACT, {
        contractName: future.contract.contractName,
      })
    );
  } else {
    errors.push(
      ...validateArtifactFunction(
        artifact,
        future.contract.contractName,
        future.functionName,
        future.args,
        true
      )
    );

    errors.push(
      ...validateFunctionArgumentParamType(
        future.contract.contractName,
        future.functionName,
        artifact,
        future.nameOrIndex
      )
    );
  }

  /* stage two */

  const runtimeValues = retrieveNestedRuntimeValues(future.args);
  const moduleParams = runtimeValues.filter(isModuleParameterRuntimeValue);
  const accountParams = [
    ...runtimeValues.filter(isAccountRuntimeValue),
    ...(isAccountRuntimeValue(future.from) ? [future.from] : []),
  ];

  errors.push(
    ...accountParams.flatMap((arv) =>
      validateAccountRuntimeValue(arv, accounts)
    )
  );

  const missingParams = moduleParams.filter(
    (param) =>
      deploymentParameters[param.moduleId]?.[param.name] === undefined &&
      param.defaultValue === undefined
  );

  if (missingParams.length > 0) {
    errors.push(
      new IgnitionError(ERRORS.VALIDATION.MISSING_MODULE_PARAMETER, {
        name: missingParams[0].name,
      })
    );
  }

  return errors.map((e) => e.message);
}
