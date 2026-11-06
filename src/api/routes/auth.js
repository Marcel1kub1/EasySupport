export function setupRoutes(app, deps) {
  const { config } = deps;
  const { clientId, clientSecret, oauthRedirectUri, oauthScope } = config;

  app.get('/login', (_req, res) => {
    if (_req.session?.discordUser) return res.redirect('/dashboard');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: oauthRedirectUri,
      response_type: 'code',
      scope: oauthScope,
      prompt: 'consent',
    });
    return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get('/auth/callback', async (_req, res) => {
    const code = _req.query.code;
    if (!code) return res.redirect('/login?error=missing_code');

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: oauthRedirectUri,
        }),
      });
      if (!tokenResponse.ok) throw new Error('Token exchange failed');
      const tokenData = await tokenResponse.json();

      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
      });
      if (!userResponse.ok) throw new Error('Failed to fetch user');
      const user = await userResponse.json();

      const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
      });
      const guilds = guildsResponse.ok ? (await guildsResponse.json()) : [];

      const managedGuilds = guilds.filter(
        (g) => g.owner || (g.permissions & 0x20) !== 0
      );

      _req.session.discordUser = {
        id: user.id,
        username: user.username,
        globalName: user.global_name ?? user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
      };
      _req.session.userGuilds = managedGuilds;
      _req.session.accessToken = tokenData.access_token;

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('[oauth] Callback error:', error);
      return res.redirect('/login?error=callback_failed');
    }
  });

  app.get('/logout', (_req, res) => {
    _req.session.destroy(() => {
      res.clearCookie('es_session');
      res.redirect('/');
    });
  });
}

export default { setupRoutes };
