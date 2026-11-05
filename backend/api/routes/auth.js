import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..', '..');
const viewsDir = path.join(projectRoot, 'frontend', 'views');

export function setupAuthRoutes(app, config) {
  app.get('/login', (req, res) => {
    if (req.session?.discordUser) return res.redirect('/dashboard');
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.oauthRedirectUri,
      response_type: 'code',
      scope: config.oauthScope,
      prompt: 'consent',
    });
    return res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/login?error=missing_code');

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.oauthRedirectUri,
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

      req.session.discordUser = {
        id: user.id,
        username: user.username,
        globalName: user.global_name ?? user.username,
        avatar: user.avatar,
        discriminator: user.discriminator,
      };
      req.session.userGuilds = managedGuilds;
      req.session.accessToken = tokenData.access_token;

      return res.redirect('/dashboard');
    } catch (error) {
      console.error('[oauth] Callback error:', error);
      return res.redirect('/login?error=callback_failed');
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('es_session');
      res.redirect('/');
    });
  });
}
