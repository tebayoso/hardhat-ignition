import { ERRORS, ErrorDescriptor, getErrorCode } from "./errors-list";

/**
 * Base error class extended by all custom errors.
 * Placeholder to allow us to customize error output formatting in the future.
 *
 * @alpha
 */
export class CustomError extends Error {
  constructor(message: string, cause?: Error) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = this.constructor.name;
  }
}

/**
 * All exceptions intentionally thrown with Ignition-core
 * extend this class.
 *
 * @alpha
 */
export class IgnitionError extends CustomError {
  // We store the error descriptor as private field to avoid
  // interferring with Node's default error formatting.
  // We can use getters to access any private field without
  // interferring with it.
  //
  // Disabling this rule as private fields don't use `private`
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  #errorDescriptor: ErrorDescriptor;

  constructor(
    errorDescriptor: ErrorDescriptor,
    messageArguments: Record<string, string | number> = {},
    cause?: Error
  ) {
    const prefix = `${getErrorCode(errorDescriptor)}: `;
    const formattedMessage = applyErrorMessageTemplate(
      errorDescriptor.message,
      messageArguments
    );

    super(prefix + formattedMessage, cause);

    this.#errorDescriptor = errorDescriptor;
  }

  public get errorNumber(): number {
    return this.#errorDescriptor.number;
  }
}

/**
 * This class is used to throw errors from Ignition plugins made by third parties.
 *
 * @alpha
 */
export class IgnitionPluginError extends CustomError {
  public static isIgnitionPluginError(
    error: any
  ): error is IgnitionPluginError {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as IgnitionPluginError)._isIgnitionPluginError === true
    );
  }

  private readonly _isIgnitionPluginError = true;

  public readonly pluginName: string;

  constructor(pluginName: string, message: string, cause?: Error) {
    super(message, cause);
    this.pluginName = pluginName;
  }
}

/**
 * This class is used to throw errors from *core* Ignition plugins.
 * If you are developing a third-party plugin, use IgnitionPluginError instead.
 *
 * @alpha
 */
export class NomicIgnitionPluginError extends IgnitionPluginError {
  public static isNomicIgnitionPluginError(
    error: any
  ): error is NomicIgnitionPluginError {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as NomicIgnitionPluginError)._isNomicIgnitionPluginError === true
    );
  }

  private readonly _isNomicIgnitionPluginError = true;
}

/**
 * This function applies error messages templates like this:
 *
 *  - Template is a string which contains a variable tags. A variable tag is a
 *    a variable name surrounded by %. Eg: %plugin1%
 *  - A variable name is a string of alphanumeric ascii characters.
 *  - Every variable tag is replaced by its value.
 *  - %% is replaced by %.
 *  - Values can't contain variable tags.
 *  - If a variable is not present in the template, but present in the values
 *    object, an error is thrown.
 *
 * @param template - The template string.
 * @param values - A map of variable names to their values.
 *
 * @alpha
 */
export function applyErrorMessageTemplate(
  template: string,
  values: { [templateVar: string]: any }
): string {
  return _applyErrorMessageTemplate(template, values, false);
}

function _applyErrorMessageTemplate(
  template: string,
  values: { [templateVar: string]: any },
  isRecursiveCall: boolean
): string {
  if (!isRecursiveCall) {
    for (const variableName of Object.keys(values)) {
      if (variableName.match(/^[a-zA-Z][a-zA-Z0-9]*$/) === null) {
        throw new IgnitionError(
          ERRORS.INTERNAL.TEMPLATE_INVALID_VARIABLE_NAME,
          {
            variable: variableName,
          }
        );
      }

      const variableTag = `%${variableName}%`;

      if (!template.includes(variableTag)) {
        throw new IgnitionError(ERRORS.INTERNAL.TEMPLATE_VARIABLE_NOT_FOUND, {
          variable: variableName,
        });
      }
    }
  }

  if (template.includes("%%")) {
    return template
      .split("%%")
      .map((part) => _applyErrorMessageTemplate(part, values, true))
      .join("%");
  }

  for (const variableName of Object.keys(values)) {
    let value: string;

    if (values[variableName] === undefined) {
      value = "undefined";
    } else if (values[variableName] === null) {
      value = "null";
    } else {
      value = values[variableName].toString();
    }

    if (value === undefined) {
      value = "undefined";
    }

    const variableTag = `%${variableName}%`;

    if (value.match(/%([a-zA-Z][a-zA-Z0-9]*)?%/) !== null) {
      throw new IgnitionError(
        ERRORS.INTERNAL.TEMPLATE_VALUE_CONTAINS_VARIABLE_TAG,
        { variable: variableName }
      );
    }

    template = template.split(variableTag).join(value);
  }

  return template;
}
