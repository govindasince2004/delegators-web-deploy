import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

vi.mock('../server/workbenchTools', () => ({
  webFetch: vi.fn(async (url: string) => ({
    url,
    contentType: 'text/html',
    title: 'Fetched reference',
    text: 'Fetched source text about the uploaded reference.',
    provider: 'exa'
  }))
}));

import {
  extractPptxDesignProfile,
  extractPromptUrls,
  prepareReferencePack
} from '../server/references';

describe('Workbench reference ingestion', () => {
  it('extracts pasted links from the user prompt', () => {
    expect(extractPromptUrls('Use https://example.com/a and also https://example.org/report.')).toEqual([
      'https://example.com/a',
      'https://example.org/report'
    ]);
  });

  it('builds a reference pack from prompt URLs', async () => {
    const pack = await prepareReferencePack({
      brief: 'Create a report from https://example.com/source'
    });

    expect(pack?.markdown).toContain('Fetched source text');
    expect(pack?.references[0]?.extractor).toBe('exa-contents');
    expect(pack?.seedFiles.some((file) => file.path === 'references/reference-pack.md')).toBe(true);
  });

  it('extracts text from DOCX and PPTX zip XML files', async () => {
    const docx = new JSZip();
    docx.file('word/document.xml', '<w:t>Resume summary</w:t><w:t>Built with real data</w:t>');
    const pptx = new JSZip();
    pptx.file('ppt/slides/slide1.xml', '<a:t>Teaching AI</a:t><a:t>Workshop flow</a:t>');

    const pack = await prepareReferencePack({
      brief: 'Use these files',
      references: [
        {
          kind: 'file',
          name: 'resume.docx',
          dataBase64: (await docx.generateAsync({ type: 'nodebuffer' })).toString('base64')
        },
        {
          kind: 'file',
          name: 'deck.pptx',
          dataBase64: (await pptx.generateAsync({ type: 'nodebuffer' })).toString('base64')
        }
      ]
    });

    expect(pack?.markdown).toContain('Resume summary Built with real data');
    expect(pack?.markdown).toContain('Slide 1: Teaching AI Workshop flow');
  });

  it('extracts exact OOXML presentation theme, aspect, and layout rhythm', async () => {
    const pptx = new JSZip();
    pptx.file('ppt/presentation.xml', '<p:presentation><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/></p:presentation>');
    pptx.file('ppt/theme/theme1.xml', `
      <a:theme name="Northstar">
        <a:themeElements>
          <a:clrScheme name="Northstar colors">
            <a:dk1><a:srgbClr val="111827"/></a:dk1>
            <a:lt1><a:srgbClr val="F8FAFC"/></a:lt1>
            <a:accent1><a:srgbClr val="E85D3F"/></a:accent1>
            <a:accent2><a:srgbClr val="24594D"/></a:accent2>
          </a:clrScheme>
          <a:fontScheme name="Northstar fonts">
            <a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont>
            <a:minorFont><a:latin typeface="Aptos"/></a:minorFont>
          </a:fontScheme>
        </a:themeElements>
      </a:theme>
    `);
    pptx.file('ppt/slides/slide1.xml', '<p:sld><p:sp><a:t>One decisive statement</a:t></p:sp></p:sld>');
    pptx.file('ppt/slides/slide2.xml', '<p:sld><p:sp/><p:sp/><p:sp/><p:pic/><p:pic/></p:sld>');
    const buffer = await pptx.generateAsync({ type: 'nodebuffer' });

    const profile = await extractPptxDesignProfile(buffer, 'northstar.pptx');

    expect(profile).toMatchObject({
      sourceName: 'northstar.pptx',
      slideCount: 2,
      slideAspect: 'wide',
      themeName: 'Northstar',
      headingFontFamily: 'Aptos Display',
      bodyFontFamily: 'Aptos',
      usedColors: []
    });
    expect(profile.themeColors).toEqual(expect.arrayContaining(['111827', 'F8FAFC', 'E85D3F', '24594D']));
    expect(profile.layoutRhythm.map((slide) => slide.family)).toEqual(['statement', 'image']);
  });

  it('includes deterministic PPTX design evidence in the reference pack', async () => {
    const pptx = new JSZip();
    pptx.file('ppt/presentation.xml', '<p:presentation><p:sldSz cx="9144000" cy="6858000"/></p:presentation>');
    pptx.file('ppt/theme/theme1.xml', `
      <a:theme name="Editorial">
        <a:clrScheme name="Editorial"><a:dk1><a:srgbClr val="221D15"/></a:dk1><a:accent1><a:srgbClr val="B5562C"/></a:accent1></a:clrScheme>
        <a:fontScheme><a:majorFont><a:latin typeface="Georgia"/></a:majorFont><a:minorFont><a:latin typeface="Garamond"/></a:minorFont></a:fontScheme>
      </a:theme>
    `);
    pptx.file('ppt/slides/slide1.xml', '<p:sld><p:sp><a:t>Editorial review</a:t></p:sp></p:sld>');

    const pack = await prepareReferencePack({
      brief: 'Create another deck in the same style',
      references: [{
        kind: 'file',
        name: 'editorial.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        dataBase64: (await pptx.generateAsync({ type: 'nodebuffer' })).toString('base64')
      }]
    });

    expect(pack?.references[0]?.designProfile).toMatchObject({
      slideAspect: 'standard',
      headingFontFamily: 'Georgia',
      bodyFontFamily: 'Garamond',
      usedColors: []
    });
    expect(pack?.markdown).toContain('Presentation design profile');
    expect(pack?.markdown).toContain('Exact heading font from theme: Georgia');
  });

  it('extracts spreadsheet rows from XLSX references', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Budget');
    sheet.addRow(['Item', 'Amount']);
    sheet.addRow(['Research', 1200]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const pack = await prepareReferencePack({
      brief: 'Use this workbook',
      references: [{
        kind: 'file',
        name: 'budget.xlsx',
        dataBase64: buffer.toString('base64')
      }]
    });

    expect(pack?.markdown).toContain('# Sheet: Budget');
    expect(pack?.markdown).toContain('Research\t1200');
  });

  it('uses semantic gateway vision when an analyzer is supplied', async () => {
    const analyzeImage = vi.fn(async () => 'A product screenshot with a visible Save button.');
    const pack = await prepareReferencePack({
      brief: 'Use this screenshot',
      references: [{
        kind: 'file',
        name: 'screen.png',
        mimeType: 'image/png',
        dataBase64: Buffer.from('not-a-real-png').toString('base64')
      }],
      analyzeImage
    });

    expect(analyzeImage).toHaveBeenCalledOnce();
    expect(pack?.references[0]?.extractor).toBe('gateway-vision');
    expect(pack?.markdown).toContain('visible Save button');
  });

  it('prefers semantic gateway vision before OCR-only fallback analysis', async () => {
    const analyzeImage = vi.fn(async () => 'A three-column dashboard with a declining conversion chart.');
    const analyzeImageFallback = vi.fn(async () => 'OCR text: Conversion 12% 9% 7%');
    const pack = await prepareReferencePack({
      brief: 'Explain what this dashboard shows',
      references: [{
        kind: 'file',
        name: 'dashboard.png',
        mimeType: 'image/png',
        dataBase64: Buffer.from('not-a-real-png').toString('base64')
      }],
      analyzeImage,
      analyzeImageFallback
    });

    expect(analyzeImage).toHaveBeenCalledOnce();
    expect(analyzeImageFallback).not.toHaveBeenCalled();
    expect(pack?.references[0]?.extractor).toBe('gateway-vision');
    expect(pack?.markdown).toContain('declining conversion chart');
  });

  it('promotes uploaded PNG files into reusable artifact assets', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKAQMAAAC3/F3+AAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAAGUExURf8AAP///0EdNBEAAAABYktHRAH/Ai3eAAAAB3RJTUUH6gYOETEOKJXzJQAAAAtJREFUCNdjYMAHAAAeAAFuhUcyAAAAAElFTkSuQmCC',
      'base64'
    );
    const pack = await prepareReferencePack({
      brief: 'Use this uploaded visual',
      references: [{
        kind: 'file',
        name: 'launch.png',
        mimeType: 'image/png',
        dataBase64: png.toString('base64')
      }],
      analyzeImage: async () => 'A red launch visual.'
    });

    expect(pack?.assets).toHaveLength(1);
    expect(pack?.assets[0]).toMatchObject({
      id: 'REF1',
      attribution: 'User upload: launch.png'
    });
    expect(pack?.markdown).toContain('Reusable image asset: REF1');
  });
});
