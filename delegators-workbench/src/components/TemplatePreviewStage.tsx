import { useMemo } from 'react';
import { ArtifactPreview } from './ArtifactPreview';
import { buildTemplatePreviewArtifact } from '../lib/templatePreviewArtifacts';
import type { WorkbenchTemplate } from '../lib/workbenchTemplates';

type TemplatePreviewStageProps = {
  template: WorkbenchTemplate;
};

const formatLabels: Record<string, string> = {
  deck: 'Presentation',
  report: 'Document',
  sheet: 'Spreadsheet',
  resume: 'Resume',
  email: 'Email',
  assignment: 'Assignment'
};

export function TemplatePreviewStage({ template }: TemplatePreviewStageProps) {
  const artifact = useMemo(() => buildTemplatePreviewArtifact(template), [template.id, template.peakArtifactId]);
  const formatLabel = formatLabels[template.format] ?? template.format;
  const slideCount = artifact?.slides?.length ?? 0;
  const sectionCount = artifact?.sections.length ?? 0;

  return (
    <div className="template-preview-stage">
      <div className="template-preview-stage-toolbar">
        <div className="template-preview-toolbar-left">
          <span className="template-preview-format-badge">{formatLabel}</span>
          {template.peakArtifactId ? (
            <span className="template-preview-live-label">Peak artifact</span>
          ) : (
            <span className="template-preview-live-label">Live render</span>
          )}
          {slideCount ? <span className="template-preview-peak-label">{slideCount} slides</span> : null}
          {!slideCount && sectionCount ? (
            <span className="template-preview-peak-label">{sectionCount} sections</span>
          ) : null}
        </div>
      </div>
      <div className="template-preview-scroll" role="region" aria-label={`${template.id} artifact preview`}>
        <div className="template-preview-canvas">
          <ArtifactPreview artifact={artifact} variant="template-gallery" />
        </div>
      </div>
    </div>
  );
}