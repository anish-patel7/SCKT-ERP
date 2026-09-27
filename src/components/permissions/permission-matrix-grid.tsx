import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actionLabel } from "@/lib/access-control";
import {
  cellAriaLabel,
  groupPermissionIds,
  type MatrixCell,
  type MatrixGroup,
  type MatrixResource,
  type PermissionMatrixModel,
} from "@/lib/permission-matrix";
import { cn } from "@/lib/utils";

export type PermissionMatrixGridProps = {
  model: PermissionMatrixModel;
  granted: ReadonlySet<string>;
  /** Administrator: every permission shown checked and locked. */
  allGranted: boolean;
  editable: boolean;
  onChange: (ids: string[], granted: boolean) => void;
};

// One set of widths for every module section, so all columns align globally.
const RESOURCE_COL_REM = 15;
const ACTION_COL_REM = 5.75;
const SPECIAL_COL_REM = 18;

/** Groups containing user / role administration need confirmation before "Select all". */
const SENSITIVE_GROUPS = new Set(["System"]);

export function PermissionMatrixGrid(props: PermissionMatrixGridProps) {
  return (
    <>
      <DesktopMatrix {...props} />
      <MobileMatrix {...props} />
    </>
  );
}

function NotAvailable({ className }: { className?: string }) {
  return (
    <span
      className={cn("select-none text-muted-foreground/60", className)}
      title="This action does not exist for this resource"
    >
      —<span className="sr-only">Not available</span>
    </span>
  );
}

function PermissionCheckbox({
  resource,
  cell,
  props,
  id,
}: {
  resource: MatrixResource;
  cell: MatrixCell;
  props: PermissionMatrixGridProps;
  id?: string;
}) {
  const { granted, allGranted, editable, onChange } = props;
  return (
    <Checkbox
      id={id}
      checked={allGranted || granted.has(cell.permission.id)}
      disabled={!editable}
      aria-label={cellAriaLabel(resource, cell)}
      title={`${cell.permission.permission_code} — ${cell.permission.permission_name}`}
      className="size-[1.125rem]"
      onCheckedChange={(c) => onChange([cell.permission.id], c === true)}
    />
  );
}

function GroupBulkActions({
  group,
  props,
}: {
  group: MatrixGroup;
  props: PermissionMatrixGridProps;
}) {
  if (!props.editable) return null;
  const viewIds = groupPermissionIds(group, "read");
  const allIds = groupPermissionIds(group);
  const selectAll = () => {
    if (
      SENSITIVE_GROUPS.has(group.group) &&
      !confirm(
        `Grant every ${group.group} permission to this role, including user and role administration?`,
      )
    ) {
      return;
    }
    props.onChange(allIds, true);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {viewIds.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => props.onChange(viewIds, true)}
        >
          All VIEW
        </Button>
      )}
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={selectAll}>
        Select all
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs"
        onClick={() => props.onChange(allIds, false)}
      >
        Clear
      </Button>
    </div>
  );
}

function ResourceLabel({ resource }: { resource: MatrixResource }) {
  return (
    <>
      <div className="truncate font-medium text-foreground" title={resource.label}>
        {resource.label}
      </div>
      <div className="truncate font-mono text-[0.625rem] text-muted-foreground">
        {resource.module}
        {resource.replacedBy && ` · replaced by ${resource.replacedBy}`}
      </div>
    </>
  );
}

function SpecialChip({
  resource,
  cell,
  props,
}: {
  resource: MatrixResource;
  cell: MatrixCell;
  props: PermissionMatrixGridProps;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded border px-1.5 py-0.5 text-[0.625rem] font-semibold tracking-wide",
        cell.legacy
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-border bg-muted/40",
        !props.editable && "cursor-default",
      )}
      title={cell.permission.description ?? cell.permission.permission_name}
    >
      <PermissionCheckbox resource={resource} cell={cell} props={props} />
      {cell.label}
    </label>
  );
}

function DesktopMatrix(props: PermissionMatrixGridProps) {
  const { model } = props;
  const colCount = 1 + model.columns.length + (model.hasSpecial ? 1 : 0);
  const minWidth =
    RESOURCE_COL_REM +
    model.columns.length * ACTION_COL_REM +
    (model.hasSpecial ? SPECIAL_COL_REM : 0);

  return (
    <div className="relative hidden max-h-[calc(100vh-21rem)] min-h-64 overflow-auto rounded-md border border-border md:block">
      <table
        className="w-full table-fixed border-separate border-spacing-0 text-xs"
        style={{ minWidth: `${minWidth}rem` }}
      >
        <colgroup>
          <col />
          {model.columns.map((a) => (
            <col key={a} style={{ width: `${ACTION_COL_REM}rem` }} />
          ))}
          {model.hasSpecial && <col style={{ width: `${SPECIAL_COL_REM}rem` }} />}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 h-10 border-b border-r border-border bg-muted px-3 text-left font-semibold"
            >
              Resource / Function
            </th>
            {model.columns.map((a) => (
              <th
                key={a}
                scope="col"
                className="sticky top-0 z-20 h-10 whitespace-nowrap border-b border-border bg-muted px-1 text-center text-[0.6875rem] font-semibold tracking-wide"
              >
                {actionLabel(a)}
              </th>
            ))}
            {model.hasSpecial && (
              <th
                scope="col"
                className="sticky top-0 z-20 h-10 border-b border-l border-border bg-muted px-3 text-left text-[0.6875rem] font-semibold tracking-wide"
              >
                SPECIAL
              </th>
            )}
          </tr>
        </thead>
        {model.groups.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th
                colSpan={colCount}
                scope="colgroup"
                className="h-9 border-b border-border bg-muted/40 p-0 text-left"
              >
                {/* w-max + sticky keeps the heading and its bulk actions visible while scrolling sideways. */}
                <div className="sticky left-0 flex w-max items-center gap-3 px-3">
                  <span className="text-[0.8125rem] font-semibold">{group.group}</span>
                  <GroupBulkActions group={group} props={props} />
                </div>
              </th>
            </tr>
            {group.resources.map((resource) => (
              <tr key={resource.module} className="group/row">
                <th
                  scope="row"
                  className="sticky left-0 z-10 h-12 border-b border-r border-border bg-background px-3 text-left font-normal group-hover/row:bg-muted"
                >
                  <ResourceLabel resource={resource} />
                </th>
                {model.columns.map((a) => {
                  const cell = resource.standard.get(a);
                  return (
                    <td
                      key={a}
                      className="h-12 border-b border-border text-center align-middle group-hover/row:bg-muted/50"
                    >
                      <div className="flex items-center justify-center">
                        {cell ? (
                          <PermissionCheckbox resource={resource} cell={cell} props={props} />
                        ) : (
                          <NotAvailable />
                        )}
                      </div>
                    </td>
                  );
                })}
                {model.hasSpecial && (
                  <td className="h-12 border-b border-l border-border px-3 align-middle group-hover/row:bg-muted/50">
                    {resource.special.length ? (
                      <div className="flex flex-wrap gap-1 py-1">
                        {resource.special.map((cell) => (
                          <SpecialChip
                            key={cell.action}
                            resource={resource}
                            cell={cell}
                            props={props}
                          />
                        ))}
                      </div>
                    ) : (
                      <NotAvailable />
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function MobileMatrix(props: PermissionMatrixGridProps) {
  const { model } = props;
  return (
    <div className="space-y-4 md:hidden">
      {model.groups.map((group) => (
        <section key={group.group} aria-label={group.group} className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border pb-1">
            <h3 className="text-sm font-semibold">{group.group}</h3>
            <GroupBulkActions group={group} props={props} />
          </div>
          {group.resources.map((resource) => {
            const rows: {
              key: string;
              label: string;
              cell: MatrixCell | undefined;
            }[] = [
              ...model.columns.map((a) => ({
                key: a,
                label: actionLabel(a),
                cell: resource.standard.get(a),
              })),
              ...resource.special.map((c) => ({
                key: c.action,
                label: c.label,
                cell: c,
              })),
            ];
            return (
              <div key={resource.module} className="rounded-md border border-border">
                <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs">
                  <ResourceLabel resource={resource} />
                </div>
                <ul className="divide-y divide-border">
                  {rows.map(({ key, label, cell }) => {
                    const id = `pm-${resource.module}-${key}`;
                    return (
                      <li key={key} className="flex min-h-11 items-center justify-between px-3">
                        {cell ? (
                          <Fragment>
                            <label
                              htmlFor={id}
                              className={cn(
                                "flex-1 py-3 text-xs font-medium tracking-wide",
                                cell.legacy && "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {label}
                            </label>
                            <PermissionCheckbox
                              id={id}
                              resource={resource}
                              cell={cell}
                              props={props}
                            />
                          </Fragment>
                        ) : (
                          <Fragment>
                            <span className="flex-1 py-3 text-xs tracking-wide text-muted-foreground">
                              {label}
                            </span>
                            <NotAvailable className="pr-1" />
                          </Fragment>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
