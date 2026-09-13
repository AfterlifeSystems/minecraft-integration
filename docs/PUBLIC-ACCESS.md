# Public access (anyone, anywhere)

The Neural Nexus API already reaches the public internet through the existing Cloudflare Tunnel (`api.neuralnexus.site` → `http://localhost:8124` in `~/.cloudflared/config.yml`). Minecraft cannot use that same pattern.

This file is operator documentation. Compose does **not** start ngrok on a normal `up`, and it does **not** change the home router.

To start the inert ngrok TCP tunnel: put `NGROK_AUTHTOKEN` in `.env`, then `docker compose --profile ngrok up ngrok`. Or on the host: `ngrok tcp 25565`. Full steps are under **ngrok** below.

## What the companion `.env` stays

The companion still joins Fabric on the host:

```bash
MINECRAFT_SERVER_HOST=127.0.0.1
MINECRAFT_SERVER_PORT=25565
```

Players type the **public** address you send them, never `127.0.0.1` and never `fabric-server`.

Java edition join is **TCP `25565`**. Simple Voice Chat is **UDP `24454`**. The player pastes only the TCP `hostname:port`. Voice uses whatever you set in `VOICE_HOST`.

This server is `online-mode=false`. Anyone who has the public address can join under any name. Share it with people you intend to play with. Do not post it as an open world listing.

## Choose a path

| Path | Join (TCP) | Voice (UDP) | Player installs | This repo starts it |
|---|---|---|---|---|
| Same LAN | LAN IPv4 `:25565` | Set `VOICE_HOST` to that IPv4 | Nothing | No |
| Home router port forward | WAN IPv4 `:25565` | Set `VOICE_HOST` to the WAN IPv4 | Nothing | No |
| [playit.gg](https://playit.gg) | playit TCP host:port | playit UDP host:port in `VOICE_HOST` | Nothing | Only if you added a `playit` service |
| ngrok | ngrok TCP host:port | **Not ngrok.** Use a home UDP forward, IPv6, playit, or a VPN | Nothing | Only with `--profile ngrok` |
| Public VPS (EC2) | Instance IPv4 `:25565` | Set `VOICE_HOST` to that IPv4 | Nothing | No |

Prefer LAN, then a home port forward, then a VPS. Use playit when you stay behind NAT or CGNAT and do not want inbound ports. Use ngrok only when you need a quick TCP join and can live without voice, or you already have a separate UDP path.

## Same LAN

Players type the host LAN IPv4, for example `192.168.1.250:25565`. Set `VOICE_HOST` to that IPv4. Recreate Fabric after you change `VOICE_HOST` (see below).

## Home router port forward

This is the local path: no playit, no ngrok. The home gateway maps two public ports onto this machine. Compose already publishes `25565/tcp` and `24454/udp` (and `24454/tcp` for the Simple Voice Chat handshake).

### 1. Confirm Fabric is listening

```bash
docker compose up
ss -lntu | grep -E '25565|24454'
```

You want TCP `25565` and UDP `24454` on `0.0.0.0` and/or `[::]`.

### 2. Write down the two IPv4 addresses

On the host:

```bash
# LAN IPv4 of this PC (the router target). Ignore docker0 / 172.x bridges.
ip -4 addr show scope global
```

Public WAN IPv4 (what a remote laptop uses):

```bash
curl -4 -s https://ifconfig.co/ip
```

If the LAN address is `192.168.x.x` or `10.x.x.x` and the WAN address is different, you are behind NAT. That is normal. The forward lives on the **router**, not in this repo.

If `curl` returns a `100.64.x.x` / `100.127.x.x` address, the ISP is using CGNAT. A home forward will not reach you from the internet. Use playit, a VPS, or a VPN instead.

### 3. Create two forwards on the gateway

Open the router admin page (often `192.168.1.254` or `192.168.1.1`). Look for **Port Forwarding**, **NAT**, **Virtual Server**, or **Firewall**.

| Name | Protocol | WAN port | LAN IP | LAN port |
|---|---|---|---|---|
| Minecraft Java | TCP | `25565` | this PC’s LAN IPv4 | `25565` |
| Simple Voice Chat | UDP | `24454` | this PC’s LAN IPv4 | `24454` |

Some gateways also want TCP `24454` for the voice handshake. If voice fails after UDP is open, add that third rule.

Give this PC a reserved DHCP lease or a static LAN IPv4 so the forwards do not follow the wrong device after a reboot.

If the gateway has a separate **IPv6 firewall**, allow inbound TCP `25565` and UDP `24454` to this host if you want players to use IPv6. A remote Minecraft client pastes IPv6 as `[2001:db8::1]:25565`.

### 4. Point voice at the WAN address

In `.env` on the host:

```bash
VOICE_HOST=<WAN IPv4 from curl>
```

Example: `VOICE_HOST=203.0.113.10`. Do not set `VOICE_HOST=fabric-server`. Do not set it to `127.0.0.1`.

Compose writes that value into Simple Voice Chat on Fabric start. Recreate the server so clients learn the new host:

```bash
docker compose up -d --force-recreate --no-deps fabric-server
```

On a native (non-Docker) install, set the same value in `server/config/voicechat/voicechat-server.properties`:

```properties
voice_host=<WAN IPv4>
```

Then restart Fabric.

### 5. Send the player

- the two jars from `mods/` (Fabric API + Simple Voice Chat **2.5.28**)
- `WAN_IPV4:25565` for Multiplayer

They do not type the UDP address. Test from a phone hotspot, not from the same Wi‑Fi. A laptop on the LAN can still use `LAN_IPV4:25565`.

## playit.gg

[playit.gg](https://playit.gg) is a paid-leaning NAT bypass: the host agent dials out, and players paste a hostname. [Premium is $3/month](https://playit.gg/pricing). The free game list includes Minecraft Java and Simple Voice Chat, but extra tunnel types, HTTPS, and custom domains require Premium. Use it only when you stay behind NAT and do not want a VPN client or inbound ports.

1. Start Fabric (`server/start.sh` or `docker compose up`) so port `25565` is listening.
2. On the host, install and run the playit agent (Linux: follow the current playit Linux install; then `playit`).
3. In the playit dashboard create:
   - a **Minecraft Java** / TCP tunnel to `127.0.0.1:25565`
   - a **UDP** tunnel to `127.0.0.1:24454` (Simple Voice Chat)
4. Copy the TCP address playit prints (hostname **and** port, for example `random-name.playit.gg:12345`).
5. After the first Fabric start, set Simple Voice Chat to the **UDP** address playit printed (`VOICE_HOST` in `.env`, or `voice_host` in `server/config/voicechat/voicechat-server.properties`). Recreate or restart Fabric.
6. Send each player the two jars and the playit **TCP** address and port.

Verify the playit account email. An unverified account shows the agent as not connected and loads zero tunnels.

## ngrok (TCP join only) (for the minecraft server; port forwarding is for the UDP voice connection)

Official Minecraft notes: [Using ngrok with Minecraft](https://ngrok.com/docs/using-ngrok-with/minecraft).

The `ngrok` service in `docker-compose.yml` is **inert**. Plain `docker compose up` does not start it. It is behind Compose profile `ngrok`.

### Start the tunnel

**A. Opt-in Compose service** (code is in `docker-compose.yml`, off until you pass the profile):

```bash
# .env
NGROK_AUTHTOKEN=

# token: https://dashboard.ngrok.com/get-started/your-authtoken
# Free TCP also needs a card on file: https://dashboard.ngrok.com/settings

docker compose up          # Fabric + companion only; ngrok stays down
docker compose --profile ngrok up ngrok
docker compose logs -f ngrok
```

Copy the line that looks like `tcp://8.tcp.ngrok.io:13824`. Players type **`8.tcp.ngrok.io:13824`**. Drop `tcp://`. The public port is almost never `25565`.

Stop the tunnel without touching Fabric:

```bash
docker compose --profile ngrok stop ngrok
```

**B. Host agent** (no Compose service):

```bash
# https://ngrok.com/download
ngrok config add-authtoken "$NGROK_AUTHTOKEN"
ngrok tcp 25565
```

Same share rule: drop `tcp://`.

**C. One-shot Docker, not in Compose:**

```bash
docker run --rm --network host -e NGROK_AUTHTOKEN -it ngrok/ngrok:latest tcp 25565
```

### What it does here

- **Can** publish Java edition join to host port `25565`.
- **Cannot** publish Simple Voice Chat. ngrok has no UDP tunnel. Leave `VOICE_HOST` unset for muted play, or set `VOICE_HOST` to a **different** reachable UDP path (home forward, IPv6, playit UDP, or a VPN). Never set `VOICE_HOST` to the ngrok TCP hostname.

### Free-plan limits (as of ngrok’s current docs)

- TCP endpoints require a card on file. ngrok says the card is not charged on the free plan.
- The public `host:port` is **random**. Restart the agent and you must send players a new line.
- About **1 GB / month** data transfer out and **5,000 TCP connections / month**. Minecraft can burn the bandwidth cap in a few sessions. After that, players disconnect immediately.
- A reserved TCP address is a paid add-on, not free.

If you also opened home UDP `24454`, set `VOICE_HOST` to the **WAN IPv4** (or playit UDP host:port), then recreate Fabric. If you did not, voice will not work.

Do not point Cloudflare at Minecraft. The existing HTTP tunnel cannot carry TCP `25565` or UDP `24454`. Paid Cloudflare Spectrum can carry TCP join only; voice is still a separate UDP problem.

## Public VPS (EC2)

Same two ports on the instance firewall and security group: TCP `25565`, UDP `24454`. Set `VOICE_HOST` to the instance public IPv4. Steps: [INSTALLATION.md](INSTALLATION.md) section 5.

## What a player does

See [KID.md](KID.md). Install the jars, Multiplayer, paste the public `hostname:port`. Bind push-to-talk. **V** is the Simple Voice Chat settings menu, not transmit.
