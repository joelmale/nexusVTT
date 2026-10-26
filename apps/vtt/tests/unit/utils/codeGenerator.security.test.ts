import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { CodeGenerator } from '@/utils/codeGenerator';

describe('generated TypeScript data escaping', () => {
  it('emits a computed own property for prototype-shaped data keys', () => {
    const input: unknown = JSON.parse('[{"__proto__":{"polluted":true}}]');
    const source = new CodeGenerator({
      includeComments: false,
    }).generateFeaturesCode(input as never);
    expect(source).toContain('["__proto__"]:');
    expect(source).not.toContain('"__proto__":');
  });
  it('round-trips hostile string values and object keys as data literals', () => {
    const value = "\\'; globalThis.compromised = true; //\n\u2028\u2029";
    const input = [{ name: value, ['key": injected() //']: value }];
    const source = new CodeGenerator({
      includeComments: false,
    }).generateFeaturesCode(input as never);
    const parsed = ts.createSourceFile(
      'generated.ts',
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    expect(parsed.statements).toHaveLength(1);
    const statement = parsed.statements[0];
    expect(ts.isVariableStatement(statement)).toBe(true);
    if (!ts.isVariableStatement(statement))
      throw new Error('Expected data declaration');
    const array = statement.declarationList.declarations[0].initializer;
    if (!array || !ts.isArrayLiteralExpression(array))
      throw new Error('Expected array literal');
    const object = array.elements[0];
    if (!ts.isObjectLiteralExpression(object))
      throw new Error('Expected object literal');
    expect(object.properties).toHaveLength(2);
    for (const property of object.properties) {
      if (
        !ts.isPropertyAssignment(property) ||
        !ts.isStringLiteral(property.initializer)
      )
        throw new Error('Expected string data');
      expect(property.initializer.text).toBe(value);
    }
    expect(object.properties[1].name?.getText(parsed)).toBe(
      JSON.stringify('key": injected() //'),
    );
  });
});
