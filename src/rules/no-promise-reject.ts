import type { ESLintUtils, TSESLint, TSESTree } from "@typescript-eslint/utils";
import type { JSONSchema4 } from "json-schema";
import type { ReadonlyDeep } from "type-fest";

import type { RuleResult } from "~/util/rule";
import { createRule } from "~/util/rule";
import { isIdentifier, isMemberExpression } from "~/util/typeguard";

/**
 * The name of this rule.
 */
export const name = "no-promise-reject" as const;

/**
 * The options this rule can take.
 */
type Options = readonly [{}];

/**
 * The schema for the rule options.
 */
const schema: JSONSchema4 = [];

/**
 * The default options for the rule.
 */
const defaultOptions: Options = [{}];

/**
 * The possible error messages.
 */
const errorMessages = {
  generic: "Unexpected reject, return an error instead.",
} as const;

/**
 * The meta data for this rule.
 */
const meta: ESLintUtils.NamedCreateRuleMeta<keyof typeof errorMessages> = {
  type: "suggestion",
  docs: {
    description: "Disallow try-catch[-finally] and try-finally patterns.",
    recommended: false,
  },
  messages: errorMessages,
  schema,
};

/**
 * Check if the given CallExpression violates this rule.
 */
function checkCallExpression(
  node: ReadonlyDeep<TSESTree.CallExpression>,
  context: ReadonlyDeep<
    TSESLint.RuleContext<keyof typeof errorMessages, Options>
  >
): RuleResult<keyof typeof errorMessages, Options> {
  return {
    context,
    descriptors:
      isMemberExpression(node.callee) &&
      isIdentifier(node.callee.object) &&
      isIdentifier(node.callee.property) &&
      node.callee.object.name === "Promise" &&
      node.callee.property.name === "reject"
        ? [{ node, messageId: "generic" }]
        : [],
  };
}

// Create the rule.
export const rule = createRule<keyof typeof errorMessages, Options>(
  name,
  meta,
  defaultOptions,
  {
    CallExpression: checkCallExpression,
  }
);
