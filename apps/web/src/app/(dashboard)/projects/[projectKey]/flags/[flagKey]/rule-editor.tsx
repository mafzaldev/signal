'use client';

import type { AttributeClause, AttributeOperator, Rule, Variation } from '@signal/core';
import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon, XIcon } from '@/components/icons';
import { Select } from '@/components/select';
import { Button, cx, Input } from '@/components/ui';
import { NUMERIC_OPERATORS, parseClauseValues } from '@/lib/targeting';
import { ServeEditor } from './serve-editor';

const OPERATORS: { operator: AttributeOperator; is: string; isNot: string }[] = [
  { operator: 'in', is: 'is one of', isNot: 'is not one of' },
  { operator: 'contains', is: 'contains', isNot: 'does not contain' },
  { operator: 'startsWith', is: 'starts with', isNot: 'does not start with' },
  { operator: 'endsWith', is: 'ends with', isNot: 'does not end with' },
  { operator: 'lessThan', is: 'is less than', isNot: 'is not less than' },
  { operator: 'lessThanOrEqual', is: 'is at most', isNot: 'is not at most' },
  { operator: 'greaterThan', is: 'is greater than', isNot: 'is not greater than' },
  { operator: 'greaterThanOrEqual', is: 'is at least', isNot: 'is not at least' },
];

const COMMON_ATTRIBUTES = ['key', 'email', 'country', 'plan', 'role', 'version'];

function Connector({ children }: { children: string }) {
  return (
    <span className="text-xs font-medium w-10 shrink-0 pt-2 text-right text-signal-ink">
      {children}
    </span>
  );
}

function ClauseRow({
  clause,
  first,
  onChange,
  onRemove,
  canRemove,
}: {
  clause: AttributeClause;
  first: boolean;
  onChange: (clause: AttributeClause) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  // Raw text is kept separately so typing "1," isn't reformatted mid-edit.
  const [text, setText] = useState(clause.values.join(', '));
  const [error, setError] = useState<string>();

  function update(nextText: string, operator: AttributeOperator, negate: boolean) {
    setText(nextText);
    const parsed = parseClauseValues(nextText, operator);
    setError(parsed.error);
    onChange({ ...clause, operator, negate, values: parsed.error ? clause.values : parsed.values });
  }

  const numeric = NUMERIC_OPERATORS.includes(clause.operator);
  return (
    <div className="flex gap-3">
      <Connector>{first ? 'If' : 'And'}</Connector>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Attribute"
            placeholder="attribute"
            list="common-attributes"
            className="w-36 font-mono"
            value={clause.attribute}
            onChange={(e) => onChange({ ...clause, attribute: e.target.value })}
          />
          <Select
            label="Comparison"
            className="w-44"
            value={`${clause.operator}:${clause.negate ? 'not' : 'is'}`}
            onChange={(next) => {
              const [operator, mode] = next.split(':') as [AttributeOperator, string];
              update(text, operator, mode === 'not');
            }}
            options={OPERATORS.flatMap(({ operator, is, isNot }) => [
              { value: `${operator}:is`, label: is },
              { value: `${operator}:not`, label: isNot },
            ])}
          />
          <Input
            aria-label="Values"
            placeholder={numeric ? 'e.g. 18' : 'values, comma-separated'}
            className="min-w-40 flex-1"
            value={text}
            onChange={(e) => update(e.target.value, clause.operator, Boolean(clause.negate))}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="Remove condition"
          >
            <XIcon />
          </Button>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </div>
  );
}

export function RuleEditor({
  rule,
  index,
  count,
  variations,
  matched,
  onChange,
  onRemove,
  onMove,
}: {
  rule: Rule;
  index: number;
  count: number;
  variations: Variation[];
  /** The test user matched this rule. */
  matched?: boolean;
  onChange: (rule: Rule) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
}) {
  const setClauses = (clauses: Rule['clauses']) => onChange({ ...rule, clauses });

  return (
    <div
      className={cx(
        'rounded-lg border bg-surface transition-colors',
        matched ? 'border-signal ring-2 ring-signal/20' : 'border-rule',
      )}
    >
      <div className="flex items-center justify-between border-b border-rule py-1 pr-1 pl-4">
        <span className="text-xs font-medium flex items-center gap-2">
          Rule {String(index + 1).padStart(2, '0')}
          {matched && <span className="rounded bg-signal px-1.5 text-white">Matched</span>}
        </span>
        <div className="flex gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move up"
          >
            <ArrowUpIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            aria-label="Move down"
          >
            <ArrowDownIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Delete rule ${index + 1}`}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {rule.clauses.map((clause, i) => {
          const remove = () => setClauses(rule.clauses.filter((_, j) => j !== i));
          // Segment conditions get an editor with segment support; until then they're read-only.
          if (clause.operator === 'segmentMatch') {
            return (
              <div key={i} className="flex gap-3">
                <Connector>{i === 0 ? 'If' : 'And'}</Connector>
                <div className="flex items-center gap-2 text-[13px]">
                  {clause.negate ? 'Not in' : 'In'} segment{' '}
                  <code className="font-mono">{clause.values.join(', ')}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={remove}
                    aria-label="Remove condition"
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <ClauseRow
              // Remount when the list shrinks so each row's text matches its clause.
              key={`${i}-${rule.clauses.length}`}
              clause={clause}
              first={i === 0}
              canRemove={rule.clauses.length > 1}
              onChange={(next) => setClauses(rule.clauses.map((c, j) => (j === i ? next : c)))}
              onRemove={remove}
            />
          );
        })}
        <div className="pl-[3.25rem]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setClauses([...rule.clauses, { attribute: '', operator: 'in', values: [] }])
            }
          >
            <PlusIcon className="size-3.5" />
            Add condition
          </Button>
        </div>
        <div className="flex gap-3 border-t border-dashed border-rule-strong pt-3">
          <Connector>Then</Connector>
          <div className="min-w-0 flex-1">
            <ServeEditor
              label={`Rule ${index + 1}`}
              serve={rule.serve}
              variations={variations}
              onChange={(serve) => onChange({ ...rule, serve })}
            />
          </div>
        </div>
      </div>
      <datalist id="common-attributes">
        {COMMON_ATTRIBUTES.map((attribute) => (
          <option key={attribute} value={attribute} />
        ))}
      </datalist>
    </div>
  );
}
