import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, MenuItem, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { chipSx, inset, meta, mono } from '../common/panelStyles';
import { downloadPdf, errorText, getAttachment } from './api';
import { fmtDateTime } from './styles';

const MAX_BYTES = 256 * 1024;

/** Side-by-side proof: what a person reads, and what the ingestion pipeline extracts. */
export const AttachmentEvidence = ({ attachmentId, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!attachmentId) return undefined;
    let cancelled = false;
    setData(null);
    setError('');
    getAttachment(attachmentId)
      .then((result) => { if (!cancelled) setData(result); })
      .catch((e) => { if (!cancelled) setError(errorText(e, 'Could not load the evidence.')); });
    return () => { cancelled = true; };
  }, [attachmentId]);
  const close = onClose;
  return (
    <Dialog open={Boolean(attachmentId)} onClose={close} maxWidth="md" fullWidth aria-labelledby="kc-evidence-title">
      <DialogTitle id="kc-evidence-title">
        {data ? `Attachment evidence: ${data.filename}` : 'Attachment evidence'}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && <Typography sx={meta}>Loading</Typography>}
        {data && (
          <Box sx={{ display: 'grid', gap: 1.5 }}>
            <Alert severity="warning" icon={false} sx={{ fontSize: '0.82rem' }}>
              {data.summary.explanation}
              {' '}
              {`This file has ${data.summary.visible_runs} visible text runs and ${data.summary.hidden_runs} hidden runs.`}
            </Alert>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Box sx={{ ...inset, p: 1.25, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>What a person sees</Typography>
                <Box component="pre" sx={{ ...mono, fontSize: '0.74rem', m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {data.visible_text || '(nothing)'}
                </Box>
              </Box>
              <Box sx={{ ...inset, p: 1.25, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>What ingestion extracts</Typography>
                <Box component="pre" sx={{ ...mono, fontSize: '0.74rem', m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {data.extracted_text || '(nothing)'}
                </Box>
              </Box>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5 }}>Hidden text runs</Typography>
              {data.spans.filter((s) => s.hidden).length === 0 && (
                <Typography sx={meta}>No run is hidden. This file would write nothing to memory.</Typography>
              )}
              {data.spans.filter((s) => s.hidden).map((span, index) => (
                <Box
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  sx={{
                    ...inset, p: 1, mb: 0.75,
                    borderColor: (t) => alpha(t.palette.warning.main, 0.5),
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
                    <Chip label={span.reason} size="small" color="warning" variant="outlined" sx={chipSx} />
                    <Chip label={`colour ${span.color}`} size="small" variant="outlined" sx={chipSx} />
                    <Chip label={`${span.size} pt`} size="small" variant="outlined" sx={chipSx} />
                    <Chip label={`page ${span.page}`} size="small" variant="outlined" sx={chipSx} />
                  </Box>
                  <Typography sx={{ ...mono, fontSize: '0.74rem', wordBreak: 'break-word' }}>{span.text}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ ...meta, ...mono }}>{`sha256 ${data.sha256}`}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close} sx={{ textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Scenario 2. A normal ticket form with an attachment control. The real uploaded PDF goes through
 * the same ingestion pipeline as a review.
 */
const TicketSource = ({
  state, busy, onCreate, onAttach, onNotice,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [target, setTarget] = useState('');
  const [attachFile, setAttachFile] = useState(null);
  const [evidence, setEvidence] = useState(0);
  const disabled = Boolean(busy);
  const open = state.tickets.filter((t) => !t.attachment);
  const attached = state.tickets.filter((t) => t.attachment);

  const pick = (setter) => (event) => {
    const chosen = event.target.files?.[0] || null;
    if (chosen && chosen.size > MAX_BYTES) {
      onNotice({ severity: 'error', message: `The file is larger than ${MAX_BYTES / 1024} KB.` });
      event.target.value = '';
      setter(null);
      return;
    }
    setter(chosen);
  };

  const create = async (event) => {
    event.preventDefault();
    const form = new FormData();
    form.append('subject', subject.trim());
    form.append('body', body.trim());
    if (file) form.append('file', file);
    const result = await onCreate(form);
    if (result) {
      setSubject('');
      setBody('');
      setFile(null);
      const input = document.getElementById('kc-ticket-file');
      if (input) input.value = '';
    }
  };

  const attach = async () => {
    const form = new FormData();
    form.append('file', attachFile);
    const result = await onAttach(target, form);
    if (result) {
      setAttachFile(null);
      setTarget('');
    }
  };

  const fixture = async () => {
    try {
      await downloadPdf('/fixtures/invoice.pdf', 'invoice_INV-2041.pdf');
    } catch (e) {
      onNotice({ severity: 'error', message: errorText(e, 'Could not download the sample invoice.') });
    }
  };

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Typography sx={meta}>
        Create a support ticket and attach a PDF, or attach one to an existing ticket. The sample invoice looks ordinary but carries white 7 pt text.
        {' '}
        <Link component="button" type="button" onClick={fixture} sx={{ fontSize: 'inherit', verticalAlign: 'baseline' }}>
          Download the sample invoice
        </Link>
        {' '}
        to inspect it, then upload it here.
      </Typography>
      <Box component="form" onSubmit={create} aria-label="Create a support ticket" sx={{ display: 'grid', gap: 1.25 }}>
        <TextField size="small" label="Ticket subject" value={subject} onChange={(e) => setSubject(e.target.value)} inputProps={{ maxLength: 200 }} required />
        <TextField size="small" label="Message" value={body} onChange={(e) => setBody(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 2000 }} required />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button component="label" size="small" variant="outlined" startIcon={<AttachFileIcon />} sx={{ textTransform: 'none' }}>
            {file ? file.name : 'Attach a PDF'}
            <input id="kc-ticket-file" type="file" accept="application/pdf,.pdf" hidden onChange={pick(setFile)} />
          </Button>
          <Button type="submit" variant="contained" size="small" disabled={disabled || !subject.trim() || !body.trim()} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Create ticket
          </Button>
          <Typography sx={meta}>PDF only, up to 256 KB.</Typography>
        </Box>
      </Box>

      <Box sx={{ ...inset, p: 1.25, display: 'grid', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Attach to an existing ticket</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField select size="small" label="Ticket" value={target} onChange={(e) => setTarget(e.target.value)} sx={{ flex: '1 1 220px' }}>
            {open.map((t) => (
              <MenuItem key={t.id} value={t.id}>{`#${t.id} ${t.subject}`}</MenuItem>
            ))}
          </TextField>
          <Button component="label" size="small" variant="outlined" startIcon={<AttachFileIcon />} sx={{ textTransform: 'none' }}>
            {attachFile ? attachFile.name : 'Choose PDF'}
            <input type="file" accept="application/pdf,.pdf" hidden onChange={pick(setAttachFile)} />
          </Button>
          <Button size="small" variant="contained" disabled={disabled || !target || !attachFile} onClick={attach} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Upload
          </Button>
        </Box>
      </Box>

      <Box sx={{ ...inset, p: 1.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>Tickets with attachments</Typography>
        {attached.length === 0 && <Typography sx={meta}>None yet. An uploaded PDF appears here with its evidence.</Typography>}
        {attached.map((ticket) => (
          <Box key={ticket.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', py: 0.5 }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{`#${ticket.id} ${ticket.subject}`}</Typography>
            <Typography sx={meta}>{`${ticket.attachment.filename}, ${fmtDateTime(ticket.created_at)}`}</Typography>
            {ticket.attachment.hidden_runs > 0 && (
              <Chip label={`${ticket.attachment.hidden_runs} hidden runs`} size="small" color="warning" variant="outlined" sx={chipSx} />
            )}
            <Button size="small" onClick={() => setEvidence(ticket.attachment.id)} sx={{ textTransform: 'none', ml: 'auto' }}>
              Inspect evidence
            </Button>
          </Box>
        ))}
      </Box>
      <AttachmentEvidence attachmentId={evidence} onClose={() => setEvidence(0)} />
    </Box>
  );
};

export default TicketSource;
