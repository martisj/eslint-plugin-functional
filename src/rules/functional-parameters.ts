import type { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import { deepmerge } from "deepmerge-ts";
import type { JSONSchema4 } from "json-schema";
import type { ReadonlyDeep } from "type-fest";

import type { IgnorePatternOption } from "~/common/ignore-options";
import {
  shouldIgnorePattern,
  ignorePatternOptionSchema,
} from "~/common/ignore-options";
import type { RuleResult } from "~/util/rule";
import { createRule } from "~/util/rule";
import { isIIFE, isPropertyAccess, isPropertyName } from "~/util/tree";
import { isRestElement } from "~/util/typeguard";

/**
 * The name of this rule.
 */
export const name = "functional-parameters" as const;

/**
 * The parameter count options this rule can take.
 */
type ParameterCountOptions = "atLeastOne" | "exactlyOne";

/**
 * The options this rule can take.
 */
type Options = readonly [
  IgnorePatternOption &
    Readonly<{
      allowRestParameter: boolean;
      allowArgumentsKeyword: boolean;
      enforceParameterCount:
        | ParameterCountOptions
        | false
        | Readonly<{
            count: ParameterCountOptions;
            ignoreIIFE: boolean;
          }>;
    }>
];

/**
 * The schema for the rule options.
 */
const schema: JSONSchema4 = [
  {
    type: "object",
    properties: deepmerge(ignorePatternOptionSchema, {
      allowRestParameter: {
        type: "boolean",
      },
      allowArgumentsKeyword: {
        type: "boolean",
      },
      enforceParameterCount: {
        oneOf: [
          {
            type: "boolean",
            enum: [false],
          },
          {
            type: "string",
            enum: ["atLeastOne", "exactlyOne"],
          },
          {
            type: "object",
            properties: {
              count: {
                type: "string",
                enum: ["atLeastOne", "exactlyOne"],
              },
              ignoreIIFE: {
                type: "boolean",
              },
            },
            additionalProperties: false,
          },
        ],
      },
    }),
    additionalProperties: false,
  },
];

/**
 * The default options for the rule.
 */
const defaultOptions: Options = [
  {
    allowRestParameter: false,
    allowArgumentsKeyword: false,
    enforceParameterCount: {
      count: "atLeastOne",
      ignoreIIFE: true,
    },
  },
];

/**
 * The possible error messages.
 */
const errorMessages = {
  restParam:
    "Unexpected rest parameter. Use a regular parameter of type array instead.",
  arguments:
    "Unexpected use of `arguments`. Use regular function arguments instead.",
  paramCountAtLeastOne: "Functions must have at least one parameter.",
  paramCountExactlyOne: "Functions must have exactly one parameter.",
} as const;

/**
 * The meta data for this rule.
 */
const meta: ESLintUtils.NamedCreateRuleMeta<keyof typeof errorMessages> = {
  type: "suggestion",
  docs: {
    description: "Enforce functional parameters.",
    recommended: "error",
  },
  messages: errorMessages,
  schema,
};

/**
 * Get the rest parameter violations.
 */
function getRestParamViolations(
  [{ allowRestParameter }]: Options,
  node:
    | ReadonlyDeep<TSESTree.ArrowFunctionExpression>
    | ReadonlyDeep<TSESTree.FunctionDeclaration>
    | ReadonlyDeep<TSESTree.FunctionExpression>
): RuleResult<keyof typeof errorMessages, Options>["descriptors"] {
  return !allowRestParameter &&
    node.params.length > 0 &&
    isRestElement(node.params[node.params.length - 1])
    ? [
        {
          node: node.params[node.params.length - 1],
          messageId: "restParam",
        },
      ]
    : [];
}

/**
 * Get the parameter count violations.
 */
function getParamCountViolations(
  [{ enforceParameterCount }]: Options,
  node:
    | ReadonlyDeep<TSESTree.ArrowFunctionExpression>
    | ReadonlyDeep<TSESTree.FunctionDeclaration>
    | ReadonlyDeep<TSESTree.FunctionExpression>
): RuleResult<keyof typeof errorMessages, Options>["descriptors"] {
  if (
    enforceParameterCount === false ||
    (node.params.length === 0 &&
      typeof enforceParameterCount === "object" &&
      enforceParameterCount.ignoreIIFE &&
      isIIFE(node))
  ) {
    return [];
  }
  if (
    node.params.length === 0 &&
    (enforceParameterCount === "atLeastOne" ||
      (typeof enforceParameterCount === "object" &&
        enforceParameterCount.count === "atLeastOne"))
  ) {
    return [
      {
        node,
        messageId: "paramCountAtLeastOne",
      },
    ];
  }
  if (
    node.params.length !== 1 &&
    (enforceParameterCount === "exactlyOne" ||
      (typeof enforceParameterCount === "object" &&
        enforceParameterCount.count === "exactlyOne"))
  ) {
    return [
      {
        node,
        messageId: "paramCountExactlyOne",
      },
    ];
  }
  return [];
}

/**
 * Check if the given function node has a reset parameter this rule.
 */
function checkFunction(
  node:
    | ReadonlyDeep<TSESTree.ArrowFunctionExpression>
    | ReadonlyDeep<TSESTree.FunctionDeclaration>
    | ReadonlyDeep<TSESTree.FunctionExpression>,
  context: ReadonlyDeep<
    TSESLint.RuleContext<keyof typeof errorMessages, Options>
  >,
  options: Options
): RuleResult<keyof typeof errorMessages, Options> {
  const [optionsObject] = options;

  if (shouldIgnorePattern(node, context, optionsObject)) {
    return {
      context,
      descriptors: [],
    };
  }

  return {
    context,
    descriptors: [
      ...getRestParamViolations(options, node),
      ...getParamCountViolations(options, node),
    ],
  };
}

/**
 * Check if the given identifier is for the "arguments" keyword.
 */
function checkIdentifier(
  node: ReadonlyDeep<TSESTree.Identifier>,
  context: ReadonlyDeep<
    TSESLint.RuleContext<keyof typeof errorMessages, Options>
  >,
  options: Options
): RuleResult<keyof typeof errorMessages, Options> {
  const [optionsObject] = options;

  if (shouldIgnorePattern(node, context, optionsObject)) {
    return {
      context,
      descriptors: [],
    };
  }

  const { allowArgumentsKeyword } = optionsObject;

  return {
    context,
    descriptors:
      !allowArgumentsKeyword &&
      node.name === "arguments" &&
      !isPropertyName(node) &&
      !isPropertyAccess(node)
        ? [
            {
              node,
              messageId: "arguments",
            },
          ]
        : [],
  };
}

// Create the rule.
export const rule = createRule<keyof typeof errorMessages, Options>(
  name,
  meta,
  defaultOptions,
  {
    FunctionDeclaration: checkFunction,
    FunctionExpression: checkFunction,
    ArrowFunctionExpression: checkFunction,
    Identifier: checkIdentifier,
  }
);
