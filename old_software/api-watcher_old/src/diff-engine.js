'use strict';

// ─────────────────────────────────────────────
//  diff-engine.js  —  confronta due spec OpenAPI
// ─────────────────────────────────────────────

function flattenSchema(schema, prefix, specs, visited) {
  visited = visited || new Set();
  if (!schema) return {};
  const fields = {};

  if (schema.$ref && specs) {
    if (visited.has(schema.$ref)) return {};
    const refPath = schema.$ref.replace(/^#\//, '').split('/');
    let resolved = specs;
    for (const part of refPath) resolved = resolved && resolved[part];
    if (resolved) {
      return flattenSchema(resolved, prefix, specs, new Set([...visited, schema.$ref]));
    }
    const name = schema.$ref.split('/').pop();
    return { [prefix || name]: { type: name, required: false, description: '' } };
  }

  const combined = schema.allOf || schema.anyOf || schema.oneOf;
  if (combined) {
    for (const sub of combined) {
      Object.assign(fields, flattenSchema(sub, prefix, specs, visited));
    }
    return fields;
  }

  if (schema.type === 'object' || schema.properties) {
    const props = schema.properties || {};
    const required = schema.required || [];
    for (const [k, v] of Object.entries(props)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v.type === 'object' || v.properties || v.$ref) {
        Object.assign(fields, flattenSchema(v, key, specs, visited));
      } else if (v.type === 'array') {
        const itemType = v.items
          ? (v.items.type || (v.items.$ref ? v.items.$ref.split('/').pop() : 'object'))
          : 'any';
        fields[key] = { type: `array<${itemType}>`, required: required.includes(k), description: v.description || '' };
        if (v.items && (v.items.type === 'object' || v.items.properties || v.items.$ref)) {
          Object.assign(fields, flattenSchema(v.items, key + '[]', specs, visited));
        }
      } else {
        fields[key] = {
          type: v.type || (v.enum ? 'enum' : 'any'),
          required: required.includes(k),
          description: v.description || ''
        };
      }
    }
    return fields;
  }

  if (schema.type) {
    const key = prefix || 'value';
    fields[key] = { type: schema.type, required: false, description: schema.description || '' };
  }

  return fields;
}

function resolveRef(ref, specs) {
  if (!ref || !specs) return null;
  const path = ref.replace(/^#\//, '').split('/');
  let node = specs;
  for (const p of path) node = node && node[p];
  return node || null;
}

function getBodySchema(op, specs) {
  if (op.requestBody) {
    const content = op.requestBody.content || {};
    for (const ct of Object.values(content)) {
      if (ct.schema) return flattenSchema(ct.schema, '', specs);
    }
  }
  if (op.parameters) {
    for (const p of op.parameters) {
      const param = p.$ref ? resolveRef(p.$ref, specs) : p;
      if (param && param.in === 'body' && param.schema) {
        return flattenSchema(param.schema, '', specs);
      }
    }
  }
  return {};
}

function getResponseSchema(op, specs) {
  const responses = op.responses || {};
  for (const code of ['200', '201', '202', 'default']) {
    const resp = responses[code];
    if (!resp) continue;
    const resolved = resp.$ref ? resolveRef(resp.$ref, specs) : resp;
    if (!resolved) continue;
    if (resolved.content) {
      for (const ct of Object.values(resolved.content)) {
        if (ct.schema) return flattenSchema(ct.schema, '', specs);
      }
    }
    if (resolved.schema) return flattenSchema(resolved.schema, '', specs);
  }
  return {};
}

function getParams(op, specs) {
  const params = {};
  for (const p of (op.parameters || [])) {
    const param = p.$ref ? resolveRef(p.$ref, specs) : p;
    if (!param) continue;
    if (['query', 'path', 'header'].includes(param.in)) {
      const schema = param.schema || {};
      params[`${param.in}:${param.name}`] = {
        type: schema.type || param.type || 'string',
        required: !!param.required,
        description: param.description || ''
      };
    }
  }
  return params;
}

function diffFields(oldF, newF) {
  const rows = [];
  const allKeys = new Set([...Object.keys(oldF), ...Object.keys(newF)]);
  for (const key of [...allKeys].sort()) {
    const o = oldF[key];
    const n = newF[key];
    if (o && !n) {
      rows.push({ type: 'removed', key, old: o, new: null, breaking: true });
    } else if (!o && n) {
      rows.push({ type: 'added', key, old: null, new: n, breaking: false });
    } else if (o && n && (o.type !== n.type || o.required !== n.required)) {
      const breaking = o.type !== n.type || (!o.required && n.required);
      rows.push({ type: 'changed', key, old: o, new: n, breaking });
    }
  }
  return rows;
}

function getEndpoints(spec) {
  const endpoints = {};
  for (const [path, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (['get','post','put','patch','delete','options','head'].includes(method.toLowerCase())) {
        endpoints[`${method.toUpperCase()} ${path}`] = op;
      }
    }
  }
  return endpoints;
}

/**
 * Confronta due spec OpenAPI e restituisce le differenze strutturate.
 * @param {object} oldSpec
 * @param {object} newSpec
 * @returns {object} { endpoints: [...], stats: {...} }
 */
function compareSpecs(oldSpec, newSpec) {
  const oldEndpoints = getEndpoints(oldSpec);
  const newEndpoints = getEndpoints(newSpec);
  const allKeys = new Set([...Object.keys(oldEndpoints), ...Object.keys(newEndpoints)]);

  const results = [];

  for (const key of [...allKeys].sort()) {
    const [method, ...rest] = key.split(' ');
    const path = rest.join(' ');
    const oldOp = oldEndpoints[key];
    const newOp = newEndpoints[key];

    if (oldOp && !newOp) {
      results.push({ key, method, path, status: 'removed', breaking: true, sections: [] });
      continue;
    }
    if (!oldOp && newOp) {
      results.push({ key, method, path, status: 'added', breaking: false, sections: [] });
      continue;
    }

    const bodyDiff = diffFields(getBodySchema(oldOp, oldSpec), getBodySchema(newOp, newSpec));
    const respDiff  = diffFields(getResponseSchema(oldOp, oldSpec), getResponseSchema(newOp, newSpec));
    const paramDiff = diffFields(getParams(oldOp, oldSpec), getParams(newOp, newSpec));

    const allDiffs = [...bodyDiff, ...respDiff, ...paramDiff];
    if (!allDiffs.length) continue;

    const breaking = allDiffs.some(r => r.breaking);
    results.push({
      key, method, path, status: 'changed', breaking,
      hasAdded:   allDiffs.some(r => r.type === 'added'),
      hasRemoved: allDiffs.some(r => r.type === 'removed'),
      hasChanged: allDiffs.some(r => r.type === 'changed'),
      sections: [
        { title: 'Request Body',  rows: bodyDiff  },
        { title: 'Response',      rows: respDiff  },
        { title: 'Parameters',    rows: paramDiff },
      ].filter(s => s.rows.length)
    });
  }

  const stats = {
    endpointsAdded:   results.filter(r => r.status === 'added').length,
    endpointsRemoved: results.filter(r => r.status === 'removed').length,
    endpointsChanged: results.filter(r => r.status === 'changed').length,
    breakingChanges:  results.filter(r => r.breaking).length,
    fieldsAdded:   0, fieldsRemoved: 0, fieldsChanged: 0,
  };
  results.forEach(r => (r.sections || []).forEach(s => s.rows.forEach(row => {
    if (row.type === 'added')   stats.fieldsAdded++;
    if (row.type === 'removed') stats.fieldsRemoved++;
    if (row.type === 'changed') stats.fieldsChanged++;
  })));

  return { endpoints: results, stats };
}

module.exports = { compareSpecs };
