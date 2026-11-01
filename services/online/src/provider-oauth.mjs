import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fail, same } from "./domain.mjs";
const configuration = {
  google: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope:
      "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.owned",
  },
  microsoft: {
    authorize:
      "https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/organizations/oauth2/v2.0/token",
    scope: "offline_access https://graph.microsoft.com/Calendars.ReadWrite",
  },
};
export class ProviderOAuth {
  constructor({
    file,
    key,
    origin,
    clients,
    fetcher = fetch,
    now = () => Date.now(),
  }) {
    this.file = file;
    this.key = Buffer.from(key || "", "base64");
    if (this.key.length !== 32)
      throw new Error("Provider vault requires a private 32-byte base64 key.");
    this.origin = new URL(origin).origin;
    this.clients = clients;
    this.fetcher = fetcher;
    this.now = now;
    this.queue = Promise.resolve();
  }
  async exclusive(work) {
    const task = this.queue.catch(() => {}).then(work);
    this.queue = task;
    return task;
  }
  async load() {
    try {
      const bytes = await readFile(this.file),
        decipher = createDecipheriv(
          "aes-256-gcm",
          this.key,
          bytes.subarray(0, 12),
        );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString(),
      );
    } catch (error) {
      if (error.code === "ENOENT") return { accounts: {}, pending: {} };
      throw new Error("Provider vault could not be opened.");
    }
  }
  async save(data) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv),
      encrypted = Buffer.concat([
        cipher.update(JSON.stringify(data)),
        cipher.final(),
      ]);
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    await writeFile(
      this.file + ".tmp",
      Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
      { mode: 0o600 },
    );
    await rename(this.file + ".tmp", this.file);
  }
  provider(value) {
    if (
      !configuration[value] ||
      !this.clients[value]?.clientId ||
      !this.clients[value]?.clientSecret
    )
      fail(
        409,
        "Configure this provider’s web application registration first.",
      );
    return configuration[value];
  }
  async status() {
    return this.exclusive(async () => {
      const data = await this.load();
      return Object.keys(configuration).map((provider) => ({
        provider,
        configured:
          !!this.clients[provider]?.clientId &&
          !!this.clients[provider]?.clientSecret,
        connected: !!data.accounts[provider],
      }));
    });
  }
  async begin(provider) {
    return this.exclusive(async () => {
      const config = this.provider(provider),
        data = await this.load(),
        state = randomBytes(32).toString("base64url"),
        verifier = randomBytes(32).toString("base64url");
      for (const [id, value] of Object.entries(data.pending))
        if (value.expiresAt <= this.now()) delete data.pending[id];
      data.pending[state] = {
        provider,
        verifier,
        expiresAt: this.now() + 10 * 60000,
      };
      await this.save(data);
      const url = new URL(config.authorize);
      for (const [k, v] of Object.entries({
        client_id: this.clients[provider].clientId,
        redirect_uri: this.origin + "/oauth/" + provider + "/callback",
        response_type: "code",
        scope: config.scope,
        state,
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
      }))
        url.searchParams.set(k, v);
      if (provider === "google") {
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
      }
      return { url: url.href };
    });
  }
  async exchange(provider, body) {
    let response;
    try {
      response = await this.fetcher(this.provider(provider).token, {
        method: "POST",
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error("Provider authorization network request failed.");
    }
    if (!response.ok)
      fail(409, "Provider authorization was rejected. Reconnect this account.");
    const result = await response.json();
    if (
      typeof result.access_token !== "string" ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0
    )
      fail(502, "Invalid provider token response.");
    return result;
  }
  async callback(provider, query) {
    return this.exclusive(async () => {
      this.provider(provider);
      const data = await this.load(),
        pending = data.pending[query.state];
      if (
        !pending ||
        pending.provider !== provider ||
        pending.expiresAt <= this.now() ||
        typeof query.state !== "string" ||
        !same(
          query.state,
          Object.keys(data.pending).find((key) => key === query.state),
        )
      )
        fail(400, "Invalid or expired authorization state.");
      delete data.pending[query.state];
      await this.save(data);
      if (query.error) fail(400, "Provider authorization was cancelled.");
      if (
        typeof query.code !== "string" ||
        !query.code ||
        query.code.length > 4096
      )
        fail(400, "Missing authorization code.");
      const client = this.clients[provider],
        body = new URLSearchParams({
          grant_type: "authorization_code",
          client_id: client.clientId,
          client_secret: client.clientSecret,
          redirect_uri: this.origin + "/oauth/" + provider + "/callback",
          code: query.code,
          code_verifier: pending.verifier,
        });
      const result = await this.exchange(provider, body);
      if (typeof result.refresh_token !== "string")
        fail(
          409,
          "Offline calendar access was not granted. Reconnect and approve access.",
        );
      data.accounts[provider] = {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: this.now() + result.expires_in * 1000,
      };
      await this.save(data);
      return { connected: true };
    });
  }
  async access(provider) {
    return this.exclusive(async () => {
      this.provider(provider);
      const data = await this.load(),
        account = data.accounts[provider];
      if (!account) fail(409, "Connect the service calendar account.");
      if (account.expiresAt > this.now() + 60000) return account.accessToken;
      const client = this.clients[provider],
        body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: account.refreshToken,
          client_id: client.clientId,
          client_secret: client.clientSecret,
        });
      if (provider === "microsoft")
        body.set("scope", configuration[provider].scope);
      const result = await this.exchange(provider, body);
      account.accessToken = result.access_token;
      account.refreshToken = result.refresh_token || account.refreshToken;
      account.expiresAt = this.now() + result.expires_in * 1000;
      await this.save(data);
      return account.accessToken;
    });
  }
  async disconnect(provider) {
    return this.exclusive(async () => {
      this.provider(provider);
      const data = await this.load();
      delete data.accounts[provider];
      for (const [id, value] of Object.entries(data.pending))
        if (value.provider === provider) delete data.pending[id];
      await this.save(data);
      return { removedLocally: true };
    });
  }
}
