# Public access (anyone, anywhere)

The Neural Nexus API already reaches the public internet through the existing Cloudflare Tunnel (`api.neuralnexus.site` → `http://localhost:8124` in `~/.cloudflared/config.yml`). Minecraft cannot use that same pattern.

## What the companion `.env` stays

The companion still joins Fabric on the host:

```bash
MINECRAFT_SERVER_HOST=127.0.0.1
MINECRAFT_SERVER_PORT=25565
```

Players type the **public** address the game tunnel prints, never `127.0.0.1`.

## Publish Fabric (recommended: playit.gg)

[playit.gg](https://playit.gg) is the Cloudflare-shaped piece for this stack: the host agent dials out, so the router does not need inbound port forwards, and players get a hostname:port they paste into Multiplayer with no extra client software.

1. Start Fabric (`server/start.sh`) so port `25565` is listening.
2. On the host, install and run the playit agent (Linux: follow the current playit Linux install; then `playit`).
3. In the playit dashboard create:
   - a **Minecraft Java** / TCP tunnel to `127.0.0.1:25565`
   - a **UDP** tunnel to `127.0.0.1:24454` (Simple Voice Chat)
4. Copy the TCP address playit prints (hostname **and** port, for example `random-name.playit.gg:12345`).
5. After the first Fabric start, set Simple Voice Chat to the **UDP** address playit printed:

   `server/config/voicechat/voicechat-server.properties`

   ```properties
   voice_host=<udp-hostname-or-ip:port from playit>
   ```

   Restart Fabric so remote clients learn that voice address.

6. Send each player:
   - the two jars from `mods/` (Fabric API + Simple Voice Chat **2.5.28**)
   - the playit **TCP** address and port



## Other public TCP options

- Router port forward: TCP `25565` and UDP `24454` on a public IP or dynamic DNS name. Set `voice_host` to that public host.
- ngrok (or similar) TCP tunnels: same idea as playit; you still need a **separate UDP** path for voice.
- Paid Cloudflare Spectrum for Minecraft TCP: join can work; Simple Voice Chat UDP is still not this HTTP tunnel.

## What a player does

See `docs/KID.md`. Install the jars, Multiplayer, paste the public `hostname:port`. Hold **V**.

This server is `online-mode=false`. Anyone who has the public address can join under any name. Share the address with people you intend to play with; do not post it as an open world listing.
