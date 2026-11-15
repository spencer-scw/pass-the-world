import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken, type Me } from './api';
import { navigate, useRoute } from './router';
import { Home } from './pages/Home';
import { GamePage } from './pages/Game';
import { LinkDevice } from './pages/LinkDevice';
import { Join } from './pages/Join';
import { SignIn } from './pages/SignIn';

export function App() {
  const route = useRoute();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  const loadMe = useCallback(() => {
    if (!getToken()) return setMe(null);
    api<Me>('/me').then(setMe, () => setMe(null));
  }, []);

  // OAuth callback: the API redirects to #/auth?token=...
  useEffect(() => {
    if (route.path === '/auth') {
      const token = route.query.get('token');
      if (token) setToken(token);
      const next = sessionStorage.getItem('ptw.next') ?? '/';
      sessionStorage.removeItem('ptw.next');
      navigate(next);
    }
  }, [route]);

  useEffect(loadMe, [loadMe, route.path]);

  const signOut = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setMe(null);
    navigate('/');
  };

  let page: React.ReactNode;
  if (me === undefined || route.path === '/auth') page = <p className="muted">Loading…</p>;
  else if (!me) page = <SignIn onSignedIn={loadMe} />;
  else if (route.path.startsWith('/games/')) page = <GamePage id={route.path.split('/')[2]} me={me} />;
  else if (route.path.startsWith('/join/')) page = <Join code={route.path.split('/')[2]} />;
  else if (route.path === '/link') page = <LinkDevice initialCode={route.query.get('code') ?? ''} />;
  else page = <Home />;

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" width="60" height="60" />
          <span>Pass the World</span>
        </a>
        {me && (
          <div className="row">
            <span className="muted">{me.displayName}</span>
            <button className="link" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </header>
      <main>{page}</main>
    </>
  );
}
