import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#c5e99b', contrastText: '#172016' },
    background: { default: '#101411', paper: '#191e1a' },
    text: { primary: '#f0f3ed', secondary: '#98a397' },
    divider: '#2b332c',
    success: { main: '#a8d58c' },
    warning: { main: '#e6bb72' },
    error: { main: '#ee958b' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", "Arial", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
    h4: { fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-.04em' },
    h5: { fontWeight: 600, letterSpacing: '-.025em' },
    h6: { fontSize: '1.05rem', fontWeight: 600 },
    body2: { fontSize: '.85rem', lineHeight: 1.6 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 42, paddingInline: 18 }, outlined: { borderColor: '#39443a', color: '#e0e6dc' } } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: { styleOverrides: { paper: { border: '1px solid #354036', backgroundColor: '#191e1a' } } },
    MuiChip: { styleOverrides: { root: { fontSize: '.72rem', fontWeight: 500 } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4, backgroundColor: '#303a2b', height: 6 }, bar: { borderRadius: 4, transition: 'none' } } },
    MuiTooltip: { defaultProps: { arrow: true } },
  },
});
