'use client';

import type { AttributeClause, AttributeOperator, Rule, Variation } from '@feature-flags/core';
import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { OPERATOR_LABELS, parseClauseValues } from '@/lib/targeting';
import { ServeEditor } from './serve-editor';

function ClauseRow({
  clause,
  onChange,
  onRemove,
}: {
  clause: AttributeClause;
  onChange: (clause: AttributeClause) => void;
  onRemove: () => void;
}) {
  // Raw text is kept separately so typing "1," isn't reformatted mid-edit.
  const [text, setText] = useState(clause.values.join(', '));
  const [error, setError] = useState<string>();

  function update(nextText: string, operator: AttributeOperator) {
    setText(nextText);
    const parsed = parseClauseValues(nextText, operator);
    setError(parsed.error);
    onChange({ ...clause, operator, values: parsed.error ? clause.values : parsed.values });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Attribute"
          placeholder="attribute, e.g. country"
          className="w-44"
          value={clause.attribute}
          onChange={(e) => onChange({ ...clause, attribute: e.target.value })}
        />
        <Select
          aria-label="Negate"
          className="w-auto"
          value={clause.negate ? 'not' : 'is'}
          onChange={(e) => onChange({ ...clause, negate: e.target.value === 'not' })}
        >
          <option value="is">matches</option>
          <option value="not">does not match</option>
        </Select>
        <Select
          aria-label="Operator"
          className="w-auto"
          value={clause.operator}
          onChange={(e) => update(text, e.target.value as AttributeOperator)}
        >
          {Object.entries(OPERATOR_LABELS).map(([operator, label]) => (
            <option key={operator} value={operator}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Values"
          placeholder="values, comma-separated"
          className="min-w-48 flex-1"
          value={text}
          onChange={(e) => update(e.target.value, clause.operator)}
        />
        <Button variant="ghost" onClick={onRemove} aria-label="Remove condition">
          ✕
        </Button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function RuleEditor({
  rule,
  index,
  count,
  variations,
  onChange,
  onRemove,
  onMove,
}: {
  rule: Rule;
  index: number;
  count: number;
  variations: Variation[];
  onChange: (rule: Rule) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-zinc-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Rule {index + 1}</span>
        <div className="flex gap-1">
          <Button variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button variant="ghost" disabled={index === count - 1} onClick={() => onMove(1)}>
            ↓
          </Button>
          <Button variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>
      <p className="text-xs text-zinc-500">If every condition matches:</p>
      {rule.clauses.map((clause, i) => {
        const remove = () => onChange({ ...rule, clauses: rule.clauses.filter((_, j) => j !== i) });
        // Segment conditions get an editor with segment support; until then they're read-only.
        if (clause.operator === 'segmentMatch') {
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span>
                {clause.negate ? 'Not in' : 'In'} segment {clause.values.join(', ')}
              </span>
              <Button variant="ghost" onClick={remove} aria-label="Remove condition">
                ✕
              </Button>
            </div>
          );
        }
        return (
          <ClauseRow
            // Remount when the list shrinks so each row's text matches its clause.
            key={`${i}-${rule.clauses.length}`}
            clause={clause}
            onChange={(next) =>
              onChange({ ...rule, clauses: rule.clauses.map((c, j) => (j === i ? next : c)) })
            }
            onRemove={remove}
          />
        );
      })}
      <Button
        variant="secondary"
        onClick={() =>
          onChange({
            ...rule,
            clauses: [...rule.clauses, { attribute: '', operator: 'in', values: [] }],
          })
        }
      >
        + Condition
      </Button>
      <ServeEditor
        label={`Rule ${index + 1}`}
        serve={rule.serve}
        variations={variations}
        onChange={(serve) => onChange({ ...rule, serve })}
      />
    </div>
  );
}
