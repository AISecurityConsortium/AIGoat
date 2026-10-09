import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FLOW_KINDS, NODE_STATUS, NOT_PRESENT } from '../../data/threatModeling/architecture';
import { SubHeading } from './labels';

const Swatch = ({ children, width = 44 }) => (
  <svg width={width} height="22" viewBox={`0 0 ${width} 22`} aria-hidden="true" focusable="false">{children}</svg>
);

const Item = ({ swatch, label, text }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
    <Box sx={{ flexShrink: 0, display: 'flex' }}>{swatch}</Box>
    <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}>
      <strong>{label}</strong>{text ? `: ${text}` : ''}
    </Typography>
  </Box>
);

const DiagramLegend = () => {
  const theme = useTheme();
  const stroke = theme.palette.custom?.border?.strong ?? theme.palette.divider;
  const muted = theme.palette.custom?.text?.muted ?? theme.palette.text.secondary;
  const warning = theme.palette.warning.main;
  const fill = theme.palette.custom?.surface?.elevated ?? theme.palette.background.paper;

  return (
    <Box data-testid="diagram-legend" sx={{ mt: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        <Box>
          <SubHeading>Component status</SubHeading>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Item
              label={NODE_STATUS.confirmed.label}
              text="solid border"
              swatch={<Swatch><rect x="2" y="3" width="40" height="16" rx="5" fill={fill} stroke={stroke} strokeWidth="1.6" /></Swatch>}
            />
            <Item
              label={NODE_STATUS.optional.label}
              text="dashed border and OPTIONAL tag"
              swatch={<Swatch><rect x="2" y="3" width="40" height="16" rx="5" fill={fill} stroke={muted} strokeWidth="1.6" strokeDasharray="6 3" /></Swatch>}
            />
            <Item
              label={NODE_STATUS.external.label}
              text="double border and EXTERNAL tag"
              swatch={(
                <Swatch>
                  <rect x="1" y="1" width="42" height="20" rx="7" fill="none" stroke={muted} strokeWidth="1" />
                  <rect x="4" y="4" width="36" height="14" rx="5" fill={fill} stroke={muted} strokeWidth="1.6" />
                </Swatch>
              )}
            />
            <Item
              label="Attack surface"
              text="triangle marker: accepts or renders attacker-influenced content"
              swatch={(
                <Swatch>
                  <polygon points="14,19 22,3 30,19" fill={warning} />
                  <text x="22" y="17" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1a1a1a">!</text>
                </Swatch>
              )}
            />
          </Box>
        </Box>
        <Box>
          <SubHeading>Data flows (arrow shows direction)</SubHeading>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {Object.entries(FLOW_KINDS).map(([key, kind]) => (
              <Item
                key={key}
                label={kind.label}
                swatch={<Swatch><line x1="2" y1="11" x2="40" y2="11" stroke={muted} strokeWidth="1.8" strokeDasharray={kind.dash} /></Swatch>}
              />
            ))}
          </Box>
        </Box>
        <Box>
          <SubHeading>Trust zones and boundaries</SubHeading>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Item
              label="Zone"
              text="rounded band with a label; trust changes between zones"
              swatch={<Swatch><rect x="2" y="3" width="40" height="16" rx="6" fill="none" stroke={stroke} strokeWidth="1.2" strokeDasharray="8 4" /></Swatch>}
            />
            <Item
              label="Diamond on a flow"
              text="the flow crosses a trust boundary"
              swatch={<Swatch><polygon points="22,4 29,11 22,18 15,11" fill={warning} /></Swatch>}
            />
            <Item
              label="Defense band"
              text="controls run inside each surface; not a separate service"
              swatch={<Swatch><rect x="2" y="5" width="40" height="12" rx="4" fill="none" stroke={warning} strokeWidth="1.3" strokeDasharray="6 4" /></Swatch>}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>
        <SubHeading>Not present in this repo (so not drawn)</SubHeading>
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, columnGap: 3 }} data-testid="not-present-list">
          {NOT_PRESENT.map((item) => (
            <Typography key={item.id} component="li" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
              <strong>{item.label}</strong>: {item.note}
            </Typography>
          ))}
        </Box>
        <Typography sx={{ fontSize: '0.8125rem', color: muted, mt: 1 }}>
          Omitted for readability: the shop and account REST routes also read and write SQLite; the defense pipeline writes telemetry rows to SQLite.
        </Typography>
      </Box>
    </Box>
  );
};

export default DiagramLegend;
