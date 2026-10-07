"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  assignedProjectIds, createPath, pathsSchema, searchAvailableProjects,
  type CatalogProject, type CommonCorePath, type Milestone, type MilestoneSettings as Settings,
} from "@/features/milestones/config";
import { updateMilestones } from "./milestone-actions";

const inputClass = "w-full border border-[var(--border)] bg-[var(--panel-elevated)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

export function MilestoneSettings({ initial, projects, syncedAt }: {
  initial: Settings; projects: CatalogProject[]; syncedAt: string | null;
}) {
  const [paths, setPaths] = useState(initial.paths);
  const [version, setVersion] = useState(initial.version);
  const [activeId, setActiveId] = useState(initial.paths[0].id);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([0]);
  const [pending, startTransition] = useTransition();
  const active = paths.find((path) => path.id === activeId) ?? paths[0];
  const assigned = useMemo(() => assignedProjectIds(active), [active]);
  const projectMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const controlId = useId();

  function changePaths(next: CommonCorePath[]) {
    setPaths(next);
    setDirty(true);
    setSaved(false);
    setError(undefined);
  }

  function changeMilestone(index: number, milestone: Milestone) {
    changePaths(paths.map((path) => path.id === active.id ? {
      ...path, milestones: path.milestones.map((m, i) => i === index ? milestone : m),
    } : path));
  }

  function addPath() {
    let number = paths.length + 1;
    while (paths.some((p) => p.name.toLowerCase() === `common core ${number}`)) number++;
    const path = createPath(crypto.randomUUID(), `Common core ${number}`);
    changePaths([...paths, path]);
    setActiveId(path.id);
  }

  function deletePath() {
    if (paths.length <= 1 || !window.confirm(`Delete "${active.name}" and its milestone assignments? Save settings to apply this deletion.`)) return;
    const next = paths.filter((p) => p.id !== active.id);
    changePaths(next);
    setActiveId(next[0].id);
  }

  function save() {
    const parsed = pathsSchema.safeParse(paths);
    if (!parsed.success) {
      const [pathIndex, , milestoneIndex] = parsed.error.issues[0].path;
      if (typeof pathIndex === "number" && paths[pathIndex]) setActiveId(paths[pathIndex].id);
      if (typeof milestoneIndex === "number") setExpanded((current) => [...new Set([...current, milestoneIndex])]);
      setError(parsed.error.issues[0].message);
      return;
    }
    startTransition(async () => {
      try {
        const result = await updateMilestones(parsed.data, version);
        if (result.error) { setError(result.error); return; }
        if (result.version !== undefined) {
          setVersion(result.version);
          setPaths(parsed.data);
          setDirty(false);
          setSaved(true);
          setError(undefined);
        }
      } catch {
        setError("Could not save milestone settings. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby={`${controlId}-heading`}>
      <h2 id={`${controlId}-heading`} className="text-sm uppercase tracking-[0.14em]">Milestone configuration</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Create common core paths for different curricula. Each path has milestones 0–6.
        Projects can appear once per path and can be reused in other paths.
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">
        {projects.filter((p) => p.available).length} available projects · Refreshed weekly
        {syncedAt ? ` · Last synced ${new Date(syncedAt).toISOString().slice(0, 16).replace("T", " ")} UTC` : " · Waiting for the first sync"}
      </p>
      {!syncedAt && <p className="mt-2 text-sm text-[var(--muted)]">The project catalog loads automatically when the server has 42 API credentials. Reload this page after the first sync to select projects.</p>}
      <fieldset disabled={pending} className="mt-4 flex min-w-0 flex-col gap-4 disabled:opacity-60">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-40 flex-1">
            <label htmlFor={`${controlId}-path`} className="mb-1 block text-xs text-[var(--muted)]">Common core path</label>
            <select id={`${controlId}-path`} value={active.id} onChange={(e) => setActiveId(e.target.value)} className={inputClass}>
              {paths.map((path) => <option key={path.id} value={path.id}>{path.name || "Unnamed path"}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={addPath} disabled={paths.length >= 50}><Plus className="h-4 w-4" />Add path</Button>
          <Button type="button" variant="ghost" onClick={deletePath} disabled={paths.length === 1} aria-label={`Delete ${active.name} path`} title={paths.length === 1 ? "Keep at least one common core path" : "Delete path"}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div>
          <label htmlFor={`${controlId}-name`} className="mb-1 block text-xs text-[var(--muted)]">Path name</label>
          <input id={`${controlId}-name`} className={inputClass} maxLength={100} value={active.name} placeholder="e.g. Old common core" onChange={(e) => changePaths(paths.map((p) => p.id === active.id ? { ...p, name: e.target.value } : p))} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--muted)]">{assigned.size} projects assigned · Complete all required projects and one from each group.</p>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded([0, 1, 2, 3, 4, 5, 6])}>Expand all</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded([])}>Collapse all</Button>
          </div>
        </div>
        <div key={active.id} className="flex flex-col gap-3">
          {active.milestones.map((milestone, index) => (
            <div key={index} className="min-w-0 rounded-md border border-[var(--border)]">
              <button type="button" aria-expanded={expanded.includes(index)} aria-controls={`${controlId}-milestone-${index}`} aria-label={`Milestone ${index}`}
                className="flex w-full items-center justify-between gap-3 rounded-md bg-[var(--panel-elevated)] p-4 text-left focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
                onClick={() => setExpanded((current) => current.includes(index) ? current.filter((i) => i !== index) : [...current, index])}>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Milestone {index}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">{milestone.required.length} required · {milestone.alternatives.length} choose-one groups</span>
                  <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                    {[...milestone.required.map((id) => projectMap.get(id)?.name ?? `#${id}`), ...milestone.alternatives.map((group) => `(${group.map((id) => projectMap.get(id)?.name ?? `#${id}`).join(" or ") || "Choose alternatives"})`)].join(", ") || "No projects assigned yet"}
                  </span>
                </span>
                <ChevronDown aria-hidden className={`h-4 w-4 shrink-0 transition-transform ${expanded.includes(index) ? "rotate-180" : ""}`} />
              </button>
              <div id={`${controlId}-milestone-${index}`} hidden={!expanded.includes(index)} className="border-t border-[var(--border)] p-4">
              <ProjectTags label={`Milestone ${index} required projects`} selected={milestone.required} projects={projects} projectMap={projectMap} assigned={assigned}
                onChange={(required) => changeMilestone(index, { ...milestone, required })} />
              {milestone.alternatives.map((group, groupIndex) => (
                <div key={groupIndex} className="mt-3 border-l-2 border-[var(--accent)] bg-[var(--panel-elevated)] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">Choose one · Group {groupIndex + 1}</span>
                    <Button type="button" variant="ghost" size="sm" aria-label={`Remove milestone ${index} group ${groupIndex + 1}`} onClick={() => changeMilestone(index, { ...milestone, alternatives: milestone.alternatives.filter((_, i) => i !== groupIndex) })}><X className="h-4 w-4" /></Button>
                  </div>
                  <ProjectTags label={`Milestone ${index} group ${groupIndex + 1} alternatives`} selected={group} projects={projects} projectMap={projectMap} assigned={assigned}
                    onChange={(selected) => changeMilestone(index, { ...milestone, alternatives: milestone.alternatives.map((g, i) => i === groupIndex ? selected : g) })} />
                  <p className="mt-2 text-xs text-[var(--muted)]">{group.length < 2 ? "Add at least two alternatives, e.g. Agentsmith and tree_nity." : "Completing any one of these projects satisfies this group."}</p>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="mt-2" disabled={milestone.alternatives.length >= 30} onClick={() => changeMilestone(index, { ...milestone, alternatives: [...milestone.alternatives, []] })}><Plus className="h-4 w-4" />Add choose-one group</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--panel)] p-3 shadow-lg">
          <Button type="button" variant="accent" onClick={save} disabled={!dirty || pending}>{pending ? "Saving…" : "Save milestone settings"}</Button>
          {dirty && <span className="text-xs text-[var(--muted)]">Unsaved changes across all paths</span>}
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-[var(--warning)]">{error}</p>}
      {saved && <p role="status" className="mt-3 text-sm text-[var(--accent)]">Milestone settings saved.</p>}
    </section>
  );
}

function ProjectTags({ label, selected, projects, projectMap, assigned, onChange }: {
  label: string; selected: number[]; projects: CatalogProject[]; projectMap: Map<number, CatalogProject>;
  assigned: Set<number>; onChange: (ids: number[]) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const matches = useMemo(() => searchAvailableProjects(projects, assigned, search), [projects, assigned, search]);
  const options = matches.slice(0, 30);
  const activeIndex = Math.min(highlight, Math.max(0, options.length - 1));

  function select(project: CatalogProject) {
    if (assigned.has(project.id)) return;
    onChange([...selected, project.id]);
    setSearch("");
    setHighlight(0);
  }

  return (
    <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <label htmlFor={id} className="mb-2 block text-xs text-[var(--muted)]">{label}</label>
      <div className="flex flex-wrap gap-1.5 border border-[var(--border)] bg-[var(--panel-elevated)] p-2 focus-within:border-[var(--accent)]">
        {selected.map((projectId) => {
          const project = projectMap.get(projectId);
          return <span key={projectId} className="inline-flex max-w-full items-center gap-1 border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-xs" title={project?.slug}>
            <span className="truncate">{project?.name ?? `Project #${projectId}`}{project && !project.available ? " (unavailable)" : ""}</span>
            <button type="button" aria-label={`Remove ${project?.name ?? projectId} from ${label}`} className="p-0.5 hover:text-[var(--warning)]" onClick={() => onChange(selected.filter((p) => p !== projectId))}><X className="h-3 w-3" /></button>
          </span>;
        })}
        <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && options[activeIndex] ? `${id}-${options[activeIndex].id}` : undefined}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none" value={search} placeholder="Search projects…"
          onFocus={() => setOpen(true)} onChange={(e) => { setSearch(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault(); setOpen(true);
              setHighlight(Math.max(0, Math.min(options.length - 1, activeIndex + (e.key === "ArrowDown" ? 1 : -1))));
            }
            if (e.key === "Enter") { e.preventDefault(); if (open && options[activeIndex]) select(options[activeIndex]); }
          }} />
      </div>
      {open && <div className="absolute z-20 mt-1 w-full border border-[var(--border)] bg-[var(--panel-elevated)] shadow-lg">
        <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`} className="max-h-56 overflow-y-auto">
          {options.map((project, index) => <li key={project.id} id={`${id}-${project.id}`} role="option" aria-selected={index === activeIndex}
            className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? "bg-[var(--panel)] text-[var(--accent)]" : ""}`}
            onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setHighlight(index)} onClick={() => select(project)}>
            <span className="block">{project.name}</span><span className="block text-xs text-[var(--muted)]">{project.slug} · #{project.id}</span>
          </li>)}
        </ul>
        {options.length === 0 && <p role="status" className="p-3 text-xs text-[var(--muted)]">No available projects match. Projects already assigned in this path are hidden.</p>}
        {matches.length > 30 && <p className="border-t border-[var(--border)] p-2 text-xs text-[var(--muted)]">Showing 30 of {matches.length} projects. Type to narrow the search.</p>}
      </div>}
    </div>
  );
}
