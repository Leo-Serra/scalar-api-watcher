import { computeDiff, OpenApiSpec } from './diff-engine';

function makeSpec(paths: OpenApiSpec['paths'] = {}): OpenApiSpec {
  return { info: { title: 'Test API', version: '1.0' }, paths };
}

describe('computeDiff', () => {
  it('should detect an added endpoint', () => {
    const oldSpec = makeSpec({});
    const newSpec = makeSpec({ '/users': { get: { summary: 'List users' } } });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.summary.endpointsAdded).toBe(1);
    expect(result.summary.endpointsRemoved).toBe(0);
    expect(result.changes).toHaveLength(1);
    expect(result.changes![0]).toMatchObject({
      path: '/users',
      method: 'GET',
      type: 'added',
      breaking: false,
    });
  });

  it('should detect a removed endpoint as breaking', () => {
    const oldSpec = makeSpec({ '/users': { get: { summary: 'List' } } });
    const newSpec = makeSpec({});

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.summary.endpointsRemoved).toBe(1);
    expect(result.changes![0]).toMatchObject({
      type: 'removed',
      breaking: true,
    });
  });

  it('should detect modified endpoint with parameter changes', () => {
    const oldSpec = makeSpec({
      '/users': {
        get: {
          parameters: [{ name: 'page', in: 'query', required: false, schema: { type: 'integer' } }],
        },
      },
    });
    const newSpec = makeSpec({
      '/users': {
        get: {
          parameters: [{ name: 'page', in: 'query', required: true, schema: { type: 'integer' } }],
        },
      },
    });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.summary.endpointsChanged).toBe(1);
    expect(result.changes![0].breaking).toBe(true);
    const fieldChange = result.changes![0].fieldChanges?.find(
      (f) => f.field === 'param:query:page:required',
    );
    expect(fieldChange).toBeDefined();
    expect(fieldChange!.breaking).toBe(true);
  });

  it('should detect parameter type change as breaking', () => {
    const oldSpec = makeSpec({
      '/items': {
        post: {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        },
      },
    });
    const newSpec = makeSpec({
      '/items': {
        post: {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
    });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.changes![0].breaking).toBe(true);
    expect(result.changes![0].fieldChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'param:path:id:type', breaking: true }),
      ]),
    );
  });

  it('should detect added parameter (non-breaking)', () => {
    const oldSpec = makeSpec({ '/users': { get: { parameters: [] } } });
    const newSpec = makeSpec({
      '/users': {
        get: {
          parameters: [
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
          ],
        },
      },
    });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.changes![0].fieldChanges?.[0]).toMatchObject({
      field: 'param:query:limit',
      type: 'added',
      breaking: false,
    });
  });

  it('should detect removed required parameter as breaking', () => {
    const oldSpec = makeSpec({
      '/users': {
        get: {
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        },
      },
    });
    const newSpec = makeSpec({ '/users': { get: { parameters: [] } } });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.changes![0].fieldChanges?.[0]).toMatchObject({
      field: 'param:path:id',
      type: 'removed',
      breaking: true,
    });
  });

  it('should detect requestBody schema changes', () => {
    const oldSpec = makeSpec({
      '/users': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: { name: { type: 'string' }, age: { type: 'integer' } },
                  required: ['name'],
                },
              },
            },
          },
        },
      },
    });
    const newSpec = makeSpec({
      '/users': {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: { name: { type: 'string' }, email: { type: 'string' } },
                  required: ['name', 'email'],
                },
              },
            },
          },
        },
      },
    });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');
    const fields = result.changes![0].fieldChanges ?? [];

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'requestBody.email', type: 'added' }),
        expect.objectContaining({ field: 'requestBody.age', type: 'removed' }),
      ]),
    );
  });

  it('should detect deprecated endpoint as non-breaking', () => {
    const oldSpec = makeSpec({ '/old': { get: { deprecated: false } } });
    const newSpec = makeSpec({ '/old': { get: { deprecated: true } } });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.changes![0].fieldChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'deprecated', type: 'modified', breaking: false }),
      ]),
    );
  });

  it('should return correct metadata', () => {
    const result = computeDiff(makeSpec(), makeSpec(), 'cfg1', 'v1', 'v2');

    expect(result.configId).toBe('cfg1');
    expect(result.oldVersionId).toBe('v1');
    expect(result.newVersionId).toBe('v2');
  });

  it('should return zero summary for identical specs', () => {
    const spec = makeSpec({ '/a': { get: { summary: 'A' } } });

    const result = computeDiff(spec, spec, 'cfg1', 'v1', 'v2');

    expect(result.summary).toEqual({
      endpointsAdded: 0,
      endpointsRemoved: 0,
      endpointsChanged: 0,
      breakingChanges: 0,
      fieldsAdded: 0,
      fieldsRemoved: 0,
      fieldsChanged: 0,
    });
  });

  it('should handle multiple methods on same path', () => {
    const oldSpec = makeSpec({ '/users': { get: {}, post: {} } });
    const newSpec = makeSpec({ '/users': { get: {}, post: {}, delete: {} } });

    const result = computeDiff(oldSpec, newSpec, 'cfg1', 'v1', 'v2');

    expect(result.summary.endpointsAdded).toBe(1);
    expect(result.changes![0]).toMatchObject({ path: '/users', method: 'DELETE' });
  });

  it('should ignore non-HTTP method keys in path item', () => {
    const spec = makeSpec({
      '/x': { get: { summary: 'ok' }, parameters: [{ name: 'a', in: 'path' }] } as never,
    });

    const result = computeDiff(spec, spec, 'cfg1', 'v1', 'v2');
    expect(result.changes).toHaveLength(0);
  });
});
