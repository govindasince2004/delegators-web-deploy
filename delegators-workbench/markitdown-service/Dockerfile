FROM python:3.12-slim

# Microsoft MarkItDown with all optional converters (pdf, docx, pptx, xlsx/xls,
# html, csv, json, xml, zip, epub, images-metadata, audio metadata). Pinned to a
# minor range so rebuilds stay deterministic but pick up patch fixes.
RUN pip install --no-cache-dir "markitdown[all]>=0.1.2,<0.2" && \
    addgroup --system --gid 10002 markitdown && \
    adduser --system --uid 10002 --gid 10002 markitdown

WORKDIR /app
COPY server.py ./
USER markitdown
EXPOSE 8490
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys;sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8490/healthz',timeout=2).status==200 else 1)"
CMD ["python", "server.py"]
