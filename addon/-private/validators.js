import { isArray } from '@ember/array';
import { get } from '@ember/object';
import { createContextPath, ensureValidator, toString, typeOf } from './utils';

/**
 * Validator to handle type checking via typeof
 * @param {string} expectedType - The type the validator expects
 * @returns {function} Validator function
 */
export function createTypeValidator(expectedType) {
  return function(value) {
    if (typeof value !== expectedType) {
      return `Expected type ${expectedType} but received ${typeOf(value)}`;
    }
  }
}

/**
 * Validator to handle strict equality checking
 * @param {any} expectedValue - The value the validator expects
 * @returns {function} Validator function
 */
export function createEqualityValidator(expectedValue) {
  return function(value) {
    if (value !== expectedValue) {
      return `Expected value to equal ${toString(expectedValue)} but received ${toString(value)}`;
    }
  }
}

/**
 * Validator to handle instanceof checking
 * @param {any} klass - The class the value should be an instance of
 * @returns {function} Validator function
 */
export function createInstanceOfValidator(klass) {
  /**
   * @param {object} value - An object to structurally validate
   * @param {function} context - The context for the path to any validation error
   */
  return function(value, context) {
    if (!(value instanceof klass)) {
      return [
        `Expected value to be an instance of ${klass.name ?? toString(klass)} but received ${toString(value)}`,
        context
      ];
    }
  }
}

/**
 * Validator to structurally type check an object
 * @param {object} validators - Key value pairs of propertyName -> validator
 * @returns {function} Validator function
 */
export function createShapeValidator(validators) {
  /**
   * @param {object} value - An object to structurally validate
   * @param {function} context - The context for the path to any validation error
   */
  return function(value, context) {
    const error = ensureValidator('object')(value, context);
    if (error) {
      return error;
    }

    // Ensure the value is non-null so that we won't accidentally apply get to a null value
    if (value === null) {
      return [`Expected value to be a non-null object but received null`, context];
    }

    for (const key of Object.keys(validators)) {
      // Clone the current context to generate the correct context in the next iteration
      const nextContext = createContextPath(context());
      const error = ensureValidator(validators[key])(get(value, key), nextContext(key));
      if (error) {
        return error;
      }
    }
  }
}

/**
 * Validator to type check all items in an array
 * @param {string|function} validator - The validator to run against all items in the array
 * @returns {function} Validator function
 */
export function createArrayValidator(validator) {
  /**
   * @param {any[]} values - An array of values to structurally validate
   * @param {function} context - The context for the path to any validation error
   */
  return function(values, context) {
    if (!isArray(values)) {
      return [`Expected type array but received ${typeOf(values)}`, context];
    }

    for (let i = 0; i < values.length; i++) {
      // Clone the current context to generate the correct context in the next iteration
      const nextContext = createContextPath(context());
      const error = ensureValidator(validator)(values[i], nextContext(`${i}`));
      if (error) {
        return error;
      }
    }
  }
}

/**
 * Validator to type check a value against an allowed set of values
 * @param {any[]} allowedValues - The values which are allowed
 * @returns {function} Validator function
 */
export function createOneOfValidator(allowedValues) {
  /**
   * @param {any} value - A value of any type to check against the allowedValues
   * @param {function} context - The context for the path to any validation error
   */
  return function(value, context) {
    if (!allowedValues.includes(value)) {
      return [
        `Expected the value to be${allowedValues.length > 1 ? ' one of' : ''} ${allowedValues.map(toString).join(', ')} but received ${toString(value)}`,
        context
      ];
    }
  }
}

/**
 * Validator to type check a value against multiple . As long as one validator is happy
 * @param validators
 * @returns {function(*=, *=): ([*, *]|undefined)}
 */
export function createUnionOfValidator(validators) {
  /**
   * @param {any} value - A value of any type to check against the allowedValues
   * @param {function} context - The context for the path to any validation error
   */
  return function(value, context) {
    const errors = [];

    for (const validator of validators) {
      const error = ensureValidator(validator)(value, context);
      if (!error) {
        return;
      }
      errors.push(error);
    }

    return [
      'Expected the value to pass one of the provided validators:\n' + errors.map(([error, context]) => `${context()} |> ${error}`).join('\n'),
      context
    ];
  }
}
