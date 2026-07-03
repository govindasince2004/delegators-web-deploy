import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, LayoutTemplate, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { TemplatePreviewStage } from './TemplatePreviewStage';
import { resolveDesignPreset } from '../lib/designPresets';
import { getPeakArtifact } from '../lib/peakArtifacts/registry';

import {
  browseTemplates,
  buildCollectionFilterOptions,
  deckVerticalOptions,
  groupBrowseTemplates,
  resolveDeckVerticalId,
  resolveTemplateStyle,
  templateDesignSubtitle,
  templateStyleTabs,
  type TemplateSort,
  type TemplateStyleFilter
} from '../lib/templateBrowse';
import { collectionLabelForFormat, filterBrowseTemplates } from '../lib/templateCollections';
import {
  featuredWorkbenchTemplates,
  filterWorkbenchTemplates,
  resolveTemplateMetadata,
  templateAudienceTabs,
  templateFormatTabs,
  templateDisplayName,
  templateSourceLabel,
  workbenchTemplates,
  type TemplateAudience,
  type TemplateFormatFilter,
  type WorkbenchTemplate
} from '../lib/workbenchTemplates';

type TemplateGalleryProps = {
  open: boolean;
  onClose: () => void;
  onApplyTemplate: (template: WorkbenchTemplate) => void;
};

export function TemplateGallery({ open, onClose, onApplyTemplate }: TemplateGalleryProps) {
  const [format, setFormat] = useState<TemplateFormatFilter>('all');
  const [audience, setAudience] = useState<TemplateAudience | 'all'>('all');
  const [style, setStyle] = useState<TemplateStyleFilter>('all');
  const [collectionId, setCollectionId] = useState<string>('all');
  const [verticalId, setVerticalId] = useState<string>('hr');
  const [sort, setSort] = useState<TemplateSort>('featured');
  const [query, setQuery] = useState('');
  const [uniqueDesigns, setUniqueDesigns] = useState(true);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(workbenchTemplates[0]?.id ?? null);

  const filtered = useMemo(
    () => filterWorkbenchTemplates(workbenchTemplates, format, query, audience),
    [format, query, audience]
  );

  const browseBase = useMemo(
    () => filterBrowseTemplates(filtered, showAllStyles || Boolean(query.trim())),
    [filtered, showAllStyles, query]
  );

  const browseList = useMemo(
    () => browseTemplates(browseBase, {
      uniqueDesigns: uniqueDesigns && !query.trim(),
      style,
      collectionId,
      verticalId: format === 'deck' || format === 'all' ? verticalId : undefined,
      sort,
      allTemplates: workbenchTemplates
    }),
    [browseBase, uniqueDesigns, style, collectionId, verticalId, sort, format, query]
  );

  const collectionOptions = useMemo(
    () => buildCollectionFilterOptions(browseBase),
    [browseBase]
  );

  const featured = useMemo(
    () => featuredWorkbenchTemplates(browseList).filter((template) => template.peakArtifactId),
    [browseList]
  );
  const showFeatured = !query && format === 'all' && audience === 'all' && style === 'all' && collectionId === 'all' && !showAllStyles;
  const featuredIds = useMemo(
    () => new Set(featured.slice(0, 6).map((template) => template.id)),
    [featured]
  );

  const grouped = useMemo(() => {
    const list = showFeatured
      ? browseList.filter((template) => !featuredIds.has(template.id))
      : browseList;
    return groupBrowseTemplates(list);
  }, [browseList, featuredIds, showFeatured]);

  const selected = browseList.find((template) => template.id === selectedId)
    ?? browseList[0]
    ?? filtered[0]
    ?? workbenchTemplates[0]
    ?? null;

  const selectedMeta = useMemo(
    () => (selected ? resolveTemplateMetadata(selected) : null),
    [selected]
  );

  const curatedCount = useMemo(
    () => browseTemplates(filterBrowseTemplates(workbenchTemplates, false), { uniqueDesigns: true }).length,
    []
  );

  useEffect(() => {
    if (!open || !browseList.length) return;
    if (!browseList.some((template) => template.id === selectedId)) {
      setSelectedId(browseList[0].id);
    }
  }, [open, browseList, selectedId]);

  useEffect(() => {
    if (format !== 'deck' && format !== 'all') return;
    if (!selected) return;
    const resolved = resolveDeckVerticalId(selected);
    if (resolved && resolved !== verticalId) setVerticalId(resolved);
  }, [selected?.id, format, verticalId]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <>
          <motion.button
            type="button"
            className="template-gallery-scrim"
            aria-label="Close template gallery"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="template-gallery-shell"
            role="dialog"
            aria-modal="true"
            aria-label="Template gallery"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <header className="template-gallery-head">
              <div className="template-gallery-title">
                <LayoutTemplate size={18} aria-hidden="true" />
                <div>
                  <strong>Templates</strong>
                  <small>{browseList.length} ready · Microsoft & WPS libraries</small>
                </div>
              </div>
              <button type="button" className="quiet-icon" onClick={onClose} title="Close templates">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="template-gallery-body">
              <aside className="template-gallery-browse" aria-label="Browse templates">
                <label className="template-gallery-search" htmlFor="template-gallery-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    id="template-gallery-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search PPT Template 1, XLS, PDF…"
                  />
                </label>

                <div className="template-gallery-filters template-gallery-filters--compact">
                  <div className="template-gallery-filter-block template-gallery-filter-block--format">
                    <span className="template-gallery-filter-label">Category</span>
                    <div className="template-gallery-tabs template-gallery-format-tabs" role="tablist" aria-label="Template formats">
                      {templateFormatTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={format === tab.id}
                          className={format === tab.id ? 'active' : ''}
                          onClick={() => {
                            setFormat(tab.id);
                            setCollectionId('all');
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="template-gallery-filter-block template-gallery-filter-block--style">
                    <span className="template-gallery-filter-label">Library</span>
                    <div className="template-gallery-style-row" role="tablist" aria-label="Design libraries">
                      {templateStyleTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={style === tab.id}
                          className={`template-style-chip ${style === tab.id ? 'active' : ''}`}
                          onClick={() => setStyle(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <details className="template-gallery-advanced-filters">
                    <summary>More filters</summary>
                    <div className="template-gallery-advanced-body">
                      <div className="template-gallery-filter-row">
                        <label className="template-gallery-select-wrap">
                          <span>Collection</span>
                          <select
                            value={collectionId}
                            onChange={(event) => setCollectionId(event.target.value)}
                            aria-label="Filter by collection"
                          >
                            {collectionOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label} ({option.count})
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="template-gallery-select-wrap">
                          <span>Sort</span>
                          <select
                            value={sort}
                            onChange={(event) => setSort(event.target.value as TemplateSort)}
                            aria-label="Sort templates"
                          >
                            <option value="featured">Featured</option>
                            <option value="name">A → Z</option>
                            <option value="format">By format</option>
                          </select>
                        </label>
                      </div>

                      {(format === 'deck' || format === 'all') ? (
                        <div className="template-gallery-vertical-row" role="tablist" aria-label="Industry vertical">
                          <span className="template-gallery-vertical-label">Industry</span>
                          <div className="template-gallery-vertical-chips">
                            {deckVerticalOptions.map((vertical) => (
                              <button
                                key={vertical.id}
                                type="button"
                                role="tab"
                                aria-selected={verticalId === vertical.id}
                                className={`template-style-chip ${verticalId === vertical.id ? 'active' : ''}`}
                                onClick={() => setVerticalId(vertical.id)}
                              >
                                {vertical.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="template-gallery-filter-row">
                        <div className="template-gallery-tabs template-gallery-tabs-secondary" role="tablist" aria-label="Template audiences">
                          {templateAudienceTabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={audience === tab.id}
                              className={audience === tab.id ? 'active' : ''}
                              onClick={() => setAudience(tab.id)}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`template-style-toggle ${uniqueDesigns ? 'active' : ''}`}
                          onClick={() => setUniqueDesigns((value) => !value)}
                          title="Show one row per unique layout family"
                        >
                          {uniqueDesigns ? 'Unique layouts' : 'All variants'}
                        </button>
                        <button
                          type="button"
                          className={`template-style-toggle ${showAllStyles ? 'active' : ''}`}
                          onClick={() => setShowAllStyles((value) => !value)}
                        >
                          {showAllStyles ? `All ${workbenchTemplates.length}` : `Curated ${curatedCount}`}
                        </button>
                      </div>
                    </div>
                  </details>
                </div>

                <p className="template-gallery-collection-hint">
                  {collectionLabelForFormat(format)} · {browseList.length} results
                </p>

                <div className="template-gallery-list" role="list">
                  {browseList.length === 0 ? (
                    <p className="template-gallery-empty">No templates match those filters.</p>
                  ) : (
                    <>
                      {showFeatured ? (
                        <section className="template-gallery-group">
                          <h3 className="template-gallery-section-label">
                            <Sparkles size={12} aria-hidden="true" />
                            Featured designs
                          </h3>
                          <div className="template-gallery-group-items">
                            {featured.slice(0, 6).map((template) => (
                              <TemplateListItem
                                key={template.id}
                                template={template}
                                selected={selected?.id === template.id}
                                onSelect={() => setSelectedId(template.id)}
                              />
                            ))}
                          </div>
                        </section>
                      ) : null}

                      {grouped.map((group) => (
                        <section key={group.collection.id} className="template-gallery-group">
                          <h3 className="template-gallery-section-label">
                            {group.collection.label}
                            <span className="template-gallery-section-count">{group.templates.length}</span>
                          </h3>
                          <div className="template-gallery-group-items">
                            {group.templates.map((template) => (
                              <TemplateListItem
                                key={template.id}
                                template={template}
                                selected={selected?.id === template.id}
                                onSelect={() => setSelectedId(template.id)}
                              />
                            ))}
                          </div>
                        </section>
                      ))}
                    </>
                  )}
                </div>
              </aside>

              <section className="template-gallery-stage" aria-label="Template preview">
                {selected && selectedMeta ? (
                  <>
                    <div className="template-gallery-stage-header">
                      <div className="template-gallery-stage-heading">
                        <h2>{templateDisplayName(selected)}</h2>
                        <p className="template-visual-style">{selectedMeta.visualStyle ?? selected.category}</p>
                      </div>
                      <div className="template-gallery-preview-meta">
                        <span className="template-source-pill">{templateSourceLabel(selected.source)}</span>
                        <span className="template-tag-pill">{selected.format}</span>
                        <span className="template-tag-pill">{resolveTemplateStyle(selected)}</span>
                        {selected.designPreset ? (
                          <span className="template-tag-pill">{selected.designPreset}</span>
                        ) : null}
                      </div>
                    </div>
                    <TemplatePreviewStage template={selected} />
                    <div className="template-gallery-stage-footer">
                      <p className="template-gallery-stage-hint">
                        Pick a design on the left, preview it here, then load it into your workspace.
                      </p>
                      <div className="template-gallery-preview-actions template-gallery-preview-actions--primary">
                        <button
                          type="button"
                          className="template-apply-button template-apply-button--primary"
                          onClick={() => onApplyTemplate(selected)}
                        >
                          <LayoutTemplate size={14} aria-hidden="true" />
                          Use this template
                        </button>
                        <a
                          className="template-source-link"
                          href={selected.sourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <ExternalLink size={13} aria-hidden="true" />
                          {selected.source === 'kingsoft-wps' ? 'View on WPS gallery' : 'View on MS gallery'}
                        </a>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="template-gallery-stage-empty">
                    <LayoutTemplate size={28} aria-hidden="true" />
                    <p>Select a template on the left to preview its layout.</p>
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

const FORMAT_BADGES: Record<WorkbenchTemplate['format'], string> = {
  deck: 'PPT',
  report: 'PDF',
  sheet: 'XLS',
  resume: 'CV',
  email: 'Mail',
  assignment: 'Doc'
};

function templateListSubtitle(template: WorkbenchTemplate): string {
  const artifact = getPeakArtifact(template.peakArtifactId);
  if (artifact?.slides?.length) {
    return `${templateDesignSubtitle(template)} · ${artifact.slides.length} slides`;
  }
  if (artifact?.sections.length) {
    return `${templateDesignSubtitle(template)} · ${artifact.sections.length} sections`;
  }
  if (artifact?.sheet?.sheets.length) {
    const sheetCount = artifact.sheet.sheets.length;
    return `${templateDesignSubtitle(template)} · ${sheetCount} sheet${sheetCount === 1 ? '' : 's'}`;
  }
  return templateDesignSubtitle(template);
}

function TemplateListItem({
  template,
  selected,
  onSelect
}: {
  template: WorkbenchTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  const preset = resolveDesignPreset(template.designPreset, template.format);
  const accent = preset.palette.accent ?? '#52B3FF';
  const primary = preset.palette.primary ?? '#1e293b';
  const surface = preset.palette.surface ?? '#334155';
  const style = resolveTemplateStyle(template);

  return (
    <button
      type="button"
      role="listitem"
      aria-pressed={selected}
      className={`template-list-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      style={{
        '--template-accent': accent,
        '--template-primary': primary,
        '--template-surface': surface
      } as CSSProperties}
    >
      <span className="template-list-mini-preview" aria-hidden="true">
        <span className="template-list-mini-preview__canvas">
          <span className="template-list-mini-preview__block--hero" />
          <span className="template-list-mini-preview__block--side" />
          <span className="template-list-mini-preview__block--bar" />
        </span>
        <span className="template-list-mini-preview__badge">{FORMAT_BADGES[template.format]}</span>
      </span>
      <span className="template-list-copy">
        <strong>{templateDisplayName(template)}</strong>
        <small>{templateListSubtitle(template)}</small>
      </span>
      {selected ? <span className="template-list-selected-mark" aria-hidden="true" /> : null}
      {style !== 'all' ? <span className="template-list-style-tag">{style}</span> : null}
    </button>
  );
}