import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Typography } from '@mui/material';
import InstallDesktopRounded from '@mui/icons-material/InstallDesktopRounded';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaControls({ running, busy }: { running: boolean; busy: boolean }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [cacheReady, setCacheReady] = useState(false);
  const [error, setError] = useState('');
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(e: unknown) { setError(e instanceof Error ? e.message : 'Не удалось подготовить офлайн-режим'); },
  });

  useEffect(() => {
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const complete = () => { setInstalled(true); setPrompt(null); setHelp(false); };
    let alive = true;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.ready.then(registration => {
        const expected = new URL(`${import.meta.env.BASE_URL}sw.js`, location.origin).href;
        if (alive && registration.active?.scriptURL === expected) setCacheReady(true);
      });
    }
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', complete);
    return () => {
      alive = false;
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', complete);
    };
  }, []);

  const install = async () => {
    if (!prompt) { setHelp(true); return; }
    try {
      await prompt.prompt();
      await prompt.userChoice;
      setPrompt(null);
    } catch {
      setPrompt(null);
      setHelp(true);
    }
  };

  return <>
    {!installed && <Button variant="outlined" startIcon={<InstallDesktopRounded />} onClick={() => { void install(); }}>Установить</Button>}
    <Dialog open={help} onClose={() => setHelp(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Гуй Му как приложение</DialogTitle>
      <DialogContent>
        <Typography>Откройте трекер в Chrome или Edge и выберите установку приложения в меню браузера или в адресной строке. Оно будет запускаться отдельным окном с собственной иконкой.</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Если кнопки установки нет, приложение может быть уже установлено или текущий браузер не предлагает установку. Во встроенном браузере используйте открытие во внешнем Chrome или Edge.</Typography>
        <Alert severity={offlineReady || cacheReady ? 'success' : 'info'} sx={{ mt: 2 }}>
          {offlineReady || cacheReady ? 'Офлайн-режим готов: после первого открытия приложение доступно без интернета.' : import.meta.env.PROD ? 'Офлайн-кэш подготавливается при первом открытии с интернетом.' : 'Офлайн-режим проверяется в production-сборке.'}
        </Alert>
        {error && <Alert severity="warning" sx={{ mt: 2 }}>Офлайн-режим пока недоступен. Попробуйте перезагрузить страницу с интернетом.</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Сессия и история остаются в этом браузере. Приложение нужно держать открытым для своевременного отображения событий.</Typography>
      </DialogContent>
      <DialogActions sx={{ p: 3 }}><Button onClick={() => setHelp(false)}>Понятно</Button></DialogActions>
    </Dialog>
    <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="info" action={<Button size="small" disabled={running || busy} onClick={() => { void updateServiceWorker(true); }}>Обновить</Button>}>
        {running ? 'Новая версия готова. Обновление доступно после остановки прохождения.' : 'Доступна новая версия приложения.'}
      </Alert>
    </Snackbar>
  </>;
}
